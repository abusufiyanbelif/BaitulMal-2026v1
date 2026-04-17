'use client';

/**
 * @fileOverview Aggregator barrel file for Firebase SDKs and hooks.
 * This file re-exports everything from sub-modules using relative imports
 * to prevent circular dependency loops during Next.js compilation.
 */

export * from './provider';
export * from './client-provider';
export * from './init';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

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
  Timestamp
} from 'firebase/firestore';

// Re-export Storage SDK functions
export { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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
