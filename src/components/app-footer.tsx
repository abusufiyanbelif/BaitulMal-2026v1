
'use client';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Copy, Smartphone, QrCode, Mail, Phone, Download, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useBranding } from '@/hooks/use-branding';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

export function AppFooter() {
  const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  const { toast } = useToast();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const isLoading = isPaymentLoading || isBrandingLoading;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${type} Copied!`, description: text, duration: 3000 });
    });
  };
  
  const validQrCodeUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;
  
  const handleDownloadQr = async () => {
    if (!validQrCodeUrl) return;
    toast({
        title: "Preparing download...",
        description: "Your QR code image is being prepared.",
    });
    try {
        const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch QR code');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'payment-qr-code.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({
            title: "QR Code Downloading...",
            description: "Your QR code image has started downloading.",
            variant: "success"
        });
    } catch (error) {
        console.error("QR Code download failed:", error);
        toast({
            title: "Download Failed",
            description: "Could not download the QR code image.",
            variant: "destructive"
        });
    }
  };
  
  const hasPaymentInfo = paymentSettings?.upiId || paymentSettings?.paymentMobileNumber || validQrCodeUrl;
  const hasContactInfo = paymentSettings?.contactEmail || paymentSettings?.contactPhone || paymentSettings?.website;
  const hasOrgInfo = paymentSettings?.regNo || paymentSettings?.pan || paymentSettings?.address;

  if (!isLoading && !hasPaymentInfo && !hasContactInfo && !hasOrgInfo) {
    return null; // Don't render footer if no settings are found and not loading
  }

  return (
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
            </div>
             <Separator className="my-2"/>
          {isLoading ? <Skeleton className="h-5 w-4/5" /> : paymentSettings?.contactEmail && (
            <div className="flex items-center gap-2 text-sm transition-all hover:text-primary">
              <Mail className="h-4 w-4" />
              <span className="break-all">{paymentSettings.contactEmail}</span>
            </div>
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
        </div>

        {/* Payment Info */}
        <div className="flex flex-col items-center gap-3 transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-bottom" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
            {isLoading ? <Skeleton className="h-7 w-1/2" /> : <h3 className="font-semibold text-lg">For Donations</h3>}
            {isLoading ? <Skeleton className="h-5 w-4/5" /> : paymentSettings?.upiId && (
                <div className="flex items-center gap-2 transition-all hover:text-primary">
                <QrCode className="h-4 w-4" />
                <a href={`upi://pay?pa=${paymentSettings.upiId}&pn=${encodeURIComponent(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur')}&cu=INR`} className="font-mono text-sm hover:underline break-all">
                    {paymentSettings.upiId}
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(paymentSettings!.upiId!, 'UPI ID')}>
                    <Copy className="h-4 w-4" />
                </Button>
                </div>
            )}
            {isLoading ? <Skeleton className="h-5 w-3/5" /> : paymentSettings?.paymentMobileNumber && (
                <div className="flex items-center gap-2 transition-all hover:text-primary">
                <Smartphone className="h-4 w-4" />
                <a href={`tel:${paymentSettings.paymentMobileNumber}`} className="font-mono text-sm hover:underline break-all">
                    {paymentSettings.paymentMobileNumber}
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(paymentSettings!.paymentMobileNumber!, 'Phone Number')}>
                    <Copy className="h-4 w-4" />
                </Button>
                </div>
            )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center md:justify-end animate-slide-in-from-bottom" style={{ animationDelay: '0.4s', animationFillMode: 'backwards' }}>
          {isLoading ? (
            <Skeleton className="h-32 w-32 rounded-lg" />
          ) : (
            validQrCodeUrl && (
                 <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                    <DialogTrigger asChild>
                        <button className="cursor-pointer transition-transform duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg">
                            <img
                                src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`}
                                alt="UPI QR Code"
                                width={paymentSettings?.qrWidth || 128}
                                height={paymentSettings?.qrHeight || 128}
                                className="object-contain border-4 border-primary rounded-lg p-1 bg-white"
                            />
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Scan to Pay</DialogTitle>
                            <DialogDescription>
                                Use any UPI app to scan this QR code for your donation.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center justify-center p-4 bg-secondary/30 rounded-lg">
                            <img
                                src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`}
                                alt="UPI QR Code"
                                className="w-full max-w-xs h-auto rounded-lg"
                                width={300}
                                height={300}
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleDownloadQr} className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Download QR Code
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )
          )}
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
