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
        
        let profileId = '';
        let isExisting = false;
        let existingRoles: string[] = [];

        if (lookupSnap.exists) {
            const lookupData = lookupSnap.data();
            profileId = lookupData?.userKey;
            isExisting = true;
            existingRoles = lookupData?.roles || [lookupData?.role];
        }

        const batch = adminDb.batch();
        const docRef = isExisting ? adminDb.collection('donors').doc(profileId) : adminDb.collection('donors').doc();
        if (!isExisting) profileId = docRef.id;

        const donorData = {
            ...data,
            id: profileId,
            phone: cleanPhone,
            status: data.status || 'Active',
            createdAt: isExisting ? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(), // Simplified for now
            updatedAt: FieldValue.serverTimestamp(),
            createdById: createdBy.id,
            createdByName: createdBy.name,
            password: data.password || 'password', 
        };

        if (isExisting) {
            batch.set(docRef, donorData, { merge: true });
        } else {
            batch.set(docRef, donorData);
        }

        // Mirror to 'users' collection for session management
        const userRef = adminDb.collection('users').doc(profileId);
        const userUpdate: any = {
            ...donorData,
            loginId: data.loginId || cleanPhone,
            userKey: profileId,
            linkedDonorId: profileId,
        };
        // Ensure we don't overwrite role if it's already Admin/User
        if (!isExisting) userUpdate.role = 'Donor';
        
        batch.set(userRef, userUpdate, { merge: true });

        // Register/Update in 'user_lookups'
        const roles = Array.from(new Set([...existingRoles, 'Donor']));
        const lookupData = {
            userKey: profileId,
            role: roles[0], // Primary role
            roles: roles,   // All associated roles
            phone: cleanPhone,
            name: data.name,
            email: data.email || '',
            loginId: data.loginId || cleanPhone
        };
        batch.set(lookupRef, lookupData, { merge: true });
        if (data.loginId && data.loginId !== cleanPhone) {
            batch.set(adminDb.collection('user_lookups').doc(data.loginId), lookupData, { merge: true });
        }

        await batch.commit();

        revalidatePath('/donors');
        revalidatePath('/donations');
        return { 
            success: true, 
            message: isExisting ? `Linked to existing identity '${data.name}'.` : 'Donor Profile Registered & Identity Synchronized.', 
            id: profileId 
        };
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
        const oldData = oldSnap.exists ? oldSnap.data() as Donor : {} as Partial<Donor>;

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
            loginId: data.loginId || cleanPhone || oldPhone,
            role: 'Donor',
            telegramChatId: data.telegramChatId || oldData.telegramChatId || '',
            email: data.email || oldData.email || ''
        }, { merge: true });

        // Handle Lookup Synchronization
        const lookupData: any = {
            userKey: donorId,
            role: 'Donor',
            phone: cleanPhone || oldPhone,
            name: data.name || oldData.name,
            email: data.email || oldData.email || '',
            loginId: data.loginId || oldData.loginId || cleanPhone || oldPhone
        };

        if (cleanPhone && cleanPhone !== oldPhone) {
            if (oldPhone) batch.delete(adminDb.collection('user_lookups').doc(oldPhone));
            batch.set(adminDb.collection('user_lookups').doc(cleanPhone), lookupData);
        }
        
        if (data.loginId && data.loginId !== oldData.loginId) {
            if (oldData.loginId) batch.delete(adminDb.collection('user_lookups').doc(oldData.loginId));
            batch.set(adminDb.collection('user_lookups').doc(data.loginId), lookupData);
        } else if (!data.loginId && cleanPhone && cleanPhone !== (data.loginId || oldData.loginId)) {
            // Ensure phone lookup exists if no custom loginId
            batch.set(adminDb.collection('user_lookups').doc(cleanPhone), lookupData);
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
