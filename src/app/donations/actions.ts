
'use server';

import { adminDb } from '@/lib/firebase-admin-sdk';
import type { Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { revalidatePath } from 'next/cache';

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

            // Logic to migrate from old 'type' field to 'typeSplit'
            if (!donation.typeSplit || donation.typeSplit.length === 0) {
                let category: DonationCategory = 'Sadaqah'; // Default to Sadaqah

                if (donation.type) {
                    if (donation.type === 'General' || (donation.type as any) === 'Sadqa') {
                        category = 'Sadaqah';
                    } else if (donationCategories.includes(donation.type as DonationCategory)) {
                        category = donation.type as DonationCategory;
                    }
                }
                
                updatePayload.typeSplit = [{
                    category: category,
                    amount: donation.amount
                }];
                needsUpdate = true;
            } 
            // Logic to update existing 'Sadqa' entries in typeSplit
            else if (donation.typeSplit.some(s => (s.category as any) === 'Sadqa')) {
                 updatePayload.typeSplit = donation.typeSplit.map(split => {
                    if ((split.category as any) === 'Sadqa') {
                        return { ...split, category: 'Sadaqah' };
                    }
                    return split;
                });
                needsUpdate = true;
            }

            // Logic to migrate from old campaignId to new linkSplit
            if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
                updatePayload.linkSplit = [{
                    linkId: donation.campaignId,
                    linkName: donation.campaignName || 'Unknown',
                    linkType: 'campaign', // Assume old links were to campaigns
                    amount: donation.amount,
                }];
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
