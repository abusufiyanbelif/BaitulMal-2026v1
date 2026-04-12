'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithPhoneNumber, 
    RecaptchaVerifier, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';
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
    onSnapshot
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * IMPORTANT: Circular dependency resolution.
 * We initialize the core app here but do NOT import from the barrel file in children.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
  };
}

// Explicitly re-export core Firestore functions to ensure they are defined at runtime
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
    storageRef,
    uploadBytes,
    getDownloadURL,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    firebaseSignOut
};

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
