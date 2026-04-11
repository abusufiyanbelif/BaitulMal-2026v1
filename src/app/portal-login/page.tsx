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

// Add this interface to extend the global Window object
declare global {
    interface Window {
        recaptchaVerifier?: RecaptchaVerifier;
    }
}

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone must be exactly 10 digits.').max(10),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits.'),
});

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

  // Master Global Switch Control check
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
        toast({ title: 'OTP Sent!', description: 'Please check your mobile messages.', variant: 'success' });
    } catch (err: any) {
        setLoginError(err.message || 'Failed to send OTP. Try again later.');
    } finally {
        setIsLoading(false);
    }
  };

  const onVerifyOtp = async (data: any) => {
      setIsLoading(true);
      setLoginError(null);

      try {
          await verificationResult.confirm(data.otp);
          toast({ title: 'Securely Logged In', description: 'Redirecting to your portal...', variant: 'success' });
          // Routing logic is governed silently by RouteGuard inside auth-provider.tsx!
      } catch (err: any) {
          setLoginError('Invalid OTP code. Please try again.');
      } finally {
          setIsLoading(false);
      }
  };

  if (isBrandingLoading) {
      return <div className="h-screen w-full flex items-center justify-center p-4">Loading Portal Configuration...</div>;
  }

  if (!isPortalsEnabled) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center p-4 bg-muted/20">
              <ShieldCheck className="h-20 w-20 text-destructive mb-6" />
              <h1 className="text-3xl font-bold tracking-tight text-primary">Portal Access is Closed</h1>
              <p className="mt-2 text-muted-foreground text-center">Organization administrators have currently suspended self-service portal functionality.</p>
              <Button asChild className="mt-8 font-bold"><Link href="/">Return to Home</Link></Button>
          </div>
      );
  }

  return (
    <div className="w-full max-w-sm pt-20 mx-auto min-h-screen">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to home</Link>
        </Button>
      </div>

      <Card className="animate-fade-in-up border-primary/10 shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto bg-primary/5 p-3 rounded-2xl w-fit mb-4">
                <Phone className="h-8 w-8 text-primary" />
            </div>
          <CardTitle className="font-bold text-primary text-2xl">Supporter Portal</CardTitle>
          <CardDescription className="font-normal px-2">Access your donations or requests securely via Mobile Auth.</CardDescription>
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
                                <FormLabel className="font-bold">10-Digit Mobile Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="9876543210" {...field} className="h-12 text-lg text-center tracking-widest font-bold" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div id="recaptcha-container"></div>
                        <Button type="submit" className="w-full h-12 font-bold" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Secure Code
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
                                <FormLabel className="font-bold text-primary">Enter your 6-Digit Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="XXXXXX" {...field} className="h-12 text-2xl text-center tracking-[1rem] font-bold" maxLength={6} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full h-12 font-bold" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verify & Enter Portal
                        </Button>
                        <Button variant="ghost" onClick={() => setStep('phone')} type="button" className="w-full mt-2 font-bold opacity-60">
                            Use a different number
                        </Button>
                    </form>
                </Form>
            )}

            {loginError && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Authentication Failed</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
      
      <p className="text-center w-full mt-12 text-sm opacity-60 font-bold block">
         Staff Members: <Link href="/login" className="underline text-primary">Use the Member Login Area here.</Link>
      </p>
    </div>
  );
}
