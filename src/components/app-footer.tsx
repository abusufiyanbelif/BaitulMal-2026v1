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
 * Transition-colors duration ensures smooth palette changes.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  return (
<<<<<<< HEAD
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
=======
<<<<<<< Updated upstream
    <footer className="bg-card border-t mt-auto p-4 md:p-6 text-card-foreground">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Org & Contact Info */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left gap-3 transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-bottom" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
          {isLoading ? <Skeleton className="h-7 w-2/3" /> : <h3 className="font-semibold text-lg">{brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}</h3>}
          {isLoading ? <Skeleton className="h-4 w-full" /> : paymentSettings?.address && <p className="text-sm text-muted-foreground">{paymentSettings.address}</p>}
           <div className="text-sm text-muted-foreground space-y-1">
                {isLoading ? <Skeleton className="h-4 w-3/4" /> : paymentSettings?.regNo && <p>Reg. No.: {paymentSettings.regNo}</p>}
                {isLoading ? <Skeleton className="h-4 w-1/2" /> : paymentSettings?.pan && <p>PAN: {paymentSettings.pan}</p>}
>>>>>>> ec143c0fbd59660a5bff17afcf13151048a4b79c
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
<<<<<<< HEAD
          </div>
=======
          )}
          {isLoading ? <Skeleton className="h-5 w-3/5" /> : paymentSettings?.contactPhone && (
            <div className="flex items-center gap-2 text-sm transition-all hover:text-primary">
              <Phone className="h-4 w-4" />
              <span>{paymentSettings.contactPhone}</span>
=======
    <footer className="bg-card border-t mt-auto p-6 text-card-foreground font-body w-full overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-3 animate-fade-in-up">
                <div className="flex items-center gap-3">
                {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
                    validLogoUrl && (
                        <div className="relative h-8 w-auto min-w-[40px]">
                            <Image
                                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                                alt={`${brandingSettings?.name || 'Organization'} logo`}
                                width={60}
                                height={32}
                                className="object-contain drop-shadow-sm h-full w-auto"
                            />
                        </div>
                    )
                )}
                {isLoading ? <Skeleton className="h-6 w-48" /> : (
                    <h3 className="font-headline font-bold text-lg text-primary tracking-tight text-left">
                        {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
                    </h3>
                )}
                </div>
                
                <div className="space-y-1 text-[11px] text-muted-foreground font-normal">
                    {paymentSettings?.address && (
                        <div className="flex items-start justify-center md:justify-start gap-2">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="text-left">{paymentSettings.address}</span>
                        </div>
                    )}
                    {paymentSettings?.regNo && (
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Registration no: {paymentSettings.regNo}</span>
                        </div>
                    )}
                    {paymentSettings?.pan && (
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <Info className="h-3 w-3" />
                            <span>PAN: {paymentSettings.pan}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <h4 className="text-xs font-bold text-primary tracking-widest uppercase">Quick links</h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-bold">
                    <Link href="/" className="hover:text-primary transition-colors">Home</Link>
                    <Link href="/campaign-public" className="hover:text-primary transition-colors">Campaigns</Link>
                    <Link href="/leads-public" className="hover:text-primary transition-colors">Leads</Link>
                    <Link href="/info/organization" className="hover:text-primary transition-colors">About organization</Link>
                    {infoSettings?.isDonationInfoPublic && (
                        <Link href="/info/donation-info" className="hover:text-primary transition-colors">Donation info</Link>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <h4 className="text-xs font-bold text-primary tracking-widest uppercase">Contact & help</h4>
                <div className="space-y-3 w-full">
                    {paymentSettings?.contactEmail && (
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Mail className="h-3.5 w-3.5" />
                            </div>
                            <a href={`mailto:${paymentSettings.contactEmail}`} className="text-[11px] font-normal hover:underline">{paymentSettings.contactEmail}</a>
                        </div>
                    )}
                    {paymentSettings?.contactPhone && (
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Phone className="h-3.5 w-3.5" />
                            </div>
                            <a href={`tel:${paymentSettings.contactPhone}`} className="text-[11px] font-normal hover:underline">{paymentSettings.contactPhone}</a>
                        </div>
                    )}
                    {validQrCodeUrl && (
                        <Button variant="outline" size="sm" onClick={() => setIsQrDialogOpen(true)} className="h-8 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 transition-transform active:scale-95">
                            <QrCode className="mr-2 h-3.5 w-3.5" />
                            View payment QR
                        </Button>
                    )}
                </div>
>>>>>>> Stashed changes
            </div>
          )}
           {isLoading ? <Skeleton className="h-5 w-4/5" /> : paymentSettings?.website && (
            <div className="flex items-center gap-2 text-sm transition-all hover:text-primary">
              <Globe className="h-4 w-4" />
              <a href={paymentSettings.website} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">{paymentSettings.website}</a>
            </div>
          )}
>>>>>>> ec143c0fbd59660a5bff17afcf13151048a4b79c
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
          <p className="text-center sm:text-right">
            {paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}. All Rights Reserved.`}
          </p>
        </div>
      </div>
<<<<<<< Updated upstream
=======

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="font-bold text-primary">Secure donation QR</DialogTitle>
                <DialogDescription className="font-normal text-primary/70">Scan with any UPI app to contribute.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 bg-secondary/20 rounded-xl border border-primary/10">
                {validQrCodeUrl && (
                    <div className="relative w-64 h-64 bg-white p-4 rounded-lg shadow-lg border-2 border-primary">
                        <Image src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`} alt="Payment QR" fill className="object-contain" unoptimized />
                    </div>
                )}
                <div className="mt-6 text-center space-y-1">
                    <p className="text-lg font-mono font-bold text-primary">{paymentSettings?.upiId}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baitulmal Samajik Sanstha</p>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={() => setIsQrDialogOpen(false)} className="font-bold">Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
>>>>>>> Stashed changes
    </footer>
  );
}
