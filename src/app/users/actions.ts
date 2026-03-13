'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/lib/schemas';
import type { UserProfile, Donor } from '@/lib/types';
import { GROUP_IDS } from '@/lib/modules';
import { FieldValue } from 'firebase-admin/firestore';

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

        // Delete the ID proof file from storage
        const filePath = `users/${uidToDelete}/id_proof.png`;
        const fileRef = adminStorage.bucket().file(filePath);
        await fileRef.delete().catch((storageError: any) => {
            if (storageError.code !== 'storage/object-not-found' && storageError.code !== 404) {
                 console.warn(`Could not delete user ID proof: ${storageError.message}`);
            }
        });
        
        // Delete the authentication user
        await adminAuth.deleteUser(uidToDelete);
        
        const batch = adminDb.batch();
        // Delete main user document
        batch.delete(userRef);
        
        // Delete mirrored donor profile
        batch.delete(adminDb.collection('donors').doc(uidToDelete));
        
        // Delete all associated lookup documents
        if (userData?.loginId) batch.delete(adminDb.collection('user_lookups').doc(userData.loginId));
        if (userData?.phone) batch.delete(adminDb.collection('user_lookups').doc(userData.phone));
        if (userData?.userKey) batch.delete(adminDb.collection('user_lookups').doc(userData.userKey));

        await batch.commit();
        
        revalidatePath('/users');
        revalidatePath('/donors');
        return { success: true, message: 'Member and linked Donor Profile permanently removed.' };
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

export async function getPublicMembersAction(): Promise<Partial<UserProfile>[]> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return [];

    try {
        const membersQuery = adminDb.collection('users').where('organizationGroup', 'in', GROUP_IDS).where('status', '==', 'Active');
        const snapshot = await membersQuery.get();
        if (snapshot.empty) return [];

        const members: Partial<UserProfile>[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            members.push({
                id: doc.id,
                name: data.name,
                organizationGroup: data.organizationGroup,
                organizationRole: data.organizationRole,
                idProofUrl: data.idProofUrl || null,
            });
        });
        return members;
    } catch (error) {
        console.error("Error fetching public members:", error);
        return [];
    }
}

/**
 * Migration utility to ensure all institutional members have mirrored Donor Profiles.
 */
export async function syncAllUsersToDonorsAction(adminUserId: string, adminUserName: string): Promise<{ success: boolean; message: string; count: number }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE, count: 0 };

    try {
        const usersSnap = await adminDb.collection('users').get();
        let count = 0;
        const batch = adminDb.batch();

        for (const userDoc of usersSnap.docs) {
            const user = userDoc.data() as UserProfile;
            const donorRef = adminDb.collection('donors').doc(userDoc.id);
            const donorSnap = await donorRef.get();

            if (!donorSnap.exists) {
                const newDonor: Partial<Donor> = {
                    id: userDoc.id,
                    name: user.name,
                    phone: user.phone || '',
                    email: user.email || '',
                    status: user.status === 'Active' ? 'Active' : 'Inactive',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: adminUserId,
                    createdByName: adminUserName,
                    notes: `Institutional Member (Auto-mirrored during sync)`,
                };
                batch.set(donorRef, newDonor);
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        revalidatePath('/donors');
        return { success: true, message: `Successfully mirrored ${count} members to the donor registry.`, count };
    } catch (error: any) {
        console.error("Member-Donor Sync Failed:", error);
        return { success: false, message: `Sync Failed: ${error.message}`, count: 0 };
    }
}
