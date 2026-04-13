'use client';

/**
 * @fileOverview Definitive barrel file for Firebase SDKs.
 * Resolved naming collisions and ensured all core functions are explicitly exported.
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
    onSnapshot
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
    getStorage as getFirebaseStorageSDK,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    uploadString
} from 'firebase/storage';

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
    getFirebaseStorageSDK as getStorage,
    deleteObject,
    uploadString
};

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getFirebaseAuth(app),
    firestore: getFirestoreInstance(app),
    storage: getStorageInstance(app),
  };
}

// Internal helpers for initialization to avoid direct usage of SDK getters in the same scope
function getFirestoreInstance(app: any) {
    const { getFirestore } = require('firebase/firestore');
    return getFirestore(app);
}

function getStorageInstance(app: any) {
    const { getStorage } = require('firebase/storage');
    return getStorage(app);
}
