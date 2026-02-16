
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

interface CopyLeadOptions {
  sourceLeadId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyRationLists: boolean;
}

export async function copyLeadAction(options: CopyLeadOptions): Promise<{ success: boolean; message: string }> {
    if (!adminDb) {
        return { success: false, message: 'Database service not available.' };
    }
    
    const { sourceLeadId, newName, copyBeneficiaries, copyRationLists } = options;

    try {
        await adminDb!.runTransaction(async (transaction) => {
            const sourceLeadRef = adminDb!.collection('leads').doc(sourceLeadId);
            const sourceLeadSnap = await transaction.get(sourceLeadRef);
            if (!sourceLeadSnap.exists) {
                throw new Error('Source lead not found.');
            }
            
            const sourceData = sourceLeadSnap.data() as Lead;
            
            const newLeadRef = adminDb!.collection('leads').doc();
            const newLeadData: Partial<Lead> = {
                ...sourceData,
                name: newName,
                status: 'Upcoming',
                createdAt: FieldValue.serverTimestamp() as any,
                targetAmount: 0, 
            };

            if (!copyRationLists) {
                newLeadData.itemCategories = [];
            }
            
            transaction.set(newLeadRef, newLeadData);

            if (copyBeneficiaries) {
                const beneficiariesSnap = await adminDb!.collection(`leads/${sourceLeadId}/beneficiaries`).get();
                beneficiariesSnap.forEach(benDoc => {
                    const newBeneficiaryRef = adminDb!.collection(`leads/${newLeadRef.id}/beneficiaries`).doc(benDoc.id);
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
    if (!adminDb || !adminStorage) {
        return { success: false, message: 'Database or Storage service is not initialized.' };
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
