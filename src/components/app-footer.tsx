'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Mail, Phone, MapPin, Info, ShieldCheck, QrCode, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const pathname = usePathname();

  const isLoading = isPaymentLoading || isBrandingLoading || isInfoSettingsLoading;

  const validQrCodeUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  
  if (pathname === '/login') return null;

  return (
    <footer className="bg-white border-t mt-auto p-10 text-primary font-normal w-full overflow-hidden shadow-inner">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            {/* Identity Column */}
            <div className="md:col-span-5 flex flex-col gap-6 animate-fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 bg-primary/5 rounded-xl border border-primary/10 overflow-hidden flex items-center justify-center">
                        {isLoading ? <Skeleton className="h-16 w-16 rounded-lg" /> : (
                            validLogoUrl && (
                                <Image
                                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                                    alt="Footer logo"
                                    width={80}
                                    height={80}
                                    className="object-contain p-1 h-full w-full"
                                />
                            )
                        )}
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-xl tracking-tight uppercase leading-tight">
                            {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
                        </h3>
                        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Community welfare association</p>
                    </div>
                </div>
                
                <div className="space-y-3 text-xs font-normal text-muted-foreground border-l-2 border-primary/10 pl-6 ml-10">
                    {paymentSettings?.address && (
                        <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 shrink-0 text-primary/40" />
                            <span>{paymentSettings.address}</span>
                        </div>
                    )}
                    {paymentSettings?.regNo && (
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-4 w-4 text-primary/40" />
                            <span>Registration: {paymentSettings.regNo}</span>
                        </div>
                    )}
                    {paymentSettings?.pan && (
                        <div className="flex items-center gap-3">
                            <Info className="h-4 w-4 text-primary/40" />
                            <span className="font-mono">PAN: {paymentSettings.pan}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Links Column */}
            <div className="md:col-span-3 space-y-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <h4 className="text-[10px] font-bold text-primary tracking-widest uppercase border-b border-primary/10 pb-2">Institutional</h4>
                <div className="flex flex-col gap-3 text-sm font-bold">
                    <Link href="/info/organization" className="hover:text-primary/70 transition-colors flex items-center gap-2">
                        <Building2 className="h-4 w-4 opacity-40"/> About organization
                    </Link>
                    {infoSettings?.isDonationInfoPublic && (
                        <Link href="/info/donation-info" className="hover:text-primary/70 transition-colors">Guidance & rules</Link>
                    )}
                    <Link href="/campaign-public" className="hover:text-primary/70 transition-colors">Active initiatives</Link>
                </div>
            </div>

            {/* Contact & Contribution Column */}
            <div className="md:col-span-4 space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <h4 className="text-[10px] font-bold text-primary tracking-widest uppercase border-b border-primary/10 pb-2">Contribution & help</h4>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                        {paymentSettings?.contactEmail && (
                            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-md">
                                <Mail className="h-4 w-4 text-primary/60" />
                                <a href={`mailto:${paymentSettings.contactEmail}`} className="text-xs font-normal hover:underline">{paymentSettings.contactEmail}</a>
                            </div>
                        )}
                        {paymentSettings?.contactPhone && (
                            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-md">
                                <Phone className="h-4 w-4 text-primary/60" />
                                <a href={`tel:${paymentSettings.contactPhone}`} className="text-xs font-normal hover:underline">{paymentSettings.contactPhone}</a>
                            </div>
                        )}
                    </div>
                    {validQrCodeUrl && (
                        <Button variant="outline" size="lg" onClick={() => setIsQrDialogOpen(true)} className="w-full h-12 font-bold border-primary/20 text-primary hover:bg-primary/5 shadow-sm active:scale-[0.98] transition-all">
                            <QrCode className="mr-3 h-5 w-5" />
                            Donate via QR code
                        </Button>
                    )}
                </div>
            </div>
        </div>

        <Separator className="my-10 opacity-10 bg-primary" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            <p>{paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha'}. ALL RIGHTS RESERVED.`}</p>
            <div className="flex items-center gap-4">
                <span>Secure SSL encryption</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span>Verified NGO record</span>
            </div>
        </div>
      </div>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="font-bold text-primary uppercase text-center">Secure contribution QR</DialogTitle>
                <DialogDescription className="font-normal text-center pt-2">Scan using Google Pay, PhonePe, or any UPI application to support our community goals.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-2xl border-2 border-dashed border-primary/20 mt-4">
                {validQrCodeUrl && (
                    <div className="relative w-64 h-64 bg-white p-4 rounded-xl shadow-xl border-4 border-primary">
                        <Image src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`} alt="Payment QR" fill className="object-contain" unoptimized />
                    </div>
                )}
                <div className="mt-8 text-center space-y-2">
                    <p className="text-xl font-mono font-black text-primary tracking-tighter">{paymentSettings?.upiId}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{brandingSettings?.name}</p>
                </div>
            </div>
            <DialogFooter className="sm:justify-center">
                <Button onClick={() => setIsQrDialogOpen(false)} className="font-bold px-8">Done</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}