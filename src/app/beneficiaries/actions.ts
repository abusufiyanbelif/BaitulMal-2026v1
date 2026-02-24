
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

function sanitizeBeneficiaryForMasterList(data: DocumentData): Partial<Beneficiary> {
    const { status, kitAmount, itemCategoryId, itemCategoryName, ...masterData } = data;
    return masterData;
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
            id: docRef.id, // Explicitly set the ID in the document
            createdAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
        });

        revalidatePath('/beneficiaries');
        return { success: true, message: 'Beneficiary created successfully.', id: docRef.id };
    } catch (error: any) {
        console.error("Error creating beneficiary:", error);
        return { success: false, message: `Failed to create beneficiary: ${error.message}` };
    }
}

export async function updateMasterBeneficiaryAction(beneficiaryId: string, data: Partial<Beneficiary>, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        const batch = adminDb.batch();
        const masterBeneficiaryRef = adminDb.collection('beneficiaries').doc(beneficiaryId);

        // Use set with merge to create the document if it doesn't exist.
        // This prevents FAILED_PRECONDITION errors if a beneficiary exists in a
        // subcollection but not in the master list yet.
        batch.set(masterBeneficiaryRef, {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        }, { merge: true });


        // Explicitly define which master fields to propagate to sub-collections.
        // This prevents overwriting initiative-specific fields like `status` or `kitAmount`.
        const fieldsToPropagate: (keyof Beneficiary)[] = [
            'name', 'address', 'phone', 'age', 'occupation', 'members',
            'earningMembers', 'male', 'female', 'idProofType', 'idNumber',
            'idProofUrl', 'idProofFilename', 'idProofIsPublic', 'referralBy', 'notes',
            'isEligibleForZakat', 'zakatAllocation'
        ];

        const subCollectionData: Partial<Beneficiary> = {};
        for (const field of fieldsToPropagate) {
            if (field in data) {
                (subCollectionData as any)[field] = (data as any)[field];
            }
        }
        
        // Find and update all instances in subcollections
        const allInstancesQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
        const allInstancesSnap = await allInstancesQuery.get();

        if (Object.keys(subCollectionData).length > 0) {
            allInstancesSnap.forEach(docSnap => {
                // Don't re-update the master document that was found in the collection group query
                if (docSnap.ref.path !== masterBeneficiaryRef.path) {
                    batch.set(docSnap.ref, subCollectionData, { merge: true });
                }
            });
        }

        // Commit the batch
        await batch.commit();

        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: `Beneficiary updated successfully across the system.` };
    } catch (error: any) {
        console.error("Error updating beneficiary:", error);
        return { success: false, message: `Failed to update beneficiary: ${error.message}` };
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
        await docRef.update({ status: newStatus });

        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        return { success: true, message: 'Beneficiary status updated successfully.' };
    } catch (error: any) {
        console.error("Error updating beneficiary status:", error);
        return { success: false, message: `Failed to update status: ${error.message}` };
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

        // Find all instances of this beneficiary in subcollections (campaigns and leads)
        const allBeneficiaryInstancesQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
        const allBeneficiaryInstancesSnap = await allBeneficiaryInstancesQuery.get();

        for (const docSnap of allBeneficiaryInstancesSnap.docs) {
            // Decrement the target amount on the parent campaign/lead
            const parentRef = docSnap.ref.parent.parent;
            if (parentRef) {
                const beneficiaryData = docSnap.data() as Beneficiary;
                const amountToSubtract = beneficiaryData.kitAmount || 0;
                if (amountToSubtract > 0) {
                    batch.update(parentRef, { targetAmount: FieldValue.increment(-amountToSubtract) });
                }
            }
            // Add each subcollection instance to the delete batch
            batch.delete(docSnap.ref);
        }

        // Also delete the master document
        batch.delete(masterBeneficiaryRef);

        // Delete the ID proof file from storage using a predictable path
        const filePath = `beneficiaries/${beneficiaryId}/id_proof.png`;
        const fileRef = adminStorage.bucket().file(filePath);
        await fileRef.delete().catch((storageError: any) => {
            // We only log a warning if the file doesn't exist, as it might not have been uploaded.
            if (storageError.code !== 'storage/object-not-found') {
                console.warn(`Could not delete beneficiary ID proof from storage: ${storageError.message}`);
            }
        });

        // Commit all deletions at once
        await batch.commit();

        revalidatePath('/beneficiaries');
        revalidatePath('/campaign-members', 'layout');
        revalidatePath('/leads-members', 'layout');

        return { success: true, message: 'Beneficiary permanently deleted from the master list and all linked initiatives.' };
    } catch (error: any) {
        console.error('Error deleting beneficiary:', error);
        return { success: false, message: `Failed to delete beneficiary: ${error.message}` };
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
                    const sanitizedData = sanitizeBeneficiaryForMasterList(benDoc.data());
                    batch.set(masterRef, sanitizedData, { merge: true });
                    masterIds.add(benDoc.id); // Avoid re-adding if found in another campaign
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
        return { success: true, message: `Sync complete. Added ${addedCount} new beneficiaries to the master list.`, addedCount };

    } catch (error: any) {
        console.error("Error syncing master beneficiary list:", error);
        return { success: false, message: `Sync failed: ${error.message}`, addedCount: 0 };
    }
}
