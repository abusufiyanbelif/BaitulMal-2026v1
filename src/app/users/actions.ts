'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/lib/schemas';
import type { UserProfile, Donor, Campaign, Lead, Donation, Beneficiary } from '@/lib/types';
import { GROUP_IDS, createAdminPermissions, type UserPermissions } from '@/lib/modules';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { bulkRecalculateInitiativeTotalsAction } from '@/app/donations/actions';
import { recordAuditLogAction } from '@/app/audit/actions';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Please Verify Server Credentials.";

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
        } else {
            sanitized[key] = data[key];
        }
    });
    return sanitized;
}

export async function saveUserAction(uid: string, data: Partial<UserProfile>, admin: { id: string, name: string }): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cleanPhone = data.phone?.trim().replace(/\D/g, '').slice(-10) || '';
        const cleanLoginId = data.loginId?.trim().replace(/\D/g, '').slice(-10) || '';
        const userKey = data.userKey?.trim() || uid;

        const batch = adminDb.batch();
        const userRef = adminDb.collection('users').doc(uid);
        
        // 1. Save core user document
        const payload = sanitizePayload({
            ...data,
            phone: cleanPhone || data.phone, // Keep original if cleaning results in empty but was provided? No, force 10 digit.
            loginId: cleanLoginId || data.loginId,
            updatedAt: FieldValue.serverTimestamp(),
        });
        batch.set(userRef, payload, { merge: true });

        // 2. Manage Lookups
        // Delete old lookups if they exist? (Hard to know without getting old doc, but lookups are cheap)
        // For simplicity, we overwrite/set new ones.
        if (cleanPhone && cleanPhone.length === 10) {
            batch.set(adminDb.collection('user_lookups').doc(cleanPhone), {
                userKey: userKey,
                role: data.role || 'User',
                phone: cleanPhone,
                name: data.name
            });
        }
        if (cleanLoginId && cleanLoginId.length > 0) {
            batch.set(adminDb.collection('user_lookups').doc(cleanLoginId), {
                userKey: userKey,
                role: data.role || 'User',
                phone: cleanPhone,
                name: data.name
            });
        }
        if (userKey) {
            batch.set(adminDb.collection('user_lookups').doc(userKey), {
                userKey: userKey,
                role: data.role || 'User',
                phone: cleanPhone,
                name: data.name
            });
        }

        await batch.commit();
        revalidatePath('/users');
        revalidatePath(`/users/${uid}`);
        return { success: true, message: 'User Registry Updated Successfully.' };
    } catch (error: any) {
        console.error("Error saving user:", error);
        return { success: false, message: `Save Failed: ${error.message}` };
    }
}


export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    
    // Skip Firebase Auth account creation for Donors and Beneficiaries
    // They will be authenticated via Custom Tokens based on Firestore credentials.
    if (data.role === 'Donor' || data.role === 'Beneficiary') {
        return { success: true, message: 'Organization Registry Only. Auth Managed Via Portal.', uid: data.userKey };
    }

    try {
        const userRecord = await adminAuth.createUser({
            email: data.email || undefined,
            emailVerified: true,
            password: data.password,
            displayName: data.name,
            disabled: data.status === 'Inactive',
        });
        revalidatePath('/users');
        return { success: true, message: 'User Created In Firebase Authentication.', uid: userRecord.uid };
    } catch (error: any) {
        return { success: false, message: `Auth Registration Failed: ${error.message}` };
    }
}

export async function deleteUserAction(uidToDelete: string): Promise<{ success: boolean; message: string }> {
    const { adminAuth, adminDb, adminStorage } = getAdminServices();
    if (!adminAuth || !adminDb || !adminStorage) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const userRef = adminDb.collection('users').doc(uidToDelete);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as UserProfile | undefined;

        try {
            await adminAuth.deleteUser(uidToDelete);
        } catch (authError: any) {
            console.warn(`Auth deletion skipped or failed for ${uidToDelete}:`, authError.message);
        }
        
        const batch = adminDb.batch();
        batch.delete(userRef);
        batch.delete(adminDb.collection('donors').doc(uidToDelete));
        batch.delete(adminDb.collection('beneficiaries').doc(uidToDelete));
        
        const cleanPhone = userData?.phone?.trim().replace(/\D/g, '').slice(-10);
        const cleanLoginId = userData?.loginId?.trim().replace(/\D/g, '').slice(-10);

        if (userData?.loginId) batch.delete(adminDb.collection('user_lookups').doc(userData.loginId));
        if (cleanLoginId) batch.delete(adminDb.collection('user_lookups').doc(cleanLoginId));
        if (userData?.phone) batch.delete(adminDb.collection('user_lookups').doc(userData.phone));
        if (cleanPhone) batch.delete(adminDb.collection('user_lookups').doc(cleanPhone));
        if (userData?.userKey) batch.delete(adminDb.collection('user_lookups').doc(userData.userKey));
        if (uidToDelete) batch.delete(adminDb.collection('user_lookups').doc(uidToDelete));

        await batch.commit();
        revalidatePath('/users');
        return { success: true, message: 'Account Purged From Organizational Registry.' };
    } catch (error: any) {
        return { success: false, message: `Removal Operation Failed: ${error.message}` };
    }
}

export async function getPublicMembersAction(): Promise<Partial<UserProfile>[]> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return [];
    try {
        const membersQuery = adminDb.collection('users').where('organizationGroup', 'in', GROUP_IDS).where('status', '==', 'Active');
        const snapshot = await membersQuery.get();
        return snapshot.docs.map((doc: any) => ({
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
 * DEEP IDENTITY CONSOLIDATION ACTION
 * Merges multiple fragmented identities into a primary "Golden Record".
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
            donationsSnap.forEach((d: any) => {
                batch.update(d.ref, { 
                    donorId: primaryUid,
                    donorName: primaryData.name,
                    updatedAt: FieldValue.serverTimestamp(),
                    notes: (d.data().notes || '') + ` (Unified Identity Merge from ${redundantUid})`
                });
            });

            // 3. Update Audit Trails System-Wide
            const collectionsToUpdate = ['campaigns', 'leads', 'beneficiaries', 'donations'];
            for (const col of collectionsToUpdate) {
                const createdSnap = await adminDb.collection(col).where('createdById', '==', redundantUid).get();
                createdSnap.forEach((doc: any) => {
                    batch.update(doc.ref, { 
                        createdById: primaryUid,
                        createdByName: primaryData.name 
                    });
                });

                const updatedSnap = await adminDb.collection(col).where('updatedById', '==', redundantUid).get();
                updatedSnap.forEach((doc: any) => {
                    batch.update(doc.ref, { 
                        updatedById: primaryUid, 
                        updatedByName: primaryData.name 
                    });
                });
            }

            // 4. Move Master Donor Registry Data if exists
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

            batch.delete(redundantRef);
            if (rData.loginId) batch.delete(adminDb.collection('user_lookups').doc(rData.loginId));
            if (rData.phone) batch.delete(adminDb.collection('user_lookups').doc(rData.phone));
        }

        const finalUpdate = sanitizePayload({
            permissions: mergedPermissions,
            updatedAt: FieldValue.serverTimestamp(),
            linkedDonorId: primaryUid,
            linkedBeneficiaryId: primaryData.linkedBeneficiaryId || null
        });

        batch.update(primaryRef, finalUpdate);
        await batch.commit();
        
        await recordAuditLogAction({
            module: 'users',
            targetId: primaryUid,
            action: 'CONSOLIDATE',
            description: `Unified identities from ${redundantUids.length} records into: ${primaryData.name}`,
            performedBy: updatedBy,
            metadata: { redundantUids, primaryUid }
        });

        await bulkRecalculateInitiativeTotalsAction();

        revalidatePath('/users');
        revalidatePath('/donations');
        revalidatePath('/donors');
        revalidatePath('/dashboard');
        
        return { success: true, message: `Successfully Unified Profiles into: ${primaryData.name}` };
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
        return { success: true, message: 'Authentication Details Updated.' };
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
             // For Donors/Beneficiaries who haven't logged in yet, this is expected if we didn't pre-create them
             return { success: true, message: 'Organization Credentials Updated (Auth Sync Skipped).' };
        }
        return { success: false, message: `Operation Failed: ${error.message}` };
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
                    gender: user.gender || '',
                    dob: user.dob || '',
                    address: user.address || '',
                    panNumber: user.panNumber || '',
                    aadhaarNumber: user.aadhaarNumber || '',
                    aadhaarName: user.aadhaarName || '',
                    aadhaarDob: user.aadhaarDob || '',
                    aadhaarGender: user.aadhaarGender || '',
                    aadhaarAddress: user.aadhaarAddress || '',
                    bankDetails: user.bankDetails || [],
                    upiIds: user.upiIds || [],
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
        return { success: true, message: `Mirrored ${count} Members into Donor Registry.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
}
export async function mirrorIndividualUserToDonorAction(uid: string, admin: { id: string, name: string }): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return { success: false, message: 'Source user not found.' };
        const user = userSnap.data() as UserProfile;
        
        const donorRef = adminDb.collection('donors').doc(uid);
        await donorRef.set({
            id: uid,
            name: user.name,
            phone: user.phone || '',
            email: user.email || '',
            gender: user.gender || '',
            dob: user.dob || '',
            address: user.address || '',
            panNumber: user.panNumber || '',
            aadhaarNumber: user.aadhaarNumber || '',
            aadhaarName: user.aadhaarName || '',
            aadhaarDob: user.aadhaarDob || '',
            aadhaarGender: user.aadhaarGender || '',
            aadhaarAddress: user.aadhaarAddress || '',
            bankDetails: user.bankDetails || [],
            upiIds: user.upiIds || [],
            status: user.status === 'Active' ? 'Active' : 'Inactive',
            updatedAt: FieldValue.serverTimestamp(),
            createdById: admin.id,
            createdByName: admin.name,
        }, { merge: true });

        await recordAuditLogAction({
            module: 'users',
            targetId: uid,
            action: 'MIRROR',
            description: `Profile mirrored to Donor Registry by administrative sync.`,
            performedBy: admin,
            metadata: { uid }
        });

        revalidatePath('/donors');
        revalidatePath('/users');
        return { success: true, message: 'Identity Mirrored To Donor Registry.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function mirrorIndividualUserToBeneficiaryAction(uid: string, admin: { id: string, name: string }): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
    try {
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return { success: false, message: 'Source user not found.' };
        const user = userSnap.data() as UserProfile;
        
        const benRef = adminDb.collection('beneficiaries').doc(uid);
        await benRef.set({
            id: uid,
            name: user.name,
            phone: user.phone || '',
            email: user.email || '',
            gender: user.gender || '',
            dob: user.dob || '',
            address: user.address || '',
            panNumber: user.panNumber || '',
            aadhaarNumber: user.aadhaarNumber || '',
            aadhaarName: user.aadhaarName || '',
            aadhaarDob: user.aadhaarDob || '',
            aadhaarGender: user.aadhaarGender || '',
            aadhaarAddress: user.aadhaarAddress || '',
            bankDetails: user.bankDetails || [],
            upiIds: user.upiIds || [],
            familyDetails: user.familyDetails || null,
            status: user.status === 'Active' ? 'Active' : 'Inactive',
            updatedAt: FieldValue.serverTimestamp(),
            createdById: admin.id,
            createdByName: admin.name,
            beneficiaryKey: user.userKey || `BEN-${uid.slice(0, 5).toUpperCase()}`,
        }, { merge: true });

        await recordAuditLogAction({
            module: 'users',
            targetId: uid,
            action: 'MIRROR_BENEFICIARY',
            description: `Profile mirrored to Beneficiary Registry by administrative sync.`,
            performedBy: admin,
            metadata: { uid }
        });

        revalidatePath('/beneficiaries');
        revalidatePath('/users');
        return { success: true, message: 'Identity Mirrored To Beneficiary Registry.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
