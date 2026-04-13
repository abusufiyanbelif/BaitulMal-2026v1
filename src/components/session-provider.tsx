'use client';

import { createContext, useMemo as useReactMemo, ReactNode } from 'react';
import { useFirestore, useMemoFirebase, useDoc, doc, type DocumentReference } from '@/firebase';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { createAdminPermissions } from '@/lib/modules';

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
  
  const isLoading = isAuthenticating || (!!authUser && isProfileLoading);
  
  const profileWithDefaults = useReactMemo(() => {
    // 1. Check for specific administrative identities (Email or known Login IDs)
    const isAdminIdentity = 
        authUser?.email === 'abusufiyan.belif@gmail.com' || 
        authUser?.email === 'admin@example.com' || 
        userProfile?.loginId === 'admin' || 
        userProfile?.loginId === 'abusufiyan.belif';

    // 2. If profile is missing but it's a known admin identity, provide a synthetic superuser profile
    if (!userProfile) {
        if (isAdminIdentity && authUser) {
            return {
                id: authUser.uid,
                name: authUser.displayName || 'Super Administrator',
                email: authUser.email || '',
                loginId: authUser.email?.split('@')[0] || 'admin',
                userKey: 'super_admin_bypass',
                role: 'Admin',
                status: 'Active',
                permissions: createAdminPermissions(),
            } as UserProfile;
        }
        return null;
    }
    
    // 3. If profile exists, ensure admin identities always have Admin role and full permissions
    return {
        ...userProfile,
        role: isAdminIdentity ? 'Admin' : (userProfile.role || 'User'),
        permissions: isAdminIdentity ? createAdminPermissions() : (userProfile.permissions || {}),
    };
  }, [userProfile, authUser]);

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
