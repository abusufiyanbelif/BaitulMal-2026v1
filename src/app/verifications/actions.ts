'use server';
 
 import { getAdminServices } from '@/lib/firebase-admin-sdk';
 import { revalidatePath } from 'next/cache';
 import type { PendingVerification, Beneficiary, Donation, Donor, Campaign, Lead } from '@/lib/types';
 import { FieldValue, Timestamp } from 'firebase-admin/firestore';
 import { bulkRecalculateInitiativeTotalsAction, syncInitiativeCollectedTotals } from '@/app/donations/actions';
import { recordAuditLogAction } from '@/app/audit/actions';
import { generateChanges } from '@/lib/utils';
 
 const ADMIN_SDK_ERROR_MESSAGE = 'Operational Failure: Administrative Services Unavailable.';
 
 /**
  * Mock helper for WhatsApp notifications.
  * In a production environment, this would integrate with Twilio or WhatsApp Business API.
  */
 import { 
    sendWhatsAppAction, 
    notifyLeadAction, 
    notifyCampaignAction, 
    notifyDonationVerifiedAction, 
    notifyBeneficiaryStatusAction,
    notifyApprovalFinalizedAction,
    notifyVerificationUpdateAction,
    sendTelegramAction
} from '@/app/messages/actions';
 
 /**
  * Deeply serializes Firestore data by converting Timestamps to ISO strings.
  * This is required because Next.js Server Actions cannot return non-plain objects like Timestamps.
  */
 function serializeForClient(data: any): any {
     if (data === null || data === undefined) return data;
     
     // Handle Firestore Timestamp (Admin SDK)
     if (typeof data.toDate === 'function') {
         return data.toDate().toISOString();
     }
     
     // Handle Date objects
     if (data instanceof Date) {
         return data.toISOString();
     }
 
     // Handle Array
     if (Array.isArray(data)) {
         return data.map(serializeForClient);
     }
 
     // Handle Plain Object
     if (typeof data === 'object' && data.constructor === Object) {
         const serialized: any = {};
         for (const key in data) {
             if (Object.prototype.hasOwnProperty.call(data, key)) {
                 serialized[key] = serializeForClient(data[key]);
             }
         }
         return serialized;
     }
 
     return data;
 }
 
 export async function requestVerificationAction(
     verificationData: Omit<PendingVerification, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'assignedVerifierIds'>
 ) {
     const { adminDb } = getAdminServices();
     if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
 
     try {
         const verificationsRef = adminDb.collection('pending_verifications');
 
         // --- CONFLICT CHECK ---
         // Prevent multiple pending requests for the same record
         const existingSnap = await verificationsRef
             .where('targetId', '==', verificationData.targetId)
             .where('status', 'in', ['Pending', 'Partially Approved'])
             .limit(1)
             .get();
 
         if (!existingSnap.empty) {
             return { 
                 success: false, 
                 message: 'Conflict: A change request for this record is already awaiting approval. Please resolve the existing request first.' 
             };
         }
 
         const newDoc = verificationsRef.doc();
         
         const payload: PendingVerification = {
             ...verificationData,
             id: newDoc.id,
             assignedVerifierIds: verificationData.assignedVerifiers.map((v: { id: string }) => v.id),
             status: 'Pending',
             createdAt: Timestamp.now(),
             updatedAt: Timestamp.now(),
         } as PendingVerification;
 
         await newDoc.set(payload);

        let sentCount = 0;
        let failCount = 0;
 
        // Notify assigned verifiers
        for (const verifier of payload.assignedVerifiers) {
            try {
                const verifierSnap = await adminDb.collection('users').doc(verifier.id).get();
                const verifierPhone = verifierSnap.data()?.phone;
                
                if (verifierPhone && verifierPhone !== 'Unknown') {
                    // Get Base URL from Firestore if available
                    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baitulamalsolapur.com';
                    try {
                        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
                        if (resourceSnap.exists && resourceSnap.data()?.baseUrl) {
                            baseUrl = resourceSnap.data()?.baseUrl;
                        }
                    } catch (e) {}

                    const notifyResult = await sendWhatsAppAction({
                        to: verifierPhone,
                        templateId: 'verification_request',
                        variables: {
                            verifierName: verifier.name,
                            requesterName: payload.requestedBy.name,
                            purpose: payload.description || 'Data Update',
                            module: payload.module.toUpperCase(),
                            recordId: payload.targetId,
                            requestId: payload.id,
                            url: `${baseUrl}/verifications?requestId=${payload.id}`
                        },
                        metadata: {
                            moduleId: payload.module,
                            recordId: payload.targetId,
                            userId: verifier.id,
                            templateId: 'verification_request'
                        },
                        moduleId: payload.module.replace(/s$/, '') as any // Map plurals to singular
                    });
                    
                    if (notifyResult.success) sentCount++;
                    else failCount++;
                }
                
                const verifierTelegramId = verifierSnap.data()?.telegramChatId;
                if (verifierTelegramId) {
                    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baitulamalsolapur.com';
                    try {
                        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
                        if (resourceSnap.exists && resourceSnap.data()?.baseUrl) {
                            baseUrl = resourceSnap.data()?.baseUrl;
                        }
                    } catch (e) {}

                    await sendTelegramAction({
                        message: `🔔 *New Verification Request*\n\n*Module:* ${payload.module.toUpperCase()}\n*Requested By:* ${payload.requestedBy.name}\n*Purpose:* ${payload.description || 'Data Update'}\n\n🔗 Review: ${baseUrl}/verifications?requestId=${payload.id}`,
                        chatId: verifierTelegramId,
                        moduleId: payload.module.replace(/s$/, '') as any
                    });
                }

            } catch (notifyError) {
                failCount++;
                console.error(`Failed to process notification for verifier ${verifier.id}:`, notifyError);
            }
        }

        // --- NEW: Notify the whole group about the request ---
        try {
            await notifyVerificationUpdateAction({
                request: payload,
                action: 'REQUEST',
                performedBy: payload.requestedBy
            });
        } catch (e) {}

        revalidatePath(payload.revalidatePath);
        
        const notificationStatus = failCount === 0 
            ? `All ${sentCount} notifications dispatched.`
            : sentCount > 0 
                ? `${sentCount} sent, ${failCount} skipped or failed.`
                : `Automated notifications were skipped (disabled or unavailable).`;

        return { 
            success: true, 
            message: `Verification Dispatched. ${notificationStatus}` 
        };
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
 
         let minApprovalsRequired = 1;
         const configMap: Record<string, string> = {
             'leads': 'lead_config',
             'campaigns': 'campaign_config',
             'donations': 'donation_config',
             'beneficiaries': 'beneficiary_config',
             'users': 'user_config',
             'donors': 'donor_config'
         };

         const configDocId = configMap[request.module];
         if (configDocId) {
             try {
                 const configSnap = await adminDb.doc(`settings/${configDocId}`).get();
                 if (configSnap.exists) {
                     const configData = configSnap.data();
                     if (configData?.minApprovalsRequired !== undefined) {
                         minApprovalsRequired = Number(configData.minApprovalsRequired) || 1;
                     }
                 }
             } catch (e) {
                 console.error(`Failed to fetch minApprovalsRequired for ${request.module}:`, e);
             }
         }

         const approvedCount = updatedVerifiers.filter(v => v.status === 'Approved').length;
         const allApproved = approvedCount >= minApprovalsRequired || approvedCount >= request.assignedVerifiers.length;
         const status = allApproved ? 'Approved' : 'Partially Approved';
 
         if (allApproved) {
             // Apply the actual changes to the target document.
             const targetRef = adminDb.doc(`${request.targetCollection}/${request.targetId}`);
 
             // Profile modules: use set(merge) to preserve existing fields not in the update payload.
             const profileModules: string[] = ['donors', 'users'];
             if (profileModules.includes(request.module)) {
                 await targetRef.set(request.newValue, { merge: true });
             } else {
                 await targetRef.update(request.newValue);
             }
 
             // --- TRIGGER MODULE-SPECIFIC NOTIFICATIONS ---
             try {
                 if (request.module === 'leads') {
                     await notifyLeadAction(request.targetId, 'lead_updated', {
                         actionType: 'Approved Modification',
                         summary: request.description || 'Verified via Approval Workflow'
                     });
                 } else if (request.module === 'campaigns') {
                     await notifyCampaignAction(request.targetId, 'campaign_milestone');
                 } else if (request.module === 'donations') {
                     await notifyDonationVerifiedAction(request.targetId);
                 } else if (request.module === 'beneficiaries') {
                     await notifyBeneficiaryStatusAction(request.targetId, (request.newValue as any).status || 'Updated');
                 }
             } catch (notifyError) {
                 console.error(`Approval notification failed for ${request.module}:`, notifyError);
             }
 
             // Special handling for donations: Trigger recalculation of initiative totals
             if (request.module === 'donations') {
                 await bulkRecalculateInitiativeTotalsAction();
             }
 
             // Special handling for beneficiaries: Adjust initiative targetAmount if kitAmount changed
             if (request.module === 'beneficiaries' && request.targetCollection.includes('/beneficiaries')) {
                 const pathParts = request.targetCollection.split('/');
                 if (pathParts.length >= 2) {
                     const initiativeCollection = pathParts[0];
                     const initiativeId = pathParts[1];
                     const oldKitAmount = (request.originalValue as any)?.kitAmount || 0;
                     const newKitAmount = (request.newValue as any)?.kitAmount;
                     
                     if (newKitAmount !== undefined && newKitAmount !== oldKitAmount) {
                         const diff = Number(newKitAmount) - Number(oldKitAmount);
                         await adminDb.collection(initiativeCollection).doc(initiativeId).update({
                             targetAmount: FieldValue.increment(diff),
                             updatedAt: FieldValue.serverTimestamp()
                         });
 
                         // Recalculate surplus logic
                         await syncInitiativeCollectedTotals(adminDb, [{ 
                             linkId: initiativeId, 
                             linkType: initiativeCollection === 'campaigns' ? 'campaign' : 'lead',
                             linkName: '',
                             amount: 0
                         }]);
                     }
                 }
             }
 
             // Record Audit Log before deletion
             const changes = generateChanges(request.originalValue, request.newValue);
             await recordAuditLogAction({
                 targetId: request.targetId,
                 targetCollection: request.targetCollection,
                 module: request.module,
                 action: 'APPROVE',
                 description: `Change request finalized: ${request.description}`,
                 performedBy: { id: verifierId, name: updatedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier' },
                 changes: changes,
                 originalValue: request.originalValue,
                 newValue: request.newValue,
                 metadata: {
                     requestId: request.id,
                     requestedBy: request.requestedBy,
                     approvedBy: updatedVerifiers.filter(v => v.status === 'Approved').map(v => ({ id: v.id, name: v.name }))
                 }
             });

             // Notify internal notification groups with full details
             try {
                 await notifyApprovalFinalizedAction({
                     module: request.module,
                     targetId: request.targetId,
                     requestedBy: request.requestedBy.name,
                     approvedBy: updatedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier',
                     changes: changes,
                     description: request.description || 'Data modification approved'
                 });
             } catch (notifyError) {
                 console.error('Failed to notify internal groups of final approval:', notifyError);
             }

             // Cleanup: Delete the pending request
             await docRef.delete();
            
            // Notify Requester
            try {
                const requesterSnap = await adminDb.collection('users').doc(request.requestedBy.id).get();
                const requesterPhone = requesterSnap.data()?.phone;
                if (requesterPhone && requesterPhone !== 'Unknown') {
                    await sendWhatsAppAction({
                        to: requesterPhone,
                        templateId: 'verification_approved',
                        variables: {
                            requesterName: request.requestedBy.name,
                            module: request.module.toUpperCase(),
                            recordId: request.targetId,
                            purpose: request.description || 'Data Update'
                        },
                        metadata: {
                            moduleId: request.module,
                            recordId: request.targetId,
                            userId: request.requestedBy.id,
                            templateId: 'verification_approved'
                        },
                        moduleId: request.module.replace(/s$/, '') as any
                    });
                }
                
                const requesterTelegramId = requesterSnap.data()?.telegramChatId;
                if (requesterTelegramId) {
                    await sendTelegramAction({
                        message: `✅ *Verification Approved*\n\n*Module:* ${request.module.toUpperCase()}\n*Requested By:* ${request.requestedBy.name}\n*Purpose:* ${request.description || 'Data Update'}`,
                        chatId: requesterTelegramId,
                        moduleId: request.module.replace(/s$/, '') as any
                    });
                }

            } catch (notifyError) {
                console.error('Failed to notify requester of approval:', notifyError);
            }
             
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
             
             // --- NEW: Notify group about the partial approval ---
             try {
                 await notifyVerificationUpdateAction({
                     request: { ...request, assignedVerifiers: updatedVerifiers, status },
                     action: 'APPROVE',
                     performedBy: { id: verifierId, name: updatedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier' }
                 });
             } catch (e) {}
             
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
 
         // Record Audit Log for Rejection
         await recordAuditLogAction({
             targetId: request.targetId,
             targetCollection: request.targetCollection,
             module: request.module,
             action: 'REJECT',
             description: reason ? `Modification rejected: ${reason}` : 'Modification rejected by verifier.',
             performedBy: { id: verifierId, name: request.assignedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier' },
             changes: generateChanges(request.originalValue, request.newValue),
             originalValue: request.originalValue,
             newValue: request.newValue,
             metadata: {
                 requestId: request.id,
                 requestedBy: request.requestedBy,
                 rejectionReason: reason
             }
         });
 
         // Notify Requester
        try {
            const requesterSnap = await adminDb.collection('users').doc(request.requestedBy.id).get();
            const requesterPhone = requesterSnap.data()?.phone;
            if (requesterPhone && requesterPhone !== 'Unknown') {
                await sendWhatsAppAction({
                    to: requesterPhone,
                    templateId: 'verification_rejected',
                    variables: {
                        requesterName: request.requestedBy.name,
                        module: request.module.toUpperCase(),
                        recordId: request.targetId,
                        reason: reason || 'Criteria not met or data discrepancy found.'
                    },
                    metadata: {
                        moduleId: request.module,
                        recordId: request.targetId,
                        userId: request.requestedBy.id,
                        templateId: 'verification_rejected'
                    },
                    moduleId: request.module.replace(/s$/, '') as any
                });
                
                const requesterTelegramId = requesterSnap.data()?.telegramChatId;
                if (requesterTelegramId) {
                    await sendTelegramAction({
                        message: `❌ *Verification Rejected*\n\n*Module:* ${request.module.toUpperCase()}\n*Requested By:* ${request.requestedBy.name}\n*Reason:* ${reason || 'Criteria not met or data discrepancy found.'}`,
                        chatId: requesterTelegramId,
                        moduleId: request.module.replace(/s$/, '') as any
                    });
                }
            }
        } catch (notifyError) {
            console.error('Failed to notify requester of rejection:', notifyError);
        }

        // --- NEW: Notify group about the rejection ---
        try {
            await notifyVerificationUpdateAction({
                request: { ...request, status: 'Rejected' },
                action: 'REJECT',
                performedBy: { id: verifierId, name: request.assignedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier' },
                reason
            });
        } catch (e) {}

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
            assignedVerifierIds: assignedVerifiers.map((v: { id: string }) => v.id),
            status: 'Pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            module: 'users',
            description: 'Profile update requested via Supporter Portal.'
        };

        await adminDb.doc(`pending_verifications/${payload.id}`).set(payload);
        
        let sentCount = 0;
        let failCount = 0;
 
        // Notify assigned verifiers (Admins)
        for (const verifier of payload.assignedVerifiers) {
            try {
                const verifierSnap = await adminDb.collection('users').doc(verifier.id).get();
                const verifierPhone = verifierSnap.data()?.phone;
                
                if (verifierPhone && verifierPhone !== 'Unknown') {
                    // Get Base URL from Firestore if available
                    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baitulamalsolapur.com';
                    try {
                        const resourceSnap = await adminDb.collection('settings').doc('resources').get();
                        if (resourceSnap.exists && resourceSnap.data()?.baseUrl) {
                            baseUrl = resourceSnap.data()?.baseUrl;
                        }
                    } catch (e) {}

                    const notifyResult = await sendWhatsAppAction({
                        to: verifierPhone,
                        templateId: 'portal_profile_update',
                        variables: {
                            verifierName: verifier.name,
                            userName: userName,
                            requestId: payload.id,
                            url: `${baseUrl}/verifications?requestId=${payload.id}`
                        },
                        metadata: {
                            moduleId: 'users',
                            recordId: userId,
                            userId: verifier.id,
                            templateId: 'portal_profile_update'
                        },
                        moduleId: 'user'
                    });
                    
                    const verifierTelegramId = verifierSnap.data()?.telegramChatId;
                    if (verifierTelegramId) {
                        await sendTelegramAction({
                            message: `🔔 *New Portal Profile Update Request*\n\n*Requested By:* ${userName}\n\n🔗 Review: ${baseUrl}/verifications?requestId=${payload.id}`,
                            chatId: verifierTelegramId,
                            moduleId: 'user'
                        });
                    }
                    
                    if (notifyResult.success) sentCount++;
                    else failCount++;
                } else {
                    failCount++;
                }
            } catch (notifyError) {
                failCount++;
                console.error(`Failed to notify admin for portal update:`, notifyError);
            }
        }

        const notificationStatus = failCount === 0 
            ? `All ${sentCount} admins notified.`
            : sentCount > 0 
                ? `${sentCount} notified, ${failCount} skipped or failed.`
                : `Automated notifications were skipped (disabled or unavailable).`;

        return { success: true, message: `Profile update dispatched for administrative approval. ${notificationStatus}` };
    } catch (error: any) {
        console.error('Failed to submit portal profile change:', error);
        return { success: false, message: `Failed: ${error.message}` };
    }
 }

/**
 * Check if a specific record has a pending verification
 */
export async function checkPendingVerificationAction(targetId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return null;

    try {
        const snap = await adminDb.collection('pending_verifications')
            .where('targetId', '==', targetId)
            .where('status', 'in', ['Pending', 'Partially Approved'])
            .limit(1)
            .get();

        if (snap.empty) return null;
        return serializeForClient(snap.docs[0].data()) as PendingVerification;
    } catch (e) {
        return null;
    }
}

/**
 * Cancel/Withdraw a verification request
 */
export async function cancelVerificationAction(requestId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: 'DB Unavailable' };

    try {
        const docRef = adminDb.collection('pending_verifications').doc(requestId);
        const snap = await docRef.get();
        
        if (!snap.exists) return { success: false, message: 'Request not found.' };
        
        const data = snap.data() as PendingVerification;
        await docRef.delete();
        
        if (data.revalidatePath) revalidatePath(data.revalidatePath);
        
        return { success: true, message: 'Verification request withdrawn.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
