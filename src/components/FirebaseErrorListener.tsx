'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It displays a toast notification instead of throwing, preventing application crashes.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Log to console for developer visibility
      console.error("Firebase Permission Denied:", error.message);

      // Display a user-friendly but detailed toast
      // We use a longer duration for these critical errors
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: `You don't have permission to perform this action. Path: ${error.request.path}. Operation: ${error.request.method}. Please ensure your account has the required module permissions.`,
        duration: 10000,
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, [toast]);

  return null;
}