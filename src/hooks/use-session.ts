
'use client';
import { useContext } from 'react';
import { SessionContext } from '@/components/session-provider';

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  // The 'forceRefetch' function is added here to satisfy the hook's expected return type,
  // making it compatible with other data-fetching hooks that support manual refetching.
  // This avoids having to create a separate refetch mechanism for session data.
  const forceRefetch = () => {
    // This is a no-op because onAuthStateChanged handles session updates automatically.
  };
  
  return { ...context, forceRefetch };
};

    
