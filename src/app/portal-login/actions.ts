'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
import { sendTelegramAction } from '@/app/messages/actions';

const ADMIN_SDK_ERROR_MESSAGE = "Authentication infrastructure is currently offline.";

/**
 * Robust portal authentication.
 * Verifies credentials against Firestore and generates a Custom Token.
 */
export async function authenticatePortalUserAction(identifier: string, password: string, requestedRole?: 'Donor' | 'Beneficiary') {
    try {
        const { adminDb, adminAuth } = getAdminServices();
        if (!adminDb || !adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
        // Unified Identity Resolution
        const inputIdentifier = identifier.trim();
        const isPhone = /^\d{10}$/.test(inputIdentifier);
        const cleanPhone = isPhone ? inputIdentifier : '';
        const loginId = inputIdentifier;

        let targetDoc: any = null;
        let role: 'Donor' | 'Beneficiary' | 'User' | 'Admin' = requestedRole || 'Donor';

        // 1. Parallel identity lookup
        // We fetch the lookup doc and the specific donor/beneficiary docs in parallel
        const queries: Promise<any>[] = [
            adminDb.collection('user_lookups').doc(loginId).get(),
        ];

        if (isPhone) {
            queries.push(adminDb.collection('donors').where('phone', '==', cleanPhone).limit(1).get());
            queries.push(adminDb.collection('beneficiaries').where('phone', '==', cleanPhone).limit(1).get());
        } else {
            queries.push(adminDb.collection('donors').where('loginId', '==', loginId).limit(1).get());
            queries.push(adminDb.collection('beneficiaries').where('loginId', '==', loginId).limit(1).get());
        }

        const [userLookupSnap, donorSnap, benSnap] = await Promise.all(queries);

        // 2. Identity Resolution with Role Priority
        // Priority 1: Requested Role
        if (requestedRole === 'Donor' && !donorSnap.empty) {
            targetDoc = donorSnap.docs[0].data();
            targetDoc.id = donorSnap.docs[0].id;
            role = 'Donor';
        } else if (requestedRole === 'Beneficiary' && !benSnap.empty) {
            targetDoc = benSnap.docs[0].data();
            targetDoc.id = benSnap.docs[0].id;
            role = 'Beneficiary';
        } 
        
        // Priority 2: Staff Profile (if no specific role requested or requested role not found)
        if (!targetDoc && userLookupSnap.exists) {
            const lookupData = userLookupSnap.data();
            const userSnap = await adminDb.collection('users').doc(lookupData?.userKey || loginId).get();
            if (userSnap.exists) {
                targetDoc = userSnap.data();
                targetDoc.id = userSnap.id;
                role = targetDoc.role;
            }
        }

        // Priority 3: Fallback to whatever exists
        if (!targetDoc && !donorSnap.empty) {
            targetDoc = donorSnap.docs[0].data();
            targetDoc.id = donorSnap.docs[0].id;
            role = 'Donor';
        }
        if (!targetDoc && !benSnap.empty) {
            targetDoc = benSnap.docs[0].data();
            targetDoc.id = benSnap.docs[0].id;
            role = 'Beneficiary';
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
        const targetId = targetDoc.id || targetDoc.userKey || loginId;
        const customToken = await adminAuth.createCustomToken(targetId, { role });

        // 6. Record Session in Firestore (Non-blocking)
        const sessionId = randomUUID();
        const headerList = await headers();
        const userAgent = headerList.get('user-agent') || 'Unknown Device';
        const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'Unknown IP';
        
        const sessionPromise = adminDb.collection('user_sessions').doc(sessionId).set({
            userId: targetId,
            userName: targetDoc.name,
            role,
            userAgent,
            ip,
            loginAt: Date.now(),
            lastActive: Date.now(),
            status: 'Active'
        });

        // 7. Determine Final Redirect
        let redirect = '/donor-portal';
        if (role === 'Beneficiary') redirect = '/beneficiary-portal';
        if (role === 'Admin' || role === 'User') redirect = '/dashboard';

        return { 
            success: true, 
            token: customToken, 
            role, 
            sessionStart: Date.now(),
            sessionId,
            redirect,
            message: `Authentication successful. Accessing ${role} workspace...`
        };

    } catch (error: any) {
        console.error("Portal Auth Error:", error);
        return { success: false, message: `System error during login: ${error?.message || (typeof error === 'string' ? error : 'Unknown Error')}` };
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
export async function setPortalPasswordAction(userId: string, collectionName: 'users' | 'donors' | 'beneficiaries', newPassword: string) {
    const role = collectionName === 'donors' ? 'Donor' : (collectionName === 'beneficiaries' ? 'Beneficiary' : 'User');
    return updatePortalPasswordAction(userId, role, newPassword);
}

/**
 * Generate and send a secure OTP via Telegram for portal authentication.
 */
export async function sendPortalOTPAction(identifier: string) {
    try {
        const { adminDb } = getAdminServices();
        if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
        const inputIdentifier = identifier.trim();
        const isPhone = /^\d{10}$/.test(inputIdentifier);
        const cleanPhone = isPhone ? inputIdentifier : '';
        const loginId = inputIdentifier;

        let targetDoc: any = null;
        let telegramChatId: string = '';
        let customBotToken: string = '';

        // 1. Resolve Identity and find Telegram ID
        let resolvedUserId = '';
        
        // Check User Lookups (Staff/Centralized)
        const userLookups = await adminDb.collection('user_lookups').doc(loginId).get();
        if (userLookups.exists) {
            resolvedUserId = userLookups.data()?.userKey || loginId;
        }

        // Check Donors/Beneficiaries if not resolved yet
        if (!resolvedUserId) {
            const donorQuery = isPhone 
                ? adminDb.collection('donors').where('phone', '==', cleanPhone).limit(1)
                : adminDb.collection('donors').where('loginId', '==', loginId).limit(1);
            const donorSnap = await donorQuery.get();
            if (!donorSnap.empty) {
                resolvedUserId = donorSnap.docs[0].id;
            }
        }

        if (!resolvedUserId) {
            const benQuery = isPhone 
                ? adminDb.collection('beneficiaries').where('phone', '==', cleanPhone).limit(1)
                : adminDb.collection('beneficiaries').where('loginId', '==', loginId).limit(1);
            const benSnap = await benQuery.get();
            if (!benSnap.empty) {
                resolvedUserId = benSnap.docs[0].id;
            }
        }

        if (!resolvedUserId) return { success: false, message: "Identification failed. Please verify your ID or Mobile Number." };

        // 2. Fetch Primary User Record for Messaging Config and determine Profile Type
        const userSnap = await adminDb.collection('users').doc(resolvedUserId).get();
        const donorSnap = await adminDb.collection('donors').doc(resolvedUserId).get();
        const benSnap = await adminDb.collection('beneficiaries').doc(resolvedUserId).get();
        
        let profileType: 'Member' | 'Donor' | 'Beneficiary' | 'Admin' = 'Donor';
        if (userSnap.exists) {
            targetDoc = userSnap.data();
            profileType = targetDoc.role === 'Admin' ? 'Admin' : 'Member';
        } else if (donorSnap.exists) {
            targetDoc = donorSnap.data();
            profileType = 'Donor';
        } else if (benSnap.exists) {
            targetDoc = benSnap.data();
            profileType = 'Beneficiary';
        }

        telegramChatId = targetDoc?.telegramChatId || '';
        customBotToken = targetDoc?.customTelegramBotToken || '';

        if (!telegramChatId) return { success: false, message: "Telegram account not linked. Please use password login or contact support." };

        // 3. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Fetch validity from settings or default to 5
        const resourcesDoc = await adminDb.collection('settings').doc('resources').get();
        const validityMinutes = resourcesDoc.data()?.portalOtpValidityMinutes || 5;
        const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

        // 4. Store OTP in secure collection (using consistent loginId as key)
        await adminDb.collection('portal_otps').doc(loginId).set({
            otp,
            expiresAt,
            createdAt: new Date(),
            userId: resolvedUserId,
            profileType
        });

        // 5. Dispatch via Telegram using Profile-Specific Template
        const templateId = profileType === 'Admin' ? 'otp_admin' : (profileType === 'Member' ? 'otp_staff' : (profileType === 'Donor' ? 'otp_donor' : 'otp_beneficiary'));
        
        const telRes = await sendTelegramAction({ 
            templateId,
            variables: {
                name: targetDoc?.name || 'User',
                otp,
                validity: validityMinutes.toString()
            },
            chatId: telegramChatId, 
            bypassAutoCheck: true,
            configOverride: customBotToken ? { telegramBotToken: customBotToken } : undefined
        });

        if (!telRes.success) {
            let errorMsg = telRes.message || "Failed to dispatch OTP. Please try again later.";
            if (errorMsg.includes("Target Chat ID not found")) {
                errorMsg = "Telegram Connectivity Issue: The bot cannot find your chat. Please open Telegram and click 'START' in your bot to link your account.";
            }
            return { success: false, message: errorMsg };
        }

        return { success: true, message: `Secure OTP has been dispatched to your linked Telegram account (${profileType} profile).` };

    } catch (error: any) {
        console.error("OTP Dispatch Error:", error);
        return { success: false, message: `System error: ${error?.message || (typeof error === 'string' ? error : 'Unknown Internal Error')}` };
    }
}

/**
 * Verify OTP and generate Custom Token.
 */
export async function verifyPortalOTPAction(identifier: string, otp: string, requestedRole?: 'Donor' | 'Beneficiary') {
    try {
        const { adminDb, adminAuth } = getAdminServices();
        if (!adminDb || !adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
        const loginId = identifier.trim();
        let targetDoc: any = null;
        let targetId: string = '';
        let role: string = '';
        
        // 1. Fetch and Verify OTP
        const otpDoc = await adminDb.collection('portal_otps').doc(loginId).get();
        if (!otpDoc.exists) return { success: false, message: "No active OTP session found. Please request a new one." };
        
        const data = otpDoc.data();
        if (data?.otp !== otp) return { success: false, message: "Invalid verification code. Please try again." };
        
        const now = new Date();
        const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (now > expiresAt) return { success: false, message: "OTP has expired. Please request a new one." };

        // 2. Identity Resolution with Role Priority
        const inputIdentifier = identifier.trim();
        const isPhone = /^\d{10}$/.test(inputIdentifier);
        const cleanPhone = isPhone ? inputIdentifier : '';

        // 3. Parallel identity lookup
        const queries: Promise<any>[] = [
            adminDb.collection('user_lookups').doc(loginId).get(),
        ];

        if (isPhone) {
            queries.push(adminDb.collection('donors').where('phone', '==', cleanPhone).limit(1).get());
            queries.push(adminDb.collection('beneficiaries').where('phone', '==', cleanPhone).limit(1).get());
        } else {
            queries.push(adminDb.collection('donors').where('loginId', '==', loginId).limit(1).get());
            queries.push(adminDb.collection('beneficiaries').where('loginId', '==', loginId).limit(1).get());
        }

        const [userLookupSnap, donorSnap, benSnap] = await Promise.all(queries);

        // 4. Resolve Identity
        // Priority 1: Requested Role
        if (requestedRole === 'Donor' && !donorSnap.empty) {
            targetDoc = donorSnap.docs[0].data();
            targetId = donorSnap.docs[0].id;
            role = 'Donor';
        } else if (requestedRole === 'Beneficiary' && !benSnap.empty) {
            targetDoc = benSnap.docs[0].data();
            targetId = benSnap.docs[0].id;
            role = 'Beneficiary';
        } 
        
        // Priority 2: Staff Profile
        if (!targetDoc && userLookupSnap.exists) {
            const lookupData = userLookupSnap.data();
            const userSnap = await adminDb.collection('users').doc(lookupData?.userKey || loginId).get();
            if (userSnap.exists) {
                targetDoc = userSnap.data();
                role = targetDoc.role;
                targetId = userSnap.id;
            }
        }

        // Priority 3: Fallback
        if (!targetDoc && !donorSnap.empty) {
            targetDoc = donorSnap.docs[0].data();
            role = 'Donor';
            targetId = donorSnap.docs[0].id;
        }
        if (!targetDoc && !benSnap.empty) {
            targetDoc = benSnap.docs[0].data();
            role = 'Beneficiary';
            targetId = benSnap.docs[0].id;
        }

        if (!targetDoc) return { success: false, message: "Identity resolution failed after verification." };

        // 3. Clear OTP session
        await adminDb.collection('portal_otps').doc(loginId).delete().catch(() => {});

        // 4. Generate Custom Token
        const customToken = await adminAuth.createCustomToken(targetId, { role });

        // 5. Record Session (Non-blocking)
        const sessionId = randomUUID();
        const headerList = await headers();
        const userAgent = headerList.get('user-agent') || 'Unknown Device';
        const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'Unknown IP';
        
        adminDb.collection('user_sessions').doc(sessionId).set({
            userId: targetId,
            userName: targetDoc.name,
            role,
            userAgent,
            ip,
            loginAt: Date.now(),
            lastActive: Date.now(),
            status: 'Active'
        }).catch(err => console.error("Session recording failed:", err));

        // 7. Determine Final Redirect
        let redirect = '/donor-portal';
        if (role === 'Beneficiary') redirect = '/beneficiary-portal';
        if (role === 'Admin' || role === 'User') redirect = '/dashboard';

        return { 
            success: true, 
            token: customToken, 
            role, 
            sessionStart: Date.now(),
            sessionId,
            redirect,
            message: `OTP Verified. Accessing ${role} workspace...`
        };

    } catch (error: any) {
        console.error("OTP Verification Error:", error);
        return { success: false, message: error?.message || (typeof error === 'string' ? error : 'Unknown Verification Error') };
    }
}

/**
 * Reset password after verifying Telegram OTP.
 */
export async function resetPasswordWithOTPAction(identifier: string, otp: string, newPassword: string) {
    try {
        const { adminDb, adminAuth } = getAdminServices();
        if (!adminDb || !adminAuth) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
        const loginId = identifier.trim();
        
        // 1. Verify OTP
        const otpDoc = await adminDb.collection('portal_otps').doc(loginId).get();
        if (!otpDoc.exists) return { success: false, message: "No active OTP session found. Please request a new one." };
        
        const otpData = otpDoc.data();
        if (otpData?.otp !== otp) return { success: false, message: "Invalid verification code." };
        
        const expiresAt = otpData.expiresAt.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);
        if (new Date() > expiresAt) return { success: false, message: "OTP has expired." };

        // 2. Resolve User Key
        let userKey = '';
        const lookup = await adminDb.collection('user_lookups').doc(loginId).get();
        if (lookup.exists) {
            userKey = lookup.data()?.userKey || loginId;
        } else {
             const isPhone = /^\d{10}$/.test(loginId);
             const cleanPhone = isPhone ? loginId : '';
             const donorSnap = await adminDb.collection('donors').where(isPhone ? 'phone' : 'loginId', '==', isPhone ? cleanPhone : loginId).limit(1).get();
             if (!donorSnap.empty) {
                 userKey = donorSnap.docs[0].id;
             } else {
                 const benSnap = await adminDb.collection('beneficiaries').where(isPhone ? 'phone' : 'loginId', '==', isPhone ? cleanPhone : loginId).limit(1).get();
                 if (!benSnap.empty) userKey = benSnap.docs[0].id;
             }
        }

        if (!userKey) return { success: false, message: "Could not identify organizational profile for password reset." };

        // 3. Determine correct collection based on profile type
        const profileType = otpData.profileType || 'Member';
        const primaryCollection = profileType === 'Donor' ? 'donors' : (profileType === 'Beneficiary' ? 'beneficiaries' : 'users');

        // 4. Update password in primary collection
        await adminDb.collection(primaryCollection).doc(userKey).update({ 
            password: newPassword, 
            updatedAt: new Date() 
        }).catch(() => {});

        // 5. Mirror to users collection if primary was a different collection
        if (primaryCollection !== 'users') {
            await adminDb.collection('users').doc(userKey).update({ password: newPassword, updatedAt: new Date() }).catch(() => {});
        }

        // 6. Sync with Firebase Auth if user exists there
        if (adminAuth) {
            await adminAuth.updateUser(userKey, { password: newPassword }).catch(() => {});
        }

        // 7. Clear OTP Session
        await adminDb.collection('portal_otps').doc(loginId).delete().catch(() => {});

        // 8. Send Security Notification (Non-blocking)
        const templateId = profileType === 'Admin' ? 'password_changed_staff' : (profileType === 'Member' ? 'password_changed_staff' : (profileType === 'Donor' ? 'password_changed_donor' : 'password_changed_beneficiary'));
        const userDoc = await adminDb.collection(primaryCollection).doc(userKey).get();
        const userName = userDoc.data()?.name || 'User';

        import('@/app/messages/actions').then(m => {
            m.sendMultiChannelNotificationAction({
                userId: userKey,
                templateId,
                variables: { name: userName },
                metadata: { type: 'security_alert', action: 'password_reset' }
            });
        }).catch(err => console.error("Post-reset notification failed:", err));

        return { success: true, message: "Password reset successful. You can now login with your new credentials." };

    } catch (error: any) {
        console.error("Password reset via Telegram failed:", error);
        return { success: false, message: `Reset Failed: ${error.message}` };
    }
}
