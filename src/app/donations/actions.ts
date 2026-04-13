
'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, Donor } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

/**
 * Robust action to save or update a donation while handling donor identity linking.
 * Uses Unified Identity Logic: Scans Users AND Donors by phone/email to prevent duplicates.
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
        const donorName = donationData.donorName;

        // --- 1. Robust Identity Discovery (Prevent Duplication) ---
        if (!finalDonorId && donorPhone && donorPhone.length >= 10) {
            // A. Check PRIMARY USERS (Admins/Staff)
            const userMatch = await adminDb.collection('users')
                .where('phone', '==', donorPhone)
                .limit(1)
                .get();

            if (!userMatch.empty) {
                finalDonorId = userMatch.docs[0].id;
            } else {
                // B. Check SECONDARY REGISTRY (Donors)
                const donorMatch = await adminDb.collection('donors')
                    .where('phone', '==', donorPhone)
                    .limit(1)
                    .get();

                if (!donorMatch.empty) {
                    finalDonorId = donorMatch.docs[0].id;
                } else {
                    // C. Auto-Provision Single Identity
                    const newDonorRef = adminDb.collection('donors').doc();
                    const newDonor: Partial<Donor> = {
                        id: newDonorRef.id,
                        name: donorName || 'Anonymous Donor',
                        phone: donorPhone,
                        status: 'Active',
                        createdAt: FieldValue.serverTimestamp(),
                        createdById: uploadedBy.id,
                        createdByName: uploadedBy.name,
                        notes: `Established via verified donation entry.`,
                    };
                    await newDonorRef.set(newDonor);
                    finalDonorId = newDonorRef.id;
                }
            }
        }

        // --- 2. Record Financial Data ---
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

        await docRef.set(finalDonationData, { merge: true });

        // --- 3. Synchronize historical unlinked records for this phone ---
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
        return { success: true, message: 'Contribution secured and identity synchronized.', id };
    } catch (error: any) {
        console.error("Upsert Donation Failed:", error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}

export async function linkDonationToDonorAction(
    donationId: string,
    donorId: string,
    updatedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donationRef = adminDb.collection('donations').doc(donationId);
        await donationRef.update({
            donorId: donorId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: updatedBy.name,
            updatedById: updatedBy.id
        });

        revalidatePath('/donations');
        return { success: true, message: "Identity successfully linked." };
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
        const batch = adminDb.batch();
        for (const id of ids) {
            batch.update(adminDb.collection('donations').doc(id), { 
                status: newStatus,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
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
                donorId: record.donorId || null,
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

export async function bulkMapDonorsAction(donationIds: string[], uploadedBy: {id: string, name: string}): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        let mappedCount = 0;
        const snaps = await adminDb.getAll(...donationIds.map(id => adminDb.collection('donations').doc(id)));
        
        for (const snap of snaps) {
            if (!snap.exists) continue;
            const d = snap.data() as Donation;
            if (d.donorId) continue; 

            let foundDonorId = null;
            if (d.donorPhone && d.donorPhone.length >= 10) {
                const userMatch = await adminDb.collection('users').where('phone', '==', d.donorPhone).limit(1).get();
                if (!userMatch.empty) {
                    foundDonorId = userMatch.docs[0].id;
                } else {
                    const donorMatch = await adminDb.collection('donors').where('phone', '==', d.donorPhone).limit(1).get();
                    if (!donorMatch.empty) foundDonorId = donorMatch.docs[0].id;
                }
            }

            if (foundDonorId) {
                await snap.ref.update({ donorId: foundDonorId, updatedAt: FieldValue.serverTimestamp() });
                mappedCount++;
            }
        }

        revalidatePath('/donations');
        return { success: true, message: `Auto-mapped ${mappedCount} records.`, count: mappedCount };
    } catch (e: any) {
        return { success: false, message: e.message, count: 0 };
    }
}

export async function bulkUnmapDonorsAction(donationIds: string[], uploadedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        for (const id of donationIds) {
            batch.update(adminDb.collection('donations').doc(id), { donorId: null, updatedAt: FieldValue.serverTimestamp() });
        }
        await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Successfully unlinked ${donationIds.length} records.` };
    } catch (error: any) {
         return { success: false, message: error.message };
    }
}

export async function bulkManualMapDonorsAction(donationIds: string[], donorId: string, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        for (const id of donationIds) {
            batch.update(adminDb.collection('donations').doc(id), { donorId, updatedAt: FieldValue.serverTimestamp() });
        }
        await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Successfully mapped ${donationIds.length} records.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function bulkLinkInitiativeAction(
    donationIds: string[], 
    action: 'link' | 'unlink', 
    initiativeContext?: { id: string, type: 'campaign' | 'lead', name: string },
    updatedBy?: {id: string, name: string},
    splitOptions?: { shouldSplit: boolean; fillAmount: number }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const batch = adminDb.batch();
        const snaps = await adminDb.getAll(...donationIds.map(id => adminDb.collection('donations').doc(id)));
        
        for (const snap of snaps) {
            if (!snap.exists) continue;
            const d = snap.data() as Donation;
            
            if (action === 'unlink') {
                batch.update(snap.ref, {
                    linkSplit: [{ linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general', amount: d.amount }],
                    updatedAt: FieldValue.serverTimestamp()
                });
            } else if (action === 'link' && initiativeContext) {
                let finalLinkAmount = d.amount;
                
                // Optional logic for split-to-fill
                if (splitOptions?.shouldSplit && splitOptions.fillAmount < d.amount) {
                    finalLinkAmount = splitOptions.fillAmount;
                }

                const newLink = {
                    linkId: initiativeContext.id,
                    linkName: initiativeContext.name,
                    linkType: initiativeContext.type,
                    amount: finalLinkAmount
                };

                const links = [newLink];
                if (finalLinkAmount < d.amount) {
                    links.push({ linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general', amount: d.amount - finalLinkAmount });
                }

                batch.update(snap.ref, {
                    linkSplit: links,
                    updatedAt: FieldValue.serverTimestamp()
                });
            }
        }
        await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Successfully updated ${donationIds.length} allocations.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function syncAllDonationsToDonorsAction(): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const donationsSnap = await adminDb.collection('donations').where('donorId', '==', null).get();
        let count = 0;

        for (const docSnap of donationsSnap.docs) {
            const d = docSnap.data() as Donation;
            if (!d.donorPhone) continue;

            const userMatch = await adminDb.collection('users').where('phone', '==', d.donorPhone).limit(1).get();
            if (!userMatch.empty) {
                await docSnap.ref.update({ donorId: userMatch.docs[0].id, updatedAt: FieldValue.serverTimestamp() });
                count++;
            } else {
                const donorMatch = await adminDb.collection('donors').where('phone', '==', d.donorPhone).limit(1).get();
                if (!donorMatch.empty) {
                    await docSnap.ref.update({ donorId: donorMatch.docs[0].id, updatedAt: FieldValue.serverTimestamp() });
                    count++;
                }
            }
        }
        revalidatePath('/donations');
        return { success: true, message: `Successfully synchronized ${count} historical identities.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}

/**
 * Internal Admin helper to recalculate initiative collected totals.
 */
export async function bulkRecalculateInitiativeTotalsAction(): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const [campaignsSnap, leadsSnap, donationsSnap] = await Promise.all([
            adminDb.collection('campaigns').get(),
            adminDb.collection('leads').get(),
            adminDb.collection('donations').get(),
        ]);

        const campaignMap: Record<string, number> = {};
        const leadMap: Record<string, number> = {};

        donationsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.status !== 'Verified') return;
            (data.linkSplit || []).forEach((link: any) => {
                if (link.linkType === 'campaign') campaignMap[link.linkId] = (campaignMap[link.linkId] || 0) + link.amount;
                else if (link.linkType === 'lead') leadMap[link.linkId] = (leadMap[link.linkId] || 0) + link.amount;
            });
        });

        const batch = adminDb.batch();
        campaignsSnap.docs.forEach(d => batch.update(d.ref, { collectedAmount: campaignMap[d.id] || 0 }));
        leadsSnap.docs.forEach(d => batch.update(d.ref, { collectedAmount: leadMap[d.id] || 0 }));
        
        await batch.commit();
        revalidatePath('/campaigns');
        revalidatePath('/leads-members');
        return { success: true, message: "Initiative financial totals re-synchronized." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
