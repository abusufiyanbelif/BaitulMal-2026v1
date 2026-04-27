'use server';
 
import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuditLog } from '@/lib/types';
import { revalidatePath } from 'next/cache';
 
const ADMIN_SDK_ERROR_MESSAGE = "Admin SDK Initialization Failed.";
 
/**
 * Records an audit log entry in the 'audit_logs' collection.
 */
export async function recordAuditLogAction(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };
 
    try {
        const logRef = adminDb.collection('audit_logs').doc();
        
        // Clean the log object recursively to remove 'undefined' values which Firestore rejects
        const cleanData = JSON.parse(JSON.stringify(log, (key, value) => 
            value === undefined ? null : value
        ));

        const fullLog: AuditLog = {
            ...cleanData,
            id: logRef.id,
            timestamp: FieldValue.serverTimestamp() as any,
        };
 
        await logRef.set(fullLog);
        return { success: true, id: logRef.id };
    } catch (error: any) {
        console.error('Failed to record audit log:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Prunes audit logs older than a specific number of days.
 */
export async function cleanupAuditLogsAction(daysOld: number) {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: ADMIN_SDK_ERROR_MESSAGE };

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const logsRef = adminDb.collection('audit_logs');
        const oldLogsQuery = logsRef.where('timestamp', '<', cutoffDate);
        
        const snapshot = await oldLogsQuery.get();
        if (snapshot.empty) {
            return { success: true, message: "No old audit logs found.", count: 0 };
        }

        // Firestore batch limit is 500
        const batches: any[] = [];
        let currentBatch = adminDb.batch();
        let count = 0;

        snapshot.docs.forEach((doc, index) => {
            currentBatch.delete(doc.ref);
            count++;
            if (count === 500) {
                batches.push(currentBatch.commit());
                currentBatch = adminDb.batch();
                count = 0;
            }
        });

        if (count > 0) {
            batches.push(currentBatch.commit());
        }

        await Promise.all(batches);
        
        revalidatePath('/audit-trail'); 
        return { success: true, message: `Successfully deleted ${snapshot.size} audit logs older than ${daysOld} days.`, count: snapshot.size };
    } catch (error: any) {
        console.error('Audit Cleanup failed:', error);
        return { success: false, message: error.message };
    }
}
