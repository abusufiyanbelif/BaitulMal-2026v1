'use client';

/**
 * @fileOverview Firebase Barrel File.
 * Re-exports all standard SDK functions and institutional providers.
 */

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
  FieldValue,
  writeBatch,
  increment,
  deleteField,
  Timestamp
} from 'firebase/firestore';

export { 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  onAuthStateChanged,
  sendPasswordResetEmail,
  PhoneAuthProvider
} from 'firebase/auth';

export { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

export { initializeFirebase } from './init';
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
