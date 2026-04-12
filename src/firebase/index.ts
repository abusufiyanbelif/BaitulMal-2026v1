'use client';

/**
 * Firebase Hub - Primary Barrel File
 * Re-exports all core SDK functions and custom hooks.
 */

// Re-export SDK functions directly from Firebase
export * from 'firebase/auth';
export * from 'firebase/firestore';
export * from 'firebase/storage';

// Export initialization logic
export { initializeFirebase } from './init';

// Export custom hooks and providers
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
