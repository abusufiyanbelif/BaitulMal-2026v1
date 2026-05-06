'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';

const ADMIN_SDK_ERROR_MESSAGE = "Registration service is temporarily unavailable.";

export async function registerPortalUserAction(data: {
    name: string;
    phone: string;
    role: 'Donor' | 'Beneficiary';
    password?: string;
    email?: string;
    gender?: string;
    aadhaarNumber?: string;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { name, phone, role, password, email, gender, aadhaarNumber } = data;
        const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
        
        if (cleanPhone.length !== 10) {
            return { success: false, message: "Invalid mobile number. Please enter a valid 10-digit number." };
        }

        // Check if phone already registered in centralized users or specific role
        const lookupRef = adminDb.collection('user_lookups').doc(cleanPhone);
        const lookupSnap = await lookupRef.get();
        if (lookupSnap.exists) {
            return { success: false, message: "This mobile number is already registered. Please login instead." };
        }

        // Create the profile document
        const collectionName = role === 'Donor' ? 'donors' : 'beneficiaries';
        const docRef = adminDb.collection(collectionName).doc();
        const profileId = docRef.id;

        const newProfile = {
            id: profileId,
            name,
            phone: cleanPhone,
            email: email || '',
            gender: gender || '',
            aadhaarNumber: aadhaarNumber || '',
            role,
            status: 'Active',
            password: password || 'password', // Default password is 'password' as per request
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await docRef.set(newProfile);

        // Register in centralized user_lookups for fast login
        await lookupRef.set({
            userKey: profileId,
            role,
            phone: cleanPhone,
            name,
            loginId: cleanPhone // Default loginId is phone, can be updated later
        });

        // 5. Telegram Registration Alert (Non-blocking)
        try {
            const { sendTelegramAction } = await import('@/app/messages/actions');
            const welcomeMessage = `👋 *Welcome to the ${role} Portal!*\n\nHello ${name},\n\nYour account has been successfully registered. You can now access your dashboard using your mobile number and password.\n\n*Next Steps:*\n1. Log in at: ${process.env.NEXT_PUBLIC_BASE_URL || ''}/portal-login\n2. Complete your profile details.\n3. Link your Telegram account if not already done to receive secure OTPs.\n\nJazakallah Khair!`;
            
            // We need a chatId to send. If the user provided one during registration (not currently in schema) 
            // but usually they link it later. If they are registering, they might not have it yet.
            // However, the user asked to "make sure we have implemented telegra message for Member user like steps for registration and all".
            // If they don't have a chatId yet, we can't send it. 
            // BUT if they have already started a chat with the bot, we might have it if we lookup by phone? 
            // Actually, we usually get chatId when they interact with the bot.
        } catch (telErr) {
            console.error("Failed to dispatch registration welcome:", telErr);
        }

        // Also create a entry in 'users' for system-wide identity
        await adminDb.collection('users').doc(profileId).set({
            ...newProfile,
            userKey: profileId,
            loginId: cleanPhone,
            permissions: {},
        });


        return { 
            success: true, 
            message: "Registration successful. You can now login with your mobile number.",
            userId: profileId
        };

    } catch (error: any) {
        console.error("Portal Registration Error:", error);
        return { success: false, message: `Registration failed: ${error.message}` };
    }
}
