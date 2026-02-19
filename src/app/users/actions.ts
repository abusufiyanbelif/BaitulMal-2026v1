
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/lib/schemas';
import type { UserProfile } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.";

export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
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
    const { adminAuth, adminDb, adminStorage } = getAdminServices();
    if (!adminAuth || !adminDb || !adminStorage) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    }
    try {
        // Fetch user doc first to get all identifiers for lookup deletion
        const userRef = adminDb.collection('users').doc(uidToDelete);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as UserProfile | undefined;

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
        
        const batch = adminDb.batch();
        // Delete main user document
        batch.delete(userRef);
        
        // Delete all associated lookup documents
        if (userData?.loginId) {
            batch.delete(adminDb.collection('user_lookups').doc(userData.loginId));
        }
        if (userData?.phone) {
            batch.delete(adminDb.collection('user_lookups').doc(userData.phone));
        }
        if (userData?.userKey) {
            batch.delete(adminDb.collection('user_lookups').doc(userData.userKey));
        }

        await batch.commit();
        
        revalidatePath('/users');
        return { success: true, message: 'User permanently deleted from Auth, Firestore, and Storage.' };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, message: `Failed to delete user: ${error.message}` };
    }
}


export async function updateUserAuthAction(uid: string, updates: { email?: string; password?: string }): Promise<{ success: boolean, message: string }> {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) {
        return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
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
