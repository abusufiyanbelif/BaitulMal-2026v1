'use client';
import React from 'react';
import { initializeFirebase } from './init';
import { FirebaseProvider } from './provider';
import { BrandedLoader } from '@/components/branded-loader';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
    const services = initializeFirebase();

    if (!services) {
        return <BrandedLoader />;
    }

    return (
        <FirebaseProvider services={services}>
            {children}
        </FirebaseProvider>
    )
}
