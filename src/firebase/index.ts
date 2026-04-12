'use client';

/**
 * @fileOverview Central Firebase Barrel File.
 * Re-exports core SDK functions and application-specific hooks/providers.
 * Ensures consistent module resolution and prevents "is not a function" runtime errors.
 */

import { initializeFirebase as initSdks } from './init';

const { firebaseApp, auth, firestore, storage } = initSdks();

export { firebaseApp, auth, firestore, storage };

// Export standard Firebase SDK functions for use across the app
export { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  deleteField, 
  Timestamp,
  increment,
  writeBatch,
  addDoc
} from 'firebase/firestore';

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInAnonymously,
  createUserWithEmailAndPassword
} from 'firebase/auth';

export {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString,
  getMetadata
} from 'firebase/storage';

// Export Application Specific Modules
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';