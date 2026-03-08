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
  Landmark,
  CreditCard,
  Copy,
  ExternalLink
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false);

  if (pathname === '/login') return null;

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} Copied`,
      description: "The information has been copied to your clipboard.",
      variant: "success",
    });
  };

  const handleDownloadQr = async () => {
    if (!validQrUrl) return;
    try {
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Organization-Qr-${paymentSettings?.upiId || 'payment'}.png`;
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
          
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div className="relative w-12 h-12 bg-white rounded-xl p-1 border border-border shadow-sm">
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Logo"
                    fill
                    className="object-contain p-1.5"
                  />
                </div>
              )}
              <span className="text-2xl font-bold tracking-tighter text-primary">
                {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
              </span>
            </Link>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed font-normal">
              {paymentSettings?.address && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/40" />
                  {paymentSettings.address}
                </p>
              )}
              <div className="flex flex-col gap-y-2 pt-1">
                {paymentSettings?.contactPhone && (
                  <a href={`tel:${paymentSettings.contactPhone}`} className="flex items-center gap-2 hover:text-primary transition-colors font-normal">
                    <Phone className="h-4 w-4 opacity-60" /> {paymentSettings.contactPhone}
                  </a>
                )}
                {paymentSettings?.contactEmail && (
                  <a href={`mailto:${paymentSettings.contactEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors font-normal">
                    <Mail className="h-4 w-4 opacity-60" /> {paymentSettings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 md:pl-10">
            <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
              More Info
            </h3>
            <nav className="flex flex-col gap-4">
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

          <div className="flex flex-col md:items-end gap-6">
            <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
              Support Us
            </h3>
            <div className="w-full sm:w-auto">
                <Button 
                    variant="outline" 
                    onClick={() => setIsDonationDialogOpen(true)}
                    className="font-semibold border-primary/20 text-primary h-12 px-10 rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-md group w-full"
                >
                    <HeartHandshake className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    How To Give
                </Button>
                <p className="text-[9px] text-muted-foreground mt-3 font-normal italic md:text-right uppercase tracking-tighter opacity-60">
                    UPI QR, Bank Transfer, And Support Channels.
                </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] text-muted-foreground font-semibold">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {paymentSettings?.regNo && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                Registration: {paymentSettings.regNo}
              </span>
            )}
            {paymentSettings?.pan && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                PAN: {paymentSettings.pan}
              </span>
            )}
          </div>
          <p className="text-center sm:text-right font-normal text-muted-foreground opacity-80">
            {paymentSettings?.copyright || `© ${new Date().getFullYear()} ${brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}. All Rights Reserved.`}
          </p>
        </div>
      </div>

      <Dialog open={isDonationDialogOpen} onOpenChange={setIsDonationDialogOpen}>
        <DialogContent className="sm:max-w-xl border-primary/10 overflow-hidden rounded-[24px] p-0 animate-fade-in-zoom">
          <DialogHeader className="bg-primary/5 px-6 py-6 border-b">
            <DialogTitle className="text-2xl font-bold text-primary tracking-tight">Contribution Options</DialogTitle>
            <DialogDescription className="font-normal text-primary/70">
                Secure Channels For Supporting Our Community Initiatives.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-8 bg-white">
                
                <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <QrCode className="h-5 w-5" />
                        <h3 className="text-lg">Scan & Pay Via UPI</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-2xl border border-primary/10 bg-primary/[0.02]">
                        <div className="relative w-48 h-48 bg-white p-3 rounded-2xl border-4 border-primary shadow-xl">
                            {validQrUrl ? (
                                <Image
                                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                                    alt="Payment QR"
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground/20">
                                    <QrCode className="h-12 w-12" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left w-full">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">UPI Identifier</Label>
                                <div className="flex items-center justify-center md:justify-start gap-2">
                                    <p className="font-mono text-xl font-bold text-primary tracking-tighter">
                                        {paymentSettings?.upiId || 'Not Set'}
                                    </p>
                                    {paymentSettings?.upiId && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/40 hover:text-primary" onClick={() => handleCopy(paymentSettings.upiId!, 'UPI ID')}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <Button onClick={handleDownloadQr} className="font-bold shadow-md w-full md:w-auto px-6 h-10" disabled={!validQrUrl}>
                                <Download className="mr-2 h-4 w-4" /> Save QR Image
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator className="bg-primary/10" />

                <div className="space-y-6 pb-4">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <Landmark className="h-5 w-5" />
                        <h3 className="text-lg">Direct Bank Transfer</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-6 rounded-2xl border border-primary/10 bg-primary/[0.02]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">Account Name</Label>
                                <p className="text-sm font-bold text-primary">{paymentSettings?.bankAccountName || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">Bank Name</Label>
                                <p className="text-sm font-bold text-primary">{paymentSettings?.bankAccountNumber ? 'Available Upon Request' : 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">Account Number</Label>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold font-mono text-primary">{paymentSettings?.bankAccountNumber || 'N/A'}</p>
                                    {paymentSettings?.bankAccountNumber && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/40 hover:text-primary" onClick={() => handleCopy(paymentSettings.bankAccountNumber!, 'Account Number')}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">IFSC Code</Label>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold font-mono text-primary">{paymentSettings?.bankIfsc || 'N/A'}</p>
                                    {paymentSettings?.bankIfsc && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/40 hover:text-primary" onClick={() => handleCopy(paymentSettings.bankIfsc!, 'IFSC Code')}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ScrollBar />
          </ScrollArea>

          <DialogFooter className="sm:justify-center px-6 py-4 bg-primary/[0.02] border-t">
            <Button variant="secondary" onClick={() => setIsDonationDialogOpen(false)} className="font-bold border-primary/10 text-primary px-10">
              Close Options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
