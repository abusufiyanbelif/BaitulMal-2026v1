'use client';

import { useState } from 'react';
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
  HeartHandshake,
  Download,
  Maximize2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Institutional Footer - Fully theme-reactive.
 * Includes interactive QR code maximization and download capabilities.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  const handleDownloadQr = async () => {
    if (!validQrUrl) return;
    try {
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `institutional-qr-${paymentSettings?.upiId || 'payment'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("QR download failed:", error);
    }
  };

  return (
    <footer className="bg-secondary/50 border-t border-border py-12 px-4 font-normal text-primary transition-colors duration-500">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
          
          {/* Column 1: Branding & Identity */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div className="relative w-12 h-12 bg-white rounded-xl p-1 border border-border shadow-sm">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Institutional Logo"
                    fill
                    className="object-contain p-1"
                  />
                </div>
              )}
              <span className="text-2xl font-bold tracking-tighter text-primary">
                {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
              </span>
            </Link>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              {paymentSettings?.address && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/40" />
                  {paymentSettings.address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                {paymentSettings?.contactPhone && (
                  <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-2 hover:text-primary transition-colors font-bold">
                    <Phone className="h-4 w-4 opacity-60" /> {paymentSettings.contactPhone}
                  </a>
                )}
                {paymentSettings?.contactEmail && (
                  <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors font-bold">
                    <Mail className="h-4 w-4 opacity-60" /> {paymentSettings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="space-y-6 md:pl-10">
            <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase opacity-40">
              Institutional Hub
            </h3>
            <nav className="flex flex-col gap-4">
              <Link href="/info/organization" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-bold">
                <Users className="h-4 w-4 opacity-30" />
                About Our Organization
              </Link>
              <Link href="/info/donation-info" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-bold">
                <HeartHandshake className="h-4 w-4 opacity-30" />
                Donation Types Explained
              </Link>
            </nav>
          </div>

          {/* Column 3: Secure Contributions */}
          <div className="flex flex-col md:items-end gap-6">
            <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase opacity-40">
              Secure Contribution Channel
            </h3>
            <div className="flex items-center gap-6 bg-white/60 p-4 rounded-2xl border border-primary/10 shadow-lg transition-all duration-300">
              <div className="text-right space-y-1.5">
                <p className="text-sm text-primary font-bold font-mono tracking-tighter">
                  {paymentSettings?.upiId || 'Not Configured'}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                  Scan With Any UPI App
                </p>
              </div>
              {validQrUrl ? (
                <div 
                  onClick={() => setIsQrDialogOpen(true)}
                  className="relative w-32 h-32 bg-white p-2 rounded-xl border-4 border-primary shadow-2xl cursor-pointer group transition-all hover:scale-110 active:scale-95"
                >
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                    alt="Payment QR"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                    <Maximize2 className="text-primary h-8 w-8 drop-shadow-md" />
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 bg-white/50 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/10">
                  <QrCode className="h-12 w-12" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] text-muted-foreground opacity-50 tracking-widest uppercase font-bold">
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

      {/* QR Maximization Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md border-primary/10 overflow-hidden rounded-[20px] p-0 animate-fade-in-zoom">
          <DialogHeader className="bg-primary/5 px-6 py-4 border-b">
            <DialogTitle className="font-bold text-primary tracking-tight">Institutional Payment QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-white">
            <div className="relative w-64 h-64 bg-white p-4 rounded-2xl border-4 border-primary shadow-2xl transition-transform hover:scale-[1.02]">
              {validQrUrl && (
                <Image
                  src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                  alt="Payment QR Maximized"
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="font-mono text-lg font-bold text-primary tracking-tighter">{paymentSettings?.upiId}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed max-w-[200px] mx-auto">
                Scan With Any UPI-Enabled Application To Make A Secure Contribution.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-center px-6 py-4 bg-primary/[0.02] border-t">
            <Button onClick={handleDownloadQr} className="font-bold shadow-lg active:scale-95 transition-all w-full sm:w-auto px-8">
              <Download className="mr-2 h-4 w-4" /> Download QR Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
