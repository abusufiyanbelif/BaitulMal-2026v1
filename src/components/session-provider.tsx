'use client';

import { createContext, useMemo as useReactMemo, ReactNode, useState, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc, doc, type DocumentReference } from '@/firebase';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { createAdminPermissions } from '@/lib/modules';

interface SessionContextType {
    user: User | null;
    userProfile: UserProfile | null;
    isLoading: boolean;
    isStaff: boolean;
    isContributor: boolean;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

/**
 * Unified Session Provider.
 * Handles identity resolution for Staff, Donors, and Beneficiaries.
 */
export function SessionProvider({ authUser, children, isAuthenticating }: { authUser?: User | null; children: ReactNode; isAuthenticating: boolean; }) {
  const firestore = useFirestore();
  const [tokenRole, setTokenRole] = useState<string | null>(null);

  // 1. Resolve Role from Token Claims (Most Secure)
  useEffect(() => {
    if (!authUser) {
      setTokenRole(null);
      return;
    }
    const timeout = setTimeout(() => {
      if (tokenRole === null) {
        console.warn('SessionProvider: Claims resolution timed out. Falling back to Guest.');
        setTokenRole('None');
      }
    }, 5000);

    authUser.getIdTokenResult(true).then(result => {
      clearTimeout(timeout);
      setTokenRole((result.claims?.role as string) || 'None');
    }).catch(err => {
      clearTimeout(timeout);
      console.warn('SessionProvider: Claims resolution failed:', err);
      setTokenRole('Error');
    });
    return () => clearTimeout(timeout);
  }, [authUser]);

  // 2. Resolve Profile Document Reference
  // We wait for tokenRole to ensure the auth state is fully established before fetching from Firestore.
  const profileRef = useMemoFirebase(() => {
      if (!firestore || !authUser?.uid || !tokenRole) return null;
      
      // If token says Donor/Beneficiary, we fetch from those collections directly
      if (tokenRole === 'Donor') return doc(firestore, 'donors', authUser.uid) as any;
      if (tokenRole === 'Beneficiary') return doc(firestore, 'beneficiaries', authUser.uid) as any;
      
      // Fallback to central users collection for Staff/Admin
      return doc(firestore, 'users', authUser.uid) as DocumentReference<UserProfile>;
  }, [firestore, authUser?.uid, tokenRole]);

  const { data: profileData, isLoading: isProfileLoading } = useDoc<any>(profileRef);

  // 3. Assemble Final Profile with Administrative Bypasses
  const resolvedProfile = useReactMemo(() => {
    if (!authUser) return null;

    // Sovereign Admin Identities (Hardcoded recovery access)
    const adminUids = [
        'cyMl1lQME0Yur1YS3VCms1AvrOJ2', // System Admin
        'S5efNV5jpTPoxYNv6SnAlv3jNPO2', // Abusufiyan Belif
        '3gKwUE2JrBT8wngoUxTTN6tLJk03'  // Maaz Shaikh
    ];

    const isAdmin = adminUids.includes(authUser.uid) || profileData?.role === 'Admin' || tokenRole === 'Admin';

    if (!profileData) {
        // If profile document hasn't loaded yet but we are a known admin
        if (isAdmin) {
            return {
                id: authUser.uid,
                name: authUser.displayName || 'Administrator',
                role: 'Admin',
                status: 'Active',
                permissions: createAdminPermissions(),
            } as UserProfile;
        }
        return null;
    }

    // Assemble profile based on role
    // We spread profileData first, then ensure role is set correctly from token if missing
    const profile = { 
        ...profileData,
        role: (tokenRole === 'None' || tokenRole === 'Error') ? (profileData?.role || 'Guest') : tokenRole,
    };

    if (isAdmin) {
        profile.role = 'Admin';
        profile.permissions = createAdminPermissions();
    }

    // Ensure ID is present
    if (!profile.id) profile.id = authUser.uid;

    return profile as UserProfile;
}, [profileData, authUser, tokenRole]);

  const isLoading = isAuthenticating || (!!authUser && (isProfileLoading || tokenRole === null));

  const contextValue = useReactMemo(() => {
      const role = resolvedProfile?.role;
      const isStaff = role === 'Admin' || role === 'User';
      const isContributor = role === 'Donor' || role === 'Beneficiary';

      return {
          user: authUser || null,
          userProfile: resolvedProfile,
          isLoading,
          isStaff,
          isContributor
      };
  }, [authUser, resolvedProfile, isLoading]);

  return (
    <SessionContext.Provider value={contextValue}>
        {children}
    </SessionContext.Provider>
  );
}