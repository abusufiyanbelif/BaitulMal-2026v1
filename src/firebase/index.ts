'use client';

/**
 * @fileOverview Definitive barrel file for Firebase SDKs.
 * Optimized for standard ESM exports to prevent circular dependencies and SSR crashes.
 */

import { 
    doc,
    collection,
    query,
    where,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    deleteField,
    Timestamp,
    increment,
    writeBatch,
    orderBy,
    limit,
    onSnapshot,
    getFirestore
} from 'firebase/firestore';

import { 
    getAuth as getFirebaseAuth,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';

import { 
    getStorage as getFirebaseStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    uploadString
} from 'firebase/storage';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';

export {
    doc,
    collection,
    query,
    where,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    deleteField,
    Timestamp,
    increment,
    writeBatch,
    orderBy,
    limit,
    onSnapshot,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    firebaseSignOut,
    getFirebaseAuth as getAuth,
    storageRef,
    uploadBytes,
    getDownloadURL,
    getFirebaseStorage as getStorage,
    deleteObject,
    uploadString
};

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

/**
 * Initializes Firebase core services.
 * Safe for use in the 'use client' bundle.
 */
export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getFirebaseAuth(app),
    firestore: getFirestore(app),
    storage: getFirebaseStorage(app),
  };
}
