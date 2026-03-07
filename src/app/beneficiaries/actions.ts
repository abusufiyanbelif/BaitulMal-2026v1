'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

function sanitizeBeneficiaryForMasterList(data: DocumentData): Partial<Beneficiary> {
    const { kitAmount, itemCategoryId, itemCategoryName, zakatAllocation, ...masterData } = data;
    // Map 'Given' to 'Verified' for master list, otherwise keep it or default to 'Pending'
    const status = data.status === 'Given' ? 'Verified' : (data.status || 'Pending');
    return {
        ...masterData,
        status: status as any,
    };
}

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
        return { success: true, message: 'Beneficiary Created Successfully.', id: docRef.id };
    } catch (error: any) {
        console.error("Error creating beneficiary:", error);
        return { success: false, message: `Failed To Create Beneficiary: ${error.message}` };
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

        // Ensure status doesn't become null/empty
        const statusToSet = status || 'Pending';

        await masterBeneficiaryRef.set({
            ...masterData,
            status: statusToSet,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        }, { merge: true });
        
        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: `Beneficiary Master Record Updated.` };
    } catch (error: any) {
        console.error("Error updating master beneficiary:", error);
        return { success: false, message: `Failed To Update Beneficiary: ${error.message}` };
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

        return { success: true, message: 'Initiative-Specific Details Updated.' };
    } catch (error: any) {
        console.error("Error updating initiative beneficiary:", error);
        return { success: false, message: `Failed To Update: ${error.message}` };
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
        return { success: true, message: 'Beneficiary Status Updated Successfully.' };
    } catch (error: any) {
        console.error("Error updating beneficiary status:", error);
        return { success: false, message: `Failed To Update Status: ${error.message}` };
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

        const allBeneficiaryInstancesQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
        const allBeneficiaryInstancesSnap = await allBeneficiaryInstancesQuery.get();

        for (const docSnap of allBeneficiaryInstancesSnap.docs) {
            const parentRef = docSnap.ref.parent.parent;
            if (parentRef) {
                const beneficiaryData = docSnap.data() as Beneficiary;
                const amountToSubtract = beneficiaryData.kitAmount || 0;
                if (amountToSubtract > 0) {
                    batch.update(parentRef, { targetAmount: FieldValue.increment(-amountToSubtract) });
                }
            }
            batch.delete(docSnap.ref);
        }

        batch.delete(masterBeneficiaryRef);

        const folderPath = `beneficiaries/${beneficiaryId}/`;
        await adminStorage.bucket().deleteFiles({ prefix: folderPath }).catch((storageError: any) => {
            if (storageError.code !== 404) {
                console.warn(`Could Not Delete Beneficiary Files From Storage: ${storageError.message}`);
            }
        });

        await batch.commit();

        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: 'Beneficiary Permanently Deleted From Master List And All Linked Initiatives.' };
    } catch (error: any) {
        console.error('Error deleting beneficiary:', error);
        return { success: false, message: `Failed To Delete Beneficiary: ${error.message}` };
    }
}

export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string; addedCount: number; }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, addedCount: 0 };
    }
    
    const db = adminDb;
    try {
        const batch = db.batch();
        let addedCount = 0;
        
        const masterBeneficiariesSnap = await db.collection('beneficiaries').get();
        const masterIds = new Set(masterBeneficiariesSnap.docs.map(d => d.id));

        const campaignsSnap = await db.collection('campaigns').get();
        for (const campaignDoc of campaignsSnap.docs) {
            const campaignBeneficiariesSnap = await db.collection(`campaigns/${campaignDoc.id}/beneficiaries`).get();
            for (const benDoc of campaignBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = db.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = sanitizeBeneficiaryForMasterList(benDoc.data());
                    batch.set(masterRef, sanitizedData, { merge: true });
                    masterIds.add(benDoc.id); 
                    addedCount++;
                }
            }
        }
        
        const leadsSnap = await db.collection('leads').get();
        for (const leadDoc of leadsSnap.docs) {
            const leadBeneficiariesSnap = await db.collection(`leads/${leadDoc.id}/beneficiaries`).get();
            for (const benDoc of leadBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = db.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = sanitizeBeneficiaryForMasterList(benDoc.data());
                    batch.set(masterRef, sanitizedData, { merge: true });
                    masterIds.add(benDoc.id);
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            await batch.commit();
        }

        revalidatePath('/beneficiaries');
        return { success: true, message: `Sync Complete. Added ${addedCount} New Beneficiaries To Master List.`, addedCount };

    } catch (error: any) {
        console.error("Error syncing master beneficiary list:", error);
        return { success: false, message: `Sync Failed: ${error.message}`, addedCount: 0 };
    }
}