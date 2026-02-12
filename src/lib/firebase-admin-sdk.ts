
import * as admin from 'firebase-admin';
import 'dotenv/config';

let adminAuth: admin.auth.Auth;
let adminDb: admin.firestore.Firestore;
let adminStorage: admin.storage.Storage;

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

// Initialize services after app initialization
if (admin.apps.length) {
  adminAuth = admin.auth();
  adminDb = admin.firestore(); // Point to the (default) database
  adminStorage = admin.storage();
}


export { adminAuth, adminDb, adminStorage };
