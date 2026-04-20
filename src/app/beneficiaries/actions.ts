'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Verify Server Credentials.";

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
 * Robust server-side action to upsert a beneficiary within an initiative context.
 * Hardened to handle explicit removal of numeric values (Zakat, Amounts).
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
            // Explicitly coerce numeric fields to 0 if they are undefined or null
            const initiativeBeneficiaryData = {
                ...beneficiaryData,
                kitAmount: (kitAmount !== undefined && kitAmount !== null) ? Number(kitAmount) : 0,
                zakatAllocation: (zakatAllocation !== undefined && zakatAllocation !== null) ? Number(zakatAllocation) : 0,
                verificationStatus: masterStatusToSave,
                updatedAt: FieldValue.serverTimestamp(),
                updatedById: updatedBy.id,
                updatedByName: updatedBy.name,
            };
            transaction.set(subRef, initiativeBeneficiaryData, { merge: true });

            // 3. Adjust Initiative Total Goal if this is a new link or amount changed
            const oldAmount = subSnap.exists ? (subSnap.data()?.kitAmount || 0) : 0;
            const currentAmount = (kitAmount !== undefined && kitAmount !== null) ? Number(kitAmount) : 0;
            const diff = currentAmount - oldAmount;
            
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
        console.error("Update Failed:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}
