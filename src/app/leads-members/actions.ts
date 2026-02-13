
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Lead, Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';

interface CopyLeadOptions {
  sourceLeadId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyRationLists: boolean;
}

const BATCH_SIZE = 400; // Firestore batch write limit is 500

export async function copyLeadAction(options: CopyLeadOptions): Promise<{ success: boolean; message: string }> {
  if (!adminDb) {
    const errorMessage = 'Firebase Admin SDK is not initialized. Lead copy cannot proceed.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  const { sourceLeadId, newName, copyBeneficiaries, copyRationLists } = options;

  try {
    const sourceLeadRef = adminDb.collection('leads').doc(sourceLeadId);
    const sourceLeadSnap = await sourceLeadRef.get();

    if (!sourceLeadSnap.exists) {
      return { success: false, message: 'Source lead not found.' };
    }

    const sourceLeadData = sourceLeadSnap.data() as Lead;
    
    // --- 1. Create the new lead document ---
    const newLeadData: Partial<Lead> = {
      ...sourceLeadData,
      name: newName,
      status: 'Upcoming', // Copied leads should start as Upcoming
      authenticityStatus: 'Pending Verification',
      publicVisibility: 'Hold',
      imageUrl: '', // Reset image URL
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByName: 'System Copy',
      createdById: 'system',
    };

    if (!copyRationLists) {
      newLeadData.itemCategories = [];
    }
    
    delete newLeadData.id;

    const newLeadRef = await adminDb.collection('leads').add(newLeadData);

    // --- 2. Copy Beneficiaries (if requested) ---
    if (copyBeneficiaries) {
      const sourceBeneficiariesRef = sourceLeadRef.collection('beneficiaries');
      const beneficiariesSnap = await sourceBeneficiariesRef.get();
      
      if (!beneficiariesSnap.empty) {
        let batch = adminDb.batch();
        let count = 0;

        for (const doc of beneficiariesSnap.docs) {
            const beneficiaryData = doc.data() as Omit<Beneficiary, 'id'>;
            const newBeneficiaryRef = newLeadRef.collection('beneficiaries').doc();
            
            const newBeneficiaryData = {
                ...beneficiaryData,
                idProofUrl: '', 
                idProofIsPublic: false,
                status: 'Pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdByName: 'System Copy',
                createdById: 'system',
            };
            
            batch.set(newBeneficiaryRef, newBeneficiaryData);
            count++;

            if (count === BATCH_SIZE) {
                await batch.commit();
                batch = adminDb.batch();
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
        }
      }
    }

    revalidatePath('/leads-members');
    return { success: true, message: `Successfully copied lead to '${newName}'.` };

  } catch (error: any) {
    console.error('Error in copyLeadAction:', error);
    return { success: false, message: `An unexpected error occurred during copy: ${error.message}` };
  }
}

export async function deleteLeadAction(leadId: string): Promise<{ success: boolean; message: string }> {
  if (!adminDb || !adminStorage) {
    const errorMessage = 'Firebase Admin SDK is not initialized.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  try {
    const leadRef = adminDb.collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
      return { success: true, message: 'Lead already deleted.' };
    }
    const leadName = leadSnap.data()?.name || 'Unknown Lead';

    const beneficiariesRef = leadRef.collection('beneficiaries');
    const beneficiariesSnap = await beneficiariesRef.get();
    if (!beneficiariesSnap.empty) {
      const batch = adminDb.batch();
      beneficiariesSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    await leadRef.delete();

    const bucket = adminStorage.bucket();
    const prefix = `leads/${leadId}/`;
    await bucket.deleteFiles({ prefix });

    revalidatePath('/leads-members');
    return { success: true, message: `Successfully deleted lead '${leadName}' and all its data.` };
  } catch (error: any) {
    console.error('Error in deleteLeadAction:', error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
