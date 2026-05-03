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
            screenshotUrl
        } = submission;

        if (!donorPhone || donorPhone.length < 10) throw new Error("A valid phone number is mandatory for secure donation tracking.");
        if (amount <= 0) throw new Error("Donation amount must be greater than zero.");
        if (!transactionId) throw new Error("Transaction Reference ID is required for verification.");

        // --- 1. Identity Resolution (Find or Create Donor) ---
        let donorId: string | undefined = undefined;
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
            // Single link if not split but linkSplit exists
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

        // --- 4. Create Donation Record (STAGED FOR VERIFICATION) ---
        const donationRef = adminDb.collection('donations').doc();
        const donationRecord: Partial<Donation> = {
            id: donationRef.id,
            donorName,
            donorPhone,
            donorId,
            amount,
            donationDate: donationDate || new Date().toISOString().split('T')[0],
            donationType: 'Online Payment',
            status: 'Pending',
            transactions: [transaction],
            linkSplit: finalLinkSplit,
            typeSplit: (isTypeSplit && typeSplit) ? typeSplit.map(s => ({ ...s, category: s.category as any })) : (typeSplit?.[0] ? [{ category: typeSplit[0].category as any, amount: amount, forFundraising: typeSplit[0].forFundraising }] : []),
            comments: notes,
            suggestions: suggestions || '',
            uploadedBy: 'Public Gateway',
            uploadedById: 'public_gateway',
            createdAt: FieldValue.serverTimestamp(),
            referral: referral || 'Public Website'
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
