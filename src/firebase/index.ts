'use client';

/**
 * @fileOverview Aggregator barrel file for Firebase SDKs and hooks.
 * This file is a pure aggregator. Internal files should use relative imports
 * to prevent circular dependency loops during Next.js compilation.
 */

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
export { initializeFirebase } from './init';
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

// Re-export common Firestore SDK functions for convenience
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
  getFirestore
} from 'firebase/firestore';

// Re-export Storage SDK functions
export { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  getStorage
} from 'firebase/storage';

// Re-export Auth SDK functions required for Staff and Portal access
export { 
  sendPasswordResetEmail, 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  onAuthStateChanged,
  getAuth,
  signOut,
  signInWithEmailAndPassword
} from 'firebase/auth';
