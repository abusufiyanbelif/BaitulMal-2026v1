
'use server';

import { adminDb, adminAuth, adminStorage } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import { doc, writeBatch } from 'firebase-admin/firestore';
import type { UserFormData } from '@/components/user-form';
import type { UserProfile } from '@/lib/types';

export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
    if (!adminAuth) {
        return { success: false, message: 'Authentication service is not initialized.' };
    }
    try {
        const userRecord = await adminAuth.createUser({
            email: data.email,
            emailVerified: true,
            password: data.password,
            displayName: data.name,
            disabled: data.status === 'Inactive',
        });
        revalidatePath('/users');
        return { success: true, message: 'User created in Firebase Authentication.', uid: userRecord.uid };
    } catch (error: any) {
        console.error("Error creating auth user:", error);
        return { success: false, message: `Failed to create authentication user: ${error.message}` };
    }
}

export async function deleteUserAction(uidToDelete: string): Promise<{ success: boolean; message: string }> {
    if (!adminAuth || !adminDb || !adminStorage) {
        return { success: false, message: 'Admin services are not initialized.' };
    }
    try {
        // Delete the ID proof file from storage using a predictable path
        const filePath = `users/${uidToDelete}/id_proof.png`;
        const fileRef = adminStorage.bucket().file(filePath);
        await fileRef.delete().catch((storageError: any) => {
            // We only log a warning if the file doesn't exist, as it might not have been uploaded.
            if (storageError.code !== 'storage/object-not-found') {
                 console.warn(`Could not delete user ID proof from storage: ${storageError.message}`);
            }
        });
        
        // Delete the authentication user
        await adminAuth.deleteUser(uidToDelete);
        
        // Note: For a robust lookup deletion, you'd fetch the user doc first,
        // get all identifiers (loginId, phone, etc.), and delete each lookup doc.
        // This is a simplified approach assuming client-side logic is the main source of lookups.
        const batch = writeBatch(adminDb);
        const userRef = doc(adminDb, 'users', uidToDelete);
        batch.delete(userRef);
        
        await batch.commit();
        
        revalidatePath('/users');
        return { success: true, message: 'User permanently deleted from Auth, Firestore, and Storage.' };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, message: `Failed to delete user: ${error.message}` };
    }
}


export async function updateUserAuthAction(uid: string, updates: { email?: string; password?: string }): Promise<{ success: boolean, message: string }> {
    if (!adminAuth) {
        return { success: false, message: 'Authentication service is not initialized.' };
    }
    try {
        await adminAuth.updateUser(uid, updates);
        revalidatePath(`/users/${uid}`);
        revalidatePath('/users');
        return { success: true, message: 'User authentication details updated.' };
    } catch (error: any) {
        console.error("Error updating auth user:", error);
        return { success: false, message: `Failed to update auth details: ${error.message}` };
    }
}
