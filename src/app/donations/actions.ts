
'use server';

import { adminDb } from '@/lib/firebase-admin-sdk';
import type { Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';

export async function syncDonationsAction(): Promise<{ success: boolean; message: string; updatedCount: number; }> {
    if (!adminDb) {
        const errorMessage = 'Firebase Admin SDK is not initialized. Sync cannot proceed.';
        console.error(errorMessage);
        return { success: false, message: errorMessage, updatedCount: 0 };
    }

    try {
        const donationsRef = adminDb.collection('donations');
        const snapshot = await donationsRef.get();

        if (snapshot.empty) {
            return { success: true, message: 'No donations found to sync.', updatedCount: 0 };
        }

        const batch = adminDb.batch();
        let updatedCount = 0;

        for (const doc of snapshot.docs) {
            const donation = doc.data() as Donation;
            let needsUpdate = false;
            const updatePayload: any = {};

            // 1. Migrate `type` to `typeSplit`
            if (!donation.typeSplit || donation.typeSplit.length === 0) {
                let category: DonationCategory = 'Sadaqah'; // Default to Sadaqah
                if (donation.type) {
                    if (donation.type === 'General' || (donation.type as any) === 'Sadqa') {
                        category = 'Sadaqah';
                    } else if (donationCategories.includes(donation.type as DonationCategory)) {
                        category = donation.type as DonationCategory;
                    }
                }
                updatePayload.typeSplit = [{ category, amount: donation.amount }];
                updatePayload.type = admin.firestore.FieldValue.delete(); // Mark for deletion
                needsUpdate = true;
            } 
            else if (donation.typeSplit.some(s => (s.category as any) === 'Sadqa')) {
                 updatePayload.typeSplit = donation.typeSplit.map(split => {
                    if ((split.category as any) === 'Sadqa') {
                        return { ...split, category: 'Sadaqah' };
                    }
                    return split;
                });
                needsUpdate = true;
            }

            // 2. Migrate `campaignId` to `linkSplit`
            if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
                updatePayload.linkSplit = [{
                    linkId: donation.campaignId,
                    linkName: donation.campaignName || 'Unknown Campaign',
                    linkType: 'campaign',
                    amount: donation.amount,
                }];
                updatePayload.campaignId = admin.firestore.FieldValue.delete();
                updatePayload.campaignName = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }
            
            // 3. Migrate single transaction fields to `transactions` array
            if ((!donation.transactions || donation.transactions.length === 0) && 'transactionId' in donation) {
                updatePayload.transactions = [{
                    id: `tx_${Date.now()}`,
                    amount: donation.amount,
                    transactionId: donation.transactionId || '',
                    screenshotUrl: donation.screenshotUrl || '',
                    screenshotIsPublic: donation.screenshotIsPublic || false,
                }];
                if ('transactionId' in donation) updatePayload.transactionId = admin.firestore.FieldValue.delete();
                if ('screenshotUrl' in donation) updatePayload.screenshotUrl = admin.firestore.FieldValue.delete();
                if ('screenshotIsPublic' in donation) updatePayload.screenshotIsPublic = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, updatePayload);
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            await batch.commit();
            // Revalidate paths to ensure data freshness
            revalidatePath('/donations', 'layout');
            revalidatePath('/campaign-members', 'layout');
            revalidatePath('/leads-members', 'layout');
            return { success: true, message: `Successfully synced ${updatedCount} donation records to the new data format.`, updatedCount };
        }

        return { success: true, message: 'All donation records are already up to date.', updatedCount: 0 };

    } catch (error: any) {
        console.error('Error in syncDonationsAction:', error);
        return { success: false, message: `An unexpected error occurred during sync: ${error.message}`, updatedCount: 0 };
    }
}
