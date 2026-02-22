
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
             let errorMessage = 'Firebase Admin SDK initialization failed.';
            if (e.code === 'app/invalid-credential') {
                errorMessage += " The service account credentials are not valid. Ensure 'serviceAccountKey.json' is correct or Application Default Credentials are set up.";
            } else if (e.message.includes('Could not load the default credentials')) {
                errorMessage += " Application Default Credentials could not be found. Please configure them or provide a 'serviceAccountKey.json' file.";
            } else if (e.message.includes('IAM')) {
                errorMessage += " There might be an IAM permission issue with the service account. Please ensure it has the 'Firebase Admin' or 'Editor' role.";
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
        return { adminDb: null, adminAuth: null, adminStorage: null };
    }
    try {
        const { db, auth, storage } = initializeAdmin();
        return { adminDb: db, adminAuth: auth, adminStorage: storage };
    } catch (e: any) {
        console.error(
            'CRITICAL: Firebase Admin SDK initialization failed. This is likely an environment issue. ' +
            'Ensure the service account has the correct IAM permissions and required APIs (e.g., Identity Toolkit API) are enabled in Google Cloud.',
            e
        );
        return { adminDb: null, adminAuth: null, adminStorage: null };
    }
}
