'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';

const ADMIN_SDK_ERROR_MESSAGE = "Authentication infrastructure is currently offline.";

/**
 * Robust portal authentication.
 * Verifies credentials against Firestore and generates a Custom Token.
 */
export async function authenticatePortalUserAction(identifier: string, password: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb || !adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cleanIdentifier = identifier.trim();
        let targetDoc: any = null;
        let role: 'Donor' | 'Beneficiary' | 'User' | 'Admin' = 'Donor';

        // 1. Search in Centralized Users first (Staff or unified accounts)
        // We check by loginId, phone, or userKey
        const userLookups = await adminDb.collection('user_lookups').doc(cleanIdentifier).get();
        if (userLookups.exists) {
            const lookupData = userLookups.data();
            const userSnap = await adminDb.collection('users').doc(lookupData?.userKey || cleanIdentifier).get();
            if (userSnap.exists) {
                targetDoc = userSnap.data();
                role = targetDoc.role;
            }
        }

        // 2. If not found in Users, check Donors directly (Legacy or direct portal entries)
        if (!targetDoc) {
            const donorSnap = await adminDb.collection('donors').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!donorSnap.empty) {
                targetDoc = donorSnap.docs[0].data();
                targetDoc.id = donorSnap.docs[0].id;
                role = 'Donor';
            }
        }

        // 3. Finally check Beneficiaries
        if (!targetDoc) {
            const benSnap = await adminDb.collection('beneficiaries').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!benSnap.empty) {
                targetDoc = benSnap.docs[0].data();
                targetDoc.id = benSnap.docs[0].id;
                role = 'Beneficiary';
            }
        }

        if (!targetDoc) {
            return { success: false, message: "Identification failed. Please verify your ID or Mobile Number." };
        }

        // 4. Password Verification (Database Centric)
        if (!targetDoc.password || targetDoc.password !== password) {
            return { success: false, message: "Invalid credentials. Please check your password." };
        }

        if (targetDoc.status === 'Inactive') {
            return { success: false, message: "This account is currently restricted. Please contact support." };
        }

        // 5. Generate Custom Token with Role Claim
        const targetId = targetDoc.id || targetDoc.userKey || cleanIdentifier;
        const customToken = await adminAuth.createCustomToken(targetId, { role });

        return { 
            success: true, 
            token: customToken, 
            role, 
            sessionStart: Date.now(),
            redirect: role === 'Donor' ? '/donor-portal' : '/beneficiary-portal',
            message: `Authentication successful. Accessing ${role} workspace...`
        };

    } catch (error: any) {
        console.error("Portal Auth Error:", error);
        return { success: false, message: `System error during login: ${error.message}` };
    }
}

/**
 * Handle password updates for portal users.
 */
export async function updatePortalPasswordAction(userId: string, role: string, newPassword: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const collectionName = role === 'Donor' ? 'donors' : (role === 'Beneficiary' ? 'beneficiaries' : 'users');
        const docRef = adminDb.collection(collectionName).doc(userId);
        
        await docRef.update({ 
            password: newPassword,
            updatedAt: new Date()
        });

        // Also update users collection if it's a mirrored profile
        if (collectionName !== 'users') {
            await adminDb.collection('users').doc(userId).update({ password: newPassword }).catch(() => {});
        }

        // Sync with Firebase Auth if user exists there
        if (adminAuth) {
            await adminAuth.updateUser(userId, { password: newPassword }).catch(() => {});
        }

        return { success: true, message: "Password synchronized successfully." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Admin-facing password reset that works with collection names directly.
 */
export async function setInstitutionalPasswordAction(userId: string, collectionName: 'users' | 'donors' | 'beneficiaries', newPassword: string) {
    const role = collectionName === 'donors' ? 'Donor' : (collectionName === 'beneficiaries' ? 'Beneficiary' : 'User');
    return updatePortalPasswordAction(userId, role, newPassword);
}

/**
 * Generate and send a secure OTP via Telegram for portal authentication.
 */
export async function sendPortalOTPAction(identifier: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cleanIdentifier = identifier.trim();
        let targetDoc: any = null;
        let telegramChatId: string = '';

        // 1. Resolve Identity and find Telegram ID
        // Check Users
        const userLookups = await adminDb.collection('user_lookups').doc(cleanIdentifier).get();
        if (userLookups.exists) {
            const lookupData = userLookups.data();
            const userSnap = await adminDb.collection('users').doc(lookupData?.userKey || cleanIdentifier).get();
            if (userSnap.exists) {
                targetDoc = userSnap.data();
                telegramChatId = targetDoc.telegramChatId || '';
            }
        }

        // Check Donors
        if (!targetDoc) {
            const donorSnap = await adminDb.collection('donors').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!donorSnap.empty) {
                targetDoc = donorSnap.docs[0].data();
                telegramChatId = targetDoc.telegramChatId || '';
            }
        }

        // Check Beneficiaries
        if (!targetDoc) {
            const benSnap = await adminDb.collection('beneficiaries').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!benSnap.empty) {
                targetDoc = benSnap.docs[0].data();
                telegramChatId = targetDoc.telegramChatId || '';
            }
        }

        if (!targetDoc) return { success: false, message: "Identification failed. Please verify your ID or Mobile Number." };
        if (!telegramChatId) return { success: false, message: "Telegram account not linked. Please use password login or contact support." };

        // 2. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // 3. Store OTP in secure collection
        await adminDb.collection('portal_otps').doc(cleanIdentifier).set({
            otp,
            expiresAt,
            createdAt: new Date()
        });

        // 4. Dispatch via Telegram (Calling the existing action from messages)
        const { sendTelegramAction } = await import('@/app/messages/actions');
        const message = `🔐 *Institutional Portal Access*\n\nYour One-Time Password (OTP) is: *${otp}*\n\nThis code expires in 5 minutes. If you did not request this, please ignore this message.`;
        
        const telRes = await sendTelegramAction({ 
            message, 
            chatId: telegramChatId, 
            bypassAutoCheck: true 
        });

        if (!telRes.success) return { success: false, message: "Failed to dispatch OTP. Please try again later." };

        return { success: true, message: "Secure OTP has been dispatched to your linked Telegram account." };

    } catch (error: any) {
        console.error("OTP Dispatch Error:", error);
        return { success: false, message: `System error: ${error.message}` };
    }
}

/**
 * Verify OTP and generate Custom Token.
 */
export async function verifyPortalOTPAction(identifier: string, otp: string) {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb || !adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cleanIdentifier = identifier.trim();
        
        // 1. Fetch and Verify OTP
        const otpDoc = await adminDb.collection('portal_otps').doc(cleanIdentifier).get();
        if (!otpDoc.exists) return { success: false, message: "No active OTP session found. Please request a new one." };
        
        const data = otpDoc.data();
        if (data?.otp !== otp) return { success: false, message: "Invalid verification code. Please try again." };
        
        const now = new Date();
        const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (now > expiresAt) return { success: false, message: "OTP has expired. Please request a new one." };

        // 2. Resolve Role (Mirroring authenticatePortalUserAction logic)
        let targetDoc: any = null;
        let role: any = 'Donor';
        let targetId = '';

        // Search Users
        const userLookups = await adminDb.collection('user_lookups').doc(cleanIdentifier).get();
        if (userLookups.exists) {
            const lookupData = userLookups.data();
            const userSnap = await adminDb.collection('users').doc(lookupData?.userKey || cleanIdentifier).get();
            if (userSnap.exists) {
                targetDoc = userSnap.data();
                role = targetDoc.role;
                targetId = userSnap.id;
            }
        }

        // Search Donors
        if (!targetDoc) {
            const donorSnap = await adminDb.collection('donors').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!donorSnap.empty) {
                targetDoc = donorSnap.docs[0].data();
                role = 'Donor';
                targetId = donorSnap.docs[0].id;
            }
        }

        // Search Beneficiaries
        if (!targetDoc) {
            const benSnap = await adminDb.collection('beneficiaries').where('phone', '==', cleanIdentifier).limit(1).get();
            if (!benSnap.empty) {
                targetDoc = benSnap.docs[0].data();
                role = 'Beneficiary';
                targetId = benSnap.docs[0].id;
            }
        }

        if (!targetDoc) return { success: false, message: "Identity resolution failed after verification." };

        // 3. Clear OTP session
        await adminDb.collection('portal_otps').doc(cleanIdentifier).delete().catch(() => {});

        // 4. Generate Custom Token
        const customToken = await adminAuth.createCustomToken(targetId, { role });

        return { 
            success: true, 
            token: customToken, 
            role, 
            sessionStart: Date.now(),
            redirect: role === 'Donor' ? '/donor-portal' : '/beneficiary-portal',
            message: `OTP Verified. Accessing ${role} workspace...`
        };

    } catch (error: any) {
        console.error("OTP Verification Error:", error);
        return { success: false, message: error.message };
    }
}
