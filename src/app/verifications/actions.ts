'use server';
 
 import { getAdminServices } from '@/lib/firebase-admin-sdk';
 import { revalidatePath } from 'next/cache';
 import type { PendingVerification, Beneficiary, Donation, Donor, Campaign, Lead } from '@/lib/types';
 import { FieldValue, Timestamp } from 'firebase-admin/firestore';
 import { bulkRecalculateInitiativeTotalsAction } from '@/app/donations/actions';
 
 const ADMIN_SDK_ERROR_MESSAGE = 'Operational Failure: Administrative Services Unavailable.';
 
 /**
  * Mock helper for WhatsApp notifications.
  * In a production environment, this would integrate with Twilio or WhatsApp Business API.
  */
 async function sendWhatsAppNotification(phone: string, message: string) {
     console.log(`[WHATSAPP NOTIFICATION QUIET-LOG] To: ${phone} | Content: ${message}`);
     // TODO: Integration point for external messaging API
     return true;
 }
 
 export async function requestVerificationAction(
     verificationData: Omit<PendingVerification, 'id' | 'createdAt' | 'updatedAt' | 'status'>
 ) {
     const { adminDb } = getAdminServices();
     if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
 
     try {
         const verificationsRef = adminDb.collection('pending_verifications');
         const newDoc = verificationsRef.doc();
         
         const payload: PendingVerification = {
             ...verificationData,
             id: newDoc.id,
             status: 'Pending',
             createdAt: Timestamp.now(),
             updatedAt: Timestamp.now(),
         } as PendingVerification;
 
         await newDoc.set(payload);
 
         // Notify assigned verifiers
         for (const verifier of payload.assignedVerifiers) {
             // In a real app, we'd fetch the verifier's phone number here
             await sendWhatsAppNotification('9999999999', `Verification Required: ${payload.requestedBy.name} has requested your approval for a ${payload.module} record update. Record ID: ${payload.targetId}`);
         }
 
         revalidatePath(payload.revalidatePath);
         return { success: true, message: 'Verification Request Dispatched To Assigned Members.' };
     } catch (error: any) {
         console.error('Request Verification Error:', error);
         return { success: false, message: `Dispatch Failed: ${error.message}` };
     }
 }
 
 export async function approveVerificationAction(
     requestId: string,
     verifierId: string
 ) {
     const { adminDb } = getAdminServices();
     if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
 
     try {
         const docRef = adminDb.doc(`pending_verifications/${requestId}`);
         const docSnap = await docRef.get();
 
         if (!docSnap.exists) return { success: false, message: 'Request Not Found.' };
 
         const request = docSnap.data() as PendingVerification;
         
         // Update this specific verifier's status
         const updatedVerifiers = request.assignedVerifiers.map(v => 
             v.id === verifierId ? { ...v, status: 'Approved' as const, updatedAt: Timestamp.now() } : v
         );
 
         const allApproved = updatedVerifiers.every(v => v.status === 'Approved');
         const status = allApproved ? 'Approved' : 'Partially Approved';
 
         if (allApproved) {
             // Apply the actual changes to the target document.
             const targetRef = adminDb.doc(`${request.targetCollection}/${request.targetId}`);
 
             // Profile modules: use set(merge) to preserve existing fields not in the update payload.
             // Array-heavy modules (campaigns/leads/donations/beneficiaries): use update() so
             // array fields are fully replaced rather than merged — prevents stale nested data.
             const profileModules: string[] = ['donors', 'users'];
             if (profileModules.includes(request.module)) {
                 await targetRef.set(request.newValue, { merge: true });
             } else {
                 await targetRef.update(request.newValue);
             }
 
             // Special handling for donations: Trigger recalculation of initiative totals
             if (request.module === 'donations') {
                 await bulkRecalculateInitiativeTotalsAction();
             }
 
             // Cleanup: Delete the pending request
             await docRef.delete();
             
             revalidatePath(request.revalidatePath, 'page');
             revalidatePath('/dashboard', 'layout');
 
             return { success: true, message: 'Final Approval Granted. Records Updated Globally.' };
         } else {
             // Just update the status
             await docRef.update({ 
               assignedVerifiers: updatedVerifiers, 
               status,
               updatedAt: Timestamp.now() 
             });
             
             return { success: true, message: 'Your Approval has been Recorded. Awaiting Remaining Members.' };
         }
     } catch (error: any) {
         console.error('Approve Verification Error:', error);
         return { success: false, message: `Approval Failed: ${error.message}` };
     }
 }
 
 export async function rejectVerificationAction(
     requestId: string,
     verifierId: string,
     reason?: string
 ) {
     const { adminDb } = getAdminServices();
     if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
 
     try {
         const docRef = adminDb.doc(`pending_verifications/${requestId}`);
         const docSnap = await docRef.get();
 
         if (!docSnap.exists) return { success: false, message: 'Request Not Found.' };
 
         const request = docSnap.data() as PendingVerification;
 
         // If anyone rejects, the whole thing is rejected
         await docRef.update({ 
           status: 'Rejected',
           description: reason ? `Rejected by ${verifierId}: ${reason}` : `Rejected by Member ${verifierId}`,
           updatedAt: Timestamp.now()
         });
 
         revalidatePath(request.revalidatePath);
         return { success: true, message: 'Change Request Rejected.' };
     } catch (error: any) {
         console.error('Reject Verification Error:', error);
         return { success: false, message: `Rejection Failed: ${error.message}` };
     }
 }

 export async function processPortalProfileUpdateAction(
    userId: string,
    userName: string,
    updateData: { name?: string; phone?: string }
 ) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const adminsSnap = await adminDb.collection('users').where('role', '==', 'Admin').where('status', '==', 'Active').get();
        const assignedVerifiers = adminsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            status: 'Pending' as const
        }));

        if (assignedVerifiers.length === 0) {
           return { success: false, message: 'No Active Administrator Found to verify your request.' };
        }

        const originalSnap = await adminDb.collection('users').doc(userId).get();

        const payload: PendingVerification = {
            id: adminDb.collection('pending_verifications').doc().id,
            targetId: userId,
            targetCollection: 'users',
            revalidatePath: '/profile',
            newValue: updateData,
            originalValue: originalSnap.exists ? originalSnap.data() : null,
            requestedBy: { id: userId, name: userName },
            assignedVerifiers,
            status: 'Pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            module: 'users',  // FIX: was incorrectly 'donors'
            description: 'Profile update requested via Supporter Portal.'
        };

        await adminDb.doc(`pending_verifications/${payload.id}`).set(payload);

        return { success: true, message: 'Profile update dispatched for administrative approval.' };
    } catch (error: any) {
        console.error('Failed to submit portal profile change:', error);
        return { success: false, message: `Failed: ${error.message}` };
    }
 }
