'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Uses requestAnimationFrame to ensure state updates happen outside the render cycle,
 * resolving Next.js hydration and Fast Refresh lifecycle warnings.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Log to console for developer visibility
      console.warn("Institutional Access Blocked:", error.message);

      // Display a user-friendly but detailed toast asynchronously
      window.requestAnimationFrame(() => {
        toast({
          variant: 'destructive',
          title: 'Permission restricted',
          description: `This request was denied by institutional security rules. Path: ${error.request.path}. Operation: ${error.request.method}.`,
          duration: 10000,
        });
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, [toast]);

  return null;
}