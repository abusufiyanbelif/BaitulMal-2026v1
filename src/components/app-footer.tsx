
'use client';
import { usePathname } from 'next/navigation';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { Separator } from '@/components/ui/separator';

/**
 * High-fidelity institutional footer for BMS3 A theme.
 * Uses background #F0FDF4, border-top #E2EEE7, and centered #355E3B text.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <footer className="bg-[#F0FDF4] border-t border-[#E2EEE7] py-6 px-4 text-center">
      <div className="container mx-auto space-y-2">
        <p className="text-sm font-bold text-[#355E3B] tracking-tight">
          {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#355E3B] opacity-60">
          {paymentSettings?.copyright || `© ${new Date().getFullYear()} All Rights Reserved.`}
        </p>
      </div>
    </footer>
  );
}
