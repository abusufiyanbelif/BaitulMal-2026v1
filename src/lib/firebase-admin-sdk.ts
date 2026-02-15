
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

try {
  if (getApps().length) {
    adminApp = getApps()[0];
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Standard ADC flow for production (e.g., App Hosting)
    adminApp = initializeApp();
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Fallback for local development using a .env variable
    const serviceAccount: ServiceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    );
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    console.warn("Firebase Admin SDK not initialized. Server-side actions will be disabled. Please set either GOOGLE_APPLICATION_CREDENTIALS (for production) or FIREBASE_SERVICE_ACCOUNT_KEY (for local dev).");
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
