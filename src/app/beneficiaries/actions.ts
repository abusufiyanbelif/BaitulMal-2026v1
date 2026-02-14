
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';

export async function createMasterBeneficiaryAction(data: Omit<Beneficiary, 'id' | 'createdAt' | 'createdById' | 'createdByName'>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
  if (!adminDb) {
    return { success: false, message: 'Firebase Admin SDK is not initialized.' };
  }

  try {
    const newDocRef = adminDb.collection('beneficiaries').doc();
    const newBeneficiaryData = {
      ...data,
      id: newDocRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdById: createdBy.id,
      createdByName: createdBy.name,
    };

    await newDocRef.set(newBeneficiaryData);
    revalidatePath('/beneficiaries');
    return { success: true, message: 'Beneficiary created successfully.', id: newDocRef.id };

  } catch (error: any) {
    console.error('Error in createMasterBeneficiaryAction:', error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

export async function updateMasterBeneficiaryAction(beneficiaryId: string, data: Partial<Beneficiary>, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
  if (!adminDb) {
    return { success: false, message: 'Firebase Admin SDK is not initialized.' };
  }

  try {
    const batch = adminDb.batch();
    const masterRef = adminDb.collection('beneficiaries').doc(beneficiaryId);
    
    const updateData = {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedById: updatedBy.id,
        updatedByName: updatedBy.name,
    };

    batch.update(masterRef, updateData);

    // Find and update all instances in subcollections
    const groupQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
    const subcollectionSnaps = await groupQuery.get();

    for (const doc of subcollectionSnaps.docs) {
      if (doc.ref.path !== masterRef.path) {
        batch.update(doc.ref, updateData);
      }
    }

    await batch.commit();

    revalidatePath('/beneficiaries');
    revalidatePath(`/beneficiaries/${beneficiaryId}`);
    return { success: true, message: 'Beneficiary updated across all records.' };

  } catch (error: any) {
    console.error('Error in updateMasterBeneficiaryAction:', error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

export async function deleteBeneficiaryAction(beneficiaryId: string): Promise<{ success: boolean; message: string }> {
  if (!adminDb || !adminStorage) {
    const errorMessage = 'Firebase Admin SDK is not initialized.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  try {
    const masterRef = adminDb.collection('beneficiaries').doc(beneficiaryId);
    const masterSnap = await masterRef.get();

    if (!masterSnap.exists) {
      return { success: true, message: 'Beneficiary already deleted.' };
    }
    const beneficiaryData = masterSnap.data() as Beneficiary;

    const batch = adminDb.batch();
    const affectedParents: Map<string, { ref: FirebaseFirestore.DocumentReference, amountToSubtract: number }> = new Map();

    // Find all subcollection documents for this beneficiary
    const groupQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
    const subcollectionSnaps = await groupQuery.get();

    for (const docSnap of subcollectionSnaps.docs) {
      if (docSnap.ref.path !== masterRef.path) {
        batch.delete(docSnap.ref);
        const parentRef = docSnap.ref.parent.parent;
        if (parentRef) {
          const kitAmount = docSnap.data().kitAmount || 0;
          if (kitAmount > 0) {
            affectedParents.set(parentRef.path, { ref: parentRef, amountToSubtract: kitAmount });
          }
        }
      }
    }
    
    // Adjust target amounts on parent campaigns/leads
    for (const [, { ref, amountToSubtract }] of affectedParents) {
      batch.update(ref, { targetAmount: admin.firestore.FieldValue.increment(-amountToSubtract) });
    }

    // Delete master document
    batch.delete(masterRef);

    await batch.commit();

    // Delete from Storage after successful DB operations
    if (beneficiaryData.idProofUrl) {
      try {
        const url = new URL(beneficiaryData.idProofUrl);
        const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
        await adminStorage.bucket().file(filePath).delete();
      } catch (storageError: any) {
        console.warn(`Could not delete storage file for beneficiary ${beneficiaryId}. It may not exist.`, storageError);
      }
    }

    revalidatePath('/beneficiaries');
    revalidatePath('/campaign-members', 'layout');
    revalidatePath('/leads-members', 'layout');

    return { success: true, message: `Beneficiary '${beneficiaryData.name}' has been deleted from master list and all linked initiatives.` };

  } catch (error: any) {
    console.error('Error in deleteBeneficiaryAction:', error);
    let message = 'An unexpected error occurred during beneficiary deletion.';
     if (error.code === 'permission-denied') {
        message = 'You do not have permission to perform this action.';
    }
    return { success: false, message: message };
  }
}

export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string; addedCount: number; }> {
    if (!adminDb) {
        return { success: false, message: 'Firebase Admin SDK is not initialized.', addedCount: 0 };
    }

    try {
        let addedCount = 0;
        const masterBeneficiarySnaps = await adminDb.collection('beneficiaries').get();
        const masterBeneficiaryIds = new Set(masterBeneficiarySnaps.docs.map(doc => doc.id));
        const beneficiariesToSync: Map<string, any> = new Map();

        // Get from Campaigns
        const campaignsSnap = await adminDb.collection('campaigns').get();
        for (const campaignDoc of campaignsSnap.docs) {
            const beneficiariesSnap = await campaignDoc.ref.collection('beneficiaries').get();
            beneficiariesSnap.forEach(doc => {
                if (!masterBeneficiaryIds.has(doc.id)) {
                    beneficiariesToSync.set(doc.id, doc.data());
                }
            });
        }

        // Get from Leads
        const leadsSnap = await adminDb.collection('leads').get();
        for (const leadDoc of leadsSnap.docs) {
            const beneficiariesSnap = await leadDoc.ref.collection('beneficiaries').get();
            beneficiariesSnap.forEach(doc => {
                if (!masterBeneficiaryIds.has(doc.id)) {
                     beneficiariesToSync.set(doc.id, doc.data());
                }
            });
        }
        
        if (beneficiariesToSync.size > 0) {
            const batch = adminDb.batch();
            beneficiariesToSync.forEach((data, id) => {
                const masterRef = adminDb.collection('beneficiaries').doc(id);
                // Ensure the 'id' field is present in the data
                const dataWithId = { ...data, id: id };
                batch.set(masterRef, dataWithId, { merge: true });
                addedCount++;
            });
            await batch.commit();
        }
        
        revalidatePath('/beneficiaries');
        if (addedCount > 0) {
            return { success: true, message: `Successfully synced ${addedCount} beneficiaries to the master list.`, addedCount };
        } else {
            return { success: true, message: 'Master beneficiary list is already up to date.', addedCount: 0 };
        }

    } catch (error: any) {
        console.error('Error in syncMasterBeneficiaryListAction:', error);
        return { success: false, message: `An unexpected error occurred: ${error.message}`, addedCount: 0 };
    }
}
