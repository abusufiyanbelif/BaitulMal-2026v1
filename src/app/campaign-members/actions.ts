
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Campaign } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

interface CopyCampaignOptions {
  sourceCampaignId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyDonations: boolean;
  copyRationLists: boolean;
}

export async function copyCampaignAction(options: CopyCampaignOptions): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    
    const { sourceCampaignId, newName, copyBeneficiaries, copyRationLists } = options;

    try {
        await adminDb.runTransaction(async (transaction) => {
            const sourceCampaignRef = adminDb.collection('campaigns').doc(sourceCampaignId);
            const sourceCampaignSnap = await transaction.get(sourceCampaignRef);
            if (!sourceCampaignSnap.exists) {
                throw new Error('Source campaign not found.');
            }
            
            const sourceData = sourceCampaignSnap.data() as Campaign;
            
            const newCampaignRef = adminDb.collection('campaigns').doc();
            const newCampaignData: Partial<Campaign> = {
                ...sourceData,
                name: newName,
                status: 'Upcoming',
                createdAt: FieldValue.serverTimestamp() as any,
                // Reset financial data
                targetAmount: 0, 
            };
            if (!copyRationLists) {
                newCampaignData.itemCategories = [];
            }
            
            transaction.set(newCampaignRef, newCampaignData);

            if (copyBeneficiaries) {
                const beneficiariesSnap = await adminDb.collection(`campaigns/${sourceCampaignId}/beneficiaries`).get();
                beneficiariesSnap.forEach(benDoc => {
                    const newBeneficiaryRef = adminDb.collection(`campaigns/${newCampaignRef.id}/beneficiaries`).doc(benDoc.id);
                    transaction.set(newBeneficiaryRef, benDoc.data());
                });
            }
        });
        
        revalidatePath('/campaign-members');
        return { success: true, message: `Successfully copied campaign to '${newName}'.` };

    } catch (error: any) {
        console.error('Error copying campaign:', error);
        return { success: false, message: `Failed to copy campaign: ${error.message}` };
    }
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    
    try {
        const batch = adminDb.batch();
        const campaignRef = adminDb.collection('campaigns').doc(campaignId);
        
        // Delete all files in the campaign's storage folder
        const bucket = adminStorage.bucket();
        const prefix = `campaigns/${campaignId}/`;
        await bucket.deleteFiles({ prefix });

        // Delete all documents in the beneficiaries subcollection
        const beneficiariesSnap = await adminDb.collection(`campaigns/${campaignId}/beneficiaries`).get();
        beneficiariesSnap.forEach(doc => batch.delete(doc.ref));

        batch.delete(campaignRef);
        
        await batch.commit();

        revalidatePath('/campaign-members');
        return { success: true, message: 'Campaign and all its associated data and files deleted successfully.' };

    } catch (error: any) {
        console.error('Error deleting campaign:', error);
        return { success: false, message: `Failed to delete campaign: ${error.message}` };
    }
}

export async function recalculateCampaignGoalAction(campaignId: string): Promise<{ success: boolean; message: string; newTotal?: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const beneficiariesSnap = await adminDb.collection(`campaigns/${campaignId}/beneficiaries`).get();
        let total = 0;
        beneficiariesSnap.forEach(doc => {
            const data = doc.data();
            total += (Number(data.kitAmount) || 0);
        });

        await adminDb.collection('campaigns').doc(campaignId).update({
            targetAmount: total,
            updatedAt: FieldValue.serverTimestamp()
        });

        revalidatePath(`/campaign-members/${campaignId}/summary`);
        revalidatePath(`/campaign-public/${campaignId}/summary`);
        
        return { success: true, message: `Goal Recalculated: ₹${total.toLocaleString('en-IN')}`, newTotal: total };
    } catch (error: any) {
        console.error('Recalculate Failed:', error);
        return { success: false, message: error.message };
    }
}
