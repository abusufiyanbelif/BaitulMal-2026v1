'use client';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Copy, Smartphone, QrCode, Mail, Phone, Download, Globe, Users, Info } from 'lucide-react';
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
      toast({ title: `${type} Copied!`, description: text, duration: 3000 });
    });
  };
  
  const validQrCodeUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  
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
    } catch (error: any) {
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
  const hasCopyright = paymentSettings?.copyright;

  if (pathname === '/login' || (!isLoading && !hasPaymentInfo && !hasContactInfo && !hasOrgInfo && !hasCopyright)) {
    return null; // Don't render footer if no settings are found and not loading, or on login page
  }

  return (
    <footer className="bg-card border-t mt-auto p-3 text-card-foreground">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Org & Contact Info */}
            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-2 transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-bottom" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            <div className="flex items-center gap-3">
              {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
                  validLogoUrl && (
                      <Image
                          src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                          alt={`${brandingSettings?.name || 'Organization'} Logo`}
                          width={brandingSettings?.logoWidth || 40}
                          height={brandingSettings?.logoHeight || 40}
                          className="object-contain"
                          style={{
                              maxHeight: '2.5rem',
                              width: 'auto'
                          }}
                      />
                  )
              )}
              {isLoading ? <Skeleton className="h-6 w-48" /> : <h3 className="font-bold text-base text-primary">{brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}</h3>}
            </div>
            {isLoading ? <Skeleton className="h-4 w-full" /> : paymentSettings?.address && <p className="text-xs text-muted-foreground">{paymentSettings.address}</p>}
            <div className="text-xs text-muted-foreground space-y-1">
                    {isLoading ? <Skeleton className="h-4 w-3/4" /> : paymentSettings?.regNo && <p>Reg. No.: {paymentSettings.regNo}</p>}
                    {isLoading ? <Skeleton className="h-4 w-1/2" /> : paymentSettings?.pan && <p>PAN: {paymentSettings.pan}</p>}
                </div>
                <Separator className="my-2"/>
            {isLoading ? <Skeleton className="h-4 w-4/5" /> : paymentSettings?.contactEmail && (
                <div className="flex items-center gap-2 text-xs transition-all hover:text-primary">
                <Mail className="h-3 w-3" />
                <span className="break-all">{paymentSettings.contactEmail}</span>
                </div>
            )}
            {isLoading ? <Skeleton className="h-4 w-3/5" /> : paymentSettings?.contactPhone && (
                <div className="flex items-center gap-2 text-xs transition-all hover:text-primary">
                <Phone className="h-3 w-3" />
                <span>{paymentSettings.contactPhone}</span>
                </div>
            )}
            {isLoading ? <Skeleton className="h-4 w-4/5" /> : paymentSettings?.website && (
                <div className="flex items-center gap-2 text-xs transition-all hover:text-primary">
                <Globe className="h-3 w-3" />
                <a href={paymentSettings.website} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">{paymentSettings.website}</a>
                </div>
            )}
            {isLoading ? <Skeleton className="h-4 w-3/4" /> : (
                <div className="flex items-center gap-2 text-xs transition-all hover:text-primary">
                    <Users className="h-3 w-3" />
                    <Link href="/info/members" className="hover:underline">Organization Members</Link>
                </div>
            )}
             {isLoading ? <Skeleton className="h-4 w-1/2" /> : (infoSettings?.isDonationInfoPublic &&
                <div className="flex items-center gap-2 text-xs transition-all hover:text-primary">
                    <Info className="h-3 w-3" />
                    <Link href="/info/donation-info" className="hover:underline">Donation Types</Link>
                </div>
            )}
            </div>

            {/* Payment Info */}
            <div className="flex flex-col items-center gap-2 transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-bottom" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                {isLoading ? <Skeleton className="h-6 w-1/2" /> : <h3 className="font-semibold text-base text-primary">For Donations</h3>}
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
                <Skeleton className="h-28 w-28 rounded-lg" />
            ) : (
                validQrCodeUrl && (
                    <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="cursor-pointer transition-transform duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg">
                                <Image
                                    src={`/api/image-proxy?url=${encodeURIComponent(validQrCodeUrl)}`}
                                    alt="UPI QR Code"
                                    width={paymentSettings?.qrWidth || 112}
                                    height={paymentSettings?.qrHeight || 112}
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
                                <Image
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
        <Separator className="my-3" />
        <div className="text-center text-xs text-muted-foreground">
            {isLoading ? (
                <Skeleton className="h-4 w-1/2 mx-auto" />
            ) : (
                <p className="text-primary">{paymentSettings?.copyright || "© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved."}</p>
            )}
        </div>
      </div>
    </footer>
  );
}