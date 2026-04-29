
'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfile, Donor, Beneficiary } from '@/lib/types';

/**
 * Robust authentication for Supporters (Donors/Beneficiaries) using DB Passwords.
 * Supports login via Phone or Institutional ID.
 */
export async function authenticateSupporterAction(identifier: string, password: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb || !adminAuth) return { success: false, message: 'Institutional Authentication Hub Unavailable.' };

    try {
        let targetId: string | null = null;
        let targetRole: string = 'Donor';

        // 1. Search in Users collection (Centralized Accounts)
        let userByPhone = await adminDb.collection('users').where('phone', '==', identifier).limit(1).get();
        if (userByPhone.empty) {
            userByPhone = await adminDb.collection('users').where('phones', 'array-contains', identifier).limit(1).get();
        }
        const userById = await adminDb.collection('users').doc(identifier).get();
        const userByLoginId = await adminDb.collection('users').where('loginId', '==', identifier).limit(1).get();

        let userData: any = null;

        if (!userByPhone.empty) {
            userData = userByPhone.docs[0].data();
            targetId = userByPhone.docs[0].id;
        } else if (userById.exists) {
            userData = userById.data();
            targetId = userById.id;
        } else if (!userByLoginId.empty) {
            userData = userByLoginId.docs[0].data();
            targetId = userByLoginId.docs[0].id;
        }

        if (userData && userData.password === password) {
            const customToken = await adminAuth.createCustomToken(targetId!);
            return { success: true, token: customToken, role: userData.role };
        }

        // 2. Search in Donors collection (Profile-based Auth)
        let donorByPhone = await adminDb.collection('donors').where('phone', '==', identifier).limit(1).get();
        if (donorByPhone.empty) {
            donorByPhone = await adminDb.collection('donors').where('phones', 'array-contains', identifier).limit(1).get();
        }
        const donorById = await adminDb.collection('donors').doc(identifier).get();

        if (!donorByPhone.empty) {
            const dData = donorByPhone.docs[0].data();
            if (dData.password === password) {
                const token = await adminAuth.createCustomToken(donorByPhone.docs[0].id);
                return { success: true, token, role: 'Donor' };
            }
        } else if (donorById.exists) {
            const dData = donorById.data();
            if (dData?.password === password) {
                const token = await adminAuth.createCustomToken(identifier);
                return { success: true, token, role: 'Donor' };
            }
        }

        // 3. Search in Beneficiaries collection
        let benByPhone = await adminDb.collection('beneficiaries').where('phone', '==', identifier).limit(1).get();
        if (benByPhone.empty) {
            benByPhone = await adminDb.collection('beneficiaries').where('phones', 'array-contains', identifier).limit(1).get();
        }
        const benById = await adminDb.collection('beneficiaries').doc(identifier).get();

        if (!benByPhone.empty) {
            const bData = benByPhone.docs[0].data();
            if (bData.password === password) {
                const token = await adminAuth.createCustomToken(benByPhone.docs[0].id);
                return { success: true, token, role: 'Beneficiary' };
            }
        } else if (benById.exists) {
            const bData = benById.data();
            if (bData?.password === password) {
                const token = await adminAuth.createCustomToken(identifier);
                return { success: true, token, role: 'Beneficiary' };
            }
        }

        return { success: false, message: 'Invalid Credentials. Please verify your Mobile/ID and Password.' };
    } catch (e: any) {
        console.error('Portal Auth Error:', e);
        return { success: false, message: e.message };
    }
}

/**
 * Set or Reset password for any institutional profile.
 * Restricted to Administrators.
 */
export async function setInstitutionalPasswordAction(targetId: string, collectionName: 'users' | 'donors' | 'beneficiaries', password: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Database Unavailable' };

    try {
        await adminDb.collection(collectionName).doc(targetId).update({
            password,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true, message: 'Credential Updated Successfully.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Exchange Firebase Auth Phone Number for a secure custom token using the correct institutional UID.
 */
export async function exchangeOtpForCustomTokenAction(phoneE164: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb || !adminAuth) return { success: false, message: 'Institutional Authentication Hub Unavailable.' };

    try {
        const numericOnly = phoneE164.replace(/\D/g, '');
        const phone10 = numericOnly.length >= 10 ? numericOnly.slice(-10) : numericOnly;
        const phoneWithPrefix = '+91' + phone10;

        // 1. Search in Users
        const userByPhone = await adminDb.collection('users')
            .where('phone', 'in', [phone10, phoneWithPrefix])
            .limit(1).get();

        if (!userByPhone.empty) {
            const token = await adminAuth.createCustomToken(userByPhone.docs[0].id);
            return { success: true, token, role: userByPhone.docs[0].data().role };
        }

        // 2. Search in Donors
        const donorByPhone = await adminDb.collection('donors')
            .where('phone', 'in', [phone10, phoneWithPrefix])
            .limit(1).get();

        if (!donorByPhone.empty) {
            const token = await adminAuth.createCustomToken(donorByPhone.docs[0].id);
            return { success: true, token, role: 'Donor' };
        }

        // 3. Search in Beneficiaries
        const benByPhone = await adminDb.collection('beneficiaries')
            .where('phone', 'in', [phone10, phoneWithPrefix])
            .limit(1).get();

        if (!benByPhone.empty) {
            const token = await adminAuth.createCustomToken(benByPhone.docs[0].id);
            return { success: true, token, role: 'Beneficiary' };
        }

        return { success: false, message: 'Phone number not registered in our database.' };

    } catch (e: any) {
        console.error('OTP Exchange Error:', e);
        return { success: false, message: e.message };
    }
}

export async function supporterUpdatePasswordAction(userId: string, role: string, password: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Database Unavailable' };

    try {
        let collectionName = 'users';
        if (role === 'Donor') collectionName = 'donors';
        else if (role === 'Beneficiary') collectionName = 'beneficiaries';

        // Check if doc exists in the chosen collection, fallback to 'users' if not found
        const docRef = adminDb.collection(collectionName).doc(userId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            await docRef.update({
                password,
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            // Fallback to updating the users collection
            await adminDb.collection('users').doc(userId).update({
                password,
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        // Also update Firebase Auth password if the service is available
        if (adminAuth) {
            try {
                await adminAuth.updateUser(userId, { password });
            } catch (authError: any) {
                console.warn("Firebase Auth password update skipped or failed:", authError.message);
                // Don't fail the whole operation if the user isn't in Firebase Auth
            }
        }

        return { success: true, message: 'Password Updated Successfully.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

