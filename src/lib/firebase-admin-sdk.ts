
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App | undefined;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

// This code should only run on the server.
if (typeof window === 'undefined') {
  if (!getApps().length) { // Only initialize if no app instance exists.
    try {
      // Check for serviceAccountKey.json for local development
      const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        // Use service account file if it exists (local development)
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount),
        });
        console.log("Firebase Admin SDK initialized with serviceAccountKey.json.");
      } else {
        // Otherwise, use Application Default Credentials (production/hosting environment)
        initializeApp();
        console.log("Firebase Admin SDK initialized with Application Default Credentials.");
      }
    } catch (e: any) {
      console.error(
        'Firebase Admin SDK initialization failed. Ensure your service account credentials are set correctly.',
        e.message
      );
    }
  }

  // After attempting initialization, get the app and its services.
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    try {
        adminAuth = getAuth(adminApp);
        adminDb = getFirestore(adminApp);
        adminStorage = getStorage(adminApp);
    } catch (e: any) {
        console.error("Failed to get Firebase Admin services:", e.message);
    }
  } else {
     // This case should only happen if initializeApp() failed catastrophically.
     console.error("No Firebase Admin App could be initialized.");
  }
}

export { adminApp, adminAuth, adminDb, adminStorage };
