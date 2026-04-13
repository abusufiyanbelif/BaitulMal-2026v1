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
    isStaff: boolean;
    isContributor: boolean;
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
    if (!authUser) return null;

    // --- PRIMARY ADMINISTRATIVE BYPASS (SOVEREIGN IDENTITIES) ---
    const adminEmails = [
        'abusufiyan.belif@gmail.com', 
        'baitulmalss.solapur@gmail.com', 
        'maazshaikh.official@gmail.com',
        'admin@example.com'
    ];
    
    const adminUids = [
        'cyMl1lQME0Yur1YS3VCms1AvrOJ2', // BaitulMal System Admin
        'S5efNV5jpTPoxYNv6SnAlv3jNPO2', // Abusufiyan Belif (Primary)
        '3gKwUE2JrBT8wngoUxTTN6tLJk03'  // Maaz A. Rauf Shaikh
    ];

    const isAdminIdentity = 
        adminEmails.includes(authUser.email || '') || 
        adminUids.includes(authUser.uid) ||
        userProfile?.role === 'Admin';

    if (!userProfile) {
        if (isAdminIdentity) {
            return {
                id: authUser.uid,
                name: authUser.displayName || 'System Administrator',
                email: authUser.email || '',
                loginId: 'admin',
                userKey: 'super_admin_bypass',
                role: 'Admin',
                status: 'Active',
                permissions: createAdminPermissions(),
            } as UserProfile;
        }
        return null;
    }
    
    return {
        ...userProfile,
        role: isAdminIdentity ? 'Admin' : (userProfile.role || 'User'),
        permissions: isAdminIdentity ? createAdminPermissions() : (userProfile.permissions || {}),
    } as UserProfile;
  }, [userProfile, authUser]);

  const contextValue = useReactMemo(() => {
      const isStaff = profileWithDefaults?.role === 'Admin' || profileWithDefaults?.role === 'User';
      const isContributor = !!profileWithDefaults?.linkedDonorId || !!profileWithDefaults?.linkedBeneficiaryId || profileWithDefaults?.role === 'Donor' || profileWithDefaults?.role === 'Beneficiary';

      return {
          user: authUser || null,
          userProfile: profileWithDefaults,
          isLoading,
          isStaff,
          isContributor
      };
  }, [authUser, profileWithDefaults, isLoading]);

  return (
    <SessionContext.Provider value={contextValue}>
        {children}
    </SessionContext.Provider>
  );
}