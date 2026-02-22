
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
                    credential: cert(serviceAccountPath),
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                console.log("Firebase Admin SDK initialized with serviceAccountKey.json for local development.");
            } else {
                // This will use Application Default Credentials in a GCP environment (like Firebase App Hosting)
                initializeApp({
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                console.log("Firebase Admin SDK initialized with Application Default Credentials (production mode).");
            }
        } catch (e: any) {
             let errorMessage = 'Firebase Admin SDK initialization failed.';
            if (e.code === 'app/invalid-credential') {
                errorMessage += " The service account credentials are not valid. Ensure 'serviceAccountKey.json' is correct or Application Default Credentials are set up.";
            } else if (e.message.includes('Could not load the default credentials')) {
                errorMessage += " For local development, 'serviceAccountKey.json' was not found and Application Default Credentials could not be loaded. Please refer to the setup guide.";
            } else if (e.message.includes('IAM')) {
                errorMessage += " There might be an IAM permission issue with the service account. Please ensure it has the 'Firebase Admin' or 'Editor' role in Google Cloud.";
            } else {
                errorMessage += ` Unexpected error: ${e.message}`;
            }
            console.error(errorMessage, e);
            throw new Error(errorMessage);
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
        console.error("getAdminServices should not be called on the client side.");
        return { adminDb: null, adminAuth: null, adminStorage: null };
    }
    try {
        const { db, auth, storage } = initializeAdmin();
        return { adminDb: db, adminAuth: auth, adminStorage: storage };
    } catch (e: any) {
        // The detailed error is already logged in initializeAdmin, so here we provide context for the action that failed.
        console.error(
            'CRITICAL: getAdminServices failed because the Admin SDK could not be initialized. ' +
            'This means any server-side script (database seed, migration, etc.) will fail. ' +
            'Please check the server logs for the original initialization error message.',
        );
        // We re-throw because the calling script cannot function without these services.
        throw new Error(
            `Admin SDK initialization failed. This usually means the server is missing credentials. Please ensure your 'serviceAccountKey.json' is correctly placed in the project root or that Application Default Credentials are configured.`
        );
    }
}
