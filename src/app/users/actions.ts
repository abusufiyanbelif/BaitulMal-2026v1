
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import { doc, writeBatch } from 'firebase-admin/firestore';
import type { UserFormData } from '@/components/user-form';

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
    if (!adminAuth || !adminDb) {
        return { success: false, message: 'Admin services are not initialized.' };
    }
    try {
        await adminAuth.deleteUser(uidToDelete);
        
        const batch = writeBatch(adminDb);
        const userRef = doc(adminDb, 'users', uidToDelete);
        batch.delete(userRef);
        
        // This is a simplification; a robust solution would fetch all lookups
        // to delete them, but for now we delete known ones.
        
        await batch.commit();
        
        revalidatePath('/users');
        return { success: true, message: 'User permanently deleted from Auth and Firestore.' };
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
