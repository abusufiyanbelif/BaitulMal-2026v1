'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { revalidatePath } from 'next/cache';

const ADMIN_SDK_ERROR_MESSAGE = "Registration service is temporarily unavailable.";

export async function registerPortalUserAction(data: {
    name: string;
    phone: string;
    role: 'Donor' | 'Beneficiary';
    password?: string;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { name, phone, role, password } = data;
        const cleanPhone = phone.trim().replace(/\D/g, '');
        
        if (cleanPhone.length < 10) {
            return { success: false, message: "Invalid mobile number. Please enter at least 10 digits." };
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
            role,
            status: 'Active',
            password: password || cleanPhone, // Default password is phone if none provided
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await docRef.set(newProfile);

        // Register in centralized user_lookups for fast login
        await lookupRef.set({
            userKey: profileId,
            role,
            phone: cleanPhone,
            name
        });

        // Also create a entry in 'users' for system-wide identity
        await adminDb.collection('users').doc(profileId).set({
            id: profileId,
            name,
            phone: cleanPhone,
            role,
            status: 'Active',
            password: password || cleanPhone,
            userKey: profileId,
            loginId: cleanPhone,
            permissions: {},
            createdAt: new Date(),
            updatedAt: new Date(),
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
