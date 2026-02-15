
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

try {
  if (getApps().length) {
    adminApp = getApps()[0];
  } else {
    // Check for serviceAccountKey.json for local development
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Standard ADC flow for production (e.g., App Hosting)
      adminApp = initializeApp();
    } else {
      console.warn(
        "Firebase Admin SDK not initialized. Server-side actions will be disabled. " +
        "For local development, create a 'serviceAccountKey.json' file in your project root. " +
        "For production, ensure GOOGLE_APPLICATION_CREDENTIALS is set."
      );
    }
  }
} catch (e: any) {
  console.error(
    'Firebase Admin SDK initialization failed. Ensure your service account credentials are set correctly.',
    e.message
  );
}

if (adminApp) {
  try {
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    adminStorage = getStorage(adminApp);
  } catch (e: any) {
    console.error("Failed to get Firebase Admin services:", e.message);
    adminAuth = null;
    adminDb = null;
    adminStorage = null;
  }
}

export { adminApp, adminAuth, adminDb, adminStorage };
