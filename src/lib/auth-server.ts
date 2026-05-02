import { cookies } from 'next/headers';
import { getAdminServices } from './firebase-admin-sdk';

export async function getServerSession() {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) return null;

    try {
        const { adminAuth, adminDb } = getAdminServices();
        if (!adminAuth || !adminDb) return null;

        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Check user role from Firestore
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data();
        return {
            uid,
            email: decodedToken.email,
            role: userData?.role || 'Guest',
            permissions: userData?.permissions || {}
        };
    } catch (error) {
        console.error('getServerSession Error:', error);
        return null;
    }
}
