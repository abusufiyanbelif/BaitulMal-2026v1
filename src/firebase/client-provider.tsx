
'use client';
import React, { useState, useEffect } from 'react';
import { initializeFirebase } from './init';
import { FirebaseProvider } from './provider';
import { TempLogo } from '@/components/temp-logo';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';

interface FirebaseServices {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore | null;
    storage: FirebaseStorage | null;
}

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
    const [services, setServices] = useState<FirebaseServices | null>(null);

    useEffect(() => {
        // This effect will only run on the client side, where `window` is available.
        setServices(initializeFirebase());
    }, []); // Empty dependency array ensures this runs only once on mount.

    if (!services) {
        // While services are being initialized, show a simple loader.
        // This prevents children from trying to access Firebase context before it's ready.
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
                <div className="w-64 h-64">
                    <TempLogo />
                </div>
            </div>
        )
    }

    return (
        <FirebaseProvider services={services}>
            {children}
        </FirebaseProvider>
    );
}
