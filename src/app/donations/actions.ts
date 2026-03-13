'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, Donor } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. Please ensure server credentials are configured.";

/**
 * Robust action to save or update a donation while handling donor identity linking.
 * Handles auto-syncing of historical donations for the same donor identity.
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
        const donorPhone = donationData.donorPhone;

        // --- 1. Identity Resolution Logic (Auto-Discovery) ---
        // If we don't have an ID but have a phone, try to find an existing donor
        if (!finalDonorId && donorPhone && donorPhone.length >= 10) {
            const donorsCol = adminDb.collection('donors');
            const foundDonorSnap = await donorsCol.where('phone', '==', donorPhone).limit(1).get();

            if (!foundDonorSnap.empty) {
                finalDonorId = foundDonorSnap.docs[0].id;
            } else {
                // Auto-create donor profile if phone is provided but no profile exists
                const newDonorRef = donorsCol.doc();
                const newDonor: Partial<Donor> = {
                    id: newDonorRef.id,
                    name: donationData.donorName || 'Anonymous Donor',
                    phone: donorPhone,
                    status: 'Active',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: uploadedBy.id,
                    createdByName: uploadedBy.name,
                    notes: `Profile automatically established from donation entry.`,
                };
                await newDonorRef.set(newDonor);
                finalDonorId = newDonorRef.id;
            }
        }

        // --- 2. Save Current Donation ---
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

        // --- 3. Ripple Effect: Sync other donations for this donor ---
        // If we identified a donor, find all other unlinked donations with this phone number and link them
        if (finalDonorId && donorPhone) {
            const unlinkedQuery = adminDb.collection('donations')
                .where('donorPhone', '==', donorPhone)
                .where('donorId', '==', null);
            
            const unlinkedSnap = await unlinkedQuery.get();
            if (!unlinkedSnap.empty) {
                const batch = adminDb.batch();
                unlinkedSnap.docs.forEach(d => {
                    batch.update(d.ref, { donorId: finalDonorId, updatedAt: FieldValue.serverTimestamp() });
                });
                await batch.commit();
            }
        }

        revalidatePath('/donations');
        revalidatePath('/donors');
        if (finalDonorId) revalidatePath(`/donors/${finalDonorId}`);
        revalidatePath('/', 'layout');
        
        return { success: true, message: 'Identity resolved and contribution secured.', id };
    } catch (error: any) {
        console.error("Upsert Donation Failed:", error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}

/**
 * Specifically used by the Resolver Hub to map a donation to a donor.
 * Handles the "Stitching" of a dummy record to a verified profile.
 */
export async function linkDonationToDonorAction(
    donationId: string,
    donorId: string,
    updatedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donationRef = adminDb.collection('donations').doc(donationId);
        const donorRef = adminDb.collection('donors').doc(donorId);
        
        const [donationSnap, donorSnap] = await Promise.all([donationRef.get(), donorRef.get()]);
        
        if (!donationSnap.exists) throw new Error("Donation record not found.");
        if (!donorSnap.exists) throw new Error("Donor profile not found.");

        const donationData = donationSnap.data() as Donation;

        // 1. Link this specific donation
        await donationRef.update({
            donorId: donorId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: updatedBy.name,
            updatedById: updatedBy.id
        });

        // 2. Ripple Effect: Link all other matching donations by phone or name
        // This is the "Intelligent Sync" part
        const identifier = donationData.donorPhone || donationData.donorName;
        const field = donationData.donorPhone ? 'donorPhone' : 'donorName';

        if (identifier) {
            const unlinkedQuery = adminDb.collection('donations')
                .where(field, '==', identifier)
                .where('donorId', '==', null);
            
            const unlinkedSnap = await unlinkedQuery.get();
            if (!unlinkedSnap.empty) {
                const batch = adminDb.batch();
                unlinkedSnap.docs.forEach(d => {
                    // Only update if it's actually unlinked
                    if (!d.data().donorId) {
                        batch.update(d.ref, { donorId: donorId, updatedAt: FieldValue.serverTimestamp() });
                    }
                });
                await batch.commit();
            }
        }

        revalidatePath('/donations');
        revalidatePath(`/donors/${donorId}`);
        revalidatePath('/donors');
        
        return { success: true, message: "Identities successfully consolidated across the registry." };
    } catch (error: any) {
        return { success: false, message: error.message };
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
                donorId: record.donorId || null, // Ensure field exists for Hub detection
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

/**
 * Migration utility to ensure all historical donations are detectable by the Hub.
 * It sets 'donorId: null' on records where the field is missing.
 */
export async function syncAllDonationsToDonorsAction(): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const donationsSnap = await adminDb.collection('donations').get();
        let count = 0;
        let preparedCount = 0;
        const batch = adminDb.batch();

        for (const docSnap of donationsSnap.docs) {
            const donation = docSnap.data() as Donation;
            
            // Logic 1: Prepare missing field for Hub detection
            if (donation.donorId === undefined) {
                batch.update(docSnap.ref, { donorId: null });
                preparedCount++;
            }

            // Logic 2: Auto-link by Phone if possible
            if (!donation.donorId && donation.donorPhone) {
                const donorQuery = await adminDb.collection('donors')
                    .where('phone', '==', donation.donorPhone)
                    .limit(1)
                    .get();

                if (!donorQuery.empty) {
                    const donorId = donorQuery.docs[0].id;
                    batch.update(docSnap.ref, { donorId });
                    count++;
                }
            }
        }

        if (count > 0 || preparedCount > 0) {
            await batch.commit();
        }

        revalidatePath('/donations');
        revalidatePath('/donors');
        return { 
            success: true, 
            message: `Registry prepared. Linked ${count} matching records and initialized ${preparedCount} legacy entries for manual resolution.`, 
            count 
        };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}