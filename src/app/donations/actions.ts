
'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, DonationCategory } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

export async function syncDonationsAction(): Promise<{ success: boolean; message: string; updatedCount: number; }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, updatedCount: 0 };
    }
    
    try {
        const batch = adminDb.batch();
        let updatedCount = 0;
        
        const donationsRef = adminDb.collection('donations');
        const donationsSnap = await donationsRef.get();
        
        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as any; 
            
            if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
                
                const newLinkSplit = [{
                    linkId: donation.campaignId,
                    linkName: donation.campaignName || 'Unknown Campaign',
                    linkType: 'campaign' as const,
                    amount: donation.amount
                }];
                
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
        return { success: true, message: `Sync Complete. Updated ${updatedCount} Legacy Records.`, updatedCount };

    } catch (error: any) {
        console.error("Error syncing donations:", error);
        return { success: false, message: `Sync Failed: ${error.message}`, updatedCount: 0 };
    }
}

export async function bulkUpdateDonationStatusAction(
    ids: string[],
    newStatus: Donation['status']
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const CHUNK_SIZE = 450;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();
            for (const id of chunk) {
                const ref = adminDb.collection('donations').doc(id);
                batch.update(ref, { status: newStatus });
            }
            await batch.commit();
        }
        revalidatePath('/donations');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');
        return { success: true, message: `Successfully Updated ${ids.length} Donations To ${newStatus}.` };
    } catch (error: any) {
        console.error("Bulk Donation Update Failed:", error);
        return { success: false, message: `Bulk Update Failed: ${error.message}` };
    }
}

export async function bulkImportDonationsAction(
    records: Partial<Donation>[], 
    uploadedBy: {id: string, name: string},
    initiativeContext?: { type: 'campaign' | 'lead', id: string, name: string }
): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const batch = adminDb.batch();
        let count = 0;

        for (const record of records) {
            const docRef = record.id ? adminDb.collection('donations').doc(record.id) : adminDb.collection('donations').doc();
            const id = docRef.id;
            
            const donationData = {
                ...record,
                id,
                donorName: record.donorName || 'Anonymous Donor',
                donorPhone: record.donorPhone || '',
                amount: record.amount || 0,
                donationDate: record.donationDate || new Date().toISOString().split('T')[0],
                status: record.status || 'Verified',
                donationType: record.donationType || 'Other',
                referral: record.referral || '',
                uploadedBy: uploadedBy.name,
                uploadedById: uploadedBy.id,
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            // If initiative context is provided, ensure it's in the linkSplit
            if (initiativeContext) {
                const currentLinks = (record.linkSplit || []) as any[];
                const exists = currentLinks.some(l => l.linkId === initiativeContext.id);
                
                if (!exists) {
                    const newLink = {
                        linkId: initiativeContext.id,
                        linkName: initiativeContext.name,
                        linkType: initiativeContext.type,
                        amount: record.amount || 0
                    };
                    (donationData as any).linkSplit = [...currentLinks, newLink];
                }
            }

            batch.set(docRef, donationData, { merge: true });
            count++;
        }

        await batch.commit();
        revalidatePath('/donations');
        if (initiativeContext) {
            const basePath = initiativeContext.type === 'campaign' ? 'campaign-members' : 'leads-members';
            revalidatePath(`/${basePath}/${initiativeContext.id}/donations`);
        }
        
        return { success: true, message: `Successfully Synchronized ${count} Donation Records.`, count };
    } catch (error: any) {
        console.error("Bulk Donation Import Failed:", error);
        return { success: false, message: `Import Failed: ${error.message}`, count: 0 };
    }
}

export async function deleteDonationAction(donationId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        const docRef = adminDb.collection('donations').doc(donationId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return { success: false, message: 'Donation Not Found.' };
        }

        const donationData = docSnap.data();
        const screenshotUrls: string[] = (donationData?.transactions || [])
            .map((t: any) => t.screenshotUrl)
            .filter(Boolean);
        
        if (screenshotUrls.length > 0) {
            const bucket = adminStorage.bucket();
            const deletePromises = screenshotUrls.map(url => {
                try {
                    const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
                    return bucket.file(path).delete().catch((err: any) => {
                         if (err.code !== 404) { 
                             console.warn(`Failed To Delete Screenshot ${path}:`, err.message);
                         }
                    });
                } catch (e: any) {
                    console.warn(`Could Not Parse Screenshot URL To Delete: ${url}`);
                    return Promise.resolve();
                }
            });
            await Promise.all(deletePromises);
        }

        await docRef.delete();

        revalidatePath('/donations');
        return { success: true, message: 'Donation Permanently Deleted.' };

    } catch (error: any) {
        console.error('Error Deleting Donation:', error);
        return { success: false, message: `Failed To Delete Donation: ${error.message}` };
    }
}
