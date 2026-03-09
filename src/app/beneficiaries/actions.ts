
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';

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
            const masterRef = adminDb.collection('beneficiaries').doc();
            const id = masterRef.id;
            const fullRecord = {
                ...record,
                id,
                status: record.status || 'Pending',
                addedDate: record.addedDate || new Date().toISOString().split('T')[0],
                createdAt: FieldValue.serverTimestamp(),
                createdById: createdBy.id,
                createdByName: createdBy.name,
            };

            batch.set(masterRef, fullRecord);

            if (initiativeContext) {
                const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
                const subRef = adminDb.doc(`${collectionName}/${initiativeContext.id}/beneficiaries/${id}`);
                batch.set(subRef, {
                    ...fullRecord,
                    verificationStatus: fullRecord.status,
                    status: 'Pending' 
                });
            }
            count++;
        }

        await batch.commit();
        revalidatePath('/beneficiaries');
        if (initiativeContext) revalidatePath(`/${initiativeContext.type === 'campaign' ? 'campaign-members' : 'leads-members'}/${initiativeContext.id}/beneficiaries`);
        
        return { success: true, message: `Successfully Imported ${count} Records Into The Registry.`, count };
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
