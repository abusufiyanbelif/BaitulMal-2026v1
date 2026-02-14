
import type * as admin from 'firebase-admin';

// To prevent server crashes during build, we are temporarily disabling
// the auto-initialization. The services will be null, and server actions
// will fail gracefully until the `serviceAccountKey.json` is provided
// and the initialization is restored.

export const adminAuth: admin.auth.Auth | null = null;
export const adminDb: admin.firestore.Firestore | null = null;
export const adminStorage: admin.storage.Storage | null = null;
