'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

/**
 * Creates a new beneficiary in the master registry.
 */
export async function createMasterBeneficiaryAction(data: Partial<Beneficiary>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const docRef = adminDb.collection('beneficiaries').doc();
        const payload = {
            ...data,
            id: docRef.id,
            status: data.status || 'Pending',
            addedDate: data.addedDate || new Date().toISOString().split('T')[0],
            createdAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: createdBy.id,
            updatedByName: createdBy.name,
        };
        await docRef.set(payload);

        revalidatePath('/beneficiaries');
        return { success: true, message: 'Beneficiary Record Registered Successfully.', id: docRef.id };
    } catch (error: any) {
        return { success: false, message: `Registration Failed: ${error.message}` };
    }
}

/**
 * Updates a master beneficiary record.
 */
export async function updateMasterBeneficiaryAction(beneficiaryId: string, data: Partial<Beneficiary>, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        await adminDb.collection('beneficiaries').doc(beneficiaryId).update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        });
        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath('/beneficiaries');
        return { success: true, message: 'Master profile updated.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Bulk updates master status.
 */
export async function bulkUpdateMasterBeneficiaryStatusAction(ids: string[], status: Beneficiary['status'], updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        ids.forEach(id => {
            batch.update(adminDb.collection('beneficiaries').doc(id), { status, updatedById: updatedBy.id, updatedByName: updatedBy.name, updatedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit();
        revalidatePath('/beneficiaries');
        return { success: true, message: `Updated ${ids.length} records.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Bulk updates zakat eligibility.
 */
export async function bulkUpdateMasterZakatAction(ids: string[], isEligibleForZakat: boolean, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        ids.forEach(id => {
            batch.update(adminDb.collection('beneficiaries').doc(id), { isEligibleForZakat, updatedById: updatedBy.id, updatedByName: updatedBy.name, updatedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit();
        revalidatePath('/beneficiaries');
        return { success: true, message: `Zakat status updated for ${ids.length} records.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Bulk imports beneficiaries from CSV.
 */
export async function bulkImportBeneficiariesAction(records: Partial<Beneficiary>[], createdBy: {id: string, name: string}, initiativeContext?: { type: 'campaign' | 'lead', id: string }): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        for (const record of records) {
            const id = record.id || adminDb.collection('beneficiaries').doc().id;
            const ref = adminDb.collection('beneficiaries').doc(id);
            const payload = {
                ...record,
                id,
                status: record.status || 'Pending',
                addedDate: record.addedDate || new Date().toISOString().split('T')[0],
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                createdById: createdBy.id,
                createdByName: createdBy.name,
                updatedAt: FieldValue.serverTimestamp(),
                updatedById: createdBy.id,
                updatedByName: createdBy.name,
            };
            batch.set(ref, payload, { merge: true });

            if (initiativeContext) {
                const subRef = adminDb.doc(`${initiativeContext.type === 'campaign' ? 'campaigns' : 'leads'}/${initiativeContext.id}/beneficiaries/${id}`);
                batch.set(subRef, payload, { merge: true });
            }
        }
        await batch.commit();
        revalidatePath('/beneficiaries');
        if (initiativeContext) revalidatePath(`/${initiativeContext.type}s-members/${initiativeContext.id}/beneficiaries`);
        return { success: true, message: `Successfully synchronized ${records.length} records.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Robust server-side action to upsert a beneficiary within an initiative context.
 */
export async function upsertInitiativeBeneficiaryAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    beneficiaryData: Partial<Beneficiary> & { id: string },
    updatedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const masterRef = adminDb.collection('beneficiaries').doc(beneficiaryData.id);
        const subRef = adminDb.doc(`${collectionName}/${initiativeId}/beneficiaries/${beneficiaryData.id}`);
        const initiativeRef = adminDb.collection(collectionName).doc(initiativeId);

        await adminDb.runTransaction(async (transaction) => {
            const masterSnap = await transaction.get(masterRef);
            const initiativeSnap = await transaction.get(initiativeRef);
            const subSnap = await transaction.get(subRef);

            if (!initiativeSnap.exists) throw new Error(`${initiativeType} not found.`);

            const { status, kitAmount, zakatAllocation, itemCategoryId, itemCategoryName, verificationStatus, ...masterFields } = beneficiaryData;
            
            // 1. Update Master Profile
            const masterStatusToSave = status === 'Given' ? 'Verified' : (status || 'Pending');
            transaction.set(masterRef, {
                ...masterFields,
                status: masterStatusToSave,
                updatedAt: FieldValue.serverTimestamp(),
                updatedById: updatedBy.id,
                updatedByName: updatedBy.name,
            }, { merge: true });

            // 2. Update Initiative-Specific Record
            const initiativeBeneficiaryData = {
                ...beneficiaryData,
                verificationStatus: masterStatusToSave,
                updatedAt: FieldValue.serverTimestamp(),
                updatedById: updatedBy.id,
                updatedByName: updatedBy.name,
            };
            transaction.set(subRef, initiativeBeneficiaryData, { merge: true });

            // 3. Adjust Initiative Total Goal if this is a new link or amount changed
            const oldAmount = subSnap.exists ? (subSnap.data()?.kitAmount || 0) : 0;
            const diff = (kitAmount || 0) - oldAmount;
            
            if (diff !== 0) {
                const currentInitiative = initiativeSnap.data() as Campaign | Lead;
                const newTarget = (currentInitiative.targetAmount || 0) + diff;
                transaction.update(initiativeRef, { targetAmount: newTarget, updatedAt: FieldValue.serverTimestamp() });
            }
        });

        revalidatePath(`/beneficiaries/${beneficiaryData.id}`);
        revalidatePath(`/${collectionName}-members/${initiativeId}/beneficiaries`);
        
        return { success: true, message: 'Beneficiary records synchronized successfully.' };
    } catch (error: any) {
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

/**
 * Bulk updates disbursement status within an initiative.
 */
export async function bulkUpdateInitiativeBeneficiaryStatusAction(
    type: 'campaign' | 'lead',
    id: string,
    beneficiaryIds: string[],
    status: Beneficiary['status']
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        const collectionName = type === 'campaign' ? 'campaigns' : 'leads';
        beneficiaryIds.forEach(bId => {
            const ref = adminDb.doc(`${collectionName}/${id}/beneficiaries/${bId}`);
            batch.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit();
        revalidatePath(`/${collectionName}-members/${id}/beneficiaries`);
        return { success: true, message: `Updated ${beneficiaryIds.length} disbursement statuses.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Bulk updates verification (vetting) status across master and initiative.
 */
export async function bulkUpdateBeneficiaryVettingAction(
    ids: string[],
    status: Beneficiary['status'],
    updatedBy: {id: string, name: string},
    initiativeContext: { type: 'campaign' | 'lead', id: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const batch = adminDb.batch();
        const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
        ids.forEach(id => {
            batch.update(adminDb.collection('beneficiaries').doc(id), { status, updatedById: updatedBy.id, updatedByName: updatedBy.name, updatedAt: FieldValue.serverTimestamp() });
            batch.update(adminDb.doc(`${collectionName}/${initiativeContext.id}/beneficiaries/${id}`), { verificationStatus: status, updatedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit();
        revalidatePath('/beneficiaries');
        revalidatePath(`/${collectionName}-members/${initiativeContext.id}/beneficiaries`);
        return { success: true, message: `Vetting status updated for ${ids.length} records.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Legacy sync helper.
 */
export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string }> {
    revalidatePath('/beneficiaries');
    return { success: true, message: 'Registry Refreshed.' };
}

/**
 * Updates initiative-specific beneficiary details.
 */
export async function updateInitiativeBeneficiaryDetailsAction(type: 'campaign' | 'lead', id: string, bId: string, data: any): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const collectionName = type === 'campaign' ? 'campaigns' : 'leads';
        await adminDb.doc(`${collectionName}/${id}/beneficiaries/${bId}`).set(data, { merge: true });
        revalidatePath(`/${collectionName}-members/${id}/beneficiaries`);
        return { success: true, message: 'Initiative details updated.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Updates single beneficiary status in initiative.
 */
export async function updateBeneficiaryStatusInInitiativeAction(type: 'campaign' | 'lead', id: string, bId: string, status: any): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const collectionName = type === 'campaign' ? 'campaigns' : 'leads';
        await adminDb.doc(`${collectionName}/${id}/beneficiaries/${bId}`).update({ status, updatedAt: FieldValue.serverTimestamp() });
        revalidatePath(`/${collectionName}-members/${id}/beneficiaries`);
        return { success: true, message: 'Status updated.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function deleteBeneficiaryAction(beneficiaryId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    
    try {
        const batch = adminDb.batch();
        const masterRef = adminDb.collection('beneficiaries').doc(beneficiaryId);

        // Find every instance of this beneficiary in initiatives to adjust goals
        const subquery = await adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId).get();
        
        for (const subDoc of subquery.docs) {
            const data = subDoc.data() as Beneficiary;
            const pathParts = subDoc.ref.path.split('/');
            const initiativeType = pathParts[0]; // campaigns or leads
            const initiativeId = pathParts[1];
            
            const initiativeRef = adminDb.collection(initiativeType).doc(initiativeId);
            batch.update(initiativeRef, { 
                targetAmount: FieldValue.increment(-(data.kitAmount || 0)),
                updatedAt: FieldValue.serverTimestamp()
            });
            batch.delete(subDoc.ref);
        }

        batch.delete(masterRef);

        const bucket = adminStorage.bucket();
        await bucket.deleteFiles({ prefix: `beneficiaries/${beneficiaryId}/` }).catch(() => {});

        await batch.commit();
        revalidatePath('/beneficiaries');
        revalidatePath('/dashboard');
        return { success: true, message: 'Beneficiary permanently removed and totals reconciled.' };
    } catch (error: any) {
        return { success: false, message: `Removal Failed: ${error.message}` };
    }
}
