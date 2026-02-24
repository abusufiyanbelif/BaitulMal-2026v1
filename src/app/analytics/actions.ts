'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';

export async function getStorageAnalytics() {
    const { adminStorage } = getAdminServices();
    if (!adminStorage) {
        throw new Error("Storage Admin SDK not available.");
    }

    try {
        const bucket = adminStorage.bucket();
        const [files] = await bucket.getFiles();

        let totalSize = 0;
        const fileTypes: Record<string, { count: number; size: number }> = {};
        let imageCount = 0;


        files.forEach(file => {
            const fileSize = parseInt(file.metadata.size as string, 10);
            totalSize += fileSize;
            
            const contentType = file.metadata.contentType || 'unknown';
            if (contentType.startsWith('image/')) {
                imageCount++;
            }
            
            const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            if (!fileTypes[extension]) {
                fileTypes[extension] = { count: 0, size: 0 };
            }
            fileTypes[extension].count++;
            fileTypes[extension].size += fileSize;

        });
        
        const folders = new Set(files.map(f => {
            const parts = f.name.split('/');
            if (parts.length > 1) {
                return parts.slice(0, -1).join('/');
            }
            return null;
        }).filter(Boolean));

        return {
            totalFiles: files.length,
            totalSize,
            imageCount,
            fileTypes: Object.entries(fileTypes).map(([type, data]) => ({ type, ...data })).sort((a, b) => b.count - a.count),
            folderCount: folders.size,
        };
    } catch (error: any) {
        console.error("Error getting storage analytics:", error);
        return { error: error.message };
    }
}

export async function incrementPageHit(pageId: string) {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error("Admin SDK not available for page hit increment.");
        return;
    }

    const pageRef = adminDb.collection('page_hits').doc(pageId);

    try {
        await pageRef.set({
            hits: FieldValue.increment(1)
        }, { merge: true });
    } catch (error) {
        console.error(`Failed to increment page hit for ${pageId}:`, error);
    }
}

export async function getPageHits() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        return { error: "Admin SDK not available." };
    }

    try {
        const snapshot = await adminDb.collection('page_hits').get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
        console.error("Error getting page hits:", error);
        return { error: error.message };
    }
}
