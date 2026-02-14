
'use server';

import { adminDb } from '@/lib/firebase-admin-sdk';
import type { Campaign, Beneficiary, Donation } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { collection, getDocs, doc, writeBatch, serverTimestamp, runTransaction } from 'firebase-admin/firestore';

interface CopyCampaignOptions {
  sourceCampaignId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyDonations: boolean;
  copyRationLists: boolean;
}

export async function copyCampaignAction(options: CopyCampaignOptions): Promise<{ success: boolean; message: string }> {
    if (!adminDb) {
        return { success: false, message: 'Database service not available.' };
    }
    
    const { sourceCampaignId, newName, copyBeneficiaries, copyDonations, copyRationLists } = options;

    try {
        await runTransaction(adminDb, async (transaction) => {
            const sourceCampaignRef = doc(adminDb, 'campaigns', sourceCampaignId);
            const sourceCampaignSnap = await transaction.get(sourceCampaignRef);
            if (!sourceCampaignSnap.exists()) {
                throw new Error('Source campaign not found.');
            }
            
            const sourceData = sourceCampaignSnap.data() as Campaign;
            
            const newCampaignRef = doc(collection(adminDb, 'campaigns'));
            const newCampaignData: Partial<Campaign> = {
                ...sourceData,
                name: newName,
                status: 'Upcoming',
                createdAt: serverTimestamp(),
                // Reset financial data
                targetAmount: 0, 
            };
            if (!copyRationLists) {
                newCampaignData.itemCategories = [];
            }
            
            transaction.set(newCampaignRef, newCampaignData);

            if (copyBeneficiaries) {
                const beneficiariesSnap = await getDocs(collection(adminDb, `campaigns/${sourceCampaignId}/beneficiaries`));
                beneficiariesSnap.forEach(benDoc => {
                    const newBeneficiaryRef = doc(adminDb, `campaigns/${newCampaignRef.id}/beneficiaries`, benDoc.id);
                    transaction.set(newBeneficiaryRef, benDoc.data());
                });
            }

            if (copyDonations) {
                const donationsSnap = await getDocs(collection(adminDb, `campaigns/${sourceCampaignId}/donations`));
                donationsSnap.forEach(donDoc => {
                    const newDonationRef = doc(collection(adminDb, `campaigns/${newCampaignRef.id}/donations`));
                    transaction.set(newDonationRef, donDoc.data());
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
    if (!adminDb) {
        return { success: false, message: 'Database service not available.' };
    }
    
    try {
        const batch = writeBatch(adminDb);
        const campaignRef = doc(adminDb, 'campaigns', campaignId);
        
        // Note: For a production app, deleting subcollections requires a more robust solution
        // like a Firebase Function, as client-side/server-action deletes can be slow and timeout.
        // This is a simplified version for demonstration.
        
        const beneficiariesSnap = await getDocs(collection(adminDb, `campaigns/${campaignId}/beneficiaries`));
        beneficiariesSnap.forEach(doc => batch.delete(doc.ref));
        
        const donationsSnap = await getDocs(collection(adminDb, `campaigns/${campaignId}/donations`));
        donationsSnap.forEach(doc => batch.delete(doc.ref));

        batch.delete(campaignRef);
        
        await batch.commit();

        revalidatePath('/campaign-members');
        return { success: true, message: 'Campaign and its associated data deleted successfully.' };

    } catch (error: any) {
        console.error('Error deleting campaign:', error);
        return { success: false, message: `Failed to delete campaign: ${error.message}` };
    }
}
