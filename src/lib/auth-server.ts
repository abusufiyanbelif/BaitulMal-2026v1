import { cookies } from 'next/headers';
import { getAdminServices } from './firebase-admin-sdk';

export async function getServerSession() {
    const cookieStore = cookies();
    const token = cookieStore.get('__session')?.value || cookieStore.get('auth-token')?.value;

    if (!token) return null;

    try {
        const { adminAuth, adminDb } = getAdminServices();
        if (!adminAuth || !adminDb) return null;

        // Verify either session cookie or ID token
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifySessionCookie(token);
        } catch (e) {
            decodedToken = await adminAuth.verifyIdToken(token);
        }

        const uid = decodedToken.uid;

        // Unified Identity Search
        let userData: any = null;
        let role = (decodedToken.claims?.role as string) || 'Guest';

        // 1. Try Users (Staff)
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            role = userData.role || role;
        }

        // 2. Try Donors
        if (!userData) {
            const donorDoc = await adminDb.collection('donors').doc(uid).get();
            if (donorDoc.exists) {
                userData = donorDoc.data();
                role = 'Donor';
            }
        }

        // 3. Try Beneficiaries
        if (!userData) {
            const benDoc = await adminDb.collection('beneficiaries').doc(uid).get();
            if (benDoc.exists) {
                userData = benDoc.data();
                role = 'Beneficiary';
            }
        }

        if (!userData) return null;

        return {
            uid,
            email: decodedToken.email,
            role,
            permissions: userData?.permissions || {},
            name: userData?.name || 'User'
        };
    } catch (error) {
        console.error('getServerSession Error:', error);
        return null;
    }
}
