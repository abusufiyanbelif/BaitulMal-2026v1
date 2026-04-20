'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

interface CopyLeadOptions {
  sourceLeadId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyRationLists: boolean;
}

export async function copyLeadAction(options: CopyLeadOptions): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    
    const { sourceLeadId, newName, copyBeneficiaries, copyRationLists } = options;

    try {
        await adminDb.runTransaction(async (transaction) => {
            const sourceLeadRef = adminDb.collection('leads').doc(sourceLeadId);
            const sourceLeadSnap = await transaction.get(sourceLeadRef);
            if (!sourceLeadSnap.exists) {
                throw new Error('Source lead not found.');
            }
            
            const sourceData = sourceLeadSnap.data() as Lead;
            
            const newLeadRef = adminDb.collection('leads').doc();
            const newLeadData: Partial<Lead> = {
                ...sourceData,
                name: newName,
                status: 'Upcoming',
                publicVisibility: 'Hold',         // reset — not published yet
                authenticityStatus: 'Pending Verification', // reset
                targetAmount: 0,
                requiredAmount: 0,                // reset — recalculate after beneficiaries are added
                collectedAmount: 0,               // reset — no donations yet
                createdAt: FieldValue.serverTimestamp() as any,
                updatedAt: FieldValue.serverTimestamp() as any,
                createdById: null,
                createdByName: null,
                leadNumber: null,            // will be assigned on save if needed
            };

            // Strip runtime-only fields that should not be carried over
            delete (newLeadData as any).id;
            delete (newLeadData as any).createdById;
            delete (newLeadData as any).createdByName;
            delete (newLeadData as any).leadNumber;

            if (!copyRationLists) {
                newLeadData.itemCategories = [];
            }
            
            transaction.set(newLeadRef, newLeadData);

            if (copyBeneficiaries) {
                const beneficiariesSnap = await adminDb.collection(`leads/${sourceLeadId}/beneficiaries`).get();
                beneficiariesSnap.forEach(benDoc => {
                    const newBeneficiaryRef = adminDb.collection(`leads/${newLeadRef.id}/beneficiaries`).doc(benDoc.id);
                    transaction.set(newBeneficiaryRef, benDoc.data());
                });
            }
        });
        
        revalidatePath('/leads-members');
        return { success: true, message: `Successfully copied lead to '${newName}'.` };

    } catch (error: any) {
        console.error('Error copying lead:', error);
        return { success: false, message: `Failed to copy lead: ${error.message}` };
    }
}

export async function deleteLeadAction(leadId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    
    try {
        const batch = adminDb.batch();
        const leadRef = adminDb.collection('leads').doc(leadId);

        // Delete all files in the lead's storage folder
        const bucket = adminStorage.bucket();
        const prefix = `leads/${leadId}/`;
        await bucket.deleteFiles({ prefix });
        
        const beneficiariesSnap = await adminDb.collection(`leads/${leadId}/beneficiaries`).get();
        beneficiariesSnap.forEach(doc => batch.delete(doc.ref));

        batch.delete(leadRef);
        
        await batch.commit();

        revalidatePath('/leads-members');
        return { success: true, message: 'Lead and its associated data and files deleted successfully.' };

    } catch (error: any) {
        console.error('Error deleting lead:', error);
        return { success: false, message: `Failed to delete lead: ${error.message}` };
    }
}

export async function recalculateLeadGoalAction(leadId: string): Promise<{ success: boolean; message: string; newTotal?: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const beneficiariesSnap = await adminDb.collection(`leads/${leadId}/beneficiaries`).get();
        let total = 0;
        beneficiariesSnap.forEach(doc => {
            const data = doc.data();
            total += (Number(data.kitAmount) || 0);
        });

        await adminDb.collection('leads').doc(leadId).update({
            targetAmount: total,
            requiredAmount: total,
            updatedAt: FieldValue.serverTimestamp()
        });

        revalidatePath(`/leads-members/${leadId}/summary`);
        revalidatePath(`/leads-public/${leadId}/summary`);
        
        return { success: true, message: `Goal Recalculated: ₹${total.toLocaleString('en-IN')}`, newTotal: total };
    } catch (error: any) {
        console.error('Recalculate Failed:', error);
        return { success: false, message: error.message };
    }
}