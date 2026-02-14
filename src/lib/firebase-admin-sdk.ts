import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      adminApp = getApps()[0];
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. Firebase Admin SDK not initialized.');
  }
} catch (e: any) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY or initialize Firebase Admin SDK.', e.message);
}


if (adminApp) {
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
}

export { adminApp, adminAuth, adminDb };
