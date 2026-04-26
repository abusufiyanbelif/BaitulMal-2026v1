'use server';

import { cookies } from 'next/headers';
import { getAdminServices } from '@/lib/firebase-admin-sdk';

/**
 * Creates a session cookie from a Firebase ID token.
 */
export async function createSessionAction(idToken: string) {
    const { adminAuth } = getAdminServices();
    if (!adminAuth) return { success: false, message: 'Admin Auth Unavailable' };

    try {
        console.log('createSessionAction: Creating session for token...');
        // Set session expiration to 5 days.
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        
        cookies().set('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });

        return { success: true };
    } catch (error: any) {
        console.error('Session Creation Error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Clears the session cookie.
 */
export async function clearSessionAction() {
    cookies().delete('__session');
    return { success: true };
}
