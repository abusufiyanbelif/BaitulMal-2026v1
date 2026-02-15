
'use client';
    
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, Auth } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase/provider'; // Use the provider's hook

/**
 * A hook to get the current Firebase user.
 * It provides a real-time snapshot of the user's authentication state.
 *
 * @returns { user: User | null; isLoading: boolean; } An object containing the user and loading state.
 */
export function useUser() {
  const auth = useFirebaseAuth(); // Get the auth instance from the provider
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  return { user, isLoading };
}
