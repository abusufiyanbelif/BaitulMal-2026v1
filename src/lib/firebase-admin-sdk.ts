
import * as admin from 'firebase-admin';
import 'dotenv/config';

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;
let adminStorage: admin.storage.Storage | null = null;

// This check ensures this server-side code never runs in the browser.
if (typeof window === 'undefined') {
    try {
        if (!admin.apps.length) {
            const serviceAccount = require('../../serviceAccountKey.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        }
    } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND') {
            console.error('\n\x1b[31m[FATAL ERROR]\x1b[0m `serviceAccountKey.json` not found in the project root. Admin-only server actions will fail. Please obtain it from your Firebase project settings.\n');
        } else {
            console.error('Firebase Admin SDK initialization error:', e);
        }
    }

    // Initialize services only if the app was successfully initialized
    if (admin.apps.length) {
        adminAuth = admin.auth();
        adminDb = admin.firestore();
        adminStorage = admin.storage();
    }
}

export { adminAuth, adminDb, adminStorage };
