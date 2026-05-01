'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';

/**
 * Revokes all active sessions for a specific role.
 * This forces all users with that role to re-authenticate.
 */
export async function revokeAllSessionsForRoleAction(role: 'Donor' | 'Beneficiary' | 'User' | 'Admin') {
    const { adminAuth, adminDb } = getAdminServices();
    if (!adminAuth || !adminDb) return { success: false, message: 'Admin SDK Initialization Failed.' };

    try {
        // 1. Identify target users from the unified 'users' collection
        const usersSnap = await adminDb.collection('users')
            .where('role', '==', role)
            .get();

        if (usersSnap.empty) {
            return { success: true, message: `No active ${role} profiles found to revoke.` };
        }

        const uids = usersSnap.docs.map(doc => doc.id);
        const count = uids.length;
        
        // 2. Revoke Firebase Auth refresh tokens (Server-side kill switch)
        const revokePromises = uids.map(uid => 
            adminAuth.revokeRefreshTokens(uid).catch(err => {
                if (err.code === 'auth/user-not-found' || err.errorInfo?.code === 'auth/user-not-found') return;
                throw err;
            })
        );
        await Promise.all(revokePromises);

        // 3. Update Global Configuration for Instant Client-Side Logout
        const configDocName = role === 'Donor' ? 'donor_config' : 
                            (role === 'Beneficiary' ? 'beneficiary_config' : 'user_config');
        const now = Date.now();

        await adminDb.collection('settings').doc(configDocName).set({
            sessionRevokedAt: now,
            updatedAt: now,
            revokedBy: 'System Administrative Action'
        }, { merge: true });

        // 4. Batch update individual users and their sessions
        const batch = adminDb.batch();
        usersSnap.docs.forEach(snap => {
            batch.update(snap.ref, { forceLogoutAt: now });
            
            // Sync to mirror collections
            if (role === 'Donor') {
                batch.update(adminDb.collection('donors').doc(snap.id), { forceLogoutAt: now });
            } else if (role === 'Beneficiary') {
                batch.update(adminDb.collection('beneficiaries').doc(snap.id), { forceLogoutAt: now });
            }
        });

        // 5. Mark sessions as revoked
        const sessionsSnap = await adminDb.collection('user_sessions')
            .where('role', '==', role)
            .where('status', '==', 'Active')
            .get();
        
        sessionsSnap.docs.forEach(snap => {
            batch.update(snap.ref, { 
                status: 'Revoked', 
                revokedAt: now,
                revokedBy: 'System Administrative Action'
            });
        });

        await batch.commit();

        const revalidateRole = role === 'Admin' ? 'user' : role.toLowerCase();
        revalidatePath(`/settings/${revalidateRole}`);
        
        return { 
            success: true, 
            message: `Successfully terminated ${count} active ${role} sessions. Forced re-authentication is now active.` 
        };
    } catch (error: any) {
        console.error(`Global session revocation failed for ${role}:`, error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}

/**
 * Revokes all active sessions for a specific user.
 */
export async function revokeUserSessionsAction(userId: string) {
    const { adminAuth, adminDb } = getAdminServices();
    if (!adminAuth || !adminDb) return { success: false, message: 'Admin SDK Initialization Failed.' };

    try {
        // 1. Revoke Firebase Auth refresh tokens
        await adminAuth.revokeRefreshTokens(userId).catch(err => {
            if (err.code === 'auth/user-not-found' || err.errorInfo?.code === 'auth/user-not-found') return;
            throw err;
        });

        // 2. Update individual user document with forceLogoutAt
        const now = Date.now();
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            await userRef.update({ forceLogoutAt: now });
            const data = userDoc.data();
            
            // Also update mirrored collections if they exist
            if (data?.role === 'Donor') {
                await adminDb.collection('donors').doc(userId).update({ forceLogoutAt: now }).catch(() => {});
            } else if (data?.role === 'Beneficiary') {
                await adminDb.collection('beneficiaries').doc(userId).update({ forceLogoutAt: now }).catch(() => {});
            }
        } else {
            // Check in donors/beneficiaries if not in users
            await adminDb.collection('donors').doc(userId).update({ forceLogoutAt: now }).catch(() => {});
            await adminDb.collection('beneficiaries').doc(userId).update({ forceLogoutAt: now }).catch(() => {});
        }

        // 3. Mark user sessions as revoked
        const sessionsSnap = await adminDb.collection('user_sessions')
            .where('userId', '==', userId)
            .where('status', '==', 'Active')
            .get();
        
        const batch = adminDb.batch();
        sessionsSnap.docs.forEach(snap => {
            batch.update(snap.ref, { 
                status: 'Revoked', 
                revokedAt: now,
                revokedBy: 'User Action'
            });
        });
        await batch.commit();

        return { 
            success: true, 
            message: "All other sessions have been successfully terminated." 
        };
    } catch (error: any) {
        console.error(`User session revocation failed for ${userId}:`, error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}

/**
 * Fetches the list of sessions for a specific user.
 */
export async function getUserSessionsAction(userId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Admin SDK Initialization Failed.' };

    try {
        const sessionsSnap = await adminDb.collection('user_sessions')
            .where('userId', '==', userId)
            .orderBy('loginAt', 'desc')
            .limit(10)
            .get();

        const sessions = sessionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, sessions };
    } catch (error: any) {
        console.error(`Failed to fetch sessions for ${userId}:`, error);
        return { success: false, message: error.message };
    }
}
