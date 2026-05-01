'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import type { Donor } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { recordAuditLogAction } from '../audit/actions';
import { generateChanges } from '@/lib/utils';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Ensure Server Credentials Are Configured Correctly.";

/**
 * Creates a new donor profile. 
 */
export async function createDonorAction(data: Partial<Donor>, createdBy: {id: string, name: string}): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cleanPhone = data.phone?.trim().replace(/\D/g, '').slice(-10) || '';
        
        if (cleanPhone.length !== 10) {
            return { success: false, message: "A valid 10-digit mobile number is required for registration." };
        }

        // Check for existing records using the cleaned phone
        const lookupRef = adminDb.collection('user_lookups').doc(cleanPhone);
        const lookupSnap = await lookupRef.get();
        
        if (lookupSnap.exists) {
            const lookupData = lookupSnap.data();
            return { 
                success: false, 
                message: `An identity for '${lookupData?.name || 'User'}' already exists with this phone number.`,
                id: lookupData?.userKey
            };
        }

        const batch = adminDb.batch();
        const docRef = adminDb.collection('donors').doc();
        const profileId = docRef.id;

        const donorData = {
            ...data,
            id: profileId,
            phone: cleanPhone,
            status: data.status || 'Active',
            createdAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
            password: data.password || 'password', // Default password as requested
        };

        batch.set(docRef, donorData);

        // Mirror to 'users' collection for session management
        batch.set(adminDb.collection('users').doc(profileId), {
            ...donorData,
            role: 'Donor',
            loginId: cleanPhone,
            userKey: profileId,
            permissions: {},
        });

        // Register in 'user_lookups'
        batch.set(lookupRef, {
            userKey: profileId,
            role: 'Donor',
            phone: cleanPhone,
            name: data.name
        });

        await batch.commit();

        revalidatePath('/donors');
        revalidatePath('/donations');
        return { success: true, message: 'Donor Profile Registered & Identity Synchronized.', id: profileId };
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
        const oldSnap = await docRef.get();
        const oldData = oldSnap.exists ? oldSnap.data() : {};

        const cleanPhone = data.phone?.trim().replace(/\D/g, '').slice(-10);
        const oldPhone = oldData?.phone?.trim().replace(/\D/g, '').slice(-10);

        const updatePayload: any = {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedById: updatedBy.id,
            updatedByName: updatedBy.name,
        };

        if (cleanPhone) updatePayload.phone = cleanPhone;

        const batch = adminDb.batch();
        batch.set(docRef, updatePayload, { merge: true });

        // Update Mirrored User
        batch.set(adminDb.collection('users').doc(donorId), {
            ...updatePayload,
            loginId: cleanPhone || oldPhone,
            role: 'Donor'
        }, { merge: true });

        // Handle Lookup Synchronization
        if (cleanPhone && cleanPhone !== oldPhone) {
            if (oldPhone) batch.delete(adminDb.collection('user_lookups').doc(oldPhone));
            batch.set(adminDb.collection('user_lookups').doc(cleanPhone), {
                userKey: donorId,
                role: 'Donor',
                phone: cleanPhone,
                name: data.name || oldData.name
            });
        } else if (cleanPhone && !oldPhone) {
             batch.set(adminDb.collection('user_lookups').doc(cleanPhone), {
                userKey: donorId,
                role: 'Donor',
                phone: cleanPhone,
                name: data.name || oldData.name
            });
        }

        await batch.commit();

        // Log Audit
        const changes = generateChanges(oldData, updatePayload);
        if (changes.length > 0) {
            await recordAuditLogAction({
                module: 'donors',
                targetId: donorId,
                action: 'Update',
                description: `Manual update to donor profile for ${oldData?.name || donorId}`,
                changes,
                performedBy: updatedBy,
                timestamp: new Date().toISOString()
            });
        }

        revalidatePath(`/donors/${donorId}`);
        revalidatePath('/donors');
        return { success: true, message: 'Donor Profile Synchronized System-Wide.' };
    } catch (error: any) {
        console.error("Error Updating Donor:", error);
        return { success: false, message: `Update Failed: ${error.message}` };
    }
}


/**
 * Removes a donor profile after safely unlinking all associated donations.
 */
export async function deleteDonorAction(donorId: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donorRef = adminDb.collection('donors').doc(donorId);
        const donorSnap = await donorRef.get();
        
        if (!donorSnap.exists) {
            return { success: true, message: 'Record already purged from registry.' };
        }

        const batch = adminDb.batch();
        const donationsSnap = await adminDb.collection('donations').where('donorId', '==', donorId).get();
        donationsSnap.forEach((docSnap: any) => {
            batch.update(docSnap.ref, { 
                donorId: null, 
                updatedAt: FieldValue.serverTimestamp() 
            });
        });

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
