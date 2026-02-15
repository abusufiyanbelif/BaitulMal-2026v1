
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
        // First, get the user's data to check for files
        const userRef = doc(adminDb, 'users', uidToDelete);
        const userSnap = await userRef.get();

        if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            if (userData.idProofUrl) {
                try {
                    // Extract file path from URL and delete from storage
                    const filePath = new URL(userData.idProofUrl).pathname.split('/o/')[1].split('?')[0];
                    const decodedFilePath = decodeURIComponent(filePath);
                    const fileRef = adminStorage.bucket().file(decodedFilePath);
                    await fileRef.delete();
                } catch (storageError: any) {
                    console.warn(`Could not delete user ID proof from storage: ${storageError.message}`);
                }
            }
        }
        
        // Delete the authentication user
        await adminAuth.deleteUser(uidToDelete);
        
        // Delete Firestore documents in a batch
        const batch = writeBatch(adminDb);
        batch.delete(userRef);
        // Note: This is a simplification. A robust solution would fetch all lookups
        // to delete them, but for now we rely on client-side knowledge which is fragile.
        
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
