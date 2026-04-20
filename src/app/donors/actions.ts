'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Donor } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

/**
 * Creates a new donor profile. 
 * Includes a duplicate check by phone number to prevent registry fragmentation.
 */
export async function createDonorAction(data: Partial<Donor>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        // 1. Prevent duplicate profiles by phone number
        if (data.phone && data.phone.trim().length >= 10) {
            const existingQuery = await adminDb.collection('donors').where('phone', '==', data.phone.trim()).limit(1).get();
            if (!existingQuery.empty) {
                const existingDonor = existingQuery.docs[0];
                return { 
                    success: false, 
                    message: `A verified profile for '${existingDonor.data().name}' already exists with this phone number. Please link this contribution to the existing profile instead.`,
                    id: existingDonor.id
                };
            }
        }

        // 2. Register New Identity
        const docRef = adminDb.collection('donors').doc();
        await docRef.set({
            ...data,
            id: docRef.id,
            status: data.status || 'Active',
            createdAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
        });

        revalidatePath('/donors');
        revalidatePath('/donations');
        return { success: true, message: 'Donor Profile Registered Successfully.', id: docRef.id };
    } catch (error: any) {
        console.error("Error Creating Donor:", error);
        return { success: false, message: `Registration Failed: ${error.message}` };
    }
}

export async function updateDonorAction(donorId: string, data: Partial<Donor>, updatedBy: {id: string, name: string}): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const docRef = adminDb.collection('donors').doc(donorId);
        await docRef.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        });

        revalidatePath(`/donors/${donorId}`);
        revalidatePath('/donors');
        return { success: true, message: 'Donor Profile Updated Successfully.' };
    } catch (error: any) {
        console.error("Error Updating Donor:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}

/**
 * Removes a donor profile after safely unlinking all associated donations.
 */
export async function deleteDonorAction(donorId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donorRef = adminDb.collection('donors').doc(donorId);
        const donorSnap = await donorRef.get();
        
        if (!donorSnap.exists) {
            return { success: true, message: 'Record already purged from registry.' };
        }

        const batch = adminDb.batch();
        
        // 1. Identification & Unlinking: Preserve financial audit trail
        const donationsSnap = await adminDb.collection('donations').where('donorId', '==', donorId).get();
        
        donationsSnap.forEach(docSnap => {
            batch.update(docSnap.ref, { 
                donorId: null, 
                updatedAt: FieldValue.serverTimestamp() 
            });
        });

        // 2. Delete the actual identity profile
        batch.delete(donorRef);
        
        await batch.commit();
        
        revalidatePath('/donors');
        revalidatePath('/donations');
        revalidatePath('/dashboard');
        
        return { success: true, message: 'Donor Profile Purged. Associated donations preserved as unlinked records.' };
    } catch (error: any) {
        console.error("Error Deleting Donor Record:", error);
        return { success: false, message: `Removal operation failed: ${error.message}` };
    }
}

export async function bulkImportDonorsAction(records: Partial<Donor>[], createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const batch = adminDb.batch();
        let count = 0;

        for (const record of records) {
            const docRef = record.id ? adminDb.collection('donors').doc(record.id) : adminDb.collection('donors').doc();
            const id = docRef.id;
            
            batch.set(docRef, {
                ...record,
                id,
                status: record.status || 'Active',
                createdAt: record.createdAt || FieldValue.serverTimestamp(),
                createdById: record.createdById || createdBy.id,
                createdByName: record.createdByName || createdBy.name,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            count++;
        }

        await batch.commit();
        revalidatePath('/donors');
        return { success: true, message: `Successfully Synchronized ${count} Donor Profiles.`, count };
    } catch (error: any) {
        console.error("Bulk Import Failed:", error);
        return { success: false, message: `Import Failed: ${error.message}`, count: 0 };
    }
}
