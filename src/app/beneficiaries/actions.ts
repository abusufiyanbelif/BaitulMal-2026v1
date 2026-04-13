'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

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
 * Robust server-side action to upsert a beneficiary within an initiative context.
 * Performs real-time reconciliation of target goals and audit trails.
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
