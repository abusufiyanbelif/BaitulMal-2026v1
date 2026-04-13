
'use client';

/**
 * @fileOverview Definitive barrel file for Firebase SDKs.
 * Declarations must precede exports to avoid circular reference loops.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore,
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

// Primary Service Initializer
export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getFirebaseAuth(app),
    firestore: getFirestore(app),
    storage: getFirebaseStorage(app),
  };
}

// Explicit Named Exports
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
