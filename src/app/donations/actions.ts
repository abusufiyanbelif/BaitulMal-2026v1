'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, Donor } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

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
        if (!finalDonorId && donorPhone && donorPhone.length >= 10) {
            const donorsCol = adminDb.collection('donors');
            const foundDonorSnap = await donorsCol.where('phone', '==', donorPhone).limit(1).get();

            if (!foundDonorSnap.empty) {
                finalDonorId = foundDonorSnap.docs[0].id;
            } else {
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

        // Remove legacy fields if they exist to prevent query pollution
        if ((finalDonationData as any).campaignId) delete (finalDonationData as any).campaignId;
        if ((finalDonationData as any).campaignName) delete (finalDonationData as any).campaignName;

        await docRef.set(finalDonationData, { merge: true });

        // --- 3. Ripple Effect: Sync other donations for this donor ---
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

        await donationRef.update({
            donorId: donorId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: updatedBy.name,
            updatedById: updatedBy.id
        });

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

/**
 * Migration utility to ensure all historical donations are detectable by the Hub.
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
            
            if (donation.donorId === undefined) {
                batch.update(docSnap.ref, { donorId: null });
                preparedCount++;
            }

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
            message: `Registry prepared. Linked ${count} matching records and initialized ${preparedCount} legacy entries.`, 
            count 
        };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}

/**
 * Bulk actions for identity resolution
 */
export async function bulkMapDonorsAction(donationIds: string[], uploadedBy: {id: string, name: string}): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        let mappedCount = 0;
        const chunkSize = 100;

        for (let i = 0; i < donationIds.length; i += chunkSize) {
            const batch = adminDb.batch();
            const chunk = donationIds.slice(i, i + chunkSize);
            const snaps = await adminDb.getAll(...chunk.map(id => adminDb.collection('donations').doc(id)));
            
            for (const snap of snaps) {
                if (!snap.exists) continue;
                const d = snap.data() as Donation;
                
                // Allow overwriting if user explicitly requests this in bulk? The user specifically asked to map unmapped.
                // We'll skip if it has a donorId to be safe unless specified, but to ensure robust mapping of selected we evaluate.
                if (d.donorId) continue; 

                let foundDonorId = null;
                const queries = [];
                if (d.donorPhone && d.donorPhone.length > 5) {
                    queries.push(adminDb.collection('donors').where('phone', '==', d.donorPhone).limit(1).get());
                    queries.push(adminDb.collection('donors').where('phones', 'array-contains', d.donorPhone).limit(1).get());
                }
                
                const donationUpiIds = (d.transactions || []).map((tx: any) => tx.upiId).filter(Boolean);
                for (const upi of donationUpiIds) {
                    queries.push(adminDb.collection('donors').where('upiIds', 'array-contains', upi).limit(1).get());
                }
                
                // Include explicit transactionId to account checking as an extra safeguard
                const transactionIds = (d.transactions || []).map((tx: any) => tx.transactionId).filter(Boolean);
                for (const txId of transactionIds) {
                     queries.push(adminDb.collection('donors').where('accountNumbers', 'array-contains', txId).limit(1).get());
                }

                if (queries.length > 0) {
                    const results = await Promise.all(queries);
                    for (const querySnap of results) {
                        if (!querySnap.empty) {
                            const donorDoc = querySnap.docs[0];
                            foundDonorId = donorDoc.id;
                            const donorData = donorDoc.data() as Donor;
                            
                            // Feature: Scrape UPIS and Phones into Donor
                            let needsUpdate = false;
                            const updateData: any = {};
                            const existingUpis = new Set(donorData.upiIds || []);
                            for (const upi of donationUpiIds) {
                                if (upi && !existingUpis.has(upi)) {
                                    existingUpis.add(upi);
                                    needsUpdate = true;
                                }
                            }
                            if (needsUpdate) updateData.upiIds = Array.from(existingUpis);

                            if (d.donorPhone && d.donorPhone !== donorData.phone) {
                                const existingPhones = new Set(donorData.phones || [donorData.phone]);
                                if (!existingPhones.has(d.donorPhone)) {
                                    existingPhones.add(d.donorPhone);
                                    updateData.phones = Array.from(existingPhones).filter(Boolean);
                                    needsUpdate = true;
                                }
                            }

                            if (needsUpdate) {
                                batch.update(donorDoc.ref, updateData);
                            }
                            break;
                        }
                    }
                }

                if (!foundDonorId && d.donorPhone && d.donorPhone.length > 5) {
                    const newDonorRef = adminDb.collection('donors').doc();
                    const newDonor: Partial<Donor> = {
                        id: newDonorRef.id,
                        name: d.donorName || 'Anonymous Donor',
                        phone: d.donorPhone,
                        phones: [d.donorPhone],
                        upiIds: donationUpiIds,
                        status: 'Active',
                        createdAt: FieldValue.serverTimestamp(),
                        createdById: uploadedBy.id,
                        createdByName: uploadedBy.name,
                        notes: `Profile mapped dynamically from Bulk auto-resolve algorithm.`,
                    };
                    batch.set(newDonorRef, newDonor);
                    foundDonorId = newDonorRef.id;
                }

                if (foundDonorId) {
                    batch.update(snap.ref, { donorId: foundDonorId, updatedAt: FieldValue.serverTimestamp() });
                    mappedCount++;
                }
            }
            await batch.commit();
        }

        revalidatePath('/donations');
        revalidatePath('/donors');
        return { success: true, message: `Auto-resolved and mapped ${mappedCount} identity records successfully.`, count: mappedCount };
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
            batch.update(adminDb.collection('donations').doc(id), { 
                donorId: null, 
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: uploadedBy.name 
            });
        }
        await batch.commit();
        revalidatePath('/donations');
        revalidatePath('/donors');
        return { success: true, message: `Successfully unlinked ${donationIds.length} records from donors.` };
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
            batch.update(adminDb.collection('donations').doc(id), { 
                donorId, 
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: updatedBy.name 
            });
        }
        await batch.commit();
        revalidatePath('/donations');
        revalidatePath(`/donors/${donorId}`);
        revalidatePath('/donors');
        return { success: true, message: `Successfully mapped ${donationIds.length} records to the selected donor.` };
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
                let finalLinks = [];
                
                if (splitOptions?.shouldSplit && d.amount > splitOptions.fillAmount) {
                    finalLinks = [
                        {
                            linkId: initiativeContext.id,
                            linkName: initiativeContext.name,
                            linkType: initiativeContext.type,
                            amount: splitOptions.fillAmount
                        },
                        {
                            linkId: 'unallocated',
                            linkName: 'Unallocated',
                            linkType: 'general' as const,
                            amount: d.amount - splitOptions.fillAmount
                        }
                    ];
                } else {
                    finalLinks = [{
                        linkId: initiativeContext.id,
                        linkName: initiativeContext.name,
                        linkType: initiativeContext.type,
                        amount: d.amount
                    }];
                }

                batch.update(snap.ref, {
                    linkSplit: finalLinks,
                    updatedAt: FieldValue.serverTimestamp()
                });
            }
        }
        await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Successfully ${action}ed ${donationIds.length} donations.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function bulkRecalculateInitiativeTotalsAction(): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        // 1. Fetch all initiatives and donations
        const campaignsSnap = await adminDb.collection('campaigns').get();
        const leadsSnap = await adminDb.collection('leads').get();
        const donationsSnap = await adminDb.collection('donations').get();

        const campaignMap: Record<string, number> = {};
        const leadMap: Record<string, number> = {};

        // 2. Aggregate
        donationsSnap.docs.forEach(docSnap => {
            const d = docSnap.data() as Donation;
            (d.linkSplit || []).forEach(link => {
                if (link.linkType === 'campaign') {
                    campaignMap[link.linkId] = (campaignMap[link.linkId] || 0) + link.amount;
                } else if (link.linkType === 'lead') {
                    leadMap[link.linkId] = (leadMap[link.linkId] || 0) + link.amount;
                }
            });
        });

        // 3. Batch Update
        const batch = adminDb.batch();
        campaignsSnap.docs.forEach(docSnap => {
            batch.update(docSnap.ref, { collectedAmount: campaignMap[docSnap.id] || 0 });
        });
        leadsSnap.docs.forEach(docSnap => {
            batch.update(docSnap.ref, { collectedAmount: leadMap[docSnap.id] || 0 });
        });

        await batch.commit();
        revalidatePath('/campaigns');
        revalidatePath('/leads');
        revalidatePath('/dashboard');
        
        return { success: true, message: "System-wide financial reconciliation complete. All totals synchronized." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
