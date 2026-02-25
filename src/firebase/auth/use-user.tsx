
'use client';
import { useFirebase, type User } from '@/firebase';

interface UseUserResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const useUser = (): UseUserResult => {
  const firebase = useFirebase();
  return { 
    user: firebase?.user || null, 
    isUserLoading: firebase?.isUserLoading ?? true, 
    userError: firebase?.userError || null 
  };
};
