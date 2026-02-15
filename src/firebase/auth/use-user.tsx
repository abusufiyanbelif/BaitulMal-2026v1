'use client';
import { useFirebase } from '@/firebase/provider';

export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
