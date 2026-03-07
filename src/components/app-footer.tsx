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
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  return (
    <footer className="bg-secondary/50 border-t border-border py-8 px-4 font-normal text-primary transition-colors duration-500">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
          
          {/* Column 1: Branding & Identity */}
          <div className="space-y-5">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div className="relative w-10 h-10 bg-white rounded-xl p-1 border border-border shadow-sm">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Institutional Logo"
                    fill
                    className="object-contain p-1"
                  />
                </div>
              )}
              <span className="text-xl font-bold tracking-tighter text-primary">
                {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
              </span>
            </Link>
            <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              {paymentSettings?.address && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/40" />
                  {paymentSettings.address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {paymentSettings?.contactPhone && (
                  <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-2 hover:text-primary transition-colors font-medium">
                    <Phone className="h-3.5 w-3.5 opacity-60" /> {paymentSettings.contactPhone}
                  </a>
                )}
                {paymentSettings?.contactEmail && (
                  <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors font-medium">
                    <Mail className="h-3.5 w-3.5 opacity-60" /> {paymentSettings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="space-y-5 md:pl-10">
            <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase opacity-40">
              Institutional Hub
            </h3>
            <nav className="flex flex-col gap-3.5">
              <Link href="/info/organization" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal">
                <Users className="h-4 w-4 opacity-30" />
                About Our Organization
              </Link>
              <Link href="/info/donation-info" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal">
                <HeartHandshake className="h-4 w-4 opacity-30" />
                Donation Types Explained
              </Link>
            </nav>
          </div>

          {/* Column 3: Secure Contributions */}
          <div className="flex flex-col md:items-end gap-5">
            <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase opacity-40">
              Secure Channel
            </h3>
            <div className="flex items-center gap-5 bg-white/40 p-3 rounded-2xl border border-primary/5 shadow-inner">
              <div className="text-right space-y-1">
                <p className="text-xs text-primary font-bold font-mono tracking-tighter">
                  {paymentSettings?.upiId || 'Not Configured'}
                </p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                  Scan With UPI
                </p>
              </div>
              {validQrUrl ? (
                <div className="relative w-14 h-14 bg-white p-1 rounded-xl border border-border shadow-md">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                    alt="UPI QR"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-14 h-14 bg-white/50 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground/10">
                  <QrCode className="h-6 w-6" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] text-muted-foreground opacity-50 tracking-widest uppercase font-bold">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {paymentSettings?.regNo && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/30" />
                Reg: {paymentSettings.regNo}
              </span>
            )}
            {paymentSettings?.pan && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/30" />
                Pan: {paymentSettings.pan}
              </span>
            )}
          </div>
          <p className="text-center sm:text-right lowercase first-letter:uppercase">
            {paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}. All Rights Reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
}