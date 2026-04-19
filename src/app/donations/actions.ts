'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, Donor, DonationLink, TransactionDetail, Campaign, Lead } from '@/lib/types';
import { donationCategories } from '@/lib/modules';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

/**
 * Sanitizes an object by removing all undefined values.
 */
function sanitizePayload(data: Record<string, any>) {
    const sanitized: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
            sanitized[key] = data[key];
        } else if (data[key] === null) {
            sanitized[key] = null;
        } else {
            sanitized[key] = data[key];
        }
    });
    return sanitized;
}

/**
 * Recalculates initiative totals for specific IDs.
 * Correctly accounts for Zakat surpluses by subtracting reservations (allocations).
 */
async function syncInitiativeCollectedTotals(db: FirebaseFirestore.Firestore, links: DonationLink[]) {
    const targets = Array.from(new Set(links.map(l => {
        const rawId = String(l.linkId);
        const cleanId = (rawId.startsWith('campaign_') || rawId.startsWith('lead_')) ? rawId.split('_')[1] : rawId;
        return `${l.linkType}_${cleanId}`;
    })));

    const donationsSnap = await db.collection('donations').where('status', '==', 'Verified').get();
    const allVerifiedDonations = donationsSnap.docs.map(doc => doc.data() as Donation);

    for (const targetKey of targets) {
        const [type, id] = targetKey.split('_');
        const collectionName = type === 'campaign' ? 'campaigns' : 'leads';
        const initiativeRef = db.collection(collectionName).doc(id);
        const initiativeSnap = await initiativeRef.get();
        if (!initiativeSnap.exists) continue;
        
        const initiativeData = initiativeSnap.data() as Campaign | Lead;
        const allowedTypes = initiativeData.allowedDonationTypes && initiativeData.allowedDonationTypes.length > 0
            ? initiativeData.allowedDonationTypes
            : [...donationCategories];

        const beneficiariesSnap = await db.collection(collectionName).doc(id).collection('beneficiaries').get();
        const zakatAllocatedSum = beneficiariesSnap.docs.reduce((sum, bDoc) => {
            const bData = bDoc.data();
            return sum + (bData.isEligibleForZakat ? (Number(bData.zakatAllocation) || 0) : 0);
        }, 0);

        let zakatSumForGoal = 0;
        let otherEligibleSum = 0;

        allVerifiedDonations.forEach(d => {
            const split = d.linkSplit?.find(l => l.linkId === id || l.linkId === `${type}_${id}`);
            if (split) {
                const totalDonation = d.amount || 1;
                const prop = split.amount / totalDonation;
                const typeSplits = d.typeSplit || [];
                
                typeSplits.forEach(s => {
                    const cat = (s.category as any) === 'General' || (s.category as any) === 'Sadqa' ? 'Sadaqah' : s.category;
                    const isAllowed = allowedTypes.includes(cat as any);
                    const isForGoal = cat !== 'Zakat' || s.forFundraising !== false;
                    
                    if (isAllowed && isForGoal) {
                        const amount = s.amount * prop;
                        if (cat === 'Zakat') zakatSumForGoal += amount;
                        else otherEligibleSum += amount;
                    }
                });
            }
        });

        const zakatSurplus = Math.max(0, zakatSumForGoal - zakatAllocatedSum);
        const finalCollected = otherEligibleSum + zakatSurplus;

        await initiativeRef.update({ collectedAmount: finalCollected, updatedAt: FieldValue.serverTimestamp() });
    }
}

/**
 * Robust action to save or update a donation while handling unified identity linking.
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
        const donorPhone = donationData.donorPhone || '';
        const donorName = donationData.donorName || 'Anonymous Donor';

        if (!finalDonorId && donorPhone && donorPhone.length >= 10) {
            const userMatch = await adminDb.collection('users').where('phone', '==', donorPhone).limit(1).get();
            if (!userMatch.empty) {
                finalDonorId = userMatch.docs[0].id;
            } else {
                const donorMatch = await adminDb.collection('donors').where('phone', '==', donorPhone).limit(1).get();
                if (!donorMatch.empty) {
                    finalDonorId = donorMatch.docs[0].id;
                } else {
                    const newDonorRef = adminDb.collection('donors').doc();
                    await newDonorRef.set({
                        id: newDonorRef.id,
                        name: donorName,
                        phone: donorPhone,
                        status: 'Active',
                        createdAt: FieldValue.serverTimestamp(),
                        createdById: uploadedBy.id,
                        createdByName: uploadedBy.name,
                        notes: `Profile established via verified donation registry.`,
                    });
                    finalDonorId = newDonorRef.id;
                }
            }
        }

        const docRef = donationId ? adminDb.collection('donations').doc(donationId) : adminDb.collection('donations').doc();
        const id = docRef.id;

        const payload = sanitizePayload({
            ...donationData,
            id,
            donorId: finalDonorId || null,
            donorName: donorName,
            donorPhone: donorPhone,
            receiverName: donationData.receiverName || '',
            amount: Number(donationData.amount) || 0,
            donationDate: donationData.donationDate || new Date().toISOString().split('T')[0],
            donationType: donationData.donationType || 'Other',
            status: donationData.status || 'Pending',
            typeSplit: donationData.typeSplit || [],
            linkSplit: donationData.linkSplit || [],
            uploadedBy: uploadedBy.name,
            uploadedById: uploadedBy.id,
            updatedAt: FieldValue.serverTimestamp(),
            ...( !donationId && { createdAt: FieldValue.serverTimestamp() } ),
        });

        await docRef.set(payload, { merge: true });

        if (donationData.linkSplit) {
            await syncInitiativeCollectedTotals(adminDb, donationData.linkSplit);
        }

        revalidatePath('/donations');
        revalidatePath('/donors');
        revalidatePath('/dashboard');
        return { success: true, message: 'Institutional record secured and totals reconciled.', id };
    } catch (error: any) {
        console.error("Upsert Donation Failed:", error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}

export async function deleteDonationAction(donationId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const docRef = adminDb.collection('donations').doc(donationId);
        const snap = await docRef.get();
        if (!snap.exists) return { success: true, message: 'Record already purged.' };

        const d = snap.data() as Donation;
        const links = d.linkSplit || [];

        await docRef.delete();

        if (links.length > 0) {
            await syncInitiativeCollectedTotals(adminDb, links);
        }

        revalidatePath('/donations');
        revalidatePath('/dashboard');
        return { success: true, message: 'Donation record purged and totals reconciled.' };
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
        const affectedLinks: DonationLink[] = [];

        for (const id of ids) {
            const ref = adminDb.collection('donations').doc(id);
            const snap = await ref.get();
            if (snap.exists) {
                const d = snap.data() as Donation;
                if (d.linkSplit) affectedLinks.push(...d.linkSplit);
                batch.update(ref, { status: newStatus, updatedAt: FieldValue.serverTimestamp() });
            }
        }
        await batch.commit();

        if (affectedLinks.length > 0) {
            const uniqueLinks = Array.from(new Set(affectedLinks.map(l => `${l.linkType}_${l.linkId}`)))
                .map(key => {
                    const [type, id] = key.split('_');
                    return { linkType: type as any, linkId: id };
                });
            await syncInitiativeCollectedTotals(adminDb, uniqueLinks as any);
        }

        revalidatePath('/donations');
        return { success: true, message: `Updated ${ids.length} records and synchronized totals.` };
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
            
            const donationData = sanitizePayload({
                ...record,
                id,
                donorName: record.donorName || 'Anonymous Donor',
                donorPhone: record.donorPhone || '',
                amount: Number(record.amount) || 0,
                donationDate: record.donationDate || new Date().toISOString().split('T')[0],
                status: record.status || 'Verified',
                donationType: record.donationType || 'Other',
                uploadedBy: uploadedBy.name,
                uploadedById: uploadedBy.id,
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                donorId: record.donorId || null,
            });

            if (initiativeContext) {
                const currentLinks = (record.linkSplit || []) as any[];
                const exists = currentLinks.some(l => l.linkId === initiativeContext.id || l.linkId === `${initiativeContext.type}_${initiativeContext.id}`);
                if (!exists) {
                    currentLinks.push({
                        linkId: initiativeContext.id,
                        linkName: initiativeContext.name,
                        linkType: initiativeContext.type,
                        amount: Number(record.amount) || 0
                    });
                    (donationData as any).linkSplit = currentLinks;
                }
            }

            batch.set(docRef, donationData, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (initiativeContext) {
            await syncInitiativeCollectedTotals(adminDb, [{ linkId: initiativeContext.id, linkType: initiativeContext.type, linkName: initiativeContext.name, amount: 0 }]);
        }

        revalidatePath('/donations');
        return { success: true, message: `Synchronized ${count} records.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
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
        const snaps = await adminDb.getAll(...donationIds.map(id => adminDb.collection('donations').doc(id)));
        const affectedLinks: DonationLink[] = [];

        const batch = adminDb.batch();
        for (const snap of snaps) {
            if (!snap.exists) continue;
            const d = snap.data() as Donation;
            if (d.linkSplit) affectedLinks.push(...d.linkSplit);
            
            if (action === 'unlink') {
                batch.update(snap.ref, {
                    linkSplit: [{ linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general', amount: d.amount }],
                    updatedAt: FieldValue.serverTimestamp()
                });
            } else if (action === 'link' && initiativeContext) {
                let finalLinkAmount = d.amount;
                if (splitOptions?.shouldSplit && splitOptions.fillAmount < d.amount) {
                    finalLinkAmount = splitOptions.fillAmount;
                }

                const links = [{ linkId: initiativeContext.id, linkName: initiativeContext.name, linkType: initiativeContext.type, amount: finalLinkAmount }];
                if (finalLinkAmount < d.amount) {
                    links.push({ linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general', amount: d.amount - finalLinkAmount });
                }
                batch.update(snap.ref, { linkSplit: links, updatedAt: FieldValue.serverTimestamp() });
                affectedLinks.push(...links);
            }
        }
        await batch.commit();

        const uniqueLinks = Array.from(new Set(affectedLinks.map(l => `${l.linkType}_${l.linkId}`)))
            .map(key => {
                const [type, id] = key.split('_');
                return { linkType: type as any, linkId: id };
            });
        await syncInitiativeCollectedTotals(adminDb, uniqueLinks as any);

        revalidatePath('/donations');
        return { success: true, message: `Successfully updated ${donationIds.length} allocations.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function bulkRecalculateInitiativeTotalsAction(): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const [campaignsSnap, leadsSnap, donationsSnap] = await Promise.all([
            adminDb.collection('campaigns').get(),
            adminDb.collection('leads').get(),
            adminDb.collection('donations').get(),
        ]);

        const batch = adminDb.batch();
        const allInitiatives = [
            ...campaignsSnap.docs.map(d => ({ ref: d.ref, id: d.id, type: 'campaign', data: d.data() as Campaign })),
            ...leadsSnap.docs.map(d => ({ ref: d.ref, id: d.id, type: 'lead', data: d.data() as Lead }))
        ];

        for (const init of allInitiatives) {
            const allowedTypes = (init.data as any).allowedDonationTypes && (init.data as any).allowedDonationTypes.length > 0
                ? (init.data as any).allowedDonationTypes
                : [...donationCategories];

            let total = 0;
            donationsSnap.docs.forEach(doc => {
                const d = doc.data() as Donation;
                if (d.status !== 'Verified') return;
                
                const split = d.linkSplit?.find(l => 
                    l.linkId === init.id || 
                    l.linkId === `campaign_${init.id}` || 
                    l.linkId === `lead_${init.id}`
                );

                if (split) {
                    const totalDonation = d.amount || 1;
                    const prop = split.amount / totalDonation;
                    const typeSplits = d.typeSplit || [];
                    const eligible = typeSplits.reduce((acc, s) => {
                        const cat = (s.category as any) === 'General' ? 'Sadaqah' : s.category;
                        const isAllowed = allowedTypes.includes(cat as any);
                        const isForGoal = cat !== 'Zakat' || s.forFundraising !== false;
                        return (isAllowed && isForGoal) ? acc + s.amount : acc;
                    }, 0);
                    total += (eligible * prop);
                }
            });
            batch.update(init.ref, { collectedAmount: total, updatedAt: FieldValue.serverTimestamp() });
        }
        
        await batch.commit();
        revalidatePath('/campaign-members');
        revalidatePath('/leads-members');
        revalidatePath('/dashboard');
        return { success: true, message: "Initiative financial totals re-synchronized." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function linkDonationToDonorAction(donationId: string, donorId: string, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        await adminDb.collection('donations').doc(donationId).update({
            donorId,
            updatedAt: FieldValue.serverTimestamp()
        });
        revalidatePath('/donations');
        return { success: true, message: 'Identity Resolution Finalized.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function syncAllDonationsToDonorsAction(): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };
    try {
        const [donorsSnap, donationsSnap] = await Promise.all([
            adminDb.collection('donors').get(),
            adminDb.collection('donations').where('donorId', '==', null).get()
        ]);
        const donorPhoneMap = new Map(donorsSnap.docs.map(doc => [doc.data().phone, doc.id]));
        const batch = adminDb.batch();
        let count = 0;
        donationsSnap.docs.forEach(doc => {
            const data = doc.data();
            const matchedId = donorPhoneMap.get(data.donorPhone);
            if (matchedId) {
                batch.update(doc.ref, { donorId: matchedId, updatedAt: FieldValue.serverTimestamp() });
                count++;
            }
        });
        if (count > 0) await batch.commit();
        revalidatePath('/donations');
        return { success: true, message: `Synchronized ${count} identities.`, count };
    } catch (e: any) {
        return { success: false, message: e.message, count: 0 };
    }
}
