'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';

/**
 * Global Firestore Permission Error Listener.
 * Fixes the "HotReload" hydration warning by deferring state updates using setTimeout.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (incomingError: FirestorePermissionError) => {
      // CRITICAL FIX: Defer the update to the next task cycle to avoid
      // updating state during a render cycle (causes HotReload warnings).
      setTimeout(() => {
        setError(incomingError);
      }, 0);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    // Throw the error so it can be caught by the nearest Error Boundary
    throw error;
  }

  return null;
}