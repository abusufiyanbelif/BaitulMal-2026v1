'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { MessageTemplate, MessageLog, ResourceSettings, PendingVerification, NotificationGroup, UserProfile } from '@/lib/types';
import { cookies } from 'next/headers';
import { generateChanges } from '@/lib/utils';
import nodemailer from 'nodemailer';

/**
 * Sovereign Admin UIDs — mirrors Firestore isAdmin() rules.
 * These bypass all permission checks regardless of DB state.
 */
const SOVEREIGN_ADMIN_UIDS = [
    'cyMl1lQME0Yur1YS3VCms1AvrOJ2',
    'S5efNV5jpTPoxYNv6SnAlv3jNPO2',
    '3gKwUE2JrBT8wngoUxTTN6tLJk03',
];

const SOVEREIGN_ADMIN_EMAILS = [
    'baitulmalss.solapur@gmail.com',
    'abusufiyan.belif@gmail.com',
    'maazshaikh.official@gmail.com',
    'admin@example.com',
];

/**
 * Helper to check if the caller is authorized (Admin or specific permission).
 * Mirrors the Firestore isAdmin() sovereign bypass logic for consistency.
 */
async function checkAuth(requiredModule?: string, requiredPerm?: string) {
    const { adminAuth, adminDb } = getAdminServices();
    if (!adminAuth || !adminDb) return { isAuthorized: false };

    const sessionCookie = cookies().get('__session')?.value || cookies().get('auth-token')?.value;
    if (!sessionCookie) {
        console.warn('checkAuth: No valid session cookie found.');
        return { isAuthorized: false };
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie).catch(() => adminAuth.verifyIdToken(sessionCookie));

        // --- SOVEREIGN BYPASS ---
        if (SOVEREIGN_ADMIN_UIDS.includes(decodedToken.uid) ||
            (decodedToken.email && SOVEREIGN_ADMIN_EMAILS.includes(decodedToken.email))) {
            return { isAuthorized: true, user: { role: 'Admin', id: decodedToken.uid } };
        }

        // --- DB ROLE CHECK ---
        // Check users collection (Staff)
        const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            if (userData?.role === 'Admin') return { isAuthorized: true, user: userData };
            
            if (requiredModule && requiredPerm) {
                const hasPerm = userData?.permissions?.[requiredModule]?.[requiredPerm] === true;
                return { isAuthorized: hasPerm, user: userData };
            }
            return { isAuthorized: true, user: userData };
        }

        // Check donors collection
        const donorSnap = await adminDb.collection('donors').doc(decodedToken.uid).get();
        if (donorSnap.exists) {
            return { isAuthorized: true, user: { ...donorSnap.data(), role: 'Donor' } };
        }

        // Check beneficiaries collection
        const benSnap = await adminDb.collection('beneficiaries').doc(decodedToken.uid).get();
        if (benSnap.exists) {
            return { isAuthorized: true, user: { ...benSnap.data(), role: 'Beneficiary' } };
        }

        return { isAuthorized: false };

        console.warn(`checkAuth: User ${decodedToken.uid} is not an Admin and lacks ${requiredModule}:${requiredPerm} permissions.`);
        return { isAuthorized: false };
    } catch (e: any) {
        console.error('checkAuth: Verification Failed:', e.message);
        return { isAuthorized: false };
    }
}

/**
 * Core utility to send a WhatsApp message using configured resources.
 */
export async function sendWhatsAppAction(params: {
    to: string;
    templateId?: string;
    variables?: Record<string, string>;
    customMessage?: string;
    metadata?: MessageLog['metadata'];
    configOverride?: Partial<ResourceSettings>;
    bypassAutoCheck?: boolean;
    moduleId?: 'campaign' | 'lead' | 'donation' | 'beneficiary' | 'donor' | 'user';
    richData?: {
        title: string;
        cause: string;
        purpose: string;
        oldData?: any;
        newData?: any;
        actionUrl?: string;
    };
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Administrative Services Unavailable.' };

    // Standard authorization check
    const auth = await checkAuth('messages', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized. Administrative clearance required.' };

    try {
        return await sendWhatsAppCore({ ...params, bypassAutoCheck: true }, auth.user?.name);
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Generates a rich, detailed message payload with context, data changes, and action links.
 */
function generateDetailedPayload(params: {
    title: string;
    cause: string;
    purpose: string;
    oldData?: any;
    newData?: any;
    actionUrl?: string;
    userName?: string;
}) {
    const changes = params.oldData && params.newData ? generateChanges(params.oldData, params.newData) : [];
    
    let message = `🔔 *${params.title}*\n\n`;
    message += `👤 *Performed by:* ${params.userName || 'System'}\n`;
    message += `🎯 *Purpose:* ${params.purpose}\n`;
    message += `⚠️ *Cause:* ${params.cause}\n\n`;

    if (changes.length > 0) {
        message += `📝 *Data Changes:*\n`;
        changes.forEach(c => {
            message += `• ${c.field}: _${c.old}_ ➔ *${c.new}*\n`;
        });
        message += `\n`;
    }

    if (params.actionUrl) {
        message += `🔗 *Action Required:* ${params.actionUrl}\n\n`;
    }

    message += `_This is an organization automated alert._`;
    return message;
}

async function sendWhatsAppCore(params: {
    to: string;
    templateId?: string;
    variables?: Record<string, string>;
    customMessage?: string;
    metadata?: MessageLog['metadata'];
    configOverride?: Partial<ResourceSettings>;
    bypassAutoCheck?: boolean;
    moduleId?: 'campaign' | 'lead' | 'donation' | 'beneficiary' | 'donor' | 'user';
    // Rich Data
    richData?: {
        title: string;
        cause: string;
        purpose: string;
        oldData?: any;
        newData?: any;
        actionUrl?: string;
    }
}, userName?: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Administrative Services Unavailable.' };

    try {
        // 1. Fetch Resource Config
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const resources = resourceSnap.data() as ResourceSettings;
        
        // --- Subscription Check ---
        if (resources?.waPlanDetails?.status !== 'Active' && !params.bypassAutoCheck) {
            return { 
                success: false, 
                message: `WhatsApp service is ${resources?.waPlanDetails?.status || 'Inactive'}. Please check resource subscription status.`,
                requiresSubscription: true,
                planDetails: resources?.waPlanDetails
            };
        }

        const API_URL = params.configOverride?.whatsappApiUrl || resources?.whatsappApiUrl || process.env.WHATSAPP_API_URL;
        const API_KEY = params.configOverride?.whatsappApiKey || resources?.whatsappApiKey || process.env.WHATSAPP_API_KEY;
        const IS_AUTO_ENABLED = resources?.isAutoWhatsAppEnabled ?? true;

        if (!IS_AUTO_ENABLED && !params.bypassAutoCheck) {
            return { success: false, message: 'Automated notifications are currently disabled in Resource Configuration.' };
        }

        // 2. Check Module-Specific Toggle
        if (params.moduleId && !params.bypassAutoCheck) {
            const moduleConfigSnap = await adminDb.collection('settings').doc(`${params.moduleId}_config`).get();
            const moduleConfig = moduleConfigSnap.data();
            if (moduleConfig && moduleConfig.enableWhatsAppNotifications === false) {
                return { success: false, message: `WhatsApp notifications are disabled for the ${params.moduleId} module.` };
            }
        }

        let finalMessage = params.customMessage || '';

        // 3. Handle Rich Data if provided (Highest Priority)
        if (params.richData) {
            finalMessage = generateDetailedPayload({
                ...params.richData,
                userName: userName
            });
        }
        // 4. Handle Template if provided (Secondary Priority)
        else if (params.templateId) {
            const templateSnap = await adminDb.collection('settings').doc('message_templates').collection('templates').doc(params.templateId).get();
            if (templateSnap.exists) {
                const template = templateSnap.data() as MessageTemplate;
                finalMessage = template.body;
                
                // Interpolate variables
                if (params.variables) {
                    Object.entries(params.variables).forEach(([key, value]) => {
                        // Safe replacement for all occurrences
                        finalMessage = finalMessage.split(`{{${key}}}`).join(value || '');
                    });
                }
            }
        }

        if (!finalMessage) return { success: false, message: 'Message content is empty.' };

        // 4. Dispatch or Simulate
        let status: 'Sent' | 'Failed' = 'Sent';
        let error: string | undefined;

        const PROVIDER = params.configOverride?.activeWhatsAppProvider || resources?.activeWhatsAppProvider || 'whapi';

        if (PROVIDER === 'meta') {
            const META_TOKEN = params.configOverride?.metaAccessToken || resources?.metaAccessToken;
            const META_PHONE_ID = params.configOverride?.metaPhoneNumberId || resources?.metaPhoneNumberId;

            if (!META_TOKEN || !META_PHONE_ID) {
                console.log(`[SIMULATED META WHATSAPP] To: ${params.to} | Content: ${finalMessage}`);
            } else {
                let cleanPhone = params.to.replace(/\D/g, '');
                if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

                try {
                    const response = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_ID}/messages`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${META_TOKEN}`
                        },
                        body: JSON.stringify({
                            messaging_product: "whatsapp",
                            recipient_type: "individual",
                            to: cleanPhone,
                            type: "text",
                            text: { body: finalMessage }
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        status = 'Failed';
                        error = `Meta API Error: ${errData.error?.message || response.statusText}`;
                    }
                } catch (e: any) {
                    status = 'Failed';
                    error = e.message;
                }
            }
        } else {
            // WHAPI (Existing Logic)
            if (!API_URL || !API_KEY) {
                console.log(`[SIMULATED WHAPI WHATSAPP] To: ${params.to} | Content: ${finalMessage}`);
            } else {
                let cleanPhone = params.to.replace(/\D/g, '');
                if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${API_KEY}`
                        },
                        body: JSON.stringify({
                            to: cleanPhone,
                            body: finalMessage
                        })
                    });

                    if (!response.ok) {
                        status = 'Failed';
                        error = `Whapi Error: ${response.statusText}`;
                    }
                } catch (e: any) {
                    status = 'Failed';
                    error = e.message;
                }
            }
        }

        // 5. Log the message
        const logRef = adminDb.collection('message_logs').doc();

        // Clean metadata to remove undefined values for Firestore
        const cleanMetadata = params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : {};

        const log: MessageLog = {
            id: logRef.id,
            recipient: params.to,
            content: finalMessage,
            type: 'WhatsApp',
            status,
            error: error || undefined,
            timestamp: Timestamp.now(),
            metadata: cleanMetadata
        };
        await logRef.set(log);

        return { 
            success: status === 'Sent', 
            message: status === 'Sent' ? 'Message dispatched successfully.' : `Failed: ${error}`,
            logId: logRef.id
        };
    } catch (e: any) {
        console.error('Messaging Action Error:', e);
        return { success: false, message: `System Error: ${e.message}` };
    }
}


/**
 * Seed default templates if they don't exist
 */
export async function seedDefaultTemplatesAction() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;

    const auth = await checkAuth('settings', 'update');
    if (!auth.isAuthorized) throw new Error('Unauthorized');

    const templates: MessageTemplate[] = [
        // --- AUTH & OTP (MultiChannel) ---
        {
            id: 'otp_staff',
            name: 'Staff: Portal Login OTP',
            subject: 'Organization Access Code',
            body: '🔐 *Staff Portal Access*\n\nHello {{name}},\n\nYour One-Time Password (OTP) for BaitulMal Staff Dashboard is: *{{otp}}*\n\nThis code expires in {{validity}} minutes. If you did not request this, please secure your account immediately.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Member',
            variables: ['name', 'otp', 'validity'],
            isActive: true
        },
        {
            id: 'otp_donor',
            name: 'Donor: Portal Login OTP',
            subject: 'Donor Portal Access',
            body: '🔐 *Donor Portal Access*\n\nAssalamualaikum {{name}},\n\nYour verification code is: *{{otp}}*\n\nUse this to access your donation history and tax receipts. Valid for {{validity}} minutes.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Donor',
            variables: ['name', 'otp', 'validity'],
            isActive: true
        },
        {
            id: 'otp_beneficiary',
            name: 'Beneficiary: Portal Login OTP',
            subject: 'Beneficiary Portal Access',
            body: '🔐 *Beneficiary Portal Access*\n\nHello {{name}},\n\nYour verification code is: *{{otp}}*\n\nUse this to check your assistance request status. Valid for {{validity}} minutes.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Beneficiary',
            variables: ['name', 'otp', 'validity'],
            isActive: true
        },
        // --- PASSWORD ALERTS ---
        {
            id: 'password_changed_staff',
            name: 'Staff: Password Reset Success',
            subject: 'Security Alert: Password Updated',
            body: '🔐 *Security Update: Staff Portal*\n\nHello {{name}},\n\nYour organization account password was recently changed. If this was not you, please contact the IT department immediately.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Member',
            variables: ['name'],
            isActive: true
        },
        {
            id: 'password_changed_donor',
            name: 'Donor: Password Reset Success',
            subject: 'Security Alert: Password Updated',
            body: '🔐 *Security Update: Donor Portal*\n\nAssalamualaikum {{name}},\n\nYour portal password has been successfully updated. You can now login with your new credentials. Jazakallah Khair for keeping your account secure.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Donor',
            variables: ['name'],
            isActive: true
        },
        {
            id: 'password_changed_beneficiary',
            name: 'Beneficiary: Password Reset Success',
            subject: 'Security Alert: Password Updated',
            body: '🔐 *Security Update: Beneficiary Portal*\n\nHello {{name}},\n\nYour password for the assistance portal has been successfully changed. If you did not authorize this change, please contact us.',
            type: 'MultiChannel',
            category: 'Security',
            profileType: 'Beneficiary',
            variables: ['name'],
            isActive: true
        },

        // --- DONOR ACTIONS ---
        {
            id: 'donor_donation_linked',
            name: 'Donor: Donation Linked to Cause',
            subject: 'Your Donation Has Been Allocated',
            body: '📌 *Donation Allocation Update*\n\nAssalamualaikum {{donorName}},\n\nYour contribution of *₹{{amount}}* has been officially linked to:\n\n*Cause:* {{causeName}}\n*Purpose:* {{purpose}}\n\n*Live Progress:* {{percent}}% reached.\n\nThank you for fueling this mission! 🤲',
            type: 'MultiChannel',
            category: 'Donation',
            profileType: 'Donor',
            variables: ['donorName', 'amount', 'causeName', 'purpose', 'percent'],
            isActive: true
        },
        {
            id: 'donor_cause_closed',
            name: 'Donor: Cause Successfully Completed',
            subject: 'Mission Accomplished Update',
            body: '🎉 *Mission Accomplished!*\n\nAssalamualaikum {{donorName}},\n\nThe cause you supported, *{{causeName}}*, has been successfully finalized.\n\n*Total Impact:* {{impactCount}} lives touched\n*Total Raised:* ₹{{totalAmount}}\n\nYour generosity made this possible. Jazakallah Khair! 🌟',
            type: 'MultiChannel',
            category: 'Update',
            profileType: 'Donor',
            variables: ['donorName', 'causeName', 'impactCount', 'totalAmount'],
            isActive: true
        },

        // --- BENEFICIARY ACTIONS ---
        {
            id: 'beneficiary_disbursement',
            name: 'Beneficiary: Funds Released',
            subject: 'Assistance Disbursement Alert',
            body: '💸 *Assistance Disbursement Notification*\n\nHello {{beneficiaryName}},\n\nAssistance funds for your request ({{id}}) have been released.\n\n*Amount:* ₹{{amount}}\n*Method:* {{method}}\n\nPlease verify receipt at your end. 🤝',
            type: 'MultiChannel',
            category: 'Update',
            profileType: 'Beneficiary',
            variables: ['beneficiaryName', 'id', 'amount', 'method'],
            isActive: true
        },

        // --- UPDATING EXISTING (Example) ---
        {
            id: 'lead_created',
            name: 'Internal: New Lead Entry',
            subject: 'New Service Request',
            body: '📍 *New Lead Entry*\n\n*ID:* {{id}}\n*Name:* {{name}}\n*Category:* {{category}}\n\nReview: {{url}}',
            type: 'MultiChannel',
            category: 'Leads',
            profileType: 'Member',
            variables: ['id', 'name', 'category', 'url'],
            isActive: true
        }
    ];

    const batch = adminDb.batch();
    for (const t of templates) {
        const ref = adminDb.collection('settings').doc('message_templates').collection('templates').doc(t.id);
        batch.set(ref, { ...t, updatedAt: Timestamp.now() }, { merge: true });
    }
    await batch.commit();
}

/**
 * Send a direct notification to a specific donor (by donor doc ID).
 * Looks up phone + telegramChatId from donors collection (and users collection as fallback).
 */
export async function notifyDonorDirectAction(donorId: string, params: {
    templateId?: string;
    variables?: Record<string, string>;
    customMessage?: string;
    metadata?: any;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        // Try donors collection first, then users
        let phone = '';
        let telegramChatId = '';
        let customBotToken = '';
        let donorName = '';

        const donorSnap = await adminDb.collection('donors').doc(donorId).get();
        if (donorSnap.exists) {
            const d = donorSnap.data() as any;
            phone = d.phone || '';
            telegramChatId = d.telegramChatId || '';
            customBotToken = d.customTelegramBotToken || '';
            donorName = d.name || '';
        }

        // Fallback: check users collection (same doc ID may exist there)
        if (!phone || !telegramChatId) {
            const userSnap = await adminDb.collection('users').doc(donorId).get();
            if (userSnap.exists) {
                const u = userSnap.data() as UserProfile;
                if (!phone) phone = u.phone || '';
                if (!telegramChatId) telegramChatId = u.telegramChatId || '';
                if (!customBotToken) customBotToken = u.customTelegramBotToken || '';
                if (!donorName) donorName = u.name || '';
            }
        }

        let whatsAppResult = null;
        let telegramResult = null;

        // Send WhatsApp
        if (phone && phone.length >= 10) {
            whatsAppResult = await sendWhatsAppAction({
                to: phone,
                templateId: params.templateId,
                variables: params.variables,
                customMessage: params.customMessage,
                metadata: params.metadata,
                bypassAutoCheck: true
            });
        }

        // Send Telegram
        if (telegramChatId) {
            telegramResult = await sendTelegramAction({ 
                templateId: params.templateId,
                variables: params.variables,
                message: params.customMessage, 
                chatId: telegramChatId, 
                bypassAutoCheck: true,
                configOverride: customBotToken ? { telegramBotToken: customBotToken } : undefined,
                metadata: params.metadata
            });
        }

        // Write in-app notification
        const notifTitle = params.variables?.donorName ? `Update for ${params.variables.donorName}` : 'Notification';
        const notifBody = params.customMessage 
            || (params.variables?.amount ? `Donation of ₹${params.variables.amount} recorded` : '')
            || 'You have a new update';

        await writeInAppNotificationAction({
            userId: donorId,
            title: notifTitle,
            body: notifBody,
            module: (params.metadata?.moduleId as any) || 'donations',
            linkUrl: params.metadata?.url || '',
        });

        return {
            success: !!(whatsAppResult?.success || telegramResult?.success),
            message: `WhatsApp: ${whatsAppResult?.success ? 'Sent' : 'Skipped'} | Telegram: ${telegramResult?.success ? 'Sent' : 'Skipped'}`
        };
    } catch (e: any) {
        console.error('Direct donor notification failed:', e);
        return { success: false, message: e.message };
    }
}

/**
 * Write an in-app notification to Firestore for the notification bell.
 */
export async function writeInAppNotificationAction(params: {
    userId: string;
    title: string;
    body: string;
    module: 'donations' | 'beneficiaries' | 'campaigns' | 'leads' | 'donors' | 'users' | 'approvals' | 'system';
    linkUrl?: string;
    metadata?: Record<string, any>;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;

    try {
        const ref = adminDb.collection('notifications').doc();
        await ref.set({
            id: ref.id,
            userId: params.userId,
            title: params.title,
            body: params.body,
            module: params.module,
            linkUrl: params.linkUrl || '',
            isRead: false,
            createdAt: Timestamp.now(),
            metadata: params.metadata || {},
        });
    } catch (e) {
        console.error('In-app notification write failed:', e);
    }
}

/**
 * Write in-app notifications to multiple admin users.
 */
export async function notifyAdminUsersInAppAction(params: {
    title: string;
    body: string;
    module: 'donations' | 'beneficiaries' | 'campaigns' | 'leads' | 'donors' | 'users' | 'approvals' | 'system';
    linkUrl?: string;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;

    try {
        const adminsSnap = await adminDb.collection('users').where('role', '==', 'Admin').where('status', '==', 'Active').get();
        const batch = adminDb.batch();
        
        for (const adminDoc of adminsSnap.docs) {
            const ref = adminDb.collection('notifications').doc();
            batch.set(ref, {
                id: ref.id,
                userId: adminDoc.id,
                title: params.title,
                body: params.body,
                module: params.module,
                linkUrl: params.linkUrl || '',
                isRead: false,
                createdAt: Timestamp.now(),
            });
        }
        
        await batch.commit();
    } catch (e) {
        console.error('Admin notification write failed:', e);
    }
}

/**
 * Notify all donors about a new initiative (campaign/lead) via Telegram.
 */
export async function notifyAllDonorsNewInitiativeAction(initiativeType: 'campaign' | 'lead', id: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const collectionName = initiativeType === 'campaign' ? 'campaigns' : 'leads';
        const snap = await adminDb.collection(collectionName).doc(id).get();
        if (!snap.exists) return { success: false, message: 'Initiative not found' };
        const data = snap.data() as any;

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';
        const publicPath = initiativeType === 'campaign' ? 'campaign-public' : 'leads-public';

        // Fetch all active donors with telegramChatId
        const donorsSnap = await adminDb.collection('donors').where('status', '==', 'Active').get();
        let sentCount = 0;

        for (const donorDoc of donorsSnap.docs) {
            const donor = donorDoc.data();
            const telegramId = donor.telegramChatId;
            if (!telegramId) continue;

            const message = `🆕 *New ${initiativeType === 'campaign' ? 'Campaign' : 'Appeal'} Launched!*\n\n` +
                `*${data.name}*\n` +
                `*Goal:* ₹${(data.targetAmount || 0).toLocaleString('en-IN')}\n` +
                `*Duration:* ${data.startDate || 'TBD'} to ${data.endDate || 'TBD'}\n` +
                `${data.description ? `*Details:* ${data.description.slice(0, 150)}...\n` : ''}` +
                `\nContribute: ${baseUrl}/${publicPath}/${id}/summary`;

            await sendTelegramAction({ message, chatId: telegramId, bypassAutoCheck: true });
            sentCount++;
        }

        return { success: true, message: `Notified ${sentCount} donors via Telegram.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Delete a message template
 */
export async function deleteTemplateAction(templateId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('settings', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        await adminDb.collection('settings').doc('message_templates').collection('templates').doc(templateId).delete();
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Fetch WhatsApp Account Info from Gateway
 */
export async function getWhatsAppAccountInfoAction(configOverride?: Partial<ResourceSettings>) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('settings', 'read');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const resources = resourceSnap.data() as ResourceSettings;
        
        const API_KEY = configOverride?.whatsappApiKey || resources?.whatsappApiKey || process.env.WHATSAPP_API_KEY;
        const API_URL = configOverride?.whatsappApiUrl || resources?.whatsappApiUrl || process.env.WHATSAPP_API_URL;

        if (!API_KEY) return { success: false, message: 'API Key not configured.' };

        // Whapi.cloud health endpoint
        let baseUrl = API_URL?.split('/messages')[0] || 'https://gate.whapi.cloud';
        // Remove trailing slash if present
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        
        console.log(`Checking WhatsApp Health at: ${baseUrl}/health`);

        const response = await fetch(`${baseUrl}/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`WhatsApp Gateway Error (${response.status}):`, errorText);
            throw new Error(`Gateway Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { success: true, data };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Send a Telegram Message
 */
export async function sendTelegramAction(params: {
    message?: string;
    chatId?: string;
    templateId?: string;
    variables?: Record<string, string>;
    configOverride?: Partial<ResourceSettings>;
    bypassAutoCheck?: boolean;
    moduleId?: 'campaign' | 'lead' | 'donation' | 'beneficiary' | 'donor' | 'user';
    // Rich Data
    richData?: {
        title: string;
        cause: string;
        purpose: string;
        oldData?: any;
        newData?: any;
        actionUrl?: string;
    }
    metadata?: any;
}) {
    try {
        const { adminDb } = getAdminServices();
        if (!adminDb) return { success: false, message: 'DB Unavailable' };

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const resources = resourceSnap.data() as ResourceSettings;

        let TOKEN = (params.configOverride?.telegramBotToken || resources?.telegramBotToken || '').trim();
        let CHAT_ID = (params.chatId || params.configOverride?.telegramChatId || resources?.telegramChatId || '').toString().trim();
        const IS_ENABLED = resources?.isTelegramEnabled ?? true;

        if (!IS_ENABLED && !params.configOverride?.isTelegramEnabled && !params.bypassAutoCheck) {
            return { success: false, message: 'Telegram alerts are disabled.' };
        }

        // Check Module-Specific Toggle
        if (params.moduleId && !params.bypassAutoCheck) {
            const moduleConfigSnap = await adminDb.collection('settings').doc(`${params.moduleId}_config`).get();
            const moduleConfig = moduleConfigSnap.data();
            if (moduleConfig && moduleConfig.enableTelegramNotifications === false) {
                return { success: false, message: `Telegram notifications are disabled for the ${params.moduleId} module.` };
            }
        }

        let finalMessage = params.message || '';

        // Handle Rich Data if provided (Highest Priority)
        if (params.richData) {
            finalMessage = generateDetailedPayload({
                ...params.richData
            });
        }
        // Handle Template if provided (Secondary Priority)
        else if (params.templateId) {
            const templateSnap = await adminDb.collection('settings').doc('message_templates').collection('templates').doc(params.templateId).get();
            if (templateSnap.exists) {
                const template = templateSnap.data() as MessageTemplate;
                finalMessage = template.body;
                
                // Interpolate variables
                if (params.variables) {
                    Object.entries(params.variables).forEach(([key, value]) => {
                        // Safe replacement for all occurrences
                        finalMessage = finalMessage.split(`{{${key}}}`).join(value || '');
                    });
                }
            }
        }

        if (!TOKEN || !CHAT_ID) {
            console.log(`[SIMULATED TELEGRAM] Chat: ${CHAT_ID} | Content: ${finalMessage}`);
            return { success: true, message: 'Telegram simulated (keys missing).' };
        }

        // Ensure TOKEN doesn't start with 'bot' because we add it in the URL
        if (TOKEN.toLowerCase().startsWith('bot')) {
            TOKEN = TOKEN.substring(3);
        }

        if (!finalMessage) {
            return { success: false, message: 'Telegram Message content is empty. Please verify that the "otp_staff" (or equivalent) template is seeded in Message Settings.' };
        }

        const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: finalMessage,
                parse_mode: 'Markdown'
            })
        });

        let status: 'Sent' | 'Failed' = 'Sent';
        let error: string | undefined;

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            status = 'Failed';
            
            const telegramDesc = errData.description || response.statusText;
            if (telegramDesc.includes('chat not found')) {
                error = "Target Chat ID not found. Ensure the user has started a conversation with the bot.";
            } else if (telegramDesc.includes('Unauthorized')) {
                error = "Telegram Bot Token is invalid or revoked. Please check your Resource Settings.";
            } else if (telegramDesc.includes('Forbidden') || telegramDesc.includes('bot can\'t initiate conversation')) {
                error = "Telegram Authorization Required: Please open the bot on Telegram and click 'START' to enable notifications.";
            } else {
                error = `Telegram API Error: ${telegramDesc}`;
            }
        }

        // --- Persistent Logging ---
        try {
            const logRef = adminDb.collection('message_logs').doc();
            const cleanMetadata = params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : {};
            
            const log: MessageLog = {
                id: logRef.id,
                recipient: CHAT_ID,
                content: finalMessage,
                type: 'Telegram',
                status,
                error: error || undefined,
                timestamp: Timestamp.now(),
                metadata: {
                    ...cleanMetadata,
                    moduleId: params.moduleId || cleanMetadata.moduleId || 'system'
                }
            };
            await logRef.set(log);
        } catch (logErr) {
            console.error('Failed to log Telegram message:', logErr);
        }

        if (status === 'Failed') {
            return { success: false, message: error || 'Failed to send Telegram message' };
        }

        return { success: true };
    } catch (e: any) {
        if (e.message?.includes('Forbidden') || e.message?.includes('initiate')) {
            console.warn(`[Telegram Delivery Warning] Skipped individual chatId ${params.chatId || 'unassigned'}. Reason: Individual must start bot interaction directly.`);
        } else {
            console.error('Telegram Action Error:', e);
        }
        return { success: false, message: e.message };
    }
}

/**
 * Fetch basic info about the Telegram Bot using the provided token.
 */
export async function getTelegramBotInfoAction(configOverride?: Partial<ResourceSettings>) {
    try {
        const { adminDb } = getAdminServices();
        if (!adminDb) return { success: false, message: 'DB Unavailable' };

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const resources = resourceSnap.data() as ResourceSettings;

        let TOKEN = (configOverride?.telegramBotToken || resources?.telegramBotToken || '').trim();
        if (!TOKEN) return { success: false, message: 'Bot Token missing.' };

        if (TOKEN.toLowerCase().startsWith('bot')) TOKEN = TOKEN.substring(3);

        const response = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`);
        const data = await response.json();

        if (data.ok) {
            return { 
                success: true, 
                data: {
                    id: data.result.id,
                    username: data.result.username,
                    name: data.result.first_name
                }
            };
        } else {
            return { success: false, message: data.description || 'Failed to fetch bot info' };
        }
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Send a Test WhatsApp Message
 */
export async function sendTestWhatsAppAction(to: string, configOverride?: Partial<ResourceSettings>) {
    const auth = await checkAuth('settings', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    return await sendWhatsAppCore({
        to,
        customMessage: '🧪 *BaitulMal Resource Test*\n\nThis is a diagnostic message to verify your WhatsApp API configuration.\n\n*Status:* Verified ✅\n*Timestamp:* ' + new Date().toLocaleString(),
        metadata: {
            moduleId: 'settings',
            userId: auth.user?.id || 'system'
        },
        configOverride,
        bypassAutoCheck: true // Test messages should always bypass the toggle
    });
}

/**
 * User-Specific Connectivity Test for WhatsApp
 */
export async function sendUserWhatsAppTestAction() {
    try {
        const { adminDb, adminAuth } = getAdminServices();
        if (!adminDb || !adminAuth) return { success: false, message: 'DB Unavailable' };

        const sessionCookie = cookies().get('__session')?.value;
        if (!sessionCookie) return { success: false, message: 'Unauthorized' };

        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie);
        const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (!userSnap.exists) return { success: false, message: 'User Record Not Found' };
        
        const userData = userSnap.data() as UserProfile;
        if (!userData.phone) return { success: false, message: 'Phone Number Missing in Profile' };

        return await sendWhatsAppCore({
            to: userData.phone,
            customMessage: `🧪 *BaitulMal Connectivity Test*\n\nHello *${userData.name}*,\n\nYour WhatsApp connectivity is verified for system alerts.\n\n*Test OTP:* ${Math.floor(100000 + Math.random() * 900000)}\n\n*Status:* Success ✅`,
            metadata: {
                moduleId: 'user',
                userId: userData.id,
                type: 'connectivity_test'
            },
            bypassAutoCheck: true
        });
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * User-Specific Connectivity Test for Telegram
 */
export async function sendUserTelegramTestAction() {
    try {
        const { adminAuth, adminDb } = getAdminServices();
        if (!adminAuth || !adminDb) return { success: false, message: 'DB Unavailable' };
        const sessionCookie = cookies().get('__session')?.value || cookies().get('auth-token')?.value;
        if (!sessionCookie) return { success: false, message: 'Unauthorized' };

        // Verify either session cookie or ID token
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifySessionCookie(sessionCookie);
        } catch (e) {
            decodedToken = await adminAuth.verifyIdToken(sessionCookie);
        }

        if (!decodedToken) return { success: false, message: 'Session Invalid' };

        // Identity Resolution (Unified Search)
        let userData: any = null;
        
        // 1. Try Users (Staff)
        const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userSnap.exists) {
            userData = userSnap.data();
        }

        // 2. Try Donors
        if (!userData) {
            const donorSnap = await adminDb.collection('donors').doc(decodedToken.uid).get();
            if (donorSnap.exists) userData = donorSnap.data();
        }

        // 3. Try Beneficiaries
        if (!userData) {
            const benSnap = await adminDb.collection('beneficiaries').doc(decodedToken.uid).get();
            if (benSnap.exists) userData = benSnap.data();
        }

        if (!userData) return { success: false, message: 'Identity profile not found.' };
        if (!userData.telegramChatId) return { success: false, message: 'Telegram Chat ID not linked to your profile.' };

        return await sendTelegramAction({
            message: `🧪 *BaitulMal Telegram Connectivity Test*\n\nHello *${userData.name || 'User'}*,\n\nYour Telegram integration is verified.\n\n*Status:* Active ✅\n*Chat ID:* \`${userData.telegramChatId}\``,
            chatId: userData.telegramChatId,
            bypassAutoCheck: true,
            configOverride: {
                telegramBotToken: userData.customTelegramBotToken || undefined
            }
        });

    } catch (error: any) {
        console.error('sendUserTelegramTestAction error:', error);
        return { success: false, message: `System error during test: ${error.message || 'Unknown Error'}` };
    }
}

/**
 * Send a Donation Receipt via WhatsApp
 */
export async function sendDonationReceiptAction(donationId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('donations', 'read');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        const donationSnap = await adminDb.collection('donations').doc(donationId).get();
        if (!donationSnap.exists) return { success: false, message: 'Donation Not Found' };
        
        const donation = donationSnap.data() as any;
        if (!donation.donorPhone) return { success: false, message: 'Donor Phone Number Missing' };

        // Get Base URL from Firestore if available
        let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baitulamalsolapur.com';
        try {
            const resourceSnap = await adminDb.collection('settings').doc('resources').get();
            if (resourceSnap.exists && resourceSnap.data()?.baseUrl) {
                baseUrl = resourceSnap.data()?.baseUrl;
            }
        } catch (e) {}

        const campaignId = donation.linkSplit?.[0]?.linkId?.replace('campaign_', '') || 'general';
        const receiptUrl = `${baseUrl}/campaign-public/${campaignId}/donations/${donationId}`;

        return await sendWhatsAppAction({
            to: donation.donorPhone,
            templateId: 'donation_receipt',
            variables: {
                donorName: donation.donorName,
                amount: `₹${donation.amount.toFixed(2)}`,
                donationId: donationId,
                date: donation.donationDate,
                url: receiptUrl
            },
            metadata: {
                moduleId: 'donations',
                recordId: donationId,
                templateId: 'donation_receipt'
            }
        });
    } catch (e: any) {
        console.error('Failed to send donation receipt:', e);
        return { success: false, message: e.message };
    }
}

/**
 * Notify admins about a new Lead or Campaign
 */
export async function notifyNewInitiativeAction(type: 'lead' | 'campaign', id: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const collectionName = type === 'lead' ? 'leads' : 'campaigns';
        const snap = await adminDb.collection(collectionName).doc(id).get();
        if (!snap.exists) return { success: false, message: 'Record not found' };

        const data = snap.data() as any;
        
        // Get Base URL
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        let message = '';
        let templateId = '';
        let variables: any = {};

        if (type === 'lead') {
            message = `📍 *New Lead Entry (Registry)*\n*Name:* ${data.name}\n*Need:* ${data.purpose || 'General Assistance'}\n*Phone:* ${data.shopContact || 'N/A'}\n\nReview: ${baseUrl}/leads-members/${id}/summary`;
            templateId = 'lead_alert';
            variables = {
                adminName: 'Registry Admin',
                leadName: data.name,
                phone: data.shopContact || 'N/A',
                need: data.purpose || 'General Assistance',
                url: `${baseUrl}/leads-members/${id}/summary`
            };
        } else {
            message = `🚀 *New Campaign Launched*\n*Campaign:* ${data.name}\n*Target:* ₹${data.targetAmount}\n\nPortal: ${baseUrl}/campaign-members/${id}/summary`;
            templateId = 'campaign_milestone';
            variables = {
                campaignName: data.name,
                amount: '₹0 (New Entry)',
                percent: '0',
                url: `${baseUrl}/campaign-members/${id}/summary`
            };
        }

        const res = await dispatchNotificationToGroups({
            module: type === 'lead' ? 'leads' : 'campaigns',
            message,
            whatsappTemplate: {
                id: templateId,
                variables
            },
            metadata: { moduleId: type === 'lead' ? 'leads' : 'campaigns', recordId: id }
        });

        return { 
            success: res.success,
            message: `Alerts dispatched to ${res.sentCount} recipients/groups.`
        };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Dispatch a notification to all relevant Notification Groups
 */
export async function dispatchNotificationToGroups(params: {
    module: NotificationGroup['enabledModules'][number];
    message: string;
    whatsappTemplate?: {
        id: string;
        variables: Record<string, string>;
    };
    richData?: {
        title: string;
        cause: string;
        purpose: string;
        oldData?: any;
        newData?: any;
        actionUrl?: string;
    };
    metadata?: any;
    excludeUserIds?: string[];
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, sentCount: 0 };

    try {
        // 1. Fetch ALL groups and filter in memory to avoid missing index/field issues
        const allGroupsSnap = await adminDb.collection('notification_groups').get();
        
        const groups = allGroupsSnap.docs
            .map((doc: any) => doc.data() as NotificationGroup)
            .filter((g: any) => {
                // Check if group is active (default to true if missing for backward compatibility)
                const isActive = g.isActive !== false;
                // Check if module is enabled
                const hasModule = Array.isArray(g.enabledModules) && g.enabledModules.includes(params.module);
                return isActive && hasModule;
            });

        if (groups.length === 0) {
            console.log(`No active notification groups found for module: ${params.module}`);
            return { success: true, sentCount: 0 };
        }

        let sentCount = 0;

        for (const group of groups) {
            if (group.type === 'Telegram') {
                if (group.channelType === 'Group' && group.targetId) {
                    await sendTelegramAction({ message: params.message, chatId: group.targetId, bypassAutoCheck: true, richData: params.richData });
                    sentCount++;
                } else if (group.channelType === 'Individual') {
                    if (!group.memberIds || group.memberIds.length === 0) continue;
                    
                    const filteredMemberIds = group.memberIds.filter((id: string) => !params.excludeUserIds?.includes(id));
                    if (filteredMemberIds.length === 0) continue;

                    const { FieldPath } = require('firebase-admin/firestore');
                    
                    const memberConfigs: Array<{ chatId: string; token?: string }> = [];
                    const chunkSize = 10;
                    for (let i = 0; i < filteredMemberIds.length; i += chunkSize) {
                        const chunk = filteredMemberIds.slice(i, i + chunkSize);
                        const membersSnap = await adminDb.collection('users')
                            .where(FieldPath.documentId(), 'in', chunk)
                            .get();
                        
                        membersSnap.docs.forEach((doc: any) => {
                            const data = doc.data() as UserProfile;
                            if (data.telegramChatId) {
                                memberConfigs.push({ 
                                    chatId: data.telegramChatId, 
                                    token: data.customTelegramBotToken 
                                });
                            }
                        });
                    }

                    for (const config of memberConfigs) {
                        await sendTelegramAction({ 
                            message: params.message, 
                            chatId: config.chatId, 
                            bypassAutoCheck: true, 
                            richData: params.richData,
                            configOverride: config.token ? { telegramBotToken: config.token } : undefined
                        });
                        sentCount++;
                    }
                }
            } else if (group.type === 'WhatsApp') {
                if (!group.memberIds || group.memberIds.length === 0) continue;
                
                const filteredMemberIds = group.memberIds.filter((id: string) => !params.excludeUserIds?.includes(id));
                if (filteredMemberIds.length === 0) continue;

                const { FieldPath } = require('firebase-admin/firestore');
                
                // Fetch member phone numbers using document IDs safely
                // Batch query if more than 10 members (in operator limit)
                const memberPhones: string[] = [];
                const chunkSize = 10;
                for (let i = 0; i < filteredMemberIds.length; i += chunkSize) {
                    const chunk = filteredMemberIds.slice(i, i + chunkSize);
                    const membersSnap = await adminDb.collection('users')
                        .where(FieldPath.documentId(), 'in', chunk)
                        .get();
                    
                    membersSnap.docs.forEach((doc: any) => {
                        const p = (doc.data() as UserProfile).phone;
                        if (p && p.length >= 10) memberPhones.push(p);
                    });
                }

                for (const phone of memberPhones) {
                    await sendWhatsAppAction({
                        to: phone,
                        templateId: params.whatsappTemplate?.id,
                        variables: params.whatsappTemplate?.variables,
                        customMessage: params.whatsappTemplate || params.richData ? undefined : params.message,
                        metadata: params.metadata,
                        bypassAutoCheck: true, // Staff alerts bypass the "isAutoWhatsAppEnabled" toggle if coming via group
                        richData: params.richData
                    });
                    sentCount++;
                }
            }
        }

        return { success: true, sentCount };
    } catch (error) {
        console.error('Dispatch Notification Error:', error);
        return { success: false, sentCount: 0 };
    }
}

/**
 * Delete specific message logs
 */
export async function deleteMessageLogsAction(logIds: string[]) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('messages', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        const batch = adminDb.batch();
        logIds.forEach(id => {
            batch.delete(adminDb.collection('message_logs').doc(id));
        });
        await batch.commit();
        return { success: true, message: `${logIds.length} records purged.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Retry a failed message
 */
export async function retryMessageAction(logId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('messages', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        const logSnap = await adminDb.collection('message_logs').doc(logId).get();
        if (!logSnap.exists) return { success: false, message: 'Log record not found.' };

        const log = logSnap.data() as MessageLog;
        
        if (log.type === 'WhatsApp') {
            return await sendWhatsAppAction({
                to: log.recipient,
                customMessage: log.content,
                metadata: { ...log.metadata, retriedFrom: logId },
                bypassAutoCheck: true
            });
        } else {
            return await sendTelegramAction({
                chatId: log.recipient,
                message: log.content,
                metadata: { ...log.metadata, retriedFrom: logId },
                bypassAutoCheck: true
            });
        }
    } catch (e: any) {
        return { success: false, message: `Retry failed: ${e.message}` };
    }
}

/**
 * Clear all message logs (Bulk Cleanup)
 */
export async function clearAllMessageLogsAction() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    const auth = await checkAuth('messages', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    try {
        // We delete in batches to avoid timeout
        const logs = await adminDb.collection('message_logs').limit(100).get();
        if (logs.empty) return { success: true, message: 'Log database is already clean.' };

        const batch = adminDb.batch();
        logs.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        return { success: true, message: 'Initial batch of 100 logs cleared. Repeat if necessary for large datasets.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Notify about Lead operations (Create, Update)
 */
export async function notifyLeadAction(leadId: string, templateId: 'lead_created' | 'lead_updated', extra?: { actionType?: string, summary?: string }) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const leadSnap = await adminDb.collection('leads').doc(leadId).get();
        if (!leadSnap.exists) return { success: false, message: 'Lead not found' };
        const data = leadSnap.data() as any;

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        const variables: Record<string, string> = {
            id: leadId,
            name: data.name,
            purpose: data.purpose || '',
            category: data.category || '',
            subCategory: data.subCategory || '',
            targetAmount: (data.targetAmount || 0).toString(),
            requiredAmount: (data.requiredAmount || 0).toString(),
            receivedAmount: (data.collectedAmount || 0).toString(),
            phone: data.shopContact || 'N/A',
            status: data.status,
            url: `${baseUrl}/leads-members/${leadId}/summary`,
            actionType: extra?.actionType || 'Record Modification',
            summary: extra?.summary || 'Data integrity update'
        };

        const res = await dispatchNotificationToGroups({
            module: 'leads',
            message: `🔄 *Lead Update: ${variables.name}*\n*Action:* ${variables.actionType}\n*Status:* ${variables.status}\n\nReview: ${variables.url}`,
            whatsappTemplate: {
                id: templateId,
                variables
            },
            metadata: { moduleId: 'leads', recordId: leadId, templateId }
        });

        return res;
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Notify about Campaign operations
 */
export async function notifyCampaignAction(campaignId: string, templateId: 'campaign_created' | 'campaign_milestone', extra?: { actionType?: string, summary?: string }) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const campSnap = await adminDb.collection('campaigns').doc(campaignId).get();
        if (!campSnap.exists) return { success: false, message: 'Campaign not found' };
        const data = campSnap.data() as any;

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        const collected = data.collectedAmount || 0;
        const target = data.targetAmount || 1; // avoid div by zero
        const percent = Math.round((collected / target) * 100);

        const variables: Record<string, string> = {
            id: campaignId,
            name: data.name,
            campaignName: data.name,
            category: data.category || '',
            targetAmount: target.toString(),
            amount: collected.toString(),
            remainingAmount: (target - collected).toString(),
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            purpose: data.description || '',
            percent: percent.toString(),
            url: `${baseUrl}/campaign-members/${campaignId}/summary`,
            actionType: extra?.actionType || 'Initiative Update',
            summary: extra?.summary || 'Record synchronization'
        };

        const res = await dispatchNotificationToGroups({
            module: 'campaigns',
            message: `📈 *Campaign Update: ${variables.name}*\n*Progress:* ${variables.percent}%\n*Raised:* ₹${variables.amount}\n\nPortal: ${variables.url}`,
            whatsappTemplate: {
                id: templateId,
                variables
            },
            metadata: { moduleId: 'campaigns', recordId: campaignId, templateId }
        });

        return res;
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Notify internal about Donation Verification
 */
export async function notifyDonationVerifiedAction(donationId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const donSnap = await adminDb.collection('donations').doc(donationId).get();
        if (!donSnap.exists) return { success: false, message: 'Donation not found' };
        const data = donSnap.data() as any;

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        const variables: Record<string, string> = {
            donationId,
            donationType: data.donationType || 'Sadaqah',
            amount: `₹${data.amount?.toLocaleString('en-IN') || '0'}`,
            donorName: data.donorName || 'Anonymous',
            linkName: data.linkName || 'General Fund',
            linkId: data.linkId || 'general',
            url: `${baseUrl}/donations/receipt/${donationId}`
        };

        // 1. Send Receipt to Donor (if phone available)
        if (data.donorPhone && data.donorPhone.length >= 10) {
            try {
                await sendWhatsAppAction({
                    to: data.donorPhone,
                    templateId: 'donation_receipt',
                    variables,
                    metadata: { moduleId: 'donations', recordId: donationId, templateId: 'donation_receipt' },
                    bypassAutoCheck: true
                });
            } catch (donorErr) {
                console.error('Failed to send receipt to donor:', donorErr);
            }
        }

        // 2. Dispatch to internal groups
        await dispatchNotificationToGroups({
            module: 'donations',
            message: `✅ *Donation Verified*\n*Donor:* ${variables.donorName}\n*Amount:* ${variables.amount}\n*Allocated:* ${variables.linkName}\n\nView: ${variables.url}`,
            whatsappTemplate: {
                id: 'donation_verified_internal',
                variables
            },
            metadata: { moduleId: 'donations', recordId: donationId, templateId: 'donation_verified_internal' }
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

/**
 * Notify about Beneficiary status changes
 */
export async function notifyBeneficiaryStatusAction(beneficiaryId: string, status: string, initiativeId?: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const benSnap = await adminDb.collection('beneficiaries').doc(beneficiaryId).get();
        if (!benSnap.exists) return { success: false, message: 'Beneficiary not found' };
        const data = benSnap.data() as any;

        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        const variables: Record<string, string> = {
            beneficiaryName: data.name,
            initiativeName: data.initiativeName || 'Registry Initiative',
            status: status,
            itemName: data.itemName || 'Direct Assistance',
            itemCategory: data.itemCategory || 'General',
            url: `${baseUrl}/beneficiaries`
        };

        const phone = data.phone;
        const telegramId = data.telegramChatId;
        const customBotToken = data.customTelegramBotToken;

        let whatsappRes = null;
        if (phone && phone.length >= 10) {
            whatsappRes = await sendWhatsAppAction({
                to: phone,
                templateId: 'beneficiary_status_changed',
                variables,
                metadata: { moduleId: 'beneficiaries', recordId: beneficiaryId, templateId: 'beneficiary_status_changed' },
                bypassAutoCheck: false,
                moduleId: 'beneficiary'
            });
        }

        let telegramRes = null;
        if (telegramId) {
            telegramRes = await sendTelegramAction({
                chatId: telegramId,
                templateId: 'beneficiary_status_changed',
                variables,
                metadata: { moduleId: 'beneficiaries', recordId: beneficiaryId },
                bypassAutoCheck: false,
                moduleId: 'beneficiary',
                configOverride: customBotToken ? { telegramBotToken: customBotToken } : undefined
            });
        }

        return whatsappRes || telegramRes || { success: false, message: 'No valid contact method found for beneficiary.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
/**
 * Notify internal groups about a finalized Approval with full details
 */
export async function notifyApprovalFinalizedAction(params: {
    module: string;
    targetId: string;
    requestedBy: string;
    approvedBy: string;
    changes: { field: string; old: any; new: any }[];
    description: string;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        // 1. Format changes into a readable string
        let changeDetails = '';
        if (params.changes.length > 0) {
            changeDetails = params.changes.map(c => {
                const oldVal = typeof c.old === 'object' ? 'Record Detail' : (c.old || 'None');
                const newVal = typeof c.new === 'object' ? 'Record Detail' : (c.new || 'None');
                return `• *${c.field}:* ${oldVal} → ${newVal}`;
            }).join('\n');
        } else {
            changeDetails = '• No specific field changes detected (Data synchronization).';
        }

        // 2. Fetch Initiative Statistics for high-impact modules
        let statsInfo = '';
        if (params.module === 'donations' || params.module === 'beneficiaries' || params.module === 'campaigns' || params.module === 'leads') {
            try {
                // Try to find the associated campaign or lead
                const donSnap = await adminDb.collection('donations').doc(params.targetId).get();
                const don = donSnap.data();
                
                let linkId = params.targetId;
                let linkType = params.module === 'leads' ? 'leads' : 'campaigns';
                
                if (don && don.linkId) {
                    linkId = don.linkId;
                    linkType = don.linkType === 'lead' ? 'leads' : 'campaigns';
                }

                const moduleSnap = await adminDb.collection(linkType).doc(linkId).get();
                if (moduleSnap.exists) {
                    const m = moduleSnap.data() as any;
                    const target = Number(m.targetAmount || 0);
                    const collected = Number(m.collectedAmount || 0);
                    const percent = target > 0 ? Math.round((collected / target) * 100) : 0;
                    statsInfo = `\n📊 *Initiative Snapshot:*\n` +
                        `• Progress: ${percent}%\n` +
                        `• Raised: ₹${collected.toLocaleString('en-IN')}\n` +
                        `• Target: ₹${target.toLocaleString('en-IN')}`;
                }
            } catch (e) {}
        }

        const message = `🏛️ *Organization Registry Updated*\n\n` +
            `*Action:* Final Approval Granted\n` +
            `*Module:* ${params.module.toUpperCase()}\n` +
            `*Description:* ${params.description}\n\n` +
            `🔄 *Modifications:*\n${changeDetails}\n` +
            `${statsInfo}\n\n` +
            `👤 *Requested By:* ${params.requestedBy}\n` +
            `⚖️ *Approved By:* ${params.approvedBy}\n` +
            `⏰ *Finalized:* ${new Date().toLocaleString('en-IN')}\n\n` +
            `🔗 Manage Record: ${baseUrl}/${params.module}/${params.targetId}`;

        return await dispatchNotificationToGroups({
            module: params.module as any,
            message,
            metadata: { 
                moduleId: params.module, 
                recordId: params.targetId,
                type: 'approval_finalized'
            }
        });

    } catch (e: any) {
        console.error('Failed to notify approval finalized:', e);
        return { success: false, message: e.message };
    }
}


/**
 * Notify internal groups about a Verification Step (Request, Partial Approval, or Rejection)
 */
export async function notifyVerificationUpdateAction(params: {
    request: PendingVerification;
    action: 'REQUEST' | 'APPROVE' | 'REJECT';
    performedBy: { id: string; name: string };
    reason?: string;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const { request, action, performedBy } = params;
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const baseUrl = resourceSnap.data()?.baseUrl || 'https://baitulamalsolapur.com';

        // 1. Format Approver Board
        const approverBoard = (request.assignedVerifiers || []).map(v => {
            let icon = '⏳';
            if (v.status === 'Approved') icon = '✅';
            if (v.status === 'Rejected') icon = '❌';
            
            // Safe Date Parsing
            let dateStr = '';
            if (v.updatedAt) {
                const dateObj = v.updatedAt.toDate ? v.updatedAt.toDate() : new Date(v.updatedAt);
                if (!isNaN(dateObj.getTime())) {
                    dateStr = ` (${dateObj.toLocaleDateString()})`;
                }
            }
            return `• ${v.name}: ${icon}${dateStr}`;
        }).join('\n');

        // 2. Fetch Module Statistics (if Donation or Beneficiary)
        let statsInfo = '';
        if (request.module === 'donations' || request.module === 'beneficiaries') {
            try {
                // Determine actual collection from targetCollection path
                let linkType = 'campaigns';
                if (request.targetCollection.includes('leads')) linkType = 'leads';
                else if (request.targetCollection.includes('campaigns')) linkType = 'campaigns';
                
                // For sub-collections (like campaigns/ID/beneficiaries), get the parent ID
                const pathParts = request.targetCollection.split('/');
                const linkId = pathParts.length > 1 ? pathParts[1] : request.targetId;
                
                const moduleSnap = await adminDb.collection(linkType).doc(linkId).get();
                if (moduleSnap.exists) {
                    const m = moduleSnap.data() as any;
                    const target = Number(m.targetAmount || 0);
                    const collected = Number(m.raisedAmount || 0);
                    const percent = target > 0 ? Math.round((collected / target) * 100) : 0;
                    statsInfo = `\n📊 *Initiative Stats:*\n` +
                        `• Progress: ${percent}%\n` +
                        `• Raised: ₹${collected.toLocaleString()}\n` +
                        `• Target: ₹${target.toLocaleString()}`;
                }
            } catch (e) {}
        }

        // 3. Format Changes (for Approvals/Requests)
        let changeSummary = '';
        if (action !== 'REJECT') {
            const changes = generateChanges(request.originalValue, request.newValue);
            if (changes.length > 0) {
                changeSummary = `\n🔄 *Changes Detected:*\n` + changes.map(c => {
                    const oldV = typeof c.old === 'object' ? 'OBJ' : (c.old || 'None');
                    const newV = typeof c.new === 'object' ? 'OBJ' : (c.new || 'None');
                    return `• ${c.field}: ${oldV} → ${newV}`;
                }).join('\n');
            }
        }

        // 4. Construct Header
        let header = '🔔 *New Verification Request*';
        if (action === 'APPROVE') header = '🟡 *Partial Approval Recorded*';
        if (action === 'REJECT') header = '🔴 *Modification Rejected*';

        const createdAtDate = (request.createdAt as any)?.toDate ? (request.createdAt as any).toDate() : new Date(request.createdAt as any);
        const dateString = !isNaN(createdAtDate.getTime()) ? createdAtDate.toLocaleDateString() : 'Unknown';

        const message = `${header}\n\n` +
            `*Module:* ${request.module.toUpperCase()}\n` +
            `*Request Date:* ${dateString}\n` +
            `*Description:* ${request.description || 'Data update'}\n` +
            (params.reason ? `*Reason:* ${params.reason}\n` : '') +
            `${changeSummary}\n` +
            `${statsInfo}\n\n` +
            `⚖️ *Approval Board:* (Total ${(request.assignedVerifiers || []).length})\n${approverBoard}\n\n` +
            `👤 *Action By:* ${performedBy.name}\n` +
            `🔗 Review: ${baseUrl}/verifications?requestId=${request.id}`;

        return await dispatchNotificationToGroups({
            module: request.module as any,
            message,
            metadata: { 
                moduleId: request.module, 
                recordId: request.targetId,
                requestId: request.id,
                type: `verification_${action.toLowerCase()}`
            },
            excludeUserIds: [performedBy.id]
        });
    } catch (e: any) {
        console.error('Failed to notify verification update:', e);
        return { success: false, message: e.message };
    }
}

/**
 * Core function to send an email using SMTP
 */
async function sendEmailCore(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    configOverride?: Partial<ResourceSettings>;
    metadata?: any;
    bypassAutoCheck?: boolean;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        // Fetch configuration
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const config = { ...(resourceSnap.data() as ResourceSettings), ...params.configOverride };

        if (!params.bypassAutoCheck && !config.isEmailEnabled) {
            return { success: false, message: 'Email Service is globally disabled.' };
        }

        if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
            return { success: false, message: 'SMTP configuration is incomplete.' };
        }

        const transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: Number(config.smtpPort) || 587,
            secure: Number(config.smtpPort) === 465,
            auth: {
                user: config.smtpUser,
                pass: config.smtpPass
            }
        });

        const info = await transporter.sendMail({
            from: `"${config.fromName || 'BaitulMal Alerts'}" <${config.fromEmail || config.smtpUser}>`,
            to: params.to,
            subject: params.subject,
            text: params.body,
            html: params.html || params.body.replace(/\n/g, '<br>')
        });

        // Log the message
        await adminDb.collection('message_logs').add({
            recipient: params.to,
            content: `Subject: ${params.subject}\n\n${params.body}`,
            type: 'Email',
            status: 'Sent',
            timestamp: FieldValue.serverTimestamp(),
            metadata: params.metadata || {}
        } as MessageLog);

        return { success: true, messageId: info.messageId };
    } catch (e: any) {
        console.error('Email dispatch failed:', e);
        
        // Log failure
        await adminDb.collection('message_logs').add({
            recipient: params.to,
            content: `Subject: ${params.subject}\n\n${params.body}`,
            type: 'Email',
            status: 'Failed',
            error: e.message,
            timestamp: FieldValue.serverTimestamp(),
            metadata: params.metadata || {}
        } as MessageLog);

        return { success: false, message: e.message };
    }
}

/**
 * Public action for sending email via templates or direct message
 */
export async function sendEmailAction(params: {
    to: string;
    subject?: string;
    body?: string;
    templateId?: string;
    variables?: Record<string, string>;
    metadata?: any;
    configOverride?: Partial<ResourceSettings>;
    bypassAutoCheck?: boolean;
}) {
    let finalSubject = params.subject || '';
    let finalBody = params.body || '';

    if (params.templateId) {
        const { adminDb } = getAdminServices();
        if (adminDb) {
            const templateSnap = await adminDb.collection('settings').doc('message_templates').collection('templates').doc(params.templateId).get();
            if (templateSnap.exists) {
                const template = templateSnap.data() as MessageTemplate;
                finalSubject = template.subject || 'Notification';
                finalBody = template.body;
                
                // Process variables
                if (params.variables) {
                    Object.entries(params.variables).forEach(([key, val]) => {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        finalSubject = finalSubject.replace(regex, val);
                        finalBody = finalBody.replace(regex, val);
                    });
                }
            }
        }
    }

    if (!finalBody) return { success: false, message: 'Message content is empty.' };

    return await sendEmailCore({
        to: params.to,
        subject: finalSubject || 'Organization Alert',
        body: finalBody,
        configOverride: params.configOverride,
        metadata: params.metadata,
        bypassAutoCheck: params.bypassAutoCheck
    });
}

/**
 * Dispatcher for Multi-Channel notifications
 */
export async function sendMultiChannelNotificationAction(params: {
    userId: string;
    templateId: string;
    variables?: Record<string, string>;
    metadata?: any;
    bypassAutoCheck?: boolean;
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        // 1. Fetch User Profile
        let userSnap = await adminDb.collection('users').doc(params.userId).get();
        if (!userSnap.exists) {
            userSnap = await adminDb.collection('donors').doc(params.userId).get();
        }
        if (!userSnap.exists) {
            userSnap = await adminDb.collection('beneficiaries').doc(params.userId).get();
        }

        if (!userSnap.exists) return { success: false, message: 'Target user profile not found.' };
        const user = userSnap.data() as UserProfile;

        // 2. Fetch Template to check channel support
        const templateSnap = await adminDb.collection('message_templates').doc(params.templateId).get();
        if (!templateSnap.exists) return { success: false, message: 'Template not found.' };
        const template = templateSnap.data() as MessageTemplate;

        const results: any[] = [];

        // 3. Dispatch via WhatsApp if enabled
        if (user.phone && (user.whatsappNotificationsEnabled !== false)) {
            results.push(await sendWhatsAppAction({
                to: user.phone,
                templateId: params.templateId,
                variables: params.variables,
                metadata: { ...params.metadata, channel: 'WhatsApp' },
                bypassAutoCheck: params.bypassAutoCheck
            }));
        }

        // 4. Dispatch via Telegram if enabled
        if (user.telegramChatId && (user.notificationsEnabled !== false)) {
            results.push(await sendTelegramAction({
                templateId: params.templateId,
                variables: params.variables,
                chatId: user.telegramChatId,
                configOverride: user.customTelegramBotToken ? { telegramBotToken: user.customTelegramBotToken } : undefined,
                metadata: { ...params.metadata, channel: 'Telegram' },
                bypassAutoCheck: params.bypassAutoCheck
            }));
        }

        // 5. Dispatch via Email if enabled
        if (user.email && !user.email.includes('@donor.demo.local')) {
            results.push(await sendEmailAction({
                to: user.email,
                templateId: params.templateId,
                variables: params.variables,
                metadata: { ...params.metadata, channel: 'Email' },
                bypassAutoCheck: params.bypassAutoCheck
            }));
        }

        const successCount = results.filter(r => r.success).length;
        return { 
            success: successCount > 0, 
            message: `Dispatched via ${successCount}/${results.length} active channels.`,
            details: results 
        };

    } catch (e: any) {
        console.error('Multi-channel dispatch failed:', e);
        return { success: false, message: e.message };
    }
}

/**
 * Diagnostic Email Test
 */
export async function sendTestEmailAction(to: string, configOverride?: Partial<ResourceSettings>) {
    const auth = await checkAuth('settings', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    return await sendEmailCore({
        to,
        subject: '🧪 BaitulMal SMTP Diagnostic',
        body: `This is a test message to verify your SMTP configuration.\n\nStatus: Online ✅\nTimestamp: ${new Date().toLocaleString()}\n\nIf you received this, your email service is correctly configured.`,
        configOverride,
        metadata: {
            moduleId: 'settings',
            userId: auth.user?.id || 'system',
            type: 'diagnostic_test'
        },
        bypassAutoCheck: true
    });
}

/**
 * Search users for messaging tests across all collections
 */
export async function searchMessagingUsersAction(query: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return [];

    try {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];

        // Fetch from all 3 main identity collections
        const [usersSnap, donorsSnap, benSnap] = await Promise.all([
            adminDb.collection('users').limit(20).get(),
            adminDb.collection('donors').limit(20).get(),
            adminDb.collection('beneficiaries').limit(20).get()
        ]);

        const allUsers: any[] = [];
        const seenIds = new Set();

        const processSnap = (snap: any, role: string) => {
            snap.forEach((doc: any) => {
                const data = doc.data();
                const id = doc.id;
                if (seenIds.has(id)) return;

                const name = (data.name || '').toLowerCase();
                const phone = (data.phone || '').toLowerCase();
                const email = (data.email || '').toLowerCase();

                if (name.includes(q) || phone.includes(q) || email.includes(q)) {
                    allUsers.push({
                        id,
                        name: data.name,
                        phone: data.phone,
                        email: data.email,
                        telegramChatId: data.telegramChatId,
                        role: data.role || role,
                        customTelegramBotToken: data.customTelegramBotToken
                    });
                    seenIds.add(id);
                }
            });
        };

        processSnap(usersSnap, 'Member');
        processSnap(donorsSnap, 'Donor');
        processSnap(benSnap, 'Beneficiary');

        return allUsers.slice(0, 10);
    } catch (e) {
        console.error('User search failed:', e);
        return [];
    }
}
