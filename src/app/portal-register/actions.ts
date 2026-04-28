'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Donor, Beneficiary } from '@/lib/types';

interface RegisterSupporterParams {
    role: 'Donor' | 'Beneficiary';
    name: string;
    phone: string;
    password: string;
    email?: string;
    address?: string;
    age?: number;
    occupation?: string;
    telegramChatId?: string;
}

export async function registerSupporterAction(params: RegisterSupporterParams) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Institutional Authentication Hub Unavailable.' };

    try {
        const { role, name, phone, password, email, address, age, occupation, telegramChatId } = params;

        const numericOnly = phone.replace(/\D/g, '');
        const phone10 = numericOnly.length >= 10 ? numericOnly.slice(-10) : numericOnly;

        if (phone10.length !== 10) {
            return { success: false, message: 'Invalid 10-digit phone number.' };
        }

        const phoneWithPrefix = '+91' + phone10;

        // 1. Check if phone is already registered in Users, Donors, or Beneficiaries
        const userCheck = await adminDb.collection('users').where('phone', 'in', [phone10, phoneWithPrefix]).limit(1).get();
        const donorCheck = await adminDb.collection('donors').where('phone', 'in', [phone10, phoneWithPrefix]).limit(1).get();
        const benCheck = await adminDb.collection('beneficiaries').where('phone', 'in', [phone10, phoneWithPrefix]).limit(1).get();

        if (!userCheck.empty || !donorCheck.empty || !benCheck.empty) {
            return { success: false, message: 'This phone number is already registered. Please log in.' };
        }

        if (role === 'Donor') {
            const donorId = `donor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const donorData: Partial<Donor> = {
                id: donorId,
                name,
                phone: phone10,
                phones: [phone10, phoneWithPrefix],
                email: email || '',
                address: address || '',
                status: 'Active',
                password,
                telegramChatId: telegramChatId || '',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await adminDb.collection('donors').doc(donorId).set(donorData);
            return { success: true, message: 'Donor Profile Registered Successfully. You can now log in.', role: 'Donor' };
        } else {
            const beneficiaryId = `ben_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const benData: Partial<Beneficiary> = {
                id: beneficiaryId,
                name,
                phone: phone10,
                address: address || '',
                occupation: occupation || '',
                age: age ? Number(age) : undefined,
                addedDate: new Date().toISOString().split('T')[0],
                status: 'Pending',
                password,
                telegramChatId: telegramChatId || '',
                isEligibleForZakat: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await adminDb.collection('beneficiaries').doc(beneficiaryId).set(benData);
            return { success: true, message: 'Beneficiary Profile Registered Successfully. Access Pending Review.', role: 'Beneficiary' };
        }
    } catch (e: any) {
        console.error('Portal Registration Error:', e);
        return { success: false, message: e.message };
    }
}

export async function getTelegramBotConfigAction() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, botName: 'Our Official Bot' };

    try {
        const resourcesDoc = await adminDb.collection('settings').doc('resources').get();
        if (resourcesDoc.exists) {
            const data = resourcesDoc.data();
            // Since we usually don't store bot username directly, we can't extract it easily from token
            // But if there's a field for it, we'd use it. For now, let's just return a placeholder or generic string.
            return { success: true, botName: data?.telegramBotName || 'BaitulMal Telegram Bot' };
        }
        return { success: true, botName: 'BaitulMal Telegram Bot' };
    } catch (e) {
        return { success: false, botName: 'BaitulMal Telegram Bot' };
    }
}
