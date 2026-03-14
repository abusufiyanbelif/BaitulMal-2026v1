'use client';

/**
 * @fileOverview Main entry point for Firebase services.
 * decoupled initialization to prevent circular dependencies during build.
 */

export { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  onSnapshot,
  onSnapshotsInSync,
  Timestamp,
  increment,
  writeBatch,
  deleteField,
  addDoc,
  type DocumentReference,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Query,
  type CollectionReference
} from 'firebase/firestore';

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';

export {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString
} from 'firebase/storage';

export {
  FirebaseProvider,
  useFirebase,
  useAuth,
  useFirestore,
  useStorage,
  useFirebaseApp,
  useMemoFirebase,
} from './provider';

export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { initializeFirebase } from './init';
export { FirebaseClientProvider } from './client-provider';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
