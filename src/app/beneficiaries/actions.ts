'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

export async function createMasterBeneficiaryAction(data: Partial<Beneficiary>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
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
        };
        await docRef.set(payload);

        revalidatePath('/beneficiaries');
        return { success: true, message: 'Beneficiary Record Registered Successfully.', id: docRef.id };
    } catch (error: any) {
        console.error("Error Creating Beneficiary:", error);
        return { success: false, message: `Registration Failed: ${error.message}` };
    }
}

/**
 * Robust server-side action to upsert a beneficiary within an initiative context.
 * This resolves permission errors by handling cross-collection updates on the server.
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
            };
            transaction.set(subRef, initiativeBeneficiaryData, { merge: true });

            // 3. Adjust Initiative Total Goal if this is a new link
            if (!subSnap.exists) {
                const currentInitiative = initiativeSnap.data() as Campaign | Lead;
                const newTarget = (currentInitiative.targetAmount || 0) + (kitAmount || 0);
                transaction.update(initiativeRef, { targetAmount: newTarget });
            }
        });

        revalidatePath(`/beneficiaries/${beneficiaryData.id}`);
        revalidatePath(`/${collectionName}-members/${initiativeId}/beneficiaries`);
        
        return { success: true, message: 'Beneficiary Records Synchronized Successfully.' };
    } catch (error: any) {
        console.error("Upsert Initiative Beneficiary Failed:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

export async function updateMasterBeneficiaryAction(
    beneficiaryId: string, 
    data: Partial<Beneficiary>, 
    updatedBy: {id: string, name: string}
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        const masterBeneficiaryRef = adminDb.collection('beneficiaries').doc(beneficiaryId);

        const { zakatAllocation, kitAmount, status, ...masterData } = data;
        
        const updatePayload: any = {
            ...masterData,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        };

        if (status) {
            updatePayload.status = status;
        }

        await masterBeneficiaryRef.set(updatePayload, { merge: true });
        
        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: `Beneficiary Master Record Synchronized.` };
    } catch (error: any) {
        console.error("Error Updating Master Beneficiary:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

export async function updateInitiativeBeneficiaryDetailsAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    beneficiaryId: string,
    data: any
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const docRef = adminDb.doc(`${collectionName}/${initiativeId}/beneficiaries/${beneficiaryId}`);
        await docRef.set(data, { merge: true });
        revalidatePath(`/${collectionName}-members/${initiativeId}/beneficiaries`);
        return { success: true, message: 'Initiative Record Updated.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateBeneficiaryStatusInInitiativeAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    beneficiaryId: string,
    newStatus: Beneficiary['status']
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const docRef = adminDb.doc(`${collectionName}/${initiativeId}/beneficiaries/${beneficiaryId}`);
        await docRef.update({ status: newStatus });
        revalidatePath(`/${collectionName}-members/${initiativeId}/beneficiaries`);
        return { success: true, message: 'Disbursement Status Updated.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const batch = adminDb.batch();
        let addedCount = 0;
        
        const masterSnap = await adminDb.collection('beneficiaries').get();
        const masterIds = new Set(masterSnap.docs.map(d => d.id));

        const initiatives = [
            { type: 'campaigns', label: 'Campaign' },
            { type: 'leads', label: 'Lead' }
        ];

        for (const init of initiatives) {
            const initSnap = await adminDb.collection(init.type).get();
            for (const doc of initSnap.docs) {
                const subSnap = await adminDb.collection(`${init.type}/${doc.id}/beneficiaries`).get();
                subSnap.forEach(subDoc => {
                    if (!masterIds.has(subDoc.id)) {
                        const masterRef = adminDb.collection('beneficiaries').doc(subDoc.id);
                        const { status, kitAmount, itemCategoryId, itemCategoryName, ...masterData } = subDoc.data();
                        batch.set(masterRef, { ...masterData, status: 'Verified' }, { merge: true });
                        masterIds.add(subDoc.id);
                        addedCount++;
                    }
                });
            }
        }

        if (addedCount > 0) await batch.commit();
        revalidatePath('/beneficiaries');
        return { success: true, message: `Sync Complete. Registered ${addedCount} New Profiles.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function bulkUpdateMasterBeneficiaryStatusAction(
    ids: string[], 
    newStatus: Beneficiary['status'], 
    updatedBy: {id: string, name: string}
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();

            for (const id of chunk) {
                const masterRef = adminDb.collection('beneficiaries').doc(id);
                batch.update(masterRef, { 
                    status: newStatus,
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedById: updatedBy.id,
                    updatedByName: updatedBy.name,
                });
            }
            await batch.commit();
        }

        revalidatePath('/beneficiaries');
        return { success: true, message: `Successfully Updated ${ids.length} Profiles.` };
    } catch (error: any) {
        console.error("Bulk Verification Update Failed:", error);
        return { success: false, message: `Bulk Update Failed: ${error.message}` };
    }
}

export async function bulkUpdateBeneficiaryVettingAction(
    ids: string[],
    newStatus: Beneficiary['status'],
    updatedBy: { id: string, name: string },
    initiativeContext?: { type: 'campaign' | 'lead', id: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();

            for (const id of chunk) {
                const masterRef = adminDb.collection('beneficiaries').doc(id);
                batch.update(masterRef, { 
                    status: newStatus,
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedById: updatedBy.id,
                    updatedByName: updatedBy.name,
                });

                if (initiativeContext) {
                    const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
                    const initiativeSubRef = adminDb.doc(`${collectionName}/${initiativeContext.id}/beneficiaries/${id}`);
                    batch.update(initiativeSubRef, { 
                        verificationStatus: newStatus 
                    });
                }
            }
            await batch.commit();
        }

        revalidatePath('/beneficiaries');
        if (initiativeContext) {
            revalidatePath(`/${initiativeContext.type === 'campaign' ? 'campaign-members' : 'leads-members'}/${initiativeContext.id}/beneficiaries`);
        }
        
        return { success: true, message: `Successfully Updated ${ids.length} Profiles.` };
    } catch (error: any) {
        console.error("Bulk Verification Sync Failed:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

export async function bulkUpdateMasterZakatAction(
    ids: string[],
    isEligible: boolean,
    updatedBy: {id: string, name: string}
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();

            for (const id of chunk) {
                const masterRef = adminDb.collection('beneficiaries').doc(id);
                batch.update(masterRef, { 
                    isEligibleForZakat: isEligible,
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedById: updatedBy.id,
                    updatedByName: updatedBy.name,
                });
            }
            await batch.commit();
        }

        revalidatePath('/beneficiaries');
        return { success: true, message: `Successfully Updated ${ids.length} Profiles.` };
    } catch (error: any) {
        console.error("Bulk Zakat Update Failed:", error);
        return { success: false, message: `Bulk Update Failed: ${error.message}` };
    }
}

export async function bulkUpdateInitiativeBeneficiaryStatusAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    ids: string[],
    newStatus: Beneficiary['status']
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }

    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const CHUNK_SIZE = 400;
        
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();
            
            for (const id of chunk) {
                const docRef = adminDb.doc(`${collectionName}/${initiativeId}/beneficiaries/${id}`);
                batch.update(docRef, { status: newStatus });
            }
            await batch.commit();
        }

        revalidatePath(`/${collectionName}-members/${initiativeId}/beneficiaries`);
        return { success: true, message: `Successfully Updated ${ids.length} Recipients.` };
    } catch (error: any) {
        console.error("Bulk Disbursement Update Failed:", error);
        return { success: false, message: `Bulk Update Failed: ${error.message}` };
    }
}

export async function bulkImportBeneficiariesAction(
    records: Partial<Beneficiary>[], 
    createdBy: {id: string, name: string},
    initiativeContext?: { type: 'campaign' | 'lead', id: string }
): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const batch = adminDb.batch();
        let count = 0;

        for (const record of records) {
            const masterRef = record.id ? adminDb.collection('beneficiaries').doc(record.id) : adminDb.collection('beneficiaries').doc();
            const id = masterRef.id;
            
            const masterData = {
                ...record,
                id,
                status: record.status || 'Verified', 
                addedDate: record.addedDate || new Date().toISOString().split('T')[0],
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                createdById: record.createdById || createdBy.id,
                createdByName: record.createdByName || createdBy.name,
                updatedAt: FieldValue.serverTimestamp(),
                updatedById: createdBy.id,
                updatedByName: createdBy.name,
            };

            const { kitAmount, zakatAllocation, ...cleanMaster } = masterData as any;
            batch.set(masterRef, cleanMaster, { merge: true });

            if (initiativeContext) {
                const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
                const subRef = adminDb.doc(`${collectionName}/${initiativeContext.id}/beneficiaries/${id}`);
                
                const initiativeData = {
                    ...masterData,
                    verificationStatus: masterData.status,
                    status: (record as any).status || 'Pending' 
                };
                
                batch.set(subRef, initiativeData, { merge: true });
            }
            count++;
        }

        await batch.commit();
        revalidatePath('/beneficiaries');
        if (initiativeContext) {
            const path = initiativeContext.type === 'campaign' ? 'campaign-members' : 'leads-members';
            revalidatePath(`/${path}/${initiativeContext.id}/beneficiaries`);
        }
        
        return { success: true, message: `Successfully Registered/Updated ${count} Records In The Registry.`, count };
    } catch (error: any) {
        console.error("Bulk Import Failed:", error);
        return { success: false, message: `Import Failed: ${error.message}`, count: 0 };
    }
}

export async function deleteBeneficiaryAction(beneficiaryId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        const batch = adminDb.batch();
        const masterBeneficiaryRef = adminDb.collection('beneficiaries').doc(beneficiaryId);

        batch.delete(masterBeneficiaryRef);

        const folderPath = `beneficiaries/${beneficiaryId}/`;
        await adminStorage.bucket().deleteFiles({ prefix: folderPath }).catch((storageError: any) => {
            if (storageError.code !== 404) {
                console.warn(`Could Not Delete Beneficiary Artifacts: ${storageError.message}`);
            }
        });

        await batch.commit();

        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: 'Beneficiary Permanently Removed.' };
    } catch (error: any) {
        console.error('Error Deleting Beneficiary:', error);
        return { success: false, message: `Removal Failed: ${error.message}` };
    }
}