'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, DonationCategory, Donor } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

/**
 * Robust action to save a donation and ensure a corresponding Donor Profile exists.
 * If no donorId is provided, it searches by phone and creates a profile if missing.
 */
export async function upsertDonationWithDonorAction(
    donationId: string | null,
    donationData: Partial<Donation>,
    uploadedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        let finalDonorId = donationData.donorId;

        // 1. If no donorId, try to find or create a donor profile by phone
        if (!finalDonorId && donationData.donorPhone) {
            const donorQuery = await adminDb.collection('donors')
                .where('phone', '==', donationData.donorPhone)
                .limit(1)
                .get();

            if (!donorQuery.empty) {
                finalDonorId = donorQuery.docs[0].id;
            } else {
                // Create a new Donor Profile automatically
                const newDonorRef = adminDb.collection('donors').doc();
                const newDonor: Partial<Donor> = {
                    id: newDonorRef.id,
                    name: donationData.donorName || 'Anonymous Donor',
                    phone: donationData.donorPhone,
                    status: 'Active',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: uploadedBy.id,
                    createdByName: uploadedBy.name,
                };
                await newDonorRef.set(newDonor);
                finalDonorId = newDonorRef.id;
            }
        }

        // 2. Prepare Donation Object
        const docRef = donationId ? adminDb.collection('donations').doc(donationId) : adminDb.collection('donations').doc();
        const id = docRef.id;

        const finalDonationData = {
            ...donationData,
            id,
            donorId: finalDonorId || null,
            uploadedBy: uploadedBy.name,
            uploadedById: uploadedBy.id,
            updatedAt: FieldValue.serverTimestamp(),
            ...( !donationId && { createdAt: FieldValue.serverTimestamp() } ),
        };

        // Remove legacy fields if they exist
        if ((finalDonationData as any).campaignId) delete (finalDonationData as any).campaignId;
        if ((finalDonationData as any).campaignName) delete (finalDonationData as any).campaignName;

        await docRef.set(finalDonationData, { merge: true });

        revalidatePath('/donations');
        if (finalDonorId) revalidatePath(`/donors/${finalDonorId}`);
        
        return { success: true, message: 'Donation record and donor profile synchronized.', id };
    } catch (error: any) {
        console.error("Upsert Donation Failed:", error);
        return { success: false, message: `Operation Failed: ${error.message}` };
    }
}

/**
 * Migration utility to link all existing donations to (newly created) donor profiles.
 * Matches by phone number to consolidate historical data.
 */
export async function syncAllDonationsToDonorsAction(): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const donationsSnap = await adminDb.collection('donations').get();
        let count = 0;

        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as Donation;
            
            // Only process if donorId is missing but phone is present
            if (!donation.donorId && donation.donorPhone) {
                // Check if donor profile exists
                const donorQuery = await adminDb.collection('donors')
                    .where('phone', '==', donation.donorPhone)
                    .limit(1)
                    .get();

                let donorId: string;
                if (!donorQuery.empty) {
                    donorId = donorQuery.docs[0].id;
                } else {
                    // Create new profile for this historical donor
                    const newDonorRef = adminDb.collection('donors').doc();
                    await newDonorRef.set({
                        id: newDonorRef.id,
                        name: donation.donorName,
                        phone: donation.donorPhone,
                        status: 'Active',
                        createdAt: FieldValue.serverTimestamp(),
                        createdById: 'migration',
                        createdByName: 'System Link Logic',
                    });
                    donorId = newDonorRef.id;
                }

                // Link the donation
                await docSnap.ref.update({ donorId });
                count++;
            }
        }

        revalidatePath('/donations');
        revalidatePath('/donors');
        return { success: true, message: `Successfully synchronized ${count} legacy records.`, count };
    } catch (error: any) {
        console.error("Historical Sync Failed:", error);
        return { success: false, message: `Sync Failed: ${error.message}`, count: 0 };
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
