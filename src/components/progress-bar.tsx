'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ showSpinner: false });
  }, []);

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Find the closest anchor tag
      const anchor = target.closest('a');

      if (anchor && anchor.href) {
        const targetUrl = new URL(anchor.href);
        const currentUrl = new URL(location.href);
        
        // Check if it's an internal navigation, not a hash link, and not a link to open in a new tab
        if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname && anchor.target !== '_blank') {
          NProgress.start();
        }
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
