'use client';
import { usePathname } from 'next/navigation';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { Mail, Phone, Globe, MapPin, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

/**
 * Centered institutional footer for BMS3 A theme.
 * Uses background #F0FDF4, border-top #E2EEE7, and centered #355E3B text.
 * Restores full organizational data including address, contacts, and registration details.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const hasContactInfo = paymentSettings?.contactPhone || paymentSettings?.contactEmail || paymentSettings?.website;
  const hasRegInfo = paymentSettings?.regNo || paymentSettings?.pan;

  return (
    <footer className="bg-[#F0FDF4] border-t border-[#E2EEE7] py-12 px-4 text-center">
      <div className="container mx-auto max-w-4xl space-y-8">
        {/* Organization Branding & Address */}
        <div className="space-y-2">
          <p className="text-xl font-bold text-[#14532D] tracking-tight">
            {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
          </p>
          {paymentSettings?.address && (
            <p className="text-sm font-normal text-[#355E3B]/80 flex items-center justify-center gap-2 max-w-lg mx-auto leading-relaxed">
              <MapPin className="h-4 w-4 shrink-0 text-[#1FA34A]" />
              {paymentSettings.address}
            </p>
          )}
        </div>

        {/* Contact Channels */}
        {hasContactInfo && (
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-bold text-[#14532D]">
            {paymentSettings?.contactPhone && (
              <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-2 hover:text-[#1FA34A] transition-colors group">
                <div className="p-1.5 rounded-full bg-white shadow-sm border border-[#E2EEE7] group-hover:border-[#1FA34A]">
                    <Phone className="h-3.5 w-3.5 text-[#1FA34A]" />
                </div>
                {paymentSettings.contactPhone}
              </a>
            )}
            {paymentSettings?.contactEmail && (
              <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-2 hover:text-[#1FA34A] transition-colors group">
                <div className="p-1.5 rounded-full bg-white shadow-sm border border-[#E2EEE7] group-hover:border-[#1FA34A]">
                    <Mail className="h-3.5 w-3.5 text-[#1FA34A]" />
                </div>
                {paymentSettings.contactEmail}
              </a>
            )}
            {paymentSettings?.website && (
              <a href={paymentSettings.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#1FA34A] transition-colors group">
                <div className="p-1.5 rounded-full bg-white shadow-sm border border-[#E2EEE7] group-hover:border-[#1FA34A]">
                    <Globe className="h-3.5 w-3.5 text-[#1FA34A]" />
                </div>
                {paymentSettings.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}

        {/* Verifiable Credentials */}
        {hasRegInfo && (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-[#355E3B]/60 uppercase tracking-widest bg-white/40 py-2 px-6 rounded-full border border-[#E2EEE7] w-fit mx-auto shadow-sm">
            {paymentSettings?.regNo && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-[#1FA34A]/60" />
                Reg. No: {paymentSettings.regNo}
              </span>
            )}
            {paymentSettings?.pan && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-[#1FA34A]/60" />
                PAN: {paymentSettings.pan}
              </span>
            )}
          </div>
        )}

        <div className="pt-4 space-y-4">
            <Separator className="bg-[#E2EEE7] max-w-[120px] mx-auto opacity-50" />
            
            {/* Copyright Statement */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#355E3B] opacity-40">
              {paymentSettings?.copyright || `© ${new Date().getFullYear()} Baitulmal Samajik Sanstha Solapur. All Rights Reserved.`}
            </p>
        </div>
      </div>
    </footer>
  );
}
