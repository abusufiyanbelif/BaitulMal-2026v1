
'use server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

interface AdminServices {
    auth: Auth;
    db: Firestore;
    storage: Storage;
    app: App;
}

let services: AdminServices | null = null;

/**
 * Initializes the Firebase Admin SDK if not already initialized.
 * This function is designed to be safe to call multiple times.
 */
function initializeAdmin(): AdminServices {
    if (services) {
        return services;
    }

    if (getApps().length === 0) {
        try {
            const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
            if (fs.existsSync(serviceAccountPath)) {
                initializeApp({
                    credential: cert(serviceAccountPath)
                });
                console.log("Firebase Admin SDK initialized with serviceAccountKey.json.");
            } else {
                initializeApp();
                console.log("Firebase Admin SDK initialized with Application Default Credentials.");
            }
        } catch (e: any) {
            console.error('Firebase Admin SDK initialization failed:', e.message);
            // We throw here to make it clear initialization is a fatal issue.
            // But the getters below will return null, allowing checks in actions.
            throw e;
        }
    }

    const app = getApps()[0]!;
    services = {
        auth: getAuth(app),
        db: getFirestore(app),
        storage: getStorage(app),
        app: app,
    };
    
    return services;
}


/**
 * A safe getter for admin services. To be called at the top of any server action.
 * Ensures the SDK is initialized and returns all services.
 */
export function getAdminServices(): { adminDb: Firestore | null; adminAuth: Auth | null; adminStorage: Storage | null; } {
     if (typeof window !== 'undefined') {
        return { adminDb: null, adminAuth: null, adminStorage: null };
    }
    try {
        const { db, auth, storage } = initializeAdmin();
        return { adminDb: db, adminAuth: auth, adminStorage: storage };
    } catch (e) {
        return { adminDb: null, adminAuth: null, adminStorage: null };
    }
}
