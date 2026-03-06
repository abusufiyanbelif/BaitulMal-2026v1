'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  ShieldCheck, 
  QrCode, 
  Info, 
  HeartHandshake, 
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Compact Institutional Footer for BMS3 A.
 * No bold text, Title Case labels, and streamlined layout.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  return (
    <footer className="bg-[#F0FDF4] border-t border-[#E2EEE7] py-8 px-4 font-normal text-primary">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Column 1: Branding & Identity */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div className="relative w-10 h-10 bg-white rounded-lg p-1 border border-[#E2EEE7]">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Logo"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
              )}
              <span className="text-lg tracking-tight text-[#14532D]">
                {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
              </span>
            </Link>
            <div className="space-y-2 text-xs text-[#355E3B]/80 leading-relaxed">
              {paymentSettings?.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#1FA34A]" />
                  {paymentSettings.address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {paymentSettings?.contactPhone && (
                  <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-1.5 hover:text-[#1FA34A] transition-colors">
                    <Phone className="h-3 w-3" /> {paymentSettings.contactPhone}
                  </a>
                )}
                {paymentSettings?.contactEmail && (
                  <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-1.5 hover:text-[#1FA34A] transition-colors">
                    <Mail className="h-3 w-3" /> {paymentSettings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="space-y-4 md:pl-8">
            <h3 className="text-[10px] font-normal tracking-widest text-[#14532D] uppercase opacity-60">
              Institutional Navigation
            </h3>
            <nav className="flex flex-col gap-2.5">
              <Link href="/info/organization" className="text-sm text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center gap-2">
                <Users className="h-3.5 w-3.5 opacity-40" />
                About Our Organization
              </Link>
              <Link href="/info/donation-info" className="text-sm text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center gap-2">
                <HeartHandshake className="h-3.5 w-3.5 opacity-40" />
                Donation Types Explained
              </Link>
              <Link href="/info/guiding-principles" className="text-sm text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 opacity-40" />
                Our Guiding Principles
              </Link>
            </nav>
          </div>

          {/* Column 3: Secure Payments */}
          <div className="flex flex-col md:items-end gap-4">
            <h3 className="text-[10px] font-normal tracking-widest text-[#14532D] uppercase opacity-60">
              Secure Contributions
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-right space-y-1">
                <p className="text-xs text-[#14532D] font-mono tracking-tight">
                  {paymentSettings?.upiId || 'No UPI ID Configured'}
                </p>
                <p className="text-[9px] text-[#355E3B]/60 tracking-tight">
                  Scan With Any UPI App
                </p>
              </div>
              {validQrUrl ? (
                <div className="relative w-16 h-16 bg-white p-1 rounded-lg border border-[#E2EEE7] shadow-sm">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                    alt="UPI QR"
                    fill
                    className="object-contain p-0.5"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-white/50 rounded-lg border border-dashed border-[#E2EEE7] flex items-center justify-center text-[#355E3B]/20">
                  <QrCode className="h-6 w-6" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E2EEE7] flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-[#355E3B]/50 tracking-wide">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {paymentSettings?.regNo && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-[#1FA34A]/40" />
                Registry No: {paymentSettings.regNo}
              </span>
            )}
            {paymentSettings?.pan && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-[#1FA34A]/40" />
                Pan: {paymentSettings.pan}
              </span>
            )}
          </div>
          <p>
            {paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}. All Rights Reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
}
