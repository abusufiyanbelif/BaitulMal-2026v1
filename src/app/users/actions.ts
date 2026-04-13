
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
        const userRef = adminDb.collection('users').doc(uidToDelete);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as UserProfile | undefined;

        const filePath = `users/${uidToDelete}/id_proof.png`;
        const fileRef = adminStorage.bucket().file(filePath);
        await fileRef.delete().catch((storageError: any) => {
            if (storageError.code !== 'storage/object-not-found' && storageError.code !== 404) {
                 console.warn(`Could not delete user ID proof: ${storageError.message}`);
            }
        });
        
        await adminAuth.deleteUser(uidToDelete);
        
        const batch = adminDb.batch();
        batch.delete(userRef);
        
        // UNLINK associated donations to keep contributions intact as "dummy" records
        const donationsSnap = await adminDb.collection('donations').where('donorId', '==', uidToDelete).get();
        donationsSnap.forEach(docSnap => {
            batch.update(docSnap.ref, { 
                donorId: null, 
                updatedAt: FieldValue.serverTimestamp() 
            });
        });

        // Delete mirrored donor profile
        batch.delete(adminDb.collection('donors').doc(uidToDelete));
        
        if (userData?.loginId) batch.delete(adminDb.collection('user_lookups').doc(userData.loginId));
        if (userData?.phone) batch.delete(adminDb.collection('user_lookups').doc(userData.phone));
        if (userData?.userKey) batch.delete(adminDb.collection('user_lookups').doc(userData.userKey));

        await batch.commit();
        
        revalidatePath('/users');
        revalidatePath('/donors');
        revalidatePath('/donations');
        return { success: true, message: 'Member account removed. Financial contributions have been preserved as unlinked records.' };
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
                    notes: `Institutional Member Profile (Auto-mirrored during sync)`,
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

/**
 * Mirror a single individual user to the donor registry.
 */
export async function mirrorIndividualUserToDonorAction(userId: string, adminUserId: string, adminUserName: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) throw new Error("User not found.");
        
        const user = userDoc.data() as UserProfile;
        const donorRef = adminDb.collection('donors').doc(userId);
        
        const donorData: any = {
            id: userId,
            name: user.name,
            phone: user.phone || '',
            email: user.email || '',
            status: user.status === 'Active' ? 'Active' : 'Inactive',
            updatedAt: FieldValue.serverTimestamp(),
        };

        const donorSnap = await donorRef.get();
        if (!donorSnap.exists) {
            donorData.createdAt = FieldValue.serverTimestamp();
            donorData.createdById = adminUserId;
            donorData.createdByName = adminUserName;
            donorData.notes = `Institutional Member Profile (Established via individual mirroring)`;
        }

        await donorRef.set(donorData, { merge: true });
        
        revalidatePath('/donors');
        revalidatePath('/users');
        revalidatePath(`/users/${userId}`);
        
        return { success: true, message: "Member identity successfully mirrored to donor registry." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Interactive Identity Consolidation Action.
 * Merges multiple user UIDs into a single primary record.
 */
export async function consolidateIdentitiesAction(
    primaryUid: string, 
    redundantUids: string[], 
    updatedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const batch = adminDb.batch();
        const primaryRef = adminDb.collection('users').doc(primaryUid);
        const primarySnap = await primaryRef.get();
        if (!primarySnap.exists) throw new Error("Primary identity not found.");

        const primaryData = primarySnap.data() as UserProfile;
        const mergedPermissions = { ...(primaryData.permissions || {}) };
        
        for (const redundantUid of redundantUids) {
            const redundantRef = adminDb.collection('users').doc(redundantUid);
            const redundantSnap = await redundantRef.get();
            if (!redundantSnap.exists) continue;

            const rData = redundantSnap.data() as UserProfile;

            // 1. Merge Permissions
            if (rData.permissions) {
                Object.keys(rData.permissions).forEach(mod => {
                    if (!mergedPermissions[mod as keyof UserPermissions]) mergedPermissions[mod as keyof UserPermissions] = {};
                    Object.assign(mergedPermissions[mod as keyof UserPermissions], rData.permissions[mod as keyof UserPermissions]);
                });
            }

            // 2. Re-assign all donations pointing to redundant UID
            const donationsSnap = await adminDb.collection('donations').where('donorId', '==', redundantUid).get();
            donationsSnap.forEach(d => {
                batch.update(d.ref, { 
                    donorId: primaryUid,
                    updatedAt: FieldValue.serverTimestamp(),
                    notes: (d.data().notes || '') + ` (Profile consolidated into ${primaryUid})`
                });
            });

            // 3. Delete redundant user and its lookups
            batch.delete(redundantRef);
            if (rData.loginId) batch.delete(adminDb.collection('user_lookups').doc(rData.loginId));
            if (rData.phone) batch.delete(adminDb.collection('user_lookups').doc(rData.phone));
            if (rData.userKey) batch.delete(adminDb.collection('user_lookups').doc(rData.userKey));
        }

        // 4. Finalize Primary
        batch.update(primaryRef, {
            permissions: mergedPermissions,
            updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();
        revalidatePath('/users');
        revalidatePath('/donations');
        return { success: true, message: `Unified ${redundantUids.length + 1} records into primary ID: ${primaryUid}` };
    } catch (error: any) {
        console.error("Consolidation Failed:", error);
        return { success: false, message: error.message };
    }
}
