'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/** Internal implementation of Query used for path resolution in errors. */
interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
    }
  }
}

/**
 * Real-time collection listener hook.
 * Uses relative imports to prevent circular dependency cycles.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        snapshot.forEach(doc => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        if (err.code === 'permission-denied') {
          const path: string =
            memoizedTargetRefOrQuery.type === 'collection'
              ? (memoizedTargetRefOrQuery as CollectionReference).path
              : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
          });

          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(err);
          console.error('[useCollection Error]', err.code, err.message);
        }
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}