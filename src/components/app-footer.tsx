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
  ExternalLink,
  Users
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * High-Fidelity Institutional Footer for BMS3 A Theme.
 * Provides full transparency, navigation, and secure payment details.
 * Uses centered layout with #F0FDF4 background and #355E3B text.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  return (
    <footer className="bg-[#F0FDF4] border-t border-[#E2EEE7] pt-16 pb-8 px-4 text-center">
      <div className="container mx-auto max-w-6xl space-y-12">
        
        {/* Top Section: Institutional Branding */}
        <div className="flex flex-col items-center gap-6 animate-fade-in-up">
          {validLogoUrl && (
            <div className="relative w-20 h-20 bg-white/50 rounded-2xl p-2 border border-[#E2EEE7] shadow-sm">
              <Image
                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                alt="Organization Logo"
                fill
                className="object-contain p-1"
              />
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-[#14532D] tracking-tighter">
              {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
            </h2>
            {paymentSettings?.address && (
              <p className="text-sm font-normal text-[#355E3B]/80 flex items-center justify-center gap-2 max-w-2xl mx-auto leading-relaxed">
                <MapPin className="h-4 w-4 shrink-0 text-[#1FA34A]" />
                {paymentSettings.address}
              </p>
            )}
          </div>
        </div>

        {/* Middle Section: Quick Links & Digital Payments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          
          {/* Column 1: Institutional Navigation */}
          <div className="space-y-6 text-center md:text-left">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#14532D] flex items-center justify-center md:justify-start gap-2">
              <Info className="h-3.5 w-3.5" /> Institutional Navigation
            </h3>
            <nav className="flex flex-col gap-3">
              <Link href="/info/organization" className="text-sm font-bold text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center justify-center md:justify-start gap-2 group">
                <Users className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                About Our Organization
              </Link>
              <Link href="/info/donation-info" className="text-sm font-bold text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center justify-center md:justify-start gap-2 group">
                <HeartHandshake className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                Donation Types Explained
              </Link>
              <Link href="/info/guiding-principles" className="text-sm font-bold text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center justify-center md:justify-start gap-2 group">
                <ShieldCheck className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                Our Guiding Principles
              </Link>
              <Link href="/campaign-public" className="text-sm font-bold text-[#355E3B] hover:text-[#1FA34A] transition-colors flex items-center justify-center md:justify-start gap-2 group">
                <ExternalLink className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                Explore Active Campaigns
              </Link>
            </nav>
          </div>

          {/* Column 2: Digital Payment Integration */}
          <div className="flex flex-col items-center md:items-end gap-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#14532D] flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5" /> Secure Contributions
            </h3>
            <div className="flex flex-col items-center md:items-end gap-4">
              {validQrUrl ? (
                <div className="relative w-32 h-32 bg-white p-2 rounded-xl shadow-lg border-2 border-[#1FA34A]/20 transition-transform hover:scale-105">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                    alt="Institutional UPI QR"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-32 h-32 bg-white/50 rounded-xl border border-dashed border-[#E2EEE7] flex items-center justify-center text-[#355E3B]/20">
                  <QrCode className="h-12 w-12" />
                </div>
              )}
              <div className="text-center md:text-right space-y-1">
                <p className="font-mono text-sm font-bold text-[#14532D] tracking-tight">
                  {paymentSettings?.upiId || 'No UPI ID Configured'}
                </p>
                <p className="text-[10px] font-bold uppercase text-[#355E3B]/60 tracking-widest">
                  Scan With Any UPI App
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-[#E2EEE7] max-w-4xl mx-auto opacity-50" />

        {/* Contact & Support Registry */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-bold text-[#14532D] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {paymentSettings?.contactPhone && (
            <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-2 hover:text-[#1FA34A] transition-all hover:-translate-y-0.5">
              <div className="p-2 rounded-full bg-white shadow-sm border border-[#E2EEE7]">
                <Phone className="h-4 w-4 text-[#1FA34A]" />
              </div>
              {paymentSettings.contactPhone}
            </a>
          )}
          {paymentSettings?.contactEmail && (
            <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-2 hover:text-[#1FA34A] transition-all hover:-translate-y-0.5">
              <div className="p-2 rounded-full bg-white shadow-sm border border-[#E2EEE7]">
                <Mail className="h-4 w-4 text-[#1FA34A]" />
              </div>
              {paymentSettings.contactEmail}
            </a>
          )}
          {paymentSettings?.website && (
            <a href={paymentSettings.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#1FA34A] transition-all hover:-translate-y-0.5">
              <div className="p-2 rounded-full bg-white shadow-sm border border-[#E2EEE7]">
                <Globe className="h-4 w-4 text-[#1FA34A]" />
              </div>
              Official Portal
            </a>
          )}
        </div>

        {/* Footer Base: Verification & Legal */}
        <div className="space-y-6 pt-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          {(paymentSettings?.regNo || paymentSettings?.pan) && (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-[#355E3B]/60 uppercase tracking-widest bg-white/40 py-2.5 px-8 rounded-full border border-[#E2EEE7] w-fit mx-auto shadow-sm backdrop-blur-sm">
              {paymentSettings?.regNo && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1FA34A]/60" />
                  Registry No: {paymentSettings.regNo}
                </span>
              )}
              {paymentSettings?.pan && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1FA34A]/60" />
                  PAN: {paymentSettings.pan}
                </span>
              )}
            </div>
          )}
          
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#355E3B]/40">
            {paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}. All Rights Reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
}