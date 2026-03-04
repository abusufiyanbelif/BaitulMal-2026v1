'use client';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Copy, Smartphone, QrCode, Mail, Phone, Download, Globe, Users, Info, ShieldCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useBranding } from '@/hooks/use-branding';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';

export function AppFooter() {
  const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  const { infoSettings, isLoading: isInfoSettingsLoading } = useInfoSettings();
  const { toast } = useToast();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const pathname = usePathname();

  const isLoading = isPaymentLoading || isBrandingLoading || isInfoSettingsLoading;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${type} copied!`, description: text, duration: 3000 });
    });
  };
  
  const validQrCodeUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  
  const handleDownloadQr = async () => {
    if (!validQrCodeUrl) return;
    toast({ title: "Preparing download...", description: "Your QR code image is being prepared." });
    try {
        const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`);
        if (!response.ok) throw new Error('Failed to fetch QR code');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'payment-qr-code.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({ title: "QR code downloading...", description: "Your QR code image has started downloading.", variant: "success" });
    } catch (error: any) {
        toast({ title: "Download failed", description: "Could not download the QR code image.", variant: "destructive" });
    }
  };
  
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
                            style={{ maxHeight: '2.5rem', width: 'auto' }}
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
                    {isLoading ? <Skeleton className="h-4 w-full" /> : paymentSettings?.address && (
                        <div className="flex items-start justify-center md:justify-start gap-2">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <p>{paymentSettings.address}</p>
                        </div>
                    )}
                    {isLoading ? <Skeleton className="h-4 w-3/4" /> : paymentSettings?.regNo && <p>Reg. no.: {paymentSettings.regNo}</p>}
                    {isLoading ? <Skeleton className="h-4 w-1/2" /> : paymentSettings?.pan && <p>PAN: {paymentSettings.pan}</p>}
                </div>

                <Separator className="bg-primary/10 w-full"/>

                <div className="space-y-2 w-full">
                    {isLoading ? <Skeleton className="h-4 w-4/5" /> : paymentSettings?.contactEmail && (
                        <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-normal text-primary hover:text-primary/80 transition-colors">
                            <Mail className="h-4 w-4" />
                            <span className="break-all">{paymentSettings.contactEmail}</span>
                        </div>
                    )}
                    {isLoading ? <Skeleton className="h-4 w-3/5" /> : paymentSettings?.contactPhone && (
                        <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-normal text-primary hover:text-primary/80 transition-colors">
                            <Phone className="h-4 w-4" />
                            <span>{paymentSettings.contactPhone}</span>
                        </div>
                    )}
                    {isLoading ? <Skeleton className="h-4 w-4/5" /> : paymentSettings?.website && (
                        <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-normal text-primary hover:text-primary/80 transition-colors">
                            <Globe className="h-4 w-4" />
                            <a href={paymentSettings.website} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">{paymentSettings.website}</a>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-opacity">
                        <Users className="h-3 w-3" />
                        <Link href="/info/organization" className="hover:underline tracking-tight">About organization</Link>
                    </div>
                    {!isLoading && infoSettings?.isDonationInfoPublic && (
                        <div className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-opacity">
                            <Info className="h-3 w-3" />
                            <Link href="/info/donation-info" className="hover:underline tracking-tight">Donation types</Link>
                        </div>
                    )}
                    {!isLoading && infoSettings?.isGuidingPrinciplesPublic && (
                        <div className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-opacity">
                            <ShieldCheck className="h-3 w-3" />
                            <Link href="/info/guiding-principles" className="hover:underline tracking-tight">Guiding principles</Link>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <h3 className="font-headline font-bold text-primary uppercase tracking-wider text-sm">For donations</h3>
                <div className="space-y-3 w-full max-w-[280px]">
                    {isLoading ? <Skeleton className="h-10 w-full" /> : paymentSettings?.upiId && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                                <QrCode className="h-4 w-4 text-primary shrink-0" />
                                <a href={`upi://pay?pa=${paymentSettings.upiId}&pn=${encodeURIComponent(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur')}&cu=INR`} className="font-mono text-sm text-primary truncate hover:underline">
                                    {paymentSettings.upiId}
                                </a>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/20 shrink-0" onClick={() => copyToClipboard(paymentSettings!.upiId!, 'UPI ID')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    {isLoading ? <Skeleton className="h-10 w-full" /> : paymentSettings?.paymentMobileNumber && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                                <Smartphone className="h-4 w-4 text-primary shrink-0" />
                                <a href={`tel:${paymentSettings.paymentMobileNumber}`} className="font-mono text-sm text-primary truncate hover:underline">
                                    {paymentSettings.paymentMobileNumber}
                                </a>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/20 shrink-0" onClick={() => copyToClipboard(paymentSettings!.paymentMobileNumber!, 'Phone number')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-center md:justify-end animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {isLoading ? (
                <Skeleton className="h-32 w-32 rounded-xl" />
            ) : (
                validQrCodeUrl && (
                    <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="relative group cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl p-1 bg-white border-2 border-primary/20">
                                <Image
                                    src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`}
                                    alt="Payment QR"
                                    width={paymentSettings?.qrWidth || 120}
                                    height={paymentSettings?.qrHeight || 120}
                                    className="object-contain"
                                />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md font-body">
                            <DialogHeader>
                                <DialogTitle className="font-headline font-bold text-primary">Scan to donate</DialogTitle>
                                <DialogDescription className="font-normal text-primary/70">
                                    Use any UPI application to scan this code and contribute to our active initiatives.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center justify-center p-6 bg-secondary/30 rounded-xl border border-primary/10">
                                <div className="relative bg-white p-4 rounded-lg shadow-sm border-4 border-primary">
                                    <Image src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`} alt="UPI QR code" className="w-full max-w-[240px] h-auto" width={300} height={300} unoptimized />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleDownloadQr} className="w-full font-bold transition-all active:scale-95">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download QR code
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )
            )}
            </div>
        </div>
        
        <Separator className="my-6 bg-primary/10" />
        
        <div className="text-center font-body animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <p className="text-[11px] font-normal text-primary opacity-80">
                {paymentSettings?.copyright || "© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved."}
            </p>
        </div>
      </div>
    </footer>
  );
}