'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Uses a deferred update to avoid React hydration/HotReload render collisions.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Defer the state update to ensure it happens outside the current render cycle.
      // This resolves the "Cannot update a component while rendering another" warning.
      setTimeout(() => {
        setError(error);
      }, 0);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }

  return null;
}
