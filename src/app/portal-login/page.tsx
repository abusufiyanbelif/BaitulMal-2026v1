'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, signInWithPhoneNumber, RecaptchaVerifier } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/hooks/use-branding';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, ArrowLeft, Phone, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { BrandedLoader } from '@/components/branded-loader';

// Extension for window object to hold recaptcha verifier
declare global {
    interface Window {
        recaptchaVerifier?: any;
    }
}

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone must be exactly 10 digits.').max(10),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits.'),
});

/**
 * Portal Login Page - Optimized for Supporter and Beneficiary OTP access.
 * Securely resolves mobile identities to institutional profiles.
 */
export default function PortalLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const isPortalsEnabled = (brandingSettings?.isDonorLoginEnabled ?? true) || (brandingSettings?.isBeneficiaryLoginEnabled ?? true);

  const setupRecaptcha = () => {
      if (!window.recaptchaVerifier && auth) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible'
          });
      }
  };

  const onSendOtp = async (data: any) => {
    setIsLoading(true);
    setLoginError(null);
    setupRecaptcha();

    try {
        const phoneE164 = `+91${data.phone}`;
        const confirmationResult = await signInWithPhoneNumber(auth!, phoneE164, window.recaptchaVerifier!);
        setVerificationResult(confirmationResult);
        setStep('otp');
        toast({ title: 'OTP Sent!', description: 'Please Check Your Mobile Messages.', variant: 'success' });
    } catch (err: any) {
        console.error("OTP send error:", err);
        setLoginError(err.message || 'Failed To Send OTP. Try Again Later.');
    } finally {
        setIsLoading(false);
    }
  };

  const onVerifyOtp = async (data: any) => {
      setIsLoading(true);
      setLoginError(null);

      try {
          await verificationResult.confirm(data.otp);
          toast({ title: 'Securely Logged In', description: 'Redirecting To Your Portal...', variant: 'success' });
          // Redirect handled by AuthProvider's RouteGuard
      } catch (err: any) {
          setLoginError('Invalid OTP Code. Please Try Again.');
      } finally {
          setIsLoading(false);
      }
  };

  if (isBrandingLoading) {
      return <BrandedLoader message="Syncing Portal Identity Hub..." />;
  }

  if (!isPortalsEnabled) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center p-4 bg-muted/20">
              <ShieldCheck className="h-20 w-20 text-destructive mb-6" />
              <h1 className="text-3xl font-bold tracking-tight text-primary">Portal Access Suspended</h1>
              <p className="mt-2 text-muted-foreground text-center font-normal">Organization Administrators Have Currently Disabled Self-Service Portal Access.</p>
              <Button asChild className="mt-8 font-bold border-primary/20 text-primary transition-transform active:scale-95" variant="outline"><Link href="/">Return To Home</Link></Button>
          </div>
      );
  }

  return (
    <div className="w-full max-w-sm pt-20 mx-auto min-h-screen animate-fade-in-up">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Home</Link>
        </Button>
      </div>

      <Card className="border-primary/10 shadow-2xl bg-white overflow-hidden">
        <CardHeader className="text-center bg-primary/5 border-b mb-6">
            <div className="mx-auto bg-white p-3 rounded-2xl w-fit shadow-sm border border-primary/10 mb-2">
                <Phone className="h-8 w-8 text-primary" />
            </div>
          <CardTitle className="font-bold text-primary text-2xl tracking-tight">Supporter Portal</CardTitle>
          <CardDescription className="font-normal px-2">Access Your Impact History Securely Via Mobile.</CardDescription>
        </CardHeader>
        
        <CardContent>
            {step === 'phone' ? (
                <Form {...phoneForm}>
                    <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4">
                        <FormField
                            control={phoneForm.control}
                            name="phone"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-primary opacity-60">10-Digit Mobile Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="9876543210" {...field} className="h-12 text-lg text-center tracking-widest font-bold border-primary/20 focus:border-primary" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div id="recaptcha-container"></div>
                        <Button type="submit" className="w-full h-12 font-bold shadow-lg active:scale-95 transition-all" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Secure Code'}
                        </Button>
                    </form>
                </Form>
            ) : (
                <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4 animate-fade-in-zoom">
                        <FormField
                            control={otpForm.control}
                            name="otp"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-primary opacity-60">Enter 6-Digit Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="XXXXXX" {...field} className="h-12 text-2xl text-center tracking-[0.5rem] font-bold border-primary/20 focus:border-primary" maxLength={6} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full h-12 font-bold shadow-lg active:scale-95 transition-all" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Enter Portal'}
                        </Button>
                        <Button variant="ghost" onClick={() => setStep('phone')} type="button" className="w-full mt-2 font-bold opacity-60 text-xs">
                            Use A Different Number
                        </Button>
                    </form>
                </Form>
            )}

            {loginError && (
                <Alert variant="destructive" className="mt-4 animate-fade-in-down">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-bold">Authentication Failed</AlertTitle>
                    <AlertDescription className="text-xs font-normal">{loginError}</AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
      
      <p className="text-center w-full mt-12 text-sm opacity-60 font-bold block">
         Staff Members: <Link href="/login" className="underline text-primary hover:text-primary/80 transition-colors">Use The Member Login Area.</Link>
      </p>
    </div>
  );
}
