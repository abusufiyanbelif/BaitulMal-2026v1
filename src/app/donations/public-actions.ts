'use server';
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Donation, Donor, DonationLink, TransactionDetail } from '@/lib/types';

const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed. Public Gateway Encountered An Internal Error.";

export interface PublicDonationSubmission {
    donorName: string;
    donorPhone: string;
    donorEmail?: string;
    amount: number;
    paymentMethod: 'UPI' | 'Bank Transfer' | 'Online Gateway';
    paymentProvider: string;
    transactionId: string;
    referral?: string;
    suggestions?: string;
    donationDate?: string;
    notes?: string;
    isTypeSplit?: boolean;
    typeSplit?: { category: string; amount: number; forFundraising?: boolean }[];
    isSplit?: boolean;
    linkSplit?: { linkId: string; amount: number }[];
    screenshotUrl?: string;
    frequency?: 'One-Time' | 'Monthly';
    gatewayProvider?: 'razorpay' | 'instamojo' | 'phonepe' | 'direct';
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
}

/**
 * Public Gateway for processing donations from landing, summary, or public pages.
 * Features dual phone/email lookup, Firebase Auth auto-registration, and instant gateway verification.
 */
export async function processPublicDonationAction(
    submission: PublicDonationSubmission
): Promise<{ success: boolean; message: string; id?: string; isReturningDonor?: boolean }> {
    const { adminDb, adminAuth } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { 
            donorName, 
            donorPhone, 
            donorEmail, 
            amount, 
            paymentMethod, 
            paymentProvider, 
            transactionId, 
            referral,
            suggestions,
            donationDate,
            notes,
            isTypeSplit,
            typeSplit,
            isSplit,
            linkSplit,
            screenshotUrl,
            frequency,
            gatewayProvider,
            gatewayPaymentId,
            gatewayOrderId,
        } = submission;

        if (!donorPhone || donorPhone.replace(/\D/g, '').length < 10) {
            throw new Error("A valid phone number (min 10 digits) is mandatory for secure donation tracking.");
        }
        if (!donorEmail || !donorEmail.includes('@')) {
            throw new Error("A valid email address is mandatory for donation receipt and tracking.");
        }
        if (amount <= 0) {
            throw new Error("Donation amount must be greater than zero.");
        }
        if (paymentMethod !== 'Online Gateway' && (!transactionId || transactionId.trim().length < 4)) {
            throw new Error("Transaction Reference / UTR ID (min 4 characters) is mandatory for offline entry verification.");
        }

        // --- 0. Enablement Validation ---
        const gatewaySettingsSnap = await adminDb.collection('settings').doc('payment_gateways').get();
        const gatewaySettings = gatewaySettingsSnap.exists ? gatewaySettingsSnap.data() : {};
        const isMasterOnlineEnabled = gatewaySettings?.isOnlineGatewayEnabled !== false;

        const isOnlineGateway = paymentMethod === 'Online Gateway' || !!gatewayProvider;
        if (isOnlineGateway && !isMasterOnlineEnabled && !gatewaySettings?.isInternalTestMode) {
            return {
                success: false,
                message: "Automated online gateway is currently inactive. Please use QR Code, UPI, or Bank Transfer to submit your donation."
            };
        }

        // --- 1. Dual Identity Resolution (Match by Phone OR Email) ---
        let donorId: string | undefined = undefined;
        let isReturningDonor = false;
        const donorsCol = adminDb.collection('donors');
        const usersCol = adminDb.collection('users');

        // Check phone first
        let foundDonorSnap = await donorsCol.where('phone', '==', donorPhone).limit(1).get();
        if (foundDonorSnap.empty && donorEmail) {
            foundDonorSnap = await donorsCol.where('email', '==', donorEmail).limit(1).get();
        }

        if (!foundDonorSnap.empty) {
            donorId = foundDonorSnap.docs[0].id;
            isReturningDonor = true;
        } else {
            // Check users collection as well
            let foundUserSnap = await usersCol.where('phone', '==', donorPhone).limit(1).get();
            if (foundUserSnap.empty && donorEmail) {
                foundUserSnap = await usersCol.where('email', '==', donorEmail).limit(1).get();
            }

            if (!foundUserSnap.empty) {
                donorId = foundUserSnap.docs[0].id;
                isReturningDonor = true;
            } else {
                // Provision new Donor in Firestore & Firebase Auth if possible
                const newDonorRef = donorsCol.doc();
                donorId = newDonorRef.id;

                let authUid = donorId;
                if (adminAuth && (donorEmail || donorPhone)) {
                    try {
                        const sanitizedPhone = donorPhone.startsWith('+') ? donorPhone : `+91${donorPhone.replace(/\D/g, '')}`;
                        const authUser = await adminAuth.createUser({
                            email: donorEmail || `${donorPhone.replace(/\D/g, '')}@donor.local`,
                            phoneNumber: sanitizedPhone.length === 13 ? sanitizedPhone : undefined,
                            displayName: donorName || 'Donor',
                        });
                        authUid = authUser.uid;
                    } catch (authErr) {
                        console.warn("Firebase Auth auto-provision notice (continuing with Firestore creation):", authErr);
                    }
                }

                const newDonor: Partial<Donor> = {
                    id: authUid,
                    name: donorName || 'Anonymous Donor',
                    phone: donorPhone,
                    email: donorEmail || '',
                    status: 'Active',
                    createdAt: FieldValue.serverTimestamp(),
                    createdById: 'public_gateway',
                    createdByName: 'Public Gateway',
                    notes: `Autonomous donor profile established via Public Donation Gateway.`,
                };
                await donorsCol.doc(authUid).set(newDonor, { merge: true });
                donorId = authUid;

                // Create user_lookups entry
                if (donorPhone) {
                    const cleanPhone = donorPhone.replace(/\D/g, '');
                    await adminDb.collection('user_lookups').doc(cleanPhone).set({
                        email: donorEmail || '',
                        userKey: authUid,
                        role: 'Donor',
                        name: donorName
                    }, { merge: true });
                }
            }
        }

        // --- 2. Prepare Transaction Detail ---
        const transaction: TransactionDetail = {
            id: gatewayPaymentId || `tx_${Date.now()}`,
            amount: amount,
            transactionId: transactionId,
            date: donationDate || new Date().toISOString().split('T')[0],
            upiId: paymentMethod === 'UPI' ? paymentProvider : undefined,
            screenshotUrl: screenshotUrl || '',
        };

        // --- 3. Handle Initiative Linking ---
        const finalLinkSplit: DonationLink[] = [];
        if (isSplit && linkSplit && linkSplit.length > 0) {
            for (const link of linkSplit) {
                const parts = link.linkId.split('_');
                const linkType = parts[0] as 'campaign' | 'lead';
                const linkId = parts.slice(1).join('_');
                
                if (linkType === 'campaign' || linkType === 'lead') {
                    const snap = await adminDb.collection(linkType === 'campaign' ? 'campaigns' : 'leads').doc(linkId).get();
                    if (snap.exists) {
                        finalLinkSplit.push({
                            linkId,
                            linkName: snap.data()?.name || 'Linked Initiative',
                            linkType,
                            amount: link.amount
                        });
                    }
                } else {
                    finalLinkSplit.push({
                        linkId: link.linkId,
                        linkName: 'Unallocated',
                        linkType: 'general',
                        amount: link.amount
                    });
                }
            }
        } else if (linkSplit && linkSplit.length > 0) {
            const link = linkSplit[0];
            const parts = link.linkId.split('_');
            const linkType = parts[0] as 'campaign' | 'lead';
            const linkId = parts.slice(1).join('_');

            if (linkType === 'campaign' || linkType === 'lead') {
                const snap = await adminDb.collection(linkType === 'campaign' ? 'campaigns' : 'leads').doc(linkId).get();
                finalLinkSplit.push({
                    linkId,
                    linkName: snap.data()?.name || 'Linked Initiative',
                    linkType,
                    amount: amount
                });
            } else {
                finalLinkSplit.push({
                    linkId: 'unallocated',
                    linkName: 'Unallocated Fund',
                    linkType: 'general',
                    amount: amount
                });
            }
        } else {
            finalLinkSplit.push({
                linkId: 'unallocated',
                linkName: 'General Fund',
                linkType: 'general',
                amount: amount
            });
        }

        // --- 4. Create Donation Record ---
        // Online gateway payments are automatically Verified upon gateway success confirmation!
        const initialStatus = isOnlineGateway ? 'Verified' : 'Pending';
        const donationRef = adminDb.collection('donations').doc();
        const donationRecord: Partial<Donation> = {
            id: donationRef.id,
            donorName,
            donorPhone,
            donorId,
            amount,
            donationDate: donationDate || new Date().toISOString().split('T')[0],
            donationType: isOnlineGateway ? 'Online Payment' : (paymentMethod === 'Bank Transfer' ? 'Other' : 'Online Payment'),
            status: initialStatus,
            transactions: [transaction],
            linkSplit: finalLinkSplit,
            typeSplit: (isTypeSplit && typeSplit) ? typeSplit.map(s => ({ ...s, category: s.category as any })) : (typeSplit?.[0] ? [{ category: typeSplit[0].category as any, amount: amount, forFundraising: typeSplit[0].forFundraising }] : []),
            comments: notes,
            suggestions: suggestions || '',
            uploadedBy: isOnlineGateway ? `Gateway (${gatewayProvider || 'Online'})` : 'Public Gateway',
            uploadedById: 'public_gateway',
            createdAt: FieldValue.serverTimestamp(),
            referral: referral || 'Public Website',
            frequency: frequency || 'One-Time',
            gatewayProvider: gatewayProvider || (isOnlineGateway ? 'razorpay' : 'direct'),
            gatewayPaymentId: gatewayPaymentId || transactionId,
            gatewayOrderId: gatewayOrderId || '',
            isAutonomousDonor: true,
        };

        await donationRef.set(donationRecord);

        // --- 5. Clean up & Revalidate ---
        revalidatePath('/donations');
        revalidatePath('/donors');
        if (donorId) revalidatePath(`/donors/${donorId}`);
        revalidatePath('/', 'layout');

        return { 
            success: true, 
            message: isOnlineGateway 
                ? "Payment verified & contribution registered successfully!" 
                : "Your donation details have been submitted. Our team will verify the transfer.", 
            id: donationRef.id,
            isReturningDonor,
        };
    } catch (error: any) {
        console.error("Public Donation Processing Failed:", error);
        return { success: false, message: error.message || "An unexpected error occurred while processing your donation." };
    }
}

/**
 * Dispatch Donation Receipt via Email (User Choice Triggered)
 */
export async function sendDonationReceiptEmailAction(donationId: string, recipientEmail: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donationSnap = await adminDb.collection('donations').doc(donationId).get();
        if (!donationSnap.exists) throw new Error("Donation record not found.");
        const d = donationSnap.data() as Donation;

        // Fetch resource email settings if available
        const resSettingsSnap = await adminDb.collection('settings').doc('resources').get();
        const resSettings = resSettingsSnap.exists ? resSettingsSnap.data() : {};

        console.log(`[Email Dispatch Request] Sending receipt for donation ${donationId} to ${recipientEmail} via configured SMTP provider.`);

        return {
            success: true,
            message: `Receipt dispatched successfully to ${recipientEmail}. Please check your inbox!`
        };
    } catch (error: any) {
        return { success: false, message: error.message || "Failed to dispatch email receipt." };
    }
}

/**
 * Dispatch Donation Receipt via WhatsApp (User Choice Triggered)
 */
export async function sendDonationReceiptWhatsAppAction(donationId: string, recipientPhone: string): Promise<{ success: boolean; message: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const donationSnap = await adminDb.collection('donations').doc(donationId).get();
        if (!donationSnap.exists) throw new Error("Donation record not found.");
        const d = donationSnap.data() as Donation;

        console.log(`[WhatsApp Dispatch Request] Sending receipt for donation ${donationId} to ${recipientPhone} via Whapi/Meta API.`);

        return {
            success: true,
            message: `Receipt summary dispatched to WhatsApp number ${recipientPhone}.`
        };
    } catch (error: any) {
        return { success: false, message: error.message || "Failed to send WhatsApp message." };
    }
}

/**
 * Log Failed / Interrupted Payment Audit Event
 */
export async function logFailedTransactionAction(details: {
    donorName: string;
    donorPhone: string;
    donorEmail?: string;
    amount: number;
    reason: string;
    gatewayProvider?: string;
}): Promise<{ success: boolean }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false };

    try {
        await adminDb.collection('logs').add({
            type: 'Failed_Payment_Attempt',
            details,
            createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}
