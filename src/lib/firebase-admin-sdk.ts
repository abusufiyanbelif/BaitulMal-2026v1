
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
            const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
            const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

            if (serviceAccountVar) {
                // Initialize using JSON string from environment variable
                try {
                    const credentials = JSON.parse(serviceAccountVar);
                    initializeApp({
                        credential: cert(credentials),
                        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                    });
                    console.log("Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT environment variable.");
                } catch (parseErr: any) {
                    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${parseErr.message}. Ensure the value is a valid JSON string starting with { and ending with }.`);
                }
            } else if (fs.existsSync(serviceAccountPath)) {
                // Initialize using local file
                initializeApp({
                    credential: cert(serviceAccountPath),
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                console.log("Firebase Admin SDK initialized with serviceAccountKey.json for local development.");
            } else {
                // Initialize using Application Default Credentials (ADC)
                // This will use ADC in a GCP environment (like Firebase App Hosting)
                initializeApp({
                    projectId: projectId, // Explicit project ID helps in some hosting environments
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                console.log(`Firebase Admin SDK initialized with Application Default Credentials (Project: ${projectId || 'auto-detected'}).`);
            }
        } catch (e: any) {
             let errorMessage = 'Firebase Admin SDK initialization failed.';
            if (e.code === 'app/invalid-credential') {
                errorMessage += " The service account credentials are not valid. Ensure your environment variables or 'serviceAccountKey.json' are correct.";
            } else if (e.message.includes('Could not load the default credentials')) {
                const checked = [
                    process.env.FIREBASE_SERVICE_ACCOUNT ? 'FIREBASE_SERVICE_ACCOUNT (Found)' : 'FIREBASE_SERVICE_ACCOUNT (Missing)',
                    fs.existsSync(path.resolve(process.cwd(), 'serviceAccountKey.json')) ? 'serviceAccountKey.json (Found)' : 'serviceAccountKey.json (Missing)'
                ].join(', ');
                
                errorMessage += ` Production environment missing credentials. (Checked: ${checked}). ACTION REQUIRED: Please add the 'FIREBASE_SERVICE_ACCOUNT' environment variable to your Firebase Hosting/App Hosting settings.`;
            } else if (e.message.includes('IAM')) {
                errorMessage += " There might be an IAM permission issue. Please ensure your service account has the 'Firebase Admin' role in Google Cloud console.";
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
