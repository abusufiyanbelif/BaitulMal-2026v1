
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';
import { syncInitiativeCollectedTotals } from '../donations/actions';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

export async function createMasterBeneficiaryAction(data: Partial<Beneficiary>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        const docRef = adminDb.collection('beneficiaries').doc();
        await docRef.set({
            ...data,
            id: docRef.id,
            status: data.status || 'Pending',
            addedDate: data.addedDate || new Date().toISOString().split('T')[0],
            createdAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
        });

        revalidatePath('/beneficiaries');
        return { success: true, message: 'Beneficiary Record Registered Successfully.', id: docRef.id };
    } catch (error: any) {
        console.error("Error Creating Beneficiary:", error);
        return { success: false, message: `Registration Failed: ${error.message}` };
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
        const pathPrefix = initiativeType === 'campaign' ? 'campaign-members' : 'leads-members';
        const publicPrefix = initiativeType === 'campaign' ? 'campaign-public' : 'leads-public';
        revalidatePath(`/${pathPrefix}/${initiativeId}/beneficiaries`);
        revalidatePath(`/${pathPrefix}/${initiativeId}/summary`);
        revalidatePath(`/${publicPrefix}/${initiativeId}/summary`);
        
        await syncInitiativeCollectedTotals(adminDb, [{ linkId: initiativeId, linkType: initiativeType }]);
        
        return { success: true, message: 'Beneficiary records synchronized successfully.' };
    } catch (error: any) {
        console.error("Update Failed:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
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
        let totalKitAmountChange = 0;

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
                    kitAmount: Number(kitAmount) || 0,
                    zakatAllocation: Number(zakatAllocation) || 0,
                    verificationStatus: masterData.status,
                    status: (record as any).status || 'Pending' 
                };
                
                batch.set(subRef, initiativeData, { merge: true });
                totalKitAmountChange += (Number(kitAmount) || 0);
            }
            count++;
        }

        if (initiativeContext && totalKitAmountChange !== 0) {
            const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
            const initiativeRef = adminDb.collection(collectionName).doc(initiativeContext.id);
            batch.update(initiativeRef, { 
                targetAmount: FieldValue.increment(totalKitAmountChange),
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        if (initiativeContext) {
            await syncInitiativeCollectedTotals(adminDb, [{ linkId: initiativeContext.id, linkType: initiativeContext.type }]);
        }

        revalidatePath('/beneficiaries');
        if (initiativeContext) {
            const path = initiativeContext.type === 'campaign' ? 'campaign-members' : 'leads-members';
            revalidatePath(`/${path}/${initiativeContext.id}/beneficiaries`);
            revalidatePath(`/${path}/${initiativeContext.id}/summary`);
        }
        
        return { success: true, message: `Successfully Registered/Updated ${count} Records and reconciled initiative goals.`, count };
    } catch (error: any) {
        console.error("Bulk Import Failed:", error);
        return { success: false, message: `Import Failed: ${error.message}`, count: 0 };
    }
}

export async function updateInitiativeBeneficiaryDetailsAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    beneficiaryId: string,
    data: Partial<Beneficiary>
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    
    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const docRef = adminDb.doc(`${collectionName}/${initiativeId}/beneficiaries/${beneficiaryId}`);
        await docRef.set(data, { merge: true });

        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath(`/${collectionName}/${initiativeId}/beneficiaries`);

        return { success: true, message: 'Initiative-Specific Details Registered.' };
    } catch (error: any) {
        console.error("Error Updating Initiative Beneficiary:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

export async function updateBeneficiaryStatusInInitiativeAction(
    initiativeType: 'campaign' | 'lead',
    initiativeId: string,
    beneficiaryId: string,
    newStatus: Beneficiary['status']
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }

    const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
    const docPath = `${collectionName}/${initiativeId}/beneficiaries/${beneficiaryId}`;

    try {
        const docRef = adminDb.doc(docPath);
        await docRef.set({ status: newStatus || 'Pending' }, { merge: true });

        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        return { success: true, message: 'Disbursement Status Updated Successfully.' };
    } catch (error: any) {
        console.error("Error Updating Disbursement Status:", error);
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
        const affectedLinks: { linkId: string, linkType: 'campaign' | 'lead' }[] = [];
        
        for (const subDoc of subquery.docs) {
            const data = subDoc.data() as Beneficiary;
            const pathParts = subDoc.ref.path.split('/');
            const initiativeType = pathParts[0] === 'campaigns' ? 'campaign' : 'lead';
            const initiativeId = pathParts[1];
            
            const initiativeRef = adminDb.collection(pathParts[0]).doc(initiativeId);
            batch.update(initiativeRef, { 
                targetAmount: FieldValue.increment(-(data.kitAmount || 0)),
                updatedAt: FieldValue.serverTimestamp()
            });
            batch.delete(subDoc.ref);
            affectedLinks.push({ linkId: initiativeId, linkType: initiativeType });
        }

        batch.delete(masterRef);

        const bucket = adminStorage.bucket();
        await bucket.deleteFiles({ prefix: `beneficiaries/${beneficiaryId}/` }).catch(() => {});

        await batch.commit();

        if (affectedLinks.length > 0) {
            await syncInitiativeCollectedTotals(adminDb, affectedLinks);
        }

        revalidatePath('/beneficiaries');
        revalidatePath('/dashboard');
        return { success: true, message: 'Beneficiary permanently removed and totals reconciled.' };
    } catch (error: any) {
        console.error("Deletion Failed:", error);
        return { success: false, message: `Removal Failed: ${error.message}` };
    }
}

export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string; addedCount: number; }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, addedCount: 0 };
    }
    
    try {
        const batch = adminDb.batch();
        let addedCount = 0;
        
        const masterBeneficiariesSnap = await adminDb.collection('beneficiaries').get();
        const masterIds = new Set(masterBeneficiariesSnap.docs.map(d => d.id));

        const campaignsSnap = await adminDb.collection('campaigns').get();
        for (const campaignDoc of campaignsSnap.docs) {
            const campaignBeneficiariesSnap = await adminDb.collection(`campaigns/${campaignDoc.id}/beneficiaries`).get();
            for (const benDoc of campaignBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = adminDb.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = benDoc.data();
                    delete sanitizedData.kitAmount;
                    delete sanitizedData.itemCategoryId;
                    delete sanitizedData.itemCategoryName;
                    delete sanitizedData.zakatAllocation;
                    
                    batch.set(masterRef, { ...sanitizedData, status: 'Verified' }, { merge: true });
                    masterIds.add(benDoc.id); 
                    addedCount++;
                }
            }
        }
        
        const leadsSnap = await adminDb.collection('leads').get();
        for (const leadDoc of leadsSnap.docs) {
            const leadBeneficiariesSnap = await adminDb.collection(`leads/${leadDoc.id}/beneficiaries`).get();
            for (const benDoc of leadBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = adminDb.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = benDoc.data();
                    delete sanitizedData.kitAmount;
                    delete sanitizedData.itemCategoryId;
                    delete sanitizedData.itemCategoryName;
                    delete sanitizedData.zakatAllocation;

                    batch.set(masterRef, { ...sanitizedData, status: 'Verified' }, { merge: true });
                    masterIds.add(benDoc.id);
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            await batch.commit();
        }

        revalidatePath('/beneficiaries');
        return { success: true, message: `Synchronization Complete. Discovered ${addedCount} New Registry Entries.`, addedCount };

    } catch (error: any) {
        console.error("Error Syncing Master List:", error);
        return { success: false, message: `Sync Failed: ${error.message}`, addedCount: 0 };
    }
}
