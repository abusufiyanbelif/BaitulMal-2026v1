
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
import { AlertTriangle, ExternalLink } from 'lucide-react';
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
    firestore: Firestore;
    storage: FirebaseStorage;
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

function initializeFirebaseClient() {
    if (typeof window === "undefined") {
        return null;
    }
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    return {
        firebaseApp: app,
        auth: getAuth(app),
        firestore: getFirestore(app),
        storage: getStorage(app),
    };
}


/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children }) => {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect 1: Initialize Firebase services ONCE on the client
  useEffect(() => {
    try {
        const firebaseServices = initializeFirebaseClient();
        if (!firebaseServices) {
            // This indicates we are on the server, so we do nothing.
            // The loading state will be handled by the initial state of `services`.
            return;
        }
        setServices(firebaseServices);
    } catch (error: any) {
        setInitError(error);
    }
  }, []);

  // Effect 2: Listen for auth state changes, depends on `services`
  useEffect(() => {
    if (!services?.auth) {
      if(initError) {
          setUserAuthState({ user: null, isUserLoading: false, userError: initError });
      }
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
  }, [services, initError]); // Rerun when services are available

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!services;
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: services?.firebaseApp || null,
      firestore: services?.firestore || null,
      auth: services?.auth || null,
      storage: services?.storage || null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError || initError,
    };
  }, [services, userAuthState, initError]);
  
  const finalUserError = userAuthState.userError || initError;

  if (finalUserError) {
    const isFirestoreError = finalUserError.message.includes("firestore");
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const firestoreConsoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore`;
    const firestoreApiConsoleUrl = `https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${projectId}`;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-lg">
              <CardHeader className="text-center">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <CardTitle className="text-destructive">Firebase Initialization Failed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTitle>Error Details</AlertTitle>
                      <AlertDescription>
                          <div className="space-y-4">
                              {isFirestoreError ? (
                                  <div className="space-y-2 p-3 bg-destructive/10 rounded-md">
                                      <p className="font-semibold">Firestore Not Available</p>
                                      <p className="text-xs">Your project is missing a Firestore database. Go to the Firebase console to create one, or enable the Firestore API if a database already exists.</p>
                                      <div className="flex gap-2 pt-1">
                                          <Button asChild className="flex-1" size="sm" variant="secondary">
                                              <a href={firestoreConsoleUrl} target="_blank" rel="noopener noreferrer">Create Database <ExternalLink className="ml-2 h-3 w-3"/></a>
                                          </Button>
                                          <Button asChild className="flex-1" size="sm" variant="secondary">
                                              <a href={firestoreApiConsoleUrl} target="_blank" rel="noopener noreferrer">Enable API <ExternalLink className="ml-2 h-3 w-3"/></a>
                                          </Button>
                                      </div>
                                  </div>
                              ) : (
                                  <p className="font-mono text-xs bg-destructive/20 p-2 rounded">
                                      {finalUserError.message}
                                  </p>
                              )}
                          </div>
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

  if (!services) {
    return <BrandedLoader />;
  }


  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
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

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
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
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
