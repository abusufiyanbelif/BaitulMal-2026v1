'use client';

/**
 * @fileOverview Pure aggregator for Firebase SDKs.
 * Cleaned of logic to prevent circular dependency cycles during Next.js compilation.
 */

import { initializeFirebase } from './init';
export { initializeFirebase };

export { 
  FirebaseProvider, 
  useFirebase, 
  useAuth, 
  useFirestore, 
  useStorage, 
  useFirebaseApp, 
  useMemoFirebase, 
  useUser 
} from './provider';

export { FirebaseClientProvider } from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';

export { 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from './non-blocking-updates';

export { 
  initiateAnonymousSignIn, 
  initiateEmailSignUp, 
  initiateEmailSignIn 
} from './non-blocking-login';

export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';

// Re-export specific SDK methods
export { 
  collection, 
  query, 
  where, 
  doc, 
  orderBy, 
  limit, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

export { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

export { 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  onAuthStateChanged,
  getAuth,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
