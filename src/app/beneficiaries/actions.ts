
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
