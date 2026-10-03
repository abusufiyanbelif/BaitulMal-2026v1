// Build Timestamp: 2026-09-11T19-26-33-885Z
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
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
  BookOpen,
  Navigation2,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Linkedin,
  MessageSquare,
  Send
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
import versionData from '@/lib/version.json';

/**
 * App Footer - Organization profile and contribution hub.
 * Re-engineered for Title Case typography and professional visual alignment.
 */
export function AppFooter() {
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const { userProfile: currentUser } = useSession();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (paymentSettings?.isFooterVisible === false) {
    return null;
  }

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

  // Defaults: Keep all sections visible unless explicitly set to false in settings
  const showInstagram = paymentSettings?.isFooterInstagramVisible !== false;
  const showFacebook = paymentSettings?.isFooterFacebookVisible !== false;
  const showYoutube = paymentSettings?.isFooterYoutubeVisible !== false;
  const showTwitter = paymentSettings?.isFooterTwitterVisible !== false;
  const showLinkedin = paymentSettings?.isFooterLinkedinVisible !== false;
  const showWhatsapp = paymentSettings?.isFooterWhatsappVisible !== false;
  const showTelegram = paymentSettings?.isFooterTelegramVisible !== false;

  const showSocials = paymentSettings?.isFooterSocialVisible !== false && (
    showInstagram || showFacebook || showYoutube || showTwitter || showLinkedin || showWhatsapp || showTelegram
  );
  const showAddress = paymentSettings?.isFooterAddressVisible !== false;
  const showContact = paymentSettings?.isFooterContactVisible !== false;
  const showQuickLinks = paymentSettings?.isFooterQuickLinksVisible !== false;
  const showSupportUs = paymentSettings?.isFooterSupportUsVisible !== false;
  const showRegInfo = paymentSettings?.isFooterRegInfoVisible !== false;
  const showCopyright = paymentSettings?.isFooterCopyrightVisible !== false;
  const showBuildVersion = paymentSettings?.isFooterBuildVersionVisible !== false;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} Copied`,
      description: "Information Has Been Copied To Clipboard.",
      variant: "success",
    });
  };

  const handleDownloadQr = async () => {
    if (!validQrUrl) return;
    try {
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`);
      if (!response.ok) throw new Error('Failed To Fetch Image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Organization-QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("QR Download Failed:", error);
    }
  };

  // Fallback defaults for missing settings values to ensure everything stays visible by default
  const addressText = paymentSettings?.address || 'Solapur, Maharashtra, India';
  const phoneText = paymentSettings?.contactPhone || '+91 98765 43210';
  const emailText = paymentSettings?.contactEmail || 'info@baitulamal.org';
  const regNoText = paymentSettings?.regNo || 'F-12345/Solapur';
  const panText = paymentSettings?.pan || 'AAATB1234F';

  return (
    <footer className="bg-secondary/50 border-t border-border py-12 font-normal text-primary transition-colors duration-500 animate-reveal-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
          
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {validLogoUrl && (
                <div 
                    className="relative overflow-hidden bg-transparent border-0"
                    style={{ 
                        width: brandingSettings?.logoWidth ? `${brandingSettings.logoWidth}px` : '48px',
                        height: brandingSettings?.logoHeight ? `${brandingSettings.logoHeight}px` : '48px'
                    }}
                >
                  <Image
                    src={validLogoUrl.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}` : validLogoUrl}
                    alt="Logo"
                    fill
                    sizes="512px"
                    className="object-contain"
                  />
                </div>
              )}
              <span className="text-2xl font-bold tracking-tight text-primary">
                {brandingSettings?.name || 'Baitulmal Solapur'}
              </span>
            </Link>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed font-normal">
              {showAddress && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary/40" />
                  {addressText}
                </p>
              )}
              {showContact && (
                <div className="flex flex-col gap-y-2 pt-1">
                  <a href={`tel:${phoneText}`} className="flex items-center gap-2 hover:text-primary transition-colors font-normal">
                    <Phone className="h-4 w-4 opacity-60" /> {phoneText}
                  </a>
                  <a href={`mailto:${emailText}`} className="flex items-center gap-2 hover:text-primary transition-colors font-normal">
                    <Mail className="h-4 w-4 opacity-60" /> {emailText}
                  </a>
                </div>
              )}
              {showSocials && (
                <div className="flex items-center gap-2.5 flex-wrap pt-3">
                  {showInstagram && (
                    <a
                      href={paymentSettings?.instagramUrl || 'https://instagram.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Instagram"
                      aria-label="Instagram Profile"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-gradient-to-tr hover:from-amber-500 hover:via-rose-500 hover:to-purple-600 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  {showFacebook && (
                    <a
                      href={paymentSettings?.facebookUrl || 'https://facebook.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Facebook"
                      aria-label="Facebook Profile"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Facebook className="h-4 w-4" />
                    </a>
                  )}
                  {showYoutube && (
                    <a
                      href={paymentSettings?.youtubeUrl || 'https://youtube.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="YouTube"
                      aria-label="YouTube Channel"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-red-600 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Youtube className="h-4 w-4" />
                    </a>
                  )}
                  {showTwitter && (
                    <a
                      href={paymentSettings?.twitterUrl || 'https://x.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Twitter / X"
                      aria-label="Twitter X Profile"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-slate-900 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                  {showLinkedin && (
                    <a
                      href={paymentSettings?.linkedinUrl || 'https://linkedin.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="LinkedIn"
                      aria-label="LinkedIn Profile"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-blue-700 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {showWhatsapp && (
                    <a
                      href={paymentSettings?.whatsappUrl ? (paymentSettings.whatsappUrl.startsWith('http') || paymentSettings.whatsappUrl.startsWith('wa.me') ? paymentSettings.whatsappUrl : `https://wa.me/${paymentSettings.whatsappUrl.replace(/\D/g, '')}`) : 'https://wa.me/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      aria-label="WhatsApp Channel or Group"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-emerald-600 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  )}
                  {showTelegram && (
                    <a
                      href={paymentSettings?.telegramUrl ? (paymentSettings.telegramUrl.startsWith('http') || paymentSettings.telegramUrl.startsWith('t.me') ? paymentSettings.telegramUrl : `https://t.me/${paymentSettings.telegramUrl.replace('@', '')}`) : 'https://t.me/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Telegram"
                      aria-label="Telegram Channel"
                      className="p-2.5 rounded-full bg-primary/5 text-primary hover:bg-sky-500 hover:text-white transition-all transform hover:scale-110 shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {showQuickLinks ? (
            <div className="space-y-6 md:pl-10">
              <h3 className="text-xs font-black text-primary/60 tracking-tight capitalize">
                Quick Links
              </h3>
              <nav className="flex flex-col gap-4">
                <Link href="/info/organization" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal">
                  <Users className="h-4 w-4 opacity-30" />
                  About Us
                </Link>
                <Link href="/info/donation-info" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal">
                  <HeartHandshake className="h-4 w-4 opacity-30" />
                  Donation Info
                </Link>
                <Link href="/info/guidance" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal">
                  <BookOpen className="h-4 w-4 opacity-30" />
                  Common Questions
                </Link>
                <a 
                  href="/app-release.apk" 
                  download="baitulamal-solapur.apk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-3 font-normal"
                >
                  <Download className="h-4 w-4 opacity-30" />
                  Download Mobile App (APK)
                </a>
                {currentUser?.role === 'Admin' && (
                  <Link href="/registry-index" className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-3 font-bold bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                    <Navigation2 className="h-4 w-4 opacity-80" />
                    Full Site Map
                  </Link>
                )}
              </nav>
            </div>
          ) : <div />}

          {showSupportUs ? (
            <div className="flex flex-col md:items-end gap-6">
              <h3 className="text-xs font-black text-primary/60 tracking-tight capitalize">
                Support Us
              </h3>
              <div className="w-full sm:w-auto">
                  <Button 
                      variant="outline" 
                      onClick={() => setIsDonationDialogOpen(true)}
                      className="font-bold border-primary/20 text-primary h-12 px-10 rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-md group w-full"
                  >
                      <HeartHandshake className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                      How to Donate
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-3 font-normal italic md:text-right tracking-tight opacity-80">
                      Use QR Code or Bank Transfer.
                  </p>
              </div>
            </div>
          ) : <div />}
        </div>

        {(showRegInfo || showCopyright || showBuildVersion) && (
          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-muted-foreground font-semibold">
            <div className="flex items-center justify-center gap-x-8 gap-y-2 flex-wrap">
              {showRegInfo && (
                <>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                    Reg No: {regNoText}
                  </span>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                    PAN: {panText}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-col items-center sm:items-end gap-1.5">
              {showCopyright && (
                <p className="text-center sm:text-right font-normal text-muted-foreground opacity-80">
                  {paymentSettings?.copyright || `© 2026 ${brandingSettings?.name || 'Organization Name'}. All Rights Reserved.`}
                </p>
              )}
              {showBuildVersion && (
                <div className="flex items-center gap-2 font-mono text-[11px] opacity-60 hover:opacity-100 transition-all cursor-default">
                    <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black uppercase tracking-widest">Build</span>
                    <span>{versionData.version}</span>
                    <span className="opacity-40">
                        ({isMounted && versionData.buildDate ? new Date(versionData.buildDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'May 2026'})
                    </span>
                </div>
              )}
            </div>
          </div>
        )}
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
                        <h3 className="text-lg">Scan And Pay Via QR Code</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-2xl border border-primary/10 bg-primary/[0.02]">
                        <div className="relative w-48 h-48 bg-white p-3 rounded-2xl border-4 border-primary shadow-xl">
                            {validQrUrl ? (
                                <Image
                                    src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`}
                                    alt="Payment QR"
                                    fill
                                    sizes="192px"
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
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-tight">Account Holder Name</Label>
                                <p className="text-sm font-bold text-primary">{paymentSettings?.bankAccountName || 'N/A'}</p>
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
