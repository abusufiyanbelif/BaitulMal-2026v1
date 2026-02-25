
'use client';

import { createContext, useMemo as useReactMemo, ReactNode } from 'react';
import { useFirestore, useMemoFirebase, useDoc, doc, type DocumentReference, type User } from '@/firebase';
import type { UserProfile } from '@/lib/types';

interface SessionContextType {
    user: User | null;
    userProfile: UserProfile | null;
    isLoading: boolean;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ authUser, children, isAuthenticating }: { authUser?: User | null; children: ReactNode; isAuthenticating: boolean; }) {
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid) as DocumentReference<UserProfile>;
  }, [firestore, authUser?.uid]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
  
  // Combine the top-level authentication check with the profile document fetch.
  // The app is "loading" if we are authenticating OR if we have a user but are still fetching their profile.
  const isLoading = isAuthenticating || (!!authUser && isProfileLoading);
  
  // If a profile exists but permissions are missing, provide a default empty object.
  // This makes downstream permission checks more robust.
  const profileWithDefaults = useReactMemo(() => {
    if (!userProfile) return null;
    return {
        ...userProfile,
        permissions: userProfile.permissions || {}, // Ensure permissions is always an object
    };
  }, [userProfile]);

  const contextValue = useReactMemo(() => ({
      user: authUser || null,
      userProfile: profileWithDefaults,
      isLoading,
  }), [authUser, profileWithDefaults, isLoading]);

  return (
    <SessionContext.Provider value={contextValue}>
        {children}
    </SessionContext.Provider>
  );
}
