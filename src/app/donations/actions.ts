
'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

export async function syncDonationsAction(): Promise<{ success: boolean; message: string; updatedCount: number; }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: "Database service is not initialized.", updatedCount: 0 };
    }
    
    try {
        const batch = adminDb.batch();
        let updatedCount = 0;
        
        const donationsRef = adminDb.collection('donations');
        const donationsSnap = await donationsRef.get();
        
        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as any; // Use any to access legacy fields
            
            // Check if this is a legacy donation that needs updating
            if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
                
                const newLinkSplit = [{
                    linkId: donation.campaignId,
                    linkName: donation.campaignName || 'Unknown Campaign',
                    linkType: 'campaign' as const,
                    amount: donation.amount
                }];
                
                // We cannot use deleteField in client-side code, but it's fine in server actions
                batch.update(docSnap.ref, { 
                    linkSplit: newLinkSplit,
                    campaignId: FieldValue.delete(),
                    campaignName: FieldValue.delete()
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

export async function deleteDonationAction(donationId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        return { success: false, message: 'Database or Storage service is not initialized.' };
    }
    try {
        const docRef = adminDb.collection('donations').doc(donationId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return { success: false, message: 'Donation not found.' };
        }

        const donationData = docSnap.data();
        const screenshotUrls: string[] = (donationData?.transactions || [])
            .map((t: any) => t.screenshotUrl)
            .filter(Boolean);
        
        // Delete screenshots from storage
        if (screenshotUrls.length > 0) {
            const bucket = adminStorage.bucket();
            const deletePromises = screenshotUrls.map(url => {
                // Extract path from URL: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
                try {
                    const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
                    return bucket.file(path).delete().catch((err: any) => {
                         if (err.code !== 404) { // 404 is "Not Found", which is fine.
                             console.warn(`Failed to delete screenshot ${path}:`, err.message);
                         }
                    });
                } catch (e: any) {
                    console.warn(`Could not parse screenshot URL to delete: ${url}`);
                    return Promise.resolve();
                }
            });
            await Promise.all(deletePromises);
        }

        // Delete Firestore document
        await docRef.delete();

        revalidatePath('/donations');
        return { success: true, message: 'Donation permanently deleted.' };

    } catch (error: any) {
        console.error('Error deleting donation:', error);
        return { success: false, message: `Failed to delete donation: ${error.message}` };
    }
}

    
