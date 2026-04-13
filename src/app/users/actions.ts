
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/lib/schemas';
import type { UserProfile, Donor, UserPermissions } from '@/lib/types';
import { GROUP_IDS, createAdminPermissions } from '@/lib/modules';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { bulkRecalculateInitiativeTotalsAction } from '@/app/donations/actions';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK initialization failed. This usually means the server is missing credentials.";

/**
 * Sanitizes an object by removing all undefined values.
 */
function sanitizePayload(data: Record<string, any>) {
    const sanitized: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
            sanitized[key] = data[key];
        } else if (data[key] === null) {
            sanitized[key] = null;
        }
    });
    return sanitized;
}

export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
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
        return { success: false, message: `Failed to create authentication user: ${error.message}` };
    }
}

export async function deleteUserAction(uidToDelete: string): Promise<{ success: boolean; message: string }> {
    const { adminAuth, adminDb, adminStorage } = getAdminServices();
    if (!adminAuth || !adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const userRef = adminDb.collection('users').doc(uidToDelete);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as UserProfile | undefined;

        await adminAuth.deleteUser(uidToDelete);
        
        const batch = adminDb.batch();
        batch.delete(userRef);
        batch.delete(adminDb.collection('donors').doc(uidToDelete));
        
        if (userData?.loginId) batch.delete(adminDb.collection('user_lookups').doc(userData.loginId));
        if (userData?.phone) batch.delete(adminDb.collection('user_lookups').doc(userData.phone));

        await batch.commit();
        revalidatePath('/users');
        return { success: true, message: 'Account purged from registry.' };
    } catch (error: any) {
        return { success: false, message: `Removal failed: ${error.message}` };
    }
}

export async function getPublicMembersAction(): Promise<Partial<UserProfile>[]> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return [];
    try {
        const membersQuery = adminDb.collection('users').where('organizationGroup', 'in', GROUP_IDS).where('status', '==', 'Active');
        const snapshot = await membersQuery.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            organizationGroup: doc.data().organizationGroup,
            organizationRole: doc.data().organizationRole,
            idProofUrl: doc.data().idProofUrl || null,
        }));
    } catch (error) {
        return [];
    }
}

/**
 * DEEP CONSOLIDATION ACTION
 * Merges multiple identities into a primary "Golden Record".
 * Re-assigns financial records and updates audit trails across the system.
 */
export async function consolidateIdentitiesAction(
    primaryUid: string, 
    redundantUids: string[], 
    updatedBy: { id: string, name: string }
): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const primaryRef = adminDb.collection('users').doc(primaryUid);
        const primarySnap = await primaryRef.get();
        if (!primarySnap.exists) throw new Error("Primary identity not found.");

        const primaryData = primarySnap.data() as UserProfile;
        const mergedPermissions = { ...(primaryData.permissions || {}) };
        
        const batch = adminDb.batch();

        for (const redundantUid of redundantUids) {
            const redundantRef = adminDb.collection('users').doc(redundantUid);
            const redundantSnap = await redundantRef.get();
            if (!redundantSnap.exists) continue;

            const rData = redundantSnap.data() as UserProfile;

            // 1. Merge Permissions
            if (rData.permissions) {
                Object.keys(rData.permissions).forEach(mod => {
                    const typedMod = mod as keyof UserPermissions;
                    if (!mergedPermissions[typedMod]) mergedPermissions[typedMod] = {};
                    Object.assign(mergedPermissions[typedMod] as any, rData.permissions[typedMod] as any);
                });
            }

            // 2. Re-assign all DONATIONS pointing to redundant UID
            const donationsSnap = await adminDb.collection('donations').where('donorId', '==', redundantUid).get();
            donationsSnap.forEach(d => {
                batch.update(d.ref, { 
                    donorId: primaryUid,
                    donorName: primaryData.name,
                    updatedAt: FieldValue.serverTimestamp(),
                    notes: (d.data().notes || '') + ` (Unified into identity ${primaryUid})`
                });
            });

            // 3. Update Audit Trails (Everything created/updated by this redundant UID)
            const collectionsToUpdate = ['campaigns', 'leads', 'beneficiaries', 'donations'];
            for (const col of collectionsToUpdate) {
                const createdSnap = await adminDb.collection(col).where('createdById', '==', redundantUid).get();
                createdSnap.forEach(doc => {
                    batch.update(doc.ref, { 
                        createdById: primaryUid,
                        createdByName: primaryData.name 
                    });
                });

                const updatedSnap = await adminDb.collection(col).where('updatedById', '==', redundantUid).get();
                updatedSnap.forEach(doc => {
                    batch.update(doc.ref, { 
                        updatedById: primaryUid, 
                        updatedByName: primaryData.name 
                    });
                });
            }

            // 4. Move Master Donor Data if exists
            const oldDonorRef = adminDb.collection('donors').doc(redundantUid);
            const primaryDonorRef = adminDb.collection('donors').doc(primaryUid);
            const oldDonorSnap = await oldDonorRef.get();
            if (oldDonorSnap.exists) {
                batch.set(primaryDonorRef, sanitizePayload({
                    ...oldDonorSnap.data(),
                    id: primaryUid,
                    updatedAt: FieldValue.serverTimestamp()
                }), { merge: true });
                batch.delete(oldDonorRef);
            }

            // 5. Delete redundant user and its lookups
            batch.delete(redundantRef);
            if (rData.loginId) batch.delete(adminDb.collection('user_lookups').doc(rData.loginId));
            if (rData.phone) batch.delete(adminDb.collection('user_lookups').doc(rData.phone));
        }

        // 6. Finalize Primary "Golden Record"
        const finalUpdate = sanitizePayload({
            permissions: mergedPermissions,
            updatedAt: FieldValue.serverTimestamp(),
            linkedDonorId: primaryUid,
            linkedBeneficiaryId: primaryData.linkedBeneficiaryId || null
        });

        batch.update(primaryRef, finalUpdate);

        await batch.commit();
        await bulkRecalculateInitiativeTotalsAction();

        revalidatePath('/users');
        revalidatePath('/donations');
        revalidatePath('/donors');
        revalidatePath('/dashboard');
        
        return { success: true, message: `Successfully unified fragmented profiles into identity: ${primaryData.name}` };
    } catch (error: any) {
        console.error("Deep Consolidation Failed:", error);
        return { success: false, message: `Reconciliation Error: ${error.message}` };
    }
}

export async function updateUserAuthAction(uid: string, updates: { email?: string; password?: string }): Promise<{ success: boolean, message: string }> {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        await adminAuth.updateUser(uid, updates);
        revalidatePath(`/users/${uid}`);
        return { success: true, message: 'Auth details updated.' };
    } catch (error: any) {
        return { success: false, message: `Failed: ${error.message}` };
    }
}

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
                batch.set(donorRef, {
                    id: userDoc.id,
                    name: user.name,
                    phone: user.phone || '',
                    email: user.email || '',
                    status: user.status === 'Active' ? 'Active' : 'Inactive',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: adminUserId,
                    createdByName: adminUserName,
                });
                count++;
            }
        }
        if (count > 0) await batch.commit();
        revalidatePath('/donors');
        return { success: true, message: `Mirrored ${count} members.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}
