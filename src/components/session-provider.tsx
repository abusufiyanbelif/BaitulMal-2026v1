'use client';

import { createContext, useMemo as useReactMemo, ReactNode, useState, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc, doc, type DocumentReference } from '@/firebase';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { createAdminPermissions } from '@/lib/modules';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  
  const [tokenRole, setTokenRole] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) {
      setTokenRole(null);
      return;
    }
    authUser.getIdTokenResult().then(result => {
      if (result.claims && result.claims.role) {
        setTokenRole(result.claims.role as string);
      }
    }).catch(err => {
      console.warn('Failed to parse user role claims securely:', err);
    });
  }, [authUser]);

  const storedRole = typeof window !== 'undefined' ? localStorage.getItem('portal_role') : null;
  const isViewingDonorPortal = pathname?.startsWith('/donor-portal') || storedRole === 'Donor' || tokenRole === 'Donor';
  const isViewingBeneficiaryPortal = pathname?.startsWith('/beneficiary-portal') || storedRole === 'Beneficiary' || tokenRole === 'Beneficiary';
  const isViewingStaffPortal = pathname?.startsWith('/dashboard') || pathname?.startsWith('/settings') || storedRole === 'Staff' || tokenRole === 'Admin' || tokenRole === 'User';

  // Load profiles based on availability, with Staff/Admin taking precedence for lookup
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid) as DocumentReference<UserProfile>;
  }, [firestore, authUser?.uid]);

  const donorDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    // Only load donor profile if specifically on donor portal or identified as a donor
    if (!isViewingDonorPortal) return null;
    return doc(firestore, 'donors', authUser.uid) as DocumentReference<any>;
  }, [firestore, authUser?.uid, isViewingDonorPortal]);

  const beneficiaryDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    // Only load beneficiary profile if specifically on beneficiary portal or identified as a beneficiary
    if (!isViewingBeneficiaryPortal) return null;
    return doc(firestore, 'beneficiaries', authUser.uid) as DocumentReference<any>;
  }, [firestore, authUser?.uid, isViewingBeneficiaryPortal]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
  const { data: donorProfile, isLoading: isDonorLoading } = useDoc<any>(donorDocRef);
  const { data: beneficiaryProfile, isLoading: isBenLoading } = useDoc<any>(beneficiaryDocRef);
  
  const isLoading = isAuthenticating || (!!authUser && (isProfileLoading || (isViewingDonorPortal && isDonorLoading) || (isViewingBeneficiaryPortal && isBenLoading)));
  
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
                name: authUser.displayName || (authUser.email === 'abusufiyan.belif@gmail.com' ? 'Abusufiyan Belif' : 'System Administrator'),
                email: authUser.email || '',
                loginId: 'admin',
                userKey: 'super_admin_bypass',
                role: 'Admin',
                status: 'Active',
                permissions: createAdminPermissions(),
            } as UserProfile;
        }

        if (donorProfile) {
            return {
                id: authUser.uid,
                name: donorProfile.name || 'Supporter',
                email: donorProfile.email || '',
                loginId: donorProfile.phone || '',
                role: 'Donor',
                status: 'Active',
                linkedDonorId: authUser.uid,
                permissions: {}
            } as any;
        }

        if (beneficiaryProfile) {
            return {
                id: authUser.uid,
                name: beneficiaryProfile.name || 'Beneficiary',
                email: beneficiaryProfile.email || '',
                loginId: beneficiaryProfile.phone || '',
                role: 'Beneficiary',
                status: 'Active',
                linkedBeneficiaryId: authUser.uid,
                permissions: {}
            } as any;
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