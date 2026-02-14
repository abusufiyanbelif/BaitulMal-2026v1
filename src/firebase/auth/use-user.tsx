
'use client';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // If the auth service isn't ready, we are still loading.
      // The hook will re-run once the auth service is available.
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  return { user, isLoading };
}
