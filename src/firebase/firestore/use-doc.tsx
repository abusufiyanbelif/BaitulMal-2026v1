'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  forceRefetch: () => void;
}

/**
 * Real-time document listener hook.
 * Uses relative imports to prevent circular dependency cycles.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          });

          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(err);
          console.error('[useDoc Error]', err.code, err.message);
        }
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, nonce]);

  return { 
    data, 
    isLoading, 
    error,
    forceRefetch: () => setNonce(n => n + 1)
  };
}