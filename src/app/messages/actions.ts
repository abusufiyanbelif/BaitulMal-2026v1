'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { MessageTemplate, MessageLog, ResourceSettings, PendingVerification, NotificationGroup, UserProfile } from '@/lib/types';
import { cookies } from 'next/headers';
import { generateChanges } from '@/lib/utils';

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

    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
        console.warn('checkAuth: No __session cookie found.');
        return { isAuthorized: false };
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie);

        // --- SOVEREIGN BYPASS (Layer 1 & 2: UID + Email — no DB read) ---
        if (SOVEREIGN_ADMIN_UIDS.includes(decodedToken.uid) ||
            (decodedToken.email && SOVEREIGN_ADMIN_EMAILS.includes(decodedToken.email))) {
            console.log(`checkAuth: Sovereign admin bypass for UID: ${decodedToken.uid}`);
            return { isAuthorized: true, user: { role: 'Admin', id: decodedToken.uid } };
        }

        // --- DB ROLE CHECK (Layer 3: Firestore profile) ---
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
    moduleId?: 'campaign' | 'lead' | 'donation' | 'beneficiary' | 'donor' | 'user';
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

        // 2. Check Module-Specific Toggle
        if (params.moduleId && !params.bypassAutoCheck) {
            const moduleConfigSnap = await adminDb.collection('settings').doc(`${params.moduleId}_config`).get();
            const moduleConfig = moduleConfigSnap.data();
            if (moduleConfig && moduleConfig.enableWhatsAppNotifications === false) {
                return { success: false, message: `WhatsApp notifications are disabled for the ${params.moduleId} module.` };
            }
        }

        let finalMessage = params.customMessage || '';

        // 3. Handle Template if provided
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
        },
        {
            id: 'security_password_reset',
            name: 'Portal: Password Reset Alert',
            subject: 'Institutional Security Alert',
            body: '🛡️ *Portal Access Updated*\n\nHello {{name}},\n\nYour portal access password for *{{orgName}}* has been updated by the administration.\n\nIf you did not request this change, please contact us immediately for assistance.\n\n*Login URL:* {{url}}',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['name', 'orgName', 'url'],
            isActive: true
        },
        {
            id: 'security_access_credential',
            name: 'Portal: New Access Credentials',
            subject: 'Portal Access Provisioned',
            body: '🔐 *Institutional Portal Access*\n\nYour secure portal access is now active. You can log in using your registered mobile and the credentials provided below.\n\n*ID/Mobile:* {{identifier}}\n*Temp Password:* {{password}}\n\n*Login Here:* {{url}}\n\n_Please change your password after your first successful login._',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['identifier', 'password', 'url'],
            isActive: true
        },
        // --- DONOR-FACING NOTIFICATIONS ---
        {
            id: 'donor_donation_recorded',
            name: 'Donor: Donation Recorded',
            subject: 'Your Contribution Has Been Received',
            body: '🎉 *Donation Received — Thank You!*\n\nAssalamualaikum {{donorName}},\n\nYour generous contribution of *₹{{amount}}* has been recorded successfully.\n\n*Receipt ID:* {{donationId}}\n*Type:* {{donationType}}\n*Date:* {{date}}\n\nJazakallah Khair for your continued support!\n\nView Receipt: {{url}}',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationId', 'donationType', 'date', 'url'],
            isActive: true
        },
        {
            id: 'donor_donation_mapped',
            name: 'Donor: Donation Linked to Cause',
            subject: 'Your Donation Has Been Allocated',
            body: '📌 *Donation Allocation Update*\n\nHello {{donorName}},\n\nYour donation of *₹{{amount}}* (ID: {{donationId}}) has been allocated to:\n\n*Cause:* {{causeName}}\n*Cause Type:* {{causeType}}\n*Progress:* {{raisedAmount}} / {{targetAmount}} ({{percent}}%)\n*Remaining:* ₹{{remainingAmount}}\n\nYour support is making a real difference! 🤲',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationId', 'causeName', 'causeType', 'raisedAmount', 'targetAmount', 'percent', 'remainingAmount'],
            isActive: true
        },
        {
            id: 'donor_cause_update',
            name: 'Donor: Cause Progress Update',
            subject: 'Initiative Progress Report',
            body: '📊 *Initiative Progress Update*\n\nHello {{donorName}},\n\nHere is a progress update on a cause you contributed to:\n\n*{{causeName}}*\n*Progress:* {{percent}}% of ₹{{targetAmount}}\n*Raised:* ₹{{raisedAmount}}\n*Remaining:* ₹{{remainingAmount}}\n*Beneficiaries Served:* {{beneficiaryCount}}\n\nThank you for being part of this mission! 🌟',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'causeName', 'percent', 'targetAmount', 'raisedAmount', 'remainingAmount', 'beneficiaryCount'],
            isActive: true
        },
        {
            id: 'donor_initiative_created',
            name: 'Donor: New Initiative Launched',
            subject: 'New Community Initiative Available',
            body: '🆕 *New Initiative Launched!*\n\nHello {{donorName}},\n\nA new {{initiativeType}} has been launched by BaitulMal:\n\n*{{initiativeName}}*\n*Goal:* ₹{{targetAmount}}\n*Duration:* {{startDate}} to {{endDate}}\n*Description:* {{description}}\n\nContribute here: {{url}}\n\nEvery contribution counts! 🤲',
            type: 'WhatsApp',
            category: 'Campaign',
            variables: ['donorName', 'initiativeType', 'initiativeName', 'targetAmount', 'startDate', 'endDate', 'description', 'url'],
            isActive: true
        },
        // --- ADMIN/INTERNAL NOTIFICATIONS ---
        {
            id: 'admin_donation_received',
            name: 'Admin: New Donation Entry',
            subject: 'New Donation Recorded',
            body: '💰 *New Donation Entry*\n\n*Donor:* {{donorName}}\n*Amount:* ₹{{amount}}\n*Type:* {{donationType}}\n*Date:* {{date}}\n*Recorded By:* {{uploadedBy}}\n\n*Linked To:* {{linkName}}\n\nManage: {{url}}',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationType', 'date', 'uploadedBy', 'linkName', 'url'],
            isActive: true
        },
        {
            id: 'admin_user_created',
            name: 'Admin: New User Account',
            subject: 'New Team Member Registered',
            body: '👤 *New Team Member Registered*\n\n*Name:* {{userName}}\n*Role:* {{role}}\n*Phone:* {{phone}}\n*Created By:* {{createdBy}}\n\n*Login ID:* {{loginId}}\n\nManage: {{url}}',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['userName', 'role', 'phone', 'createdBy', 'loginId', 'url'],
            isActive: true
        },
        {
            id: 'admin_beneficiary_added',
            name: 'Admin: Beneficiary Registered',
            subject: 'New Beneficiary Entry',
            body: '👤 *New Beneficiary Registered*\n\n*Name:* {{beneficiaryName}}\n*Phone:* {{phone}}\n*Status:* {{status}}\n*Created By:* {{createdBy}}\n\nManage: {{url}}',
            type: 'WhatsApp',
            category: 'Beneficiary',
            variables: ['beneficiaryName', 'phone', 'status', 'createdBy', 'url'],
            isActive: true
        },
        {
            id: 'admin_high_value_donation',
            name: 'Admin: High-Value Donation Alert',
            subject: 'Significant Contribution Alert',
            body: '🌟 *HIGH-VALUE DONATION ALERT*\n\n*Donor:* {{donorName}}\n*Amount:* ₹{{amount}}\n*Type:* {{donationType}}\n\nThis contribution exceeds the notification threshold.\n\n*Linked To:* {{linkName}}\n*Recorded By:* {{uploadedBy}}\n\nImmediate Review: {{url}}',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName', 'amount', 'donationType', 'linkName', 'uploadedBy', 'url'],
            isActive: true
        },
        {
            id: 'admin_password_reset',
            name: 'Admin: Password Reset Alert',
            subject: 'Security: Password Reset Performed',
            body: '🔐 *Password Reset Performed*\n\n*User:* {{userName}} ({{userId}})\n*Reset By:* {{resetBy}}\n*Timestamp:* {{timestamp}}\n\nIf unauthorized, investigate immediately.',
            type: 'WhatsApp',
            category: 'Security',
            variables: ['userName', 'userId', 'resetBy', 'timestamp'],
            isActive: true
        },
        {
            id: 'donor_onboarding',
            name: 'Donor: Welcome Onboarding',
            subject: 'Welcome To BaitulMal',
            body: '🤝 *Welcome to BaitulMal Family!*\n\nAssalamualaikum {{donorName}},\n\nYou have been registered as a donor in our system. Your contributions will be tracked, receipts generated, and you will receive regular updates about the causes you support.\n\nJazakallah Khair for choosing to make a difference! 🌟',
            type: 'WhatsApp',
            category: 'Donation',
            variables: ['donorName'],
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
        let donorName = '';

        const donorSnap = await adminDb.collection('donors').doc(donorId).get();
        if (donorSnap.exists) {
            const d = donorSnap.data() as any;
            phone = d.phone || '';
            telegramChatId = d.telegramChatId || '';
            donorName = d.name || '';
        }

        // Fallback: check users collection (same doc ID may exist there)
        if (!phone || !telegramChatId) {
            const userSnap = await adminDb.collection('users').doc(donorId).get();
            if (userSnap.exists) {
                const u = userSnap.data() as UserProfile;
                if (!phone) phone = u.phone || '';
                if (!telegramChatId) telegramChatId = u.telegramChatId || '';
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
            let message = params.customMessage || '';
            if (params.templateId) {
                const templateSnap = await adminDb.collection('settings').doc('message_templates').collection('templates').doc(params.templateId).get();
                if (templateSnap.exists) {
                    message = (templateSnap.data() as any).body;
                    if (params.variables) {
                        Object.entries(params.variables).forEach(([key, value]) => {
                            message = message.split(`{{${key}}}`).join(value || '');
                        });
                    }
                }
            }
            if (message) {
                telegramResult = await sendTelegramAction({ message, chatId: telegramChatId, bypassAutoCheck: true });
            }
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
    message: string;
    chatId?: string;
    configOverride?: Partial<ResourceSettings>;
    bypassAutoCheck?: boolean;
    moduleId?: 'campaign' | 'lead' | 'donation' | 'beneficiary' | 'donor' | 'user';
}) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
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

        if (!TOKEN || !CHAT_ID) {
            console.log(`[SIMULATED TELEGRAM] Chat: ${CHAT_ID} | Content: ${params.message}`);
            return { success: true, message: 'Telegram simulated (keys missing).' };
        }

        // Ensure TOKEN doesn't start with 'bot' because we add it in the URL
        if (TOKEN.toLowerCase().startsWith('bot')) {
            TOKEN = TOKEN.substring(3);
        }

        const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: params.message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Telegram API Error: ${errData.description || response.statusText}`);
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

        let message = '';
        let templateId = '';
        let variables: any = {};

        if (type === 'lead') {
            message = `📍 *New Lead Entry (Registry)*\n*Name:* ${data.name}\n*Need:* ${data.purpose || 'General Assistance'}\n*Phone:* ${data.shopContact || 'N/A'}\n\nReview: ${baseUrl}/leads-members/${id}/summary`;
            templateId = 'lead_alert';
            variables = {
                adminName: 'Institutional Head',
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
                    await sendTelegramAction({ message: params.message, chatId: group.targetId, bypassAutoCheck: true });
                    sentCount++;
                } else if (group.channelType === 'Individual') {
                    if (!group.memberIds || group.memberIds.length === 0) continue;
                    
                    const filteredMemberIds = group.memberIds.filter((id: string) => !params.excludeUserIds?.includes(id));
                    if (filteredMemberIds.length === 0) continue;

                    const { FieldPath } = require('firebase-admin/firestore');
                    
                    const memberTelegramIds: string[] = [];
                    const chunkSize = 10;
                    for (let i = 0; i < filteredMemberIds.length; i += chunkSize) {
                        const chunk = filteredMemberIds.slice(i, i + chunkSize);
                        const membersSnap = await adminDb.collection('users')
                            .where(FieldPath.documentId(), 'in', chunk)
                            .get();
                        
                        membersSnap.docs.forEach((doc: any) => {
                            const tid = (doc.data() as UserProfile).telegramChatId;
                            if (tid) memberTelegramIds.push(tid);
                        });
                    }

                    for (const tId of memberTelegramIds) {
                        await sendTelegramAction({ message: params.message, chatId: tId, bypassAutoCheck: true });
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
                        customMessage: params.whatsappTemplate ? undefined : params.message,
                        metadata: params.metadata,
                        bypassAutoCheck: true // Staff alerts bypass the "isAutoWhatsAppEnabled" toggle if coming via group
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

        return await sendWhatsAppAction({
            to: '917887646583',
            templateId: 'beneficiary_status_changed',
            variables,
            metadata: { moduleId: 'beneficiaries', recordId: beneficiaryId, templateId: 'beneficiary_status_changed' },
            bypassAutoCheck: false,
            moduleId: 'beneficiary'
        });
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

        const message = `🏛️ *Institutional Registry Updated*\n\n` +
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
        const approverBoard = request.assignedVerifiers.map(v => {
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
            `⚖️ *Approval Board:* (Total ${request.assignedVerifiers.length})\n${approverBoard}\n\n` +
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
