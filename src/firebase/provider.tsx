
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

import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';

import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  services: {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore | null;
    storage: FirebaseStorage | null;
  }
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
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

export const FirebaseContext = createContext<
  FirebaseContextState | undefined
>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  services
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  /* ---------- Listen to Auth changes ---------- */
  useEffect(() => {
    if (!services?.auth) {
        setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not available.") });
        return;
    };

    const unsubscribe = onAuthStateChanged(
      services.auth,
      (firebaseUser: User | null) => {
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
  
  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextState | null => {
  const context = useContext(FirebaseContext);
  return context || null;
};

export const useAuth = (): Auth | null => {
  const firebase = useFirebase();
  return firebase?.auth || null;
};

export const useFirestore = (): Firestore | null => {
  const firebase = useFirebase();
  return firebase?.firestore || null;
};

export const useStorage = (): FirebaseStorage | null => {
  const firebase = useFirebase();
  return firebase?.storage || null;
};

export const useFirebaseApp = (): FirebaseApp | null => {
  const firebase = useFirebase();
  return firebase?.firebaseApp || null;
};

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
