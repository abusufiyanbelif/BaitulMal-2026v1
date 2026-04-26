'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { MessageTemplate, MessageLog, ResourceSettings } from '@/lib/types';
import { cookies } from 'next/headers';

/**
 * Helper to check if the caller is authorized (Admin or specific permission)
 */
async function checkAuth(requiredModule?: string, requiredPerm?: string) {
    const { adminAuth, adminDb } = getAdminServices();
    if (!adminAuth || !adminDb) return { isAuthorized: false };

    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
        console.warn('checkAuth: No __session cookie found.');
        return { isAuthorized: false };
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie);
        const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userSnap.data();

        if (userData?.role === 'Admin') return { isAuthorized: true, user: userData };
        
        if (requiredModule && requiredPerm) {
            const hasPerm = userData?.permissions?.[requiredModule]?.[requiredPerm] === true;
            return { isAuthorized: hasPerm, user: userData };
        }

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
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'Administrative Services Unavailable.' };

    // Standard authorization check
    const auth = await checkAuth('messages', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized. Administrative clearance required.' };

    try {
        // 1. Fetch Resource Config
        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
        const resources = resourceSnap.data() as ResourceSettings;
        
        const API_URL = params.configOverride?.whatsappApiUrl || resources?.whatsappApiUrl || process.env.WHATSAPP_API_URL;
        const API_KEY = params.configOverride?.whatsappApiKey || resources?.whatsappApiKey || process.env.WHATSAPP_API_KEY;
        const IS_AUTO_ENABLED = resources?.isAutoWhatsAppEnabled ?? true;

        if (!IS_AUTO_ENABLED && !params.bypassAutoCheck) {
            return { success: false, message: 'Automated notifications are currently disabled in Resource Configuration.' };
        }

        let finalMessage = params.customMessage || '';

        // 2. Handle Template if provided
        if (params.templateId) {
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

        // 3. Dispatch or Simulate
        let status: 'Sent' | 'Failed' = 'Sent';
        let error: string | undefined;

        if (!API_URL || !API_KEY) {
            console.log(`[SIMULATED WHATSAPP] To: ${params.to} | Content: ${finalMessage}`);
        } else {
            // Standardize phone number for WhatsApp (remove non-digits)
            let cleanPhone = params.to.replace(/\D/g, '');
            
            // Auto-fix for Indian numbers missing country code
            if (cleanPhone.length === 10) {
                cleanPhone = `91${cleanPhone}`;
            }
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
                    error = `Gateway Error: ${response.statusText}`;
                }
            } catch (e: any) {
                status = 'Failed';
                error = e.message;
            }
        }

        // 4. Log the message
        const logRef = adminDb.collection('message_logs').doc();

        // Clean metadata to remove undefined values for Firestore
        const cleanMetadata = params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : {};

        const log: MessageLog = {
            id: logRef.id,
            recipient: params.to,
            content: finalMessage,
            type: 'WhatsApp',
            status,
            error: error || null,
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

    const templates = [
        // --- LEAD MODULE ---
        {
            id: 'lead_created',
            name: 'Lead Created',
            subject: 'New Service Request Entry',
            body: '📍 *New Lead Entry (Registry)*\n\n*ID:* {{id}}\n*Name:* {{name}}\n*Purpose:* {{purpose}}\n*Category:* {{category}} / {{subCategory}}\n\n*Financial Requirement:*\n- Target: ₹{{targetAmount}}\n- Required: ₹{{requiredAmount}}\n\n*Contact:* {{phone}}\n*Status:* {{status}}\n\nManage Lead: {{url}}',
            type: 'WhatsApp',
            category: 'Leads',
            variables: ['id', 'name', 'purpose', 'category', 'subCategory', 'targetAmount', 'requiredAmount', 'phone', 'status', 'url'],
            isActive: true
        },
        {
            id: 'lead_updated',
            name: 'Lead Modified',
            subject: 'Lead Record Updated',
            body: '🔄 *Lead Record Update*\n\nThe record for *{{name}}* ({{id}}) has been modified.\n\n*Action:* {{actionType}}\n*Change Summary:* {{summary}}\n\n*Updated Metrics:*\n- Required: ₹{{requiredAmount}}\n- Received: ₹{{receivedAmount}}\n\nReview History: {{url}}',
            type: 'WhatsApp',
            category: 'Leads',
            variables: ['id', 'name', 'actionType', 'summary', 'requiredAmount', 'receivedAmount', 'url'],
            isActive: true
        },
        {
            id: 'lead_status_changed',
            name: 'Lead Status Update',
            subject: 'Appeal Status Transition',
            body: '🔄 *Appeal Status Update*\n\nThe status for *{{name}}* ({{id}}) has been transitioned.\n\n*New Status:* {{status}}\n*Previous Status:* {{oldStatus}}\n\n*Reason/Note:* {{note}}\n\nFollow Progress: {{url}}',
            type: 'WhatsApp',
            category: 'Leads',
            variables: ['id', 'name', 'status', 'oldStatus', 'note', 'url'],
            isActive: true
        },
        {
            id: 'lead_goal_met',
            name: 'Lead: Goal Achieved',
            subject: 'Financial Target Reached',
            body: '🎉 *Financial Goal Achieved!*\n\nThe appeal for *{{name}}* ({{id}}) has reached its target of ₹{{targetAmount}}!\n\n*Total Collected:* ₹{{receivedAmount}}\n\nNext Step: Final verification and fund disbursement.',
            type: 'WhatsApp',
            category: 'Leads',
            variables: ['id', 'name', 'targetAmount', 'receivedAmount'],
            isActive: true
        },
        {
            id: 'lead_disbursed',
            name: 'Lead: Funds Disbursed',
            subject: 'Payment Release Alert',
            body: '💸 *Funds Disbursed*\n\nPayments for *{{name}}* ({{id}}) have been successfully released.\n\n*Amount:* ₹{{amount}}\n*Payment Method:* {{method}}\n*Transaction ID:* {{txId}}\n\nRegistry Status: Closed/Completed.',
            type: 'WhatsApp',
            category: 'Leads',
            variables: ['id', 'name', 'amount', 'method', 'txId'],
            isActive: true
        },
        // --- CAMPAIGN MODULE ---
        {
            id: 'campaign_created',
            name: 'Campaign Created',
            subject: 'New Community Initiative',
            body: '🚀 *New Campaign Launched*\n\n*Campaign:* {{name}}\n*ID:* {{id}}\n*Category:* {{category}}\n\n*Financial Goal:*\n- Target: ₹{{targetAmount}}\n- Date Range: {{startDate}} to {{endDate}}\n\n*Strategy:* {{purpose}}\n\nInitiative Portal: {{url}}',
            type: 'WhatsApp',
            category: 'Campaign',
            variables: ['id', 'name', 'category', 'targetAmount', 'startDate', 'endDate', 'purpose', 'url'],
            isActive: true
        },
        {
            id: 'campaign_milestone',
            name: 'Campaign Milestone',
            subject: 'Goal Progress Alert',
            body: '📈 *Campaign Milestone Alert*\n\nThe campaign *{{campaignName}}* has reached *{{percent}}%* of its goal!\n\n*Current Status:*\n- Target: ₹{{targetAmount}}\n- Received: ₹{{amount}}\n- Remaining: ₹{{remainingAmount}}\n\nView Progress Ticker: {{url}}',
            type: 'WhatsApp',
            category: 'Campaign',
            variables: ['campaignName', 'percent', 'targetAmount', 'amount', 'remainingAmount', 'url'],
            isActive: true
        },
        {
            id: 'campaign_urgent',
            name: 'Campaign: Urgent Appeal',
            subject: 'Immediate Support Required',
            body: '⚠️ *Urgent Support Required*\n\nOur initiative *{{name}}* ({{id}}) needs immediate attention.\n\n*Target:* ₹{{targetAmount}}\n*Remaining:* ₹{{remainingAmount}}\n*Closing Date:* {{endDate}}\n\n*Message:* {{urgentMessage}}\n\nYour contribution can save lives: {{url}}',
            type: 'WhatsApp',
            category: 'Campaign',
            variables: ['name', 'id', 'targetAmount', 'remainingAmount', 'endDate', 'urgentMessage', 'url'],
            isActive: true
        },
        {
            id: 'campaign_completed',
            name: 'Campaign: Mission Accomplished',
            subject: 'Initiative Successfully Finalized',
            body: '✅ *Mission Accomplished*\n\nThe campaign *{{name}}* ({{id}}) has been successfully completed.\n\n*Total Impact:* {{impactCount}} Beneficiaries\n*Total Raised:* ₹{{amount}}\n\nThank you for your unwavering support! View the completion report here: {{url}}',
            type: 'WhatsApp',
            category: 'Campaign',
            variables: ['name', 'id', 'impactCount', 'amount', 'url'],
            isActive: true
        },
        // --- DONATION MODULE ---
        {
            id: 'donation_receipt',
            name: 'Donation Receipt (Donor)',
            subject: 'Thank You For Your Support',
            body: '🙏 *Official Donation Receipt*\n\nHello {{donorName}},\n\nWe have successfully recorded your contribution of *{{amount}}*.\n\n*Receipt ID:* {{donationId}}\n*Type:* {{donationType}}\n*Linked To:* {{linkName}}\n\nDownload Receipt: {{url}}\n\nJazakallah Khair!',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationId', 'donationType', 'linkName', 'url'],
            isActive: true
        },
        {
            id: 'donation_verified_internal',
            name: 'Donation Verified (Internal)',
            subject: 'Financial Record Verified',
            body: '✅ *Donation Verification Finalized*\n\n*ID:* {{donationId}}\n*Amount:* ₹{{amount}}\n*Donor:* {{donorName}}\n*Allocated To:* {{linkName}} ({{linkId}})\n\n*Registry Update:* Funds have been officially applied to the initiative target.',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donationId', 'amount', 'donorName', 'linkName', 'linkId'],
            isActive: true
        },
        {
            id: 'donation_refunded',
            name: 'Donation: Refunded',
            subject: 'Financial Reversal Alert',
            body: '🔄 *Donation Refund Processed*\n\nHello {{donorName}},\n\nA refund of *{{amount}}* has been processed for your contribution (ID: {{donationId}}).\n\n*Reason:* {{reason}}\n\nThe amount should reflect in your source account within 5-7 business days. Jazakallah.',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationId', 'reason'],
            isActive: true
        },
        {
            id: 'donation_pledge_reminder',
            name: 'Donation: Pledge Reminder',
            subject: 'Pending Support Commitment',
            body: '⏳ *Contribution Reminder*\n\nHello {{donorName}},\n\nThis is a gentle reminder regarding your promised support for *{{linkName}}*.\n\n*Pledged Amount:* {{amount}}\n\nYou can fulfill your pledge here: {{url}}\n\nYour support helps us reach our targets faster. Jazakallah Khair!',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'linkName', 'url'],
            isActive: true
        },
        // --- BENEFICIARY MODULE ---
        {
            id: 'beneficiary_status_changed',
            name: 'Beneficiary Status Update',
            subject: 'Distribution Registry Update',
            body: '👤 *Beneficiary Distribution Alert*\n\n*Beneficiary:* {{beneficiaryName}}\n*Initiative:* {{initiativeName}}\n*New Status:* {{status}}\n\n*Allotment Details:*\n- Item: {{itemName}}\n- Category: {{itemCategory}}\n\nVerify Distribution: {{url}}',
            type: 'WhatsApp',
            category: 'Beneficiary',
            variables: ['beneficiaryName', 'initiativeName', 'status', 'itemName', 'itemCategory', 'url'],
            isActive: true
        },
        // --- APPROVAL SYSTEM ---
        {
            id: 'verification_request',
            name: 'Approval Required',
            subject: 'New Institutional Approval Request',
            body: '📋 *Institutional Action Required*\n\nHello {{verifierName}},\n\nA new *{{module}}* request ({{recordId}}) is pending your approval.\n\n*Purpose:* {{purpose}}\n*Requested By:* {{requesterName}}\n\nReview & Finalize: {{url}}',
            type: 'WhatsApp',
            category: 'Approval',
            variables: ['verifierName', 'module', 'recordId', 'purpose', 'requesterName', 'url'],
            isActive: true
        },
        {
            id: 'verification_approved',
            name: 'Approval Finalized',
            subject: 'Request Approved',
            body: '✅ *Registry Update Approved*\n\nHello {{requesterName}},\n\nYour request for *{{module}}* ({{recordId}}) has been approved.\n\n*Purpose:* {{purpose}}\n\nThe record is now active in the production registry.',
            type: 'WhatsApp',
            category: 'Approval',
            variables: ['requesterName', 'module', 'recordId', 'purpose'],
            isActive: true
        },
        // --- USER & SECURITY ---
        {
            id: 'user_role_updated',
            name: 'Security: Role Change',
            subject: 'Account Privilege Update',
            body: '🛡️ *Security Alert: Privilege Escalation*\n\n*User:* {{userName}}\n*Account ID:* {{id}}\n*New Role:* {{newRole}}\n*Old Role:* {{oldRole}}\n\nIf you did not authorize this change, please contact system administrator immediately.',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['userName', 'id', 'newRole', 'oldRole'],
            isActive: true
        },
        {
            id: 'user_welcome',
            name: 'User: Welcome/Onboarding',
            subject: 'BaitulMal Account Created',
            body: '👋 *Welcome to BaitulMal Registry*\n\nHello {{userName}},\n\nYour organizational account has been successfully created.\n\n*ID:* {{id}}\n*Role:* {{role}}\n\nPlease login to complete your profile and view your assigned duties: {{url}}',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['userName', 'id', 'role', 'url'],
            isActive: true
        },
        {
            id: 'user_status_changed',
            name: 'User: Status Update',
            subject: 'Account Status Modification',
            body: '🛡️ *Account Status Update*\n\nThe status of your BaitulMal account has been updated to *{{status}}*.\n\n*Note:* {{note}}\n\nIf you believe this is an error, please contact the institutional head immediately.',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['status', 'note'],
            isActive: true
        },
        {
            id: 'user_kyc_verified',
            name: 'User: KYC/ID Verified',
            subject: 'Identification Verified',
            body: '🆔 *Identity Verification Approved*\n\nHello {{userName}},\n\nYour identification documents (ID Proof) have been successfully verified by the board.\n\nYou now have full access to authorized administrative modules.',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['userName'],
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
 * Send a Test WhatsApp Message
 */
export async function sendTestWhatsAppAction(to: string, configOverride?: Partial<ResourceSettings>) {
    const auth = await checkAuth('settings', 'update');
    if (!auth.isAuthorized) return { success: false, message: 'Unauthorized' };

    return await sendWhatsAppAction({
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

        if (type === 'lead') {
            return await sendWhatsAppAction({
                to: '917887646583',
                templateId: 'lead_alert',
                variables: {
                    adminName: 'Institutional Head',
                    leadName: data.name,
                    phone: data.shopContact || 'N/A', // Using contact field or similar
                    need: data.purpose || 'General Assistance',
                    url: `${baseUrl}/leads-members/${id}/summary`
                },
                metadata: { moduleId: 'leads', recordId: id, templateId: 'lead_alert' },
                bypassAutoCheck: true // Force system alerts
            });
        } else {
            return await sendWhatsAppAction({
                to: '917887646583',
                templateId: 'campaign_milestone', // Re-using milestone for general alert if 0%
                variables: {
                    campaignName: data.name,
                    amount: '₹0 (New Entry)',
                    percent: '0',
                    url: `${baseUrl}/campaign-members/${id}/summary`
                },
                metadata: { moduleId: 'campaigns', recordId: id, templateId: 'campaign_milestone' },
                bypassAutoCheck: true
            });
        }
    } catch (e: any) {
        return { success: false, message: e.message };
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
        logs.docs.forEach(doc => batch.delete(doc.ref));
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

        return await sendWhatsAppAction({
            to: '917887646583', // Default Admin
            templateId,
            variables,
            metadata: { moduleId: 'leads', recordId: leadId, templateId },
            bypassAutoCheck: true
        });
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

        return await sendWhatsAppAction({
            to: '917887646583',
            templateId,
            variables,
            metadata: { moduleId: 'campaigns', recordId: campaignId, templateId },
            bypassAutoCheck: true
        });
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

        const variables: Record<string, string> = {
            donationId,
            amount: `₹${data.amount?.toLocaleString('en-IN') || '0'}`,
            donorName: data.donorName || 'Anonymous',
            linkName: data.linkName || 'General Fund',
            linkId: data.linkId || 'general'
        };

        return await sendWhatsAppAction({
            to: '917887646583',
            templateId: 'donation_verified_internal',
            variables,
            metadata: { moduleId: 'donations', recordId: donationId, templateId: 'donation_verified_internal' },
            bypassAutoCheck: true
        });
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

        return await sendWhatsAppAction({
            to: '917887646583',
            templateId: 'beneficiary_status_changed',
            variables,
            metadata: { moduleId: 'beneficiaries', recordId: beneficiaryId, templateId: 'beneficiary_status_changed' },
            bypassAutoCheck: true
        });
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
