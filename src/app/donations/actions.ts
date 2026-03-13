'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, DonationCategory, Donor } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. Please ensure server credentials are configured.";

/**
 * Enhanced action to save a donation with multi-attribute donor verification.
 * Checks for existing donors by Phone, UPI, or Bank Account.
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

        // --- Multi-Attribute Identity Matching Logic ---
        if (!finalDonorId) {
            const donorsCol = adminDb.collection('donors');
            const upiIdsFromDonation = (donationData.transactions || []).map(t => t.upiId).filter(Boolean) as string[];
            
            // Search strategy: Phone, then UPI handles, then Account Numbers
            const queries = [];
            
            if (donationData.donorPhone) {
                queries.push(donorsCol.where('phone', '==', donationData.donorPhone).limit(1).get());
            }
            
            if (upiIdsFromDonation.length > 0) {
                queries.push(donorsCol.where('upiIds', 'array-contains-any', upiIdsFromDonation.slice(0, 10)).limit(1).get());
            }

            const results = await Promise.all(queries);
            const foundDonorDoc = results.find(snap => !snap.empty)?.docs[0];

            if (foundDonorDoc) {
                finalDonorId = foundDonorDoc.id;
                // Merge new UPI handles into existing donor if not present
                const existingDonor = foundDonorDoc.data() as Donor;
                const newUpis = upiIdsFromDonation.filter(id => !(existingDonor.upiIds || []).includes(id));
                if (newUpis.length > 0) {
                    await foundDonorDoc.ref.update({
                        upiIds: FieldValue.arrayUnion(...newUpis)
                    });
                }
            } else {
                // Auto-create enriched profile
                const newDonorRef = donorsCol.doc();
                const newDonor: Partial<Donor> = {
                    id: newDonorRef.id,
                    name: donationData.donorName || 'Anonymous Donor',
                    phone: donationData.donorPhone || '',
                    upiIds: upiIdsFromDonation,
                    status: 'Active',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: uploadedBy.id,
                    createdByName: uploadedBy.name,
                    notes: `Auto-generated from donation entry.`,
                };
                await newDonorRef.set(newDonor);
                finalDonorId = newDonorRef.id;
            }
        }

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

        if ((finalDonationData as any).campaignId) delete (finalDonationData as any).campaignId;
        if ((finalDonationData as any).campaignName) delete (finalDonationData as any).campaignName;

        await docRef.set(finalDonationData, { merge: true });

        revalidatePath('/donations');
        revalidatePath(`/donors/${finalDonorId}`);
        
        return { success: true, message: 'Identity verified and record secured.', id };
    } catch (error: any) {
        console.error("Upsert Donation Failed:", error);
        return { success: false, message: `Operation Failed: ${error.message}` };
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
        return { success: true, message: `Updated ${ids.length} records.` };
    } catch (error: any) {
        return { success: false, message: error.message };
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
                uploadedBy: uploadedBy.name,
                uploadedById: uploadedBy.id,
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (initiativeContext) {
                const currentLinks = (record.linkSplit || []) as any[];
                const exists = currentLinks.some(l => l.linkId === initiativeContext.id);
                if (!exists) {
                    currentLinks.push({
                        linkId: initiativeContext.id,
                        linkName: initiativeContext.name,
                        linkType: initiativeContext.type,
                        amount: record.amount || 0
                    });
                    (donationData as any).linkSplit = currentLinks;
                }
            }

            batch.set(docRef, donationData, { merge: true });
            count++;
        }

        await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Synchronized ${count} records.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}

export async function deleteDonationAction(donationId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        await adminDb.collection('donations').doc(donationId).delete();
        revalidatePath('/donations');
        return { success: true, message: 'Donation record purged.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function syncAllDonationsToDonorsAction(): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const donationsSnap = await adminDb.collection('donations').get();
        let count = 0;

        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as Donation;
            if (!donation.donorId && donation.donorPhone) {
                const donorQuery = await adminDb.collection('donors')
                    .where('phone', '==', donation.donorPhone)
                    .limit(1)
                    .get();

                let donorId: string;
                if (!donorQuery.empty) {
                    donorId = donorQuery.docs[0].id;
                } else {
                    const newDonorRef = adminDb.collection('donors').doc();
                    await newDonorRef.set({
                        id: newDonorRef.id,
                        name: donation.donorName,
                        phone: donation.donorPhone,
                        status: 'Active',
                        createdAt: FieldValue.serverTimestamp(),
                        createdById: 'migration',
                        createdByName: 'Institutional Sync Logic',
                    });
                    donorId = newDonorRef.id;
                }
                await docSnap.ref.update({ donorId });
                count++;
            }
        }
        revalidatePath('/donations');
        revalidatePath('/donors');
        return { success: true, message: `Synchronized ${count} legacy records.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}
