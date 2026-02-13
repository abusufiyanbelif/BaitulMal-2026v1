
'use server';

import { adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { Campaign, Beneficiary, Donation } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';

interface CopyCampaignOptions {
  sourceCampaignId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyDonations: boolean;
  copyRationLists: boolean;
}

const BATCH_SIZE = 400; // Firestore batch write limit is 500

export async function copyCampaignAction(options: CopyCampaignOptions): Promise<{ success: boolean; message: string }> {
  if (!adminDb) {
    const errorMessage = 'Firebase Admin SDK is not initialized. Campaign copy cannot proceed.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  const { sourceCampaignId, newName, copyBeneficiaries, copyDonations, copyRationLists } = options;

  try {
    const sourceCampaignRef = adminDb.collection('campaigns').doc(sourceCampaignId);
    const sourceCampaignSnap = await sourceCampaignRef.get();

    if (!sourceCampaignSnap.exists) {
      return { success: false, message: 'Source campaign not found.' };
    }

    const sourceCampaignData = sourceCampaignSnap.data() as Campaign;
    
    // --- 1. Create the new campaign document ---
    const newCampaignData: Partial<Campaign> = {
      ...sourceCampaignData,
      name: newName,
      status: 'Upcoming', // Copied campaigns should start as Upcoming
      authenticityStatus: 'Pending Verification',
      publicVisibility: 'Hold',
      imageUrl: '', // Reset image URL for the new campaign
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // We assume the copier is the creator. In a real app you'd pass the userId.
      createdByName: 'System Copy',
      createdById: 'system',
    };

    if (!copyRationLists) {
      newCampaignData.itemCategories = [];
    }
    
    // Remove ID from data object
    delete newCampaignData.id;

    const newCampaignRef = await adminDb.collection('campaigns').add(newCampaignData);
    const newCampaignId = newCampaignRef.id;

    // --- 2. Copy Beneficiaries (if requested) ---
    if (copyBeneficiaries) {
      const sourceBeneficiariesRef = sourceCampaignRef.collection('beneficiaries');
      const beneficiariesSnap = await sourceBeneficiariesRef.get();
      
      if (!beneficiariesSnap.empty) {
        let batch = adminDb.batch();
        let count = 0;

        for (const doc of beneficiariesSnap.docs) {
            const beneficiaryData = doc.data() as Omit<Beneficiary, 'id'>;
            const newBeneficiaryRef = newCampaignRef.collection('beneficiaries').doc();
            
            // Create new record, keeping most data but updating timestamps etc.
            const newBeneficiaryData = {
                ...beneficiaryData,
                idProofUrl: '', // Don't copy over sensitive files
                idProofIsPublic: false,
                status: 'Pending', // Reset status for the new campaign
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
    
    // --- 3. Copy Donations (if requested) ---
    if (copyDonations) {
        const sourceDonationsQuery = adminDb.collection('donations').where('campaignId', '==', sourceCampaignId);
        const donationsSnap = await sourceDonationsQuery.get();

        if (!donationsSnap.empty) {
            let batch = adminDb.batch();
            let count = 0;

            for (const doc of donationsSnap.docs) {
                const donationData = doc.data() as Omit<Donation, 'id'>;
                const newDonationRef = adminDb.collection('donations').doc();

                const newDonationData = {
                    ...donationData,
                    campaignId: newCampaignId, // Link to the NEW campaign
                    campaignName: newName,
                    screenshotUrl: '', // Don't copy over sensitive files
                    screenshotIsPublic: false,
                    status: 'Pending', // Reset status for the new campaign
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    uploadedBy: 'System Copy',
                    uploadedById: 'system',
                };
                
                batch.set(newDonationRef, newDonationData);
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

    revalidatePath('/campaign-members');
    return { success: true, message: `Successfully copied campaign to '${newName}'.` };

  } catch (error: any) {
    console.error('Error in copyCampaignAction:', error);
    return { success: false, message: `An unexpected error occurred during copy: ${error.message}` };
  }
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; message: string }> {
  if (!adminDb || !adminStorage) {
    const errorMessage = 'Firebase Admin SDK is not initialized.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  try {
    // Get campaign name before deleting for toast message
    const campaignRef = adminDb.collection('campaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      return { success: true, message: 'Campaign already deleted.' };
    }
    const campaignName = campaignSnap.data()?.name || 'Unknown Campaign';

    // Delete beneficiaries subcollection in batches
    const beneficiariesRef = campaignRef.collection('beneficiaries');
    const beneficiariesSnap = await beneficiariesRef.get();
    if (!beneficiariesSnap.empty) {
      const batch = adminDb.batch();
      beneficiariesSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete the main campaign document
    await campaignRef.delete();

    // Delete files from Storage folder
    const bucket = adminStorage.bucket();
    const prefix = `campaigns/${campaignId}/`;
    await bucket.deleteFiles({ prefix });

    revalidatePath('/campaign-members');
    return { success: true, message: `Successfully deleted campaign '${campaignName}' and all its data.` };
  } catch (error: any) {
    console.error('Error in deleteCampaignAction:', error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
