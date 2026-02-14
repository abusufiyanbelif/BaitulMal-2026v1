
'use server';
import { adminDb } from '@/lib/firebase-admin-sdk';
import type { Donation, DonationCategory } from '@/lib/types';
import { collection, getDocs, writeBatch } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

export async function syncDonationsAction(): Promise<{ success: boolean; message: string; updatedCount: number; }> {
    if (!adminDb) {
        return { success: false, message: "Database service is not initialized.", updatedCount: 0 };
    }
    
    try {
        const batch = writeBatch(adminDb);
        let updatedCount = 0;
        
        const donationsRef = collection(adminDb, 'donations');
        const donationsSnap = await getDocs(donationsRef);
        
        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as Donation;
            
            // Check if this is a legacy donation that needs updating
            if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
                
                const newLinkSplit = [{
                    linkId: donation.campaignId,
                    linkName: donation.campaignName || 'Unknown Campaign',
                    linkType: 'campaign' as const,
                    amount: donation.amount
                }];
                
                batch.update(docSnap.ref, { 
                    linkSplit: newLinkSplit,
                    // Optionally remove old fields if desired
                    // campaignId: deleteField(),
                    // campaignName: deleteField()
                });
                updatedCount++;
            }
        }
        
        if (updatedCount > 0) {
            await batch.commit();
        }

        revalidatePath('/donations');
        return { success: true, message: `Sync complete. Updated ${updatedCount} legacy donation records.`, updatedCount };

    } catch (error: any) {
        console.error("Error syncing donations:", error);
        return { success: false, message: `Sync failed: ${error.message}`, updatedCount: 0 };
    }
}
