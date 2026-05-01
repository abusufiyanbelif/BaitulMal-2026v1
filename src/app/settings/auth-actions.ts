'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';

/**
 * Revokes all active sessions for a specific role (Donor or Beneficiary).
 * This forces all users with that role to re-authenticate.
 */
export async function revokeAllSessionsForRoleAction(role: 'Donor' | 'Beneficiary') {
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
        // This prevents users from getting new ID tokens when the current one expires (~1 hour)
        const revokePromises = uids.map(uid => 
            adminAuth.revokeRefreshTokens(uid).catch(err => {
                // If user doesn't exist in Auth, we can ignore it as they have no active session to revoke
                if (err.code === 'auth/user-not-found' || err.errorInfo?.code === 'auth/user-not-found') return;
                throw err;
            })
        );
        await Promise.all(revokePromises);

        // 3. Update Global Configuration for Instant Client-Side Logout
        // By setting a 'sessionRevokedAt' timestamp in the module config, 
        // the application frontend can force an immediate redirect to login.
        const configDocName = role === 'Donor' ? 'donor_config' : 'beneficiary_config';
        const now = Date.now();

        await adminDb.collection('settings').doc(configDocName).set({
            sessionRevokedAt: now,
            updatedAt: now,
            revokedBy: 'System Administrative Action'
        }, { merge: true });

        // 4. Batch update individual users (Optional but robust)
        // This ensures the profile data itself carries the revocation signal
        const batch = adminDb.batch();
        usersSnap.docs.forEach(snap => {
            batch.update(snap.ref, { forceLogoutAt: now });
        });
        await batch.commit();

        revalidatePath(`/settings/${role.toLowerCase()}`);
        return { 
            success: true, 
            message: `Successfully terminated ${count} active ${role} sessions. Forced re-authentication is now active.` 
        };
    } catch (error: any) {
        console.error(`Global session revocation failed for ${role}:`, error);
        return { success: false, message: `Operation failed: ${error.message}` };
    }
}
