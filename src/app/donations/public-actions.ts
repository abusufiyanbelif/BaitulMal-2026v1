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
    paymentMethod: 'UPI' | 'Bank Transfer';
    paymentProvider: string; // E.g., 'Google Pay' or 'HDFC Bank'
    transactionId: string;
    campaignId?: string;
    leadId?: string;
    notes?: string;
}

/**
 * Public Gateway for processing donations from the landing/campaign pages.
 * Handles auto-profile creation/linking for donors.
 */
export async function processPublicDonationAction(
    submission: PublicDonationSubmission
): Promise<{ success: boolean; message: string; id?: string }> {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const { donorName, donorPhone, donorEmail, amount, paymentMethod, paymentProvider, transactionId, campaignId, leadId, notes } = submission;

        if (!donorPhone || donorPhone.length < 10) throw new Error("A valid phone number is mandatory for secure donation tracking.");
        if (amount <= 0) throw new Error("Donation amount must be greater than zero.");
        if (!transactionId) throw new Error("Transaction Reference ID is required for verification.");

        // --- 1. Identity Resolution (Find or Create Donor) ---
        let donorId: string | null = null;
        const donorsCol = adminDb.collection('donors');
        const foundDonorSnap = await donorsCol.where('phone', '==', donorPhone).limit(1).get();

        if (!foundDonorSnap.empty) {
            donorId = foundDonorSnap.docs[0].id;
        } else {
            const newDonorRef = donorsCol.doc();
            const newDonor: Partial<Donor> = {
                id: newDonorRef.id,
                name: donorName || 'Anonymous Donor',
                phone: donorPhone,
                email: donorEmail || '',
                status: 'Active',
                createdAt: FieldValue.serverTimestamp(),
                createdById: 'public_gateway',
                createdByName: 'Public Gateway',
                notes: `Profile automatically established via Public Donation Gateway.`,
            };
            await newDonorRef.set(newDonor);
            donorId = newDonorRef.id;
        }

        // --- 2. Prepare Transaction Detail ---
        const transaction: TransactionDetail = {
            id: `tx_${Date.now()}`,
            amount: amount,
            transactionId: transactionId,
            date: new Date().toISOString().split('T')[0],
            upiId: paymentMethod === 'UPI' ? paymentProvider : undefined,
        };

        // --- 3. Handle Initiative Linking ---
        const linkSplit: DonationLink[] = [];
        if (campaignId) {
            const campaignSnap = await adminDb.collection('campaigns').doc(campaignId).get();
            if (campaignSnap.exists) {
                linkSplit.push({
                    linkId: campaignId,
                    linkName: campaignSnap.data()?.name || 'Linked Campaign',
                    linkType: 'campaign',
                    amount: amount
                });
            }
        } else if (leadId) {
            const leadSnap = await adminDb.collection('leads').doc(leadId).get();
            if (leadSnap.exists) {
                linkSplit.push({
                    linkId: leadId,
                    linkName: leadSnap.data()?.name || 'Linked Appeal',
                    linkType: 'lead',
                    amount: amount
                });
            }
        } else {
            linkSplit.push({
                linkId: 'unallocated',
                linkName: 'Unallocated',
                linkType: 'general',
                amount: amount
            });
        }

        // --- 4. Create Donation Record (STAGED FOR VERIFICATION) ---
        const donationRef = adminDb.collection('donations').doc();
        const donationRecord: Partial<Donation> = {
            id: donationRef.id,
            donorName,
            donorPhone,
            donorId,
            amount,
            donationDate: new Date().toISOString().split('T')[0],
            donationType: 'Online Payment',
            status: 'Pending', // All public donations start as Pending
            transactions: [transaction],
            linkSplit,
            comments: notes,
            uploadedBy: 'Public Gateway',
            uploadedById: 'public_gateway',
            createdAt: FieldValue.serverTimestamp(),
            typeSplit: [], // Initially empty, staff will categorize (Zakat, Sadaqah, etc.) during verification
            referral: 'Public Website'
        };

        await donationRef.set(donationRecord);

        // --- 5. Clean up & Revalidate ---
        revalidatePath('/donations');
        revalidatePath('/donors');
        if (donorId) revalidatePath(`/donors/${donorId}`);
        revalidatePath('/', 'layout');

        return { 
            success: true, 
            message: "Your donation has been submitted for verification. Thank you for your contribution!", 
            id: donationRef.id 
        };
    } catch (error: any) {
        console.error("Public Donation Processing Failed:", error);
        return { success: false, message: error.message || "An unexpected error occurred while processing your donation." };
    }
}
