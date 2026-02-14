
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getAuth } from 'firebase/auth';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { firebaseConfig } from '@/firebase/config';

interface FirebaseProviderProps {
  children: ReactNode;
}

// Internal state for user authentication
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


// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  storage: FirebaseStorage | null;
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { 
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

function initializeFirebaseClient(): Partial<FirebaseServices> | null {
    if (typeof window === "undefined") {
        return null;
    }
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    let firestore: Firestore | null = null;
    let storage: FirebaseStorage | null = null;

    try {
      firestore = getFirestore(app);
    } catch (e) {
      console.warn("Could not initialize Firestore. This might be because it's not enabled in the Firebase console.", e);
    }

    try {
      storage = getStorage(app);
    } catch (e) {
      console.warn("Could not initialize Storage. This might be because it's not enabled in the Firebase console or storageBucket is missing from config.", e);
    }

    return {
        firebaseApp: app,
        auth: getAuth(app),
        firestore: firestore,
        storage: storage,
    };
}


/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children }) => {
  const [services, setServices] = useState<Partial<FirebaseServices> | null>(null);
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect 1: Initialize Firebase services ONCE on the client
  useEffect(() => {
    const firebaseServices = initializeFirebaseClient();
    setServices(firebaseServices);
  }, []);

  // Effect 2: Listen for auth state changes, depends on `services`
  useEffect(() => {
    if (services === null) {
      // Services are not yet initialized.
      return;
    }

    if (!services.auth) {
      // This is a critical failure if the auth service itself can't initialize.
      const authError = new Error("Firebase Authentication service failed to initialize. Check your firebaseConfig.");
      setUserAuthState({ user: null, isUserLoading: false, userError: authError });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      services.auth,
      (firebaseUser: User | null) => { // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [services]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    return {
      areServicesAvailable: !!services,
      firebaseApp: services?.firebaseApp || null,
      firestore: services?.firestore || null,
      auth: services?.auth || null,
      storage: services?.storage || null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [services, userAuthState]);
  
  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {(() => {
        if (userAuthState.userError) {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <CardTitle className="text-destructive">Authentication Error</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <Alert variant="destructive">
                            <AlertTitle>Could not verify user status.</AlertTitle>
                            <AlertDescription>
                                <p className="font-mono text-xs bg-destructive/20 p-2 rounded mt-2">
                                    {userAuthState.userError.message}
                                </p>
                            </AlertDescription>
                        </Alert>
                        <Button onClick={() => window.location.reload()} className="w-full">
                            Reload Page
                        </Button>
                    </CardContent>
                </Card>
            </div>
          );
        }

        if (!services || userAuthState.isUserLoading) {
            return <BrandedLoader />;
        }
        
        return children;
      })()}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.auth) {
    if (!context.isUserLoading) {
      throw new Error('Firebase core services (App, Auth) not available. This is an unexpected state inside a gated component.');
    }
  }

  return {
    firebaseApp: context.firebaseApp!,
    firestore: context.firestore!,
    auth: context.auth!,
    storage: context.storage!,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  if (!auth) {
    throw new Error("Firebase Auth service is not available. Check initialization.");
  }
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  if (!firestore) {
    throw new Error("Firestore service is not available. Check configuration and ensure it's enabled in your Firebase project.");
  }
  return firestore;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  if (!storage) {
    throw new Error("Firebase Storage service is not available. Check configuration and ensure it's enabled in your Firebase project.");
  }
  return storage;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseProvider.');
  }
  return { user: context.user, isUserLoading: context.isUserLoading, userError: context.userError };
};
