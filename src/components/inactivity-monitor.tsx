
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/firebase/provider';
import { signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Default timeout: 30 minutes
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

/**
 * Inactivity Monitor - Automatically signs out users after a period of no interaction.
 * Protects administrative data in shared environments.
 */
export function InactivityMonitor() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    if (auth.currentUser) {
      try {
        await signOut(auth);
        toast({
          title: "Session Expired",
          description: "You have been signed out due to inactivity to protect institutional data.",
          variant: "info",
        });
        router.push('/login');
      } catch (error) {
        console.error("Auto-logout failed:", error);
      }
    }
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Only monitor if we're authenticated and not already on a login page
    if (auth.currentUser && pathname !== '/login' && pathname !== '/portal-login') {
      timerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    // Events that indicate user activity
    const events = [
      'mousedown', 
      'mousemove', 
      'keypress', 
      'scroll', 
      'touchstart',
      'click'
    ];

    const onActivity = () => {
      resetTimer();
    };

    if (auth.currentUser) {
      events.forEach(name => window.addEventListener(name, onActivity));
      resetTimer();
    }

    return () => {
      events.forEach(name => window.removeEventListener(name, onActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [auth.currentUser, pathname]);

  return null;
}
