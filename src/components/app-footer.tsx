'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Mail, Phone, MapPin, Info, ShieldCheck, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useBranding } from '@/hooks/use-branding';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';

export function AppFooter() {
  const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  const { infoSettings, isLoading: isInfoSettingsLoading } = useInfoSettings();
  const { toast } = useToast();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const pathname = usePathname();

  const isLoading = isPaymentLoading || isBrandingLoading || isInfoSettingsLoading;

  const validQrCodeUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  
  const hasPaymentInfo = paymentSettings?.upiId || paymentSettings?.paymentMobileNumber || validQrCodeUrl;
  const hasContactInfo = paymentSettings?.contactEmail || paymentSettings?.contactPhone || paymentSettings?.website;
  const hasOrgInfo = paymentSettings?.regNo || paymentSettings?.pan || paymentSettings?.address;
  const hasCopyright = paymentSettings?.copyright;

  if (pathname === '/login' || (!isLoading && !hasPaymentInfo && !hasContactInfo && !hasOrgInfo && !hasCopyright)) {
    return null;
  }

  return (
    <footer className="bg-card border-t mt-auto p-6 text-card-foreground font-body w-full overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-3 animate-fade-in-up">
                <div className="flex items-center gap-3">
                {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
                    validLogoUrl && (
                        <Image
                            src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                            alt={`${brandingSettings?.name || 'Organization'} logo`}
                            width={60}
                            height={32}
                            className="object-contain drop-shadow-sm"
                            style={{ maxHeight: '2rem', width: 'auto' }}
                        />
                    )
                )}
                {isLoading ? <Skeleton className="h-6 w-48" /> : (
                    <h3 className="font-headline font-bold text-lg text-primary tracking-tight">
                        {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
                    </h3>
                )}
                </div>
                
                <div className="space-y-1 text-[11px] text-muted-foreground font-normal">
                    {paymentSettings?.address && (
                        <div className="flex items-start justify-center md:justify-start gap-2">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{paymentSettings.address}</span>
                        </div>
                    )}
                    {paymentSettings?.regNo && (
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Reg. no.: {paymentSettings.regNo}</span>
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
            </div>
        </div>

        <Separator className="my-8 opacity-10 bg-primary" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-muted-foreground font-normal">
            <p>{paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha'}. All rights reserved.`}</p>
            <p className="font-mono opacity-50 truncate max-w-xs">{typeof window !== 'undefined' ? window.location.origin : ''}</p>
        </div>
      </div>

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
    </footer>
  );
}