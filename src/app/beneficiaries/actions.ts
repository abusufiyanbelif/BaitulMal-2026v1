
'use server';

import { adminDb } from '@/lib/firebase-admin-sdk';
import type { Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { collection, getDocs, doc, writeBatch, serverTimestamp, addDoc, updateDoc, deleteDoc, type DocumentData, type QuerySnapshot, FieldValue } from 'firebase-admin/firestore';

export async function createMasterBeneficiaryAction(data: Omit<Beneficiary, 'id' | 'createdAt' | 'createdById' | 'createdByName' | 'updatedAt' | 'updatedByName' | 'addedDate'>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    if (!adminDb) {
        return { success: false, message: "Database service is not initialized." };
    }
    try {
        const docRef = await addDoc(collection(adminDb, 'beneficiaries'), {
            ...data,
            addedDate: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp(),
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
    if (!adminDb) {
        return { success: false, message: "Database service is not initialized." };
    }
    try {
        const docRef = doc(adminDb, 'beneficiaries', beneficiaryId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        });
        revalidatePath(`/beneficiaries/${beneficiaryId}`);
        revalidatePath('/beneficiaries');
        return { success: true, message: 'Beneficiary updated successfully.' };
    } catch (error: any) {
        console.error("Error updating beneficiary:", error);
        return { success: false, message: `Failed to update beneficiary: ${error.message}` };
    }
}

export async function deleteBeneficiaryAction(beneficiaryId: string): Promise<{ success: boolean; message: string }> {
  if (!adminDb) {
    return { success: false, message: 'Database service is not initialized.' };
  }
  try {
    // This action only deletes from the master list. Deletion from campaigns/leads is handled there.
    await deleteDoc(doc(adminDb, 'beneficiaries', beneficiaryId));
    revalidatePath('/beneficiaries');
    return { success: true, message: 'Beneficiary deleted from the master list.' };
  } catch (error: any) {
    console.error('Error deleting beneficiary:', error);
    return { success: false, message: `Failed to delete beneficiary: ${error.message}` };
  }
}

export async function syncMasterBeneficiaryListAction(): Promise<{ success: boolean; message: string; addedCount: number; }> {
    if (!adminDb) {
        return { success: false, message: "Database service is not initialized.", addedCount: 0 };
    }
    
    try {
        const batch = writeBatch(adminDb);
        let addedCount = 0;
        
        const masterBeneficiariesSnap = await getDocs(collection(adminDb, 'beneficiaries'));
        const masterIds = new Set(masterBeneficiariesSnap.docs.map(d => d.id));

        const campaignsSnap = await getDocs(collection(adminDb, 'campaigns'));
        for (const campaignDoc of campaignsSnap.docs) {
            const campaignBeneficiariesSnap = await getDocs(collection(adminDb, `campaigns/${campaignDoc.id}/beneficiaries`));
            for (const benDoc of campaignBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = doc(adminDb, 'beneficiaries', benDoc.id);
                    batch.set(masterRef, benDoc.data());
                    masterIds.add(benDoc.id); // Avoid re-adding if found in another campaign
                    addedCount++;
                }
            }
        }
        
        const leadsSnap = await getDocs(collection(adminDb, 'leads'));
        for (const leadDoc of leadsSnap.docs) {
            const leadBeneficiariesSnap = await getDocs(collection(adminDb, `leads/${leadDoc.id}/beneficiaries`));
            for (const benDoc of leadBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    const masterRef = doc(adminDb, 'beneficiaries', benDoc.id);
                    batch.set(masterRef, benDoc.data());
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
