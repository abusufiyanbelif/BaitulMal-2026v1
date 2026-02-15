'use client';

import React, {
  DependencyList,
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
} from 'react';

import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getAuth } from 'firebase/auth';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { BrandedLoader } from '@/components/branded-loader';
import { firebaseConfig } from '@/firebase/config';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface FirebaseProviderProps {
  children: ReactNode;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/* -------------------------------------------------------------------------- */
/*                                  CONTEXT                                   */
/* -------------------------------------------------------------------------- */

export const FirebaseContext = createContext<
  FirebaseContextState | undefined
>(undefined);

/* -------------------------------------------------------------------------- */
/*                          INITIALIZE FIREBASE CLIENT                        */
/* -------------------------------------------------------------------------- */

function initializeFirebaseClient(): FirebaseServices | null {
  if (typeof window === 'undefined') return null;

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  let firestore: Firestore | null = null;
  let storage: FirebaseStorage | null = null;

  try {
    firestore = getFirestore(app);
  } catch (e) {
    console.warn('Firestore initialization failed:', e);
  }

  try {
    storage = getStorage(app);
  } catch (e) {
    console.warn('Storage initialization failed:', e);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
    storage,
  };
}

/* -------------------------------------------------------------------------- */
/*                              PROVIDER COMPONENT                            */
/* -------------------------------------------------------------------------- */

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
}) => {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  /* ---------- Initialize Firebase once on client ---------- */
  useEffect(() => {
    const firebaseServices = initializeFirebaseClient();
    setServices(firebaseServices);
  }, []);

  /* ---------- Listen to Auth changes ---------- */
  useEffect(() => {
    if (!services?.auth) return;

    const unsubscribe = onAuthStateChanged(
      services.auth,
      (firebaseUser) => {
        setUserAuthState({
          user: firebaseUser,
          isUserLoading: false,
          userError: null,
        });
      },
      (error) => {
        console.error('Auth state error:', error);
        setUserAuthState({
          user: null,
          isUserLoading: false,
          userError: error,
        });
      }
    );

    return () => unsubscribe();
  }, [services]);

  const contextValue = useMemo<FirebaseContextState>(
    () => ({
      firebaseApp: services?.firebaseApp || null,
      firestore: services?.firestore || null,
      auth: services?.auth || null,
      storage: services?.storage || null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    }),
    [services, userAuthState]
  );

  /* ---------- SAFE LOADING GATE ---------- */
  if (!services || userAuthState.isUserLoading) {
    return <BrandedLoader />;
  }

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   HOOKS                                    */
/* -------------------------------------------------------------------------- */

export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within FirebaseProvider.');
  }
  return context;
};

export const useAuth = (): Auth | null => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore | null => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useStorage = (): FirebaseStorage | null => {
  const { storage } = useFirebase();
  return storage;
};

export const useFirebaseApp = (): FirebaseApp | null => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};

/* -------------------------------------------------------------------------- */
/*                            MEMO UTILITY (UNCHANGED)                        */
/* -------------------------------------------------------------------------- */

type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(
  factory: () => T,
  deps: DependencyList
): T | MemoFirebase<T> {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;

  return memoized;
}