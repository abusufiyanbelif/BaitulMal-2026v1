
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { collection, doc, writeBatch, serverTimestamp, runTransaction, getDocs } from 'firebase-admin/firestore';

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
        await runTransaction(adminDb, async (transaction) => {
            const sourceLeadRef = doc(adminDb, 'leads', sourceLeadId);
            const sourceLeadSnap = await transaction.get(sourceLeadRef);
            if (!sourceLeadSnap.exists()) {
                throw new Error('Source lead not found.');
            }
            
            const sourceData = sourceLeadSnap.data() as Lead;
            
            const newLeadRef = doc(collection(adminDb, 'leads'));
            const newLeadData: Partial<Lead> = {
                ...sourceData,
                name: newName,
                status: 'Upcoming',
                createdAt: serverTimestamp(),
                targetAmount: 0, 
            };

            if (!copyRationLists) {
                newLeadData.itemCategories = [];
            }
            
            transaction.set(newLeadRef, newLeadData);

            if (copyBeneficiaries) {
                const beneficiariesSnap = await getDocs(collection(adminDb, `leads/${sourceLeadId}/beneficiaries`));
                beneficiariesSnap.forEach(benDoc => {
                    const newBeneficiaryRef = doc(adminDb, `leads/${newLeadRef.id}/beneficiaries`, benDoc.id);
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
        const batch = writeBatch(adminDb);
        const leadRef = doc(adminDb, 'leads', leadId);

        // Delete all files in the lead's storage folder
        const bucket = adminStorage.bucket();
        const prefix = `leads/${leadId}/`;
        await bucket.deleteFiles({ prefix });
        
        const beneficiariesSnap = await getDocs(collection(adminDb, `leads/${leadId}/beneficiaries`));
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
