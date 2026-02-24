
'use client';

export { initializeFirebase } from './init';
export { FirebaseProvider, useFirebase, useAuth, useFirestore, useStorage, useFirebaseApp, useMemoFirebase } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';

// Re-export core firebase services to ensure consistent imports
export {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    writeBatch,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    setDoc,
    limit,
    deleteField,
    type DocumentData,
    type DocumentReference,
    type Query,
    type QuerySnapshot,
    type CollectionReference,
    type Timestamp,
    type FieldValue,
} from 'firebase/firestore';

export {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    type User,
    type UserInfo,
    type Auth,
} from 'firebase/auth';

export {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    getMetadata,
    type FirebaseStorage,
} from 'firebase/storage';

export {
    initializeApp,
    getApp,
    getApps,
    type FirebaseApp,
} from 'firebase/app';
