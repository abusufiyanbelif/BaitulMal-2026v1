
'use client';

/**
 * @fileOverview Hardened barrel file for Firebase SDKs.
 * Explicitly exports named functions to prevent circular dependency runtime errors.
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
    getAuth,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';

import { 
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    uploadString
} from 'firebase/storage';

import { firebaseConfig } from '@/firebase/config';

// Primary SDK Initializer
export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}

// Explicit Named Exports for components and hooks
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
    getAuth,
    getFirestore,
    getStorage,
    storageRef,
    uploadBytes,
    getDownloadURL,
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
