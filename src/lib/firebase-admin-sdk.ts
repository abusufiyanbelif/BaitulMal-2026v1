
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount: ServiceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    );
    
    if (!getApps().length) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      adminApp = getApps()[0];
    }
  } else {
    // This is a graceful fallback for client-side rendering or environments
    // where the admin key is not available.
    console.warn("Firebase Admin SDK not initialized. Server-side actions will be disabled.");
  }
} catch (e: any) {
  console.error(
    'Firebase Admin SDK initialization failed. This can happen if the service account key is malformed. Server-side actions will be disabled.',
    e.message
  );
}

if (adminApp) {
  try {
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  } catch (e: any) {
    console.error("Failed to get Firebase Admin services:", e.message);
    adminAuth = null;
    adminDb = null;
  }
}

export { adminApp, adminAuth, adminDb };
