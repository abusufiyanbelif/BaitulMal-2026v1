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
  // Initialize to true if a ref is provided so it doesn't return false before the effect runs
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedDocRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setLoadedPath(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const currentPath = memoizedDocRef.path;

    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn(`[useDoc] Timeout reaching ${currentPath}. Stopping loading state.`);
        setIsLoading(false);
      }
    }, 10000);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        clearTimeout(timeoutId);
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setLoadedPath(currentPath);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        clearTimeout(timeoutId);
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: currentPath,
          });

          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(err);
          console.error('[useDoc Error]', err.code, err.message);
        }
        setData(null);
        setLoadedPath(currentPath);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [memoizedDocRef, nonce]);

  // Force loading state to true if the reference changed but the effect hasn't resolved yet
  const effectiveIsLoading = isLoading || (memoizedDocRef ? memoizedDocRef.path !== loadedPath : false);

  return { 
    data, 
    isLoading: effectiveIsLoading, 
    error,
    forceRefetch: () => setNonce(n => n + 1)
  };
}