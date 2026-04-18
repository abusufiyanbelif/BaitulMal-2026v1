'use client';

/**
 * @fileOverview Hardened barrel file for Firebase SDKs.
 * Uses explicit exports to prevent circular dependency loops during Next.js compilation.
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

// Re-export specific SDK methods required for Portals and Management
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
