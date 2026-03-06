'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  QrCode, 
  Users,
  HeartHandshake
} from 'lucide-react';

/**
 * Streamlined Institutional Footer - Fully theme-reactive.
 * Organization name is bolded for prominence. All other elements use standard weights.
 * Responsive semantic backgrounds ensure compatibility with all 14 themes.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  return (
    <footer className="bg-secondary/50 border-t border-border py-6 px-4 font-normal text-primary transition-colors duration-300">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Column 1: Branding & Identity */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div className="relative w-8 h-8 bg-white rounded-lg p-1 border border-border">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Institutional Logo"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
              )}
              <span className="text-lg font-bold tracking-tight text-primary">
                {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
              </span>
            </Link>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              {paymentSettings?.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                  {paymentSettings.address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {paymentSettings?.contactPhone && (
                  <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Phone className="h-3 w-3" /> {paymentSettings.contactPhone}
                  </a>
                )}
                {paymentSettings?.contactEmail && (
                  <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Mail className="h-3 w-3" /> {paymentSettings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="space-y-4 md:pl-8">
            <h3 className="text-[10px] font-normal tracking-widest text-primary uppercase opacity-60">
              Institutional Navigation
            </h3>
            <nav className="flex flex-col gap-2.5">
              <Link href="/info/organization" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Users className="h-3.5 w-3.5 opacity-40" />
                About Our Organization
              </Link>
              <Link href="/info/donation-info" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <HeartHandshake className="h-3.5 w-3.5 opacity-40" />
                Donation Types Explained
              </Link>
            </nav>
          </div>

          {/* Column 3: Secure Contributions */}
          <div className="flex flex-col md:items-end gap-4">
            <h3 className="text-[10px] font-normal tracking-widest text-primary uppercase opacity-60">
              Secure Contributions
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-right space-y-1">
                <p className="text-xs text-primary font-mono tracking-tight">
                  {paymentSettings?.upiId || 'No UPI ID Configured'}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-tight">
                  Scan With Any UPI App
                </p>
              </div>
              {validQrUrl ? (
                <div className="relative w-12 h-12 bg-white p-1 rounded-lg border border-border shadow-sm">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                    alt="UPI QR"
                    fill
                    className="object-contain p-0.5"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white/50 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground/20">
                  <QrCode className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-muted-foreground opacity-60 tracking-wide">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {paymentSettings?.regNo && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary/40" />
                Registry No: {paymentSettings.regNo}
              </span>
            )}
            {paymentSettings?.pan && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary/40" />
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
