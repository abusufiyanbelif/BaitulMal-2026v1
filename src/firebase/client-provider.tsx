
'use client';

import React, { type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

type FirebaseServices = {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
    storage: FirebaseStorage;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
    const [services, setServices] = useState<FirebaseServices | null>(null);
    const [initError, setInitError] = useState<Error | null>(null);

    useEffect(() => {
        try {
            const firebaseServices = initializeFirebase();
            if (!firebaseServices.firebaseApp || !firebaseServices.auth || !firebaseServices.firestore || !firebaseServices.storage) {
                // This will be caught if any service is null.
                // Based on current implementation, this shouldn't happen without an error, but it's a good guard.
                throw new Error("One or more Firebase services failed to initialize without throwing an error.");
            }
            setServices(firebaseServices as FirebaseServices);
        } catch (error: any) {
            setInitError(error);
        }
    }, []);

    if (initError) {
        const isFirestoreError = initError.message.includes("firestore");
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
                                            {initError.message}
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
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
      storage={services.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
