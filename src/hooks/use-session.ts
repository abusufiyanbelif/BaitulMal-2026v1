'use client';
import { useContext } from 'react';
import { SessionContext } from '@/components/session-provider';
import { useFirebase } from '@/firebase';

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  // The 'forceRefetch' function is added here to satisfy the hook's expected return type,
  // making it compatible with other data-fetching hooks that support manual refetching.
  // This avoids having to create a separate refetch mechanism for session data.
  const forceRefetch = () => {
    console.warn('forceRefetch is not implemented for useSession');
  };
  
  return { ...context, forceRefetch };
};

    