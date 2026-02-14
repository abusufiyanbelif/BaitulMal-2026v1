
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function deleteBeneficiaryAction(beneficiaryId: string): Promise<{ success: boolean; message: string }> {
  if (!adminDb || !adminStorage) {
    const errorMessage = 'Firebase Admin SDK is not initialized.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  try {
    const beneficiaryRef = adminDb.collection('beneficiaries').doc(beneficiaryId);
    const beneficiarySnap = await beneficiaryRef.get();

    if (!beneficiarySnap.exists) {
      return { success: true, message: 'Beneficiary already deleted.' };
    }

    const beneficiaryData = beneficiarySnap.data() as Beneficiary;

    // Delete from Firestore
    await beneficiaryRef.delete();

    // Delete from Storage
    if (beneficiaryData.idProofUrl) {
      try {
        const url = new URL(beneficiaryData.idProofUrl);
        const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
        await adminStorage.bucket().file(filePath).delete();
      } catch (storageError) {
        console.error(`Could not delete storage file for beneficiary ${beneficiaryId}. It may not exist.`, storageError);
      }
    }

    revalidatePath('/beneficiaries');
    return { success: true, message: `Beneficiary '${beneficiaryData.name}' has been deleted.` };

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
