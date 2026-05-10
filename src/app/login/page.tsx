'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore, sendPasswordResetEmail, doc, getDoc } from '@/firebase';
import { signInWithLoginId } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/hooks/use-branding';
import { usePageHit } from '@/hooks/use-page-hit';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, ExternalLink, ArrowLeft, HeartHandshake, HandHelping, Mail, MessageSquare, Key, Lock, CheckCircle2 } from 'lucide-react';
import { sendPortalOTPAction, resetPasswordWithOTPAction } from '@/app/portal-login/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandedLoader } from '@/components/branded-loader';

const loginSchema = z.object({
  loginId: z.string().min(3, 'Login ID or Phone Number is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  usePageHit('login');

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoginId, setResetLoginId] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'success'>('request');
  const [resetMethod, setResetMethod] = useState<'email' | 'telegram'>('email');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      loginId: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setSetupError(null);
    setLoginError(null);

    if (!auth || !firestore) {
      setLoginError('Firebase service is not available. Please check your application configuration and internet connection.');
      setIsLoading(false);
      return;
    }
    try {
       const userCredential = await signInWithLoginId(auth, firestore, data.loginId, data.password);
       
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      let userDocSnap = null;
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
          try {
              userDocSnap = await getDoc(userDocRef);
              break;
          } catch (err) {
              attempts++;
              if (attempts >= maxAttempts) {
                  console.warn("Firestore profile fetch latency bypassed in login route.");
                  break;
              }
              await new Promise(resolve => setTimeout(resolve, 500));
          }
      }
      
      const userProfile = userDocSnap?.exists() ? userDocSnap.data() : null;
      const userRole = userProfile?.role as string | undefined;
      const isStaff = userRole === 'Admin' || userRole === 'User' || userRole === 'Member' || userRole === 'Staff';

      // Set session metadata with correct role and timestamp
      if (typeof window !== 'undefined') {
          localStorage.setItem('portal_role', isStaff ? 'Staff' : (userRole || 'Staff'));
          localStorage.setItem('portal_session_start', Date.now().toString());
      }

      toast({ title: 'Login successful', description: "Welcome back!", variant: 'success' });

      if (callbackUrl) {
          // Only honour callbackUrl for staff (staff-only pages are gated by RouteGuard)
          if (isStaff) {
              router.push(callbackUrl);
          } else {
              // Non-staff authenticated via staff form: redirect to their own portal
              router.push(userRole === 'Donor' ? '/donor-portal' : (userRole === 'Beneficiary' ? '/beneficiary-portal' : '/portal-login'));
          }
      } else {
          if (isStaff) {
              router.push('/dashboard');
          } else {
              // Non-staff user – redirect to appropriate portal, not donor-portal blindly
              router.push(userRole === 'Donor' ? '/donor-portal' : (userRole === 'Beneficiary' ? '/beneficiary-portal' : '/portal-login'));
          }
      }
    } catch (error: any) {
      if (error.code === 'auth/configuration-not-found') {
            setSetupError(error.message);
        } else {
             setLoginError(error.message || 'An unexpected error occurred.');
        }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth) {
        toast({ title: "Error", description: "Authentication service is not available.", variant: "destructive"});
        return;
    }
    
    if (resetMethod === 'email') {
        if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
            toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive"});
            return;
        }

        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, resetEmail, { url: `${window.location.origin}/login`, handleCodeInApp: false });
            toast({ title: "Reset email sent", description: `Instructions have been dispatched to ${resetEmail}.`, variant: "success" });
            setIsResetDialogOpen(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSendingReset(false);
        }
    } else {
        // Telegram OTP flow
        if (resetStep === 'request') {
            if (!resetLoginId) {
                toast({ title: "Identification Required", description: "Please enter your Login ID or Phone Number.", variant: "destructive"});
                return;
            }
            setIsSendingReset(true);
            try {
                const res = await sendPortalOTPAction(resetLoginId);
                if (res.success) {
                    toast({ title: "OTP Dispatched", description: "Check your Telegram for the verification code.", variant: "success" });
                    setResetStep('verify');
                } else {
                    toast({ title: "Dispatch Failed", description: res.message, variant: "destructive" });
                }
            } finally {
                setIsSendingReset(false);
            }
        } else {
            // Verify & Reset
            if (!resetOtp || resetOtp.length !== 6) {
                toast({ title: "Invalid OTP", description: "Please enter the 6-digit code from Telegram.", variant: "destructive"});
                return;
            }
            if (!newPassword || newPassword.length < 6) {
                toast({ title: "Invalid Password", description: "New password must be at least 6 characters.", variant: "destructive"});
                return;
            }
            setIsSendingReset(true);
            try {
                const res = await resetPasswordWithOTPAction(resetLoginId, resetOtp, newPassword);
                if (res.success) {
                    setResetStep('success');
                    toast({ title: "Password Updated", description: res.message, variant: "success" });
                } else {
                    toast({ title: "Reset Failed", description: res.message, variant: "destructive" });
                }
            } finally {
                setIsSendingReset(false);
            }
        }
    }
  };

  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/sign-in-method`;

  return (
    <div className="w-full max-w-sm">
        <div className="mb-4 flex animate-slide-in-from-top" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <Button variant="outline" asChild className="transition-transform active:scale-95 font-bold border-primary/20 text-primary">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to home
                </Link>
            </Button>
        </div>
        
        <Tabs defaultValue="member" className="w-full animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            <TabsList className="grid w-full grid-cols-3 mb-4 h-12 shadow-sm rounded-xl">
                <TabsTrigger value="member" className="font-bold">Staff</TabsTrigger>
                <TabsTrigger value="donor" className="font-bold">Donor</TabsTrigger>
                <TabsTrigger value="beneficiary" className="font-bold text-xs sm:text-sm">Beneficiary</TabsTrigger>
            </TabsList>

            <TabsContent value="member" className="mt-0 outline-none">
                <Card className="shadow-xl border-primary/10 bg-white">
          <CardHeader className="text-center">
              <div className="flex justify-center items-center gap-3 mb-4">
                {isBrandingLoading ? (
                    <Skeleton className="h-9 w-full max-w-xs" />
                ) : (
                    <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary animate-fade-in-zoom">
                        {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
                    </h1>
                )}
              </div>
          <CardTitle className="font-bold text-primary">Welcome back</CardTitle>
          <CardDescription className="font-normal">Enter your credentials to access your organization account.</CardDescription>
          </CardHeader>
          <CardContent>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-normal">
              <FormField
                  control={form.control}
                  name="loginId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel className="font-bold">Login ID or phone number</FormLabel>
                      <FormControl>
                      <Input 
                          placeholder="e.g. your_id or 9876543210" 
                          {...field}
                          className="font-normal"
                      />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel className="font-bold">Password</FormLabel>
                      <FormControl>
                      <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          className="font-normal"
                          />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <Button type="submit" className="w-full transition-transform active:scale-95 font-bold" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
              </Button>
              </form>
          </Form>
          </CardContent>
          <CardFooter className="justify-center pt-4">
              <Dialog open={isResetDialogOpen} onOpenChange={(open) => {
                  setIsResetDialogOpen(open);
                  if (!open) { setResetStep('request'); setResetOtp(''); setNewPassword(''); }
              }}>
                  <DialogTrigger asChild>
                      <Button variant="link" className="p-0 h-auto text-sm font-bold text-primary">Forgot password?</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[450px] animate-fade-in-zoom p-0 overflow-hidden border-none shadow-2xl">
                      <div className="bg-primary p-6 text-white">
                          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                              <Key className="h-6 w-6" /> Recovery Portal
                          </DialogTitle>
                          <DialogDescription className="text-white/80 mt-1">
                              {resetStep === 'success' ? 'Password successfully updated' : 'Restore access to your organization account.'}
                          </DialogDescription>
                      </div>
                      
                      <div className="p-6 space-y-6 bg-white">
                          {resetStep === 'success' ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-fade-in-up">
                                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                                  </div>
                                  <h3 className="text-xl font-bold text-primary">Identity Restored</h3>
                                  <p className="text-sm text-muted-foreground max-w-xs">Your password has been securely updated. You can now login with your new credentials.</p>
                                  <Button className="w-full font-bold h-12" onClick={() => setIsResetDialogOpen(false)}>Close Recovery Portal</Button>
                              </div>
                          ) : (
                              <>
                                  <div className="grid grid-cols-2 gap-2 bg-primary/5 p-1 rounded-xl">
                                      <Button 
                                          variant={resetMethod === 'email' ? 'default' : 'ghost'} 
                                          className={`font-bold rounded-lg h-10 ${resetMethod === 'email' ? 'shadow-md' : 'text-primary/60'}`}
                                          onClick={() => { setResetMethod('email'); setResetStep('request'); }}
                                          disabled={resetStep === 'verify'}
                                      >
                                          <Mail className="mr-2 h-4 w-4" /> Email
                                      </Button>
                                      <Button 
                                          variant={resetMethod === 'telegram' ? 'default' : 'ghost'} 
                                          className={`font-bold rounded-lg h-10 ${resetMethod === 'telegram' ? 'shadow-md' : 'text-primary/60'}`}
                                          onClick={() => setResetMethod('telegram')}
                                          disabled={resetStep === 'verify'}
                                      >
                                          <MessageSquare className="mr-2 h-4 w-4" /> Telegram
                                      </Button>
                                  </div>

                                  {resetMethod === 'email' ? (
                                      <div className="space-y-4 animate-fade-in-up">
                                          <div className="space-y-2">
                                              <Label htmlFor="reset-email" className="font-bold text-primary">Email Address</Label>
                                              <Input
                                                  id="reset-email"
                                                  type="email"
                                                  placeholder="your.email@organization.com"
                                                  value={resetEmail}
                                                  onChange={(e) => setResetEmail(e.target.value)}
                                                  disabled={isSendingReset}
                                                  className="h-12 border-primary/10 rounded-xl"
                                              />
                                          </div>
                                          <Button onClick={handlePasswordReset} disabled={isSendingReset} className="w-full h-12 font-bold text-lg shadow-lg active:scale-95 transition-transform">
                                              {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                                          </Button>
                                      </div>
                                  ) : (
                                      <div className="space-y-6 animate-fade-in-up">
                                          {resetStep === 'request' ? (
                                              <div className="space-y-4">
                                                  <div className="space-y-2">
                                                      <Label htmlFor="reset-loginid" className="font-bold text-primary">Login ID or Phone Number</Label>
                                                      <Input
                                                          id="reset-loginid"
                                                          placeholder="e.g. abusufiyan.belif"
                                                          value={resetLoginId}
                                                          onChange={(e) => setResetLoginId(e.target.value)}
                                                          disabled={isSendingReset}
                                                          className="h-12 border-primary/10 rounded-xl font-mono"
                                                      />
                                                      <p className="text-[10px] text-primary/60 italic">We will dispatch an OTP to your linked Telegram account.</p>
                                                  </div>
                                                  <Button onClick={handlePasswordReset} disabled={isSendingReset} className="w-full h-12 font-bold text-lg shadow-lg active:scale-95 transition-transform">
                                                      {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : "Dispatch Telegram OTP"}
                                                  </Button>
                                              </div>
                                          ) : (
                                              <div className="space-y-4">
                                                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                                                      <Lock className="h-5 w-5 text-primary mt-0.5" />
                                                      <div className="space-y-1">
                                                          <p className="text-xs font-bold text-primary">Verification Code Sent</p>
                                                          <p className="text-[10px] text-muted-foreground">Check your Telegram for a 6-digit OTP code.</p>
                                                      </div>
                                                  </div>
                                                  
                                                  <div className="space-y-2">
                                                      <Label htmlFor="reset-otp" className="font-bold text-primary">Enter 6-Digit OTP</Label>
                                                      <Input
                                                          id="reset-otp"
                                                          maxLength={6}
                                                          placeholder="000000"
                                                          value={resetOtp}
                                                          onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                                                          className="h-12 border-primary/10 rounded-xl text-center text-2xl font-bold tracking-[0.5em]"
                                                      />
                                                  </div>

                                                  <div className="space-y-2">
                                                      <Label htmlFor="new-password" className="font-bold text-primary">New Password</Label>
                                                      <Input
                                                          id="new-password"
                                                          type="password"
                                                          placeholder="At least 6 characters"
                                                          value={newPassword}
                                                          onChange={(e) => setNewPassword(e.target.value)}
                                                          className="h-12 border-primary/10 rounded-xl"
                                                      />
                                                  </div>

                                                  <div className="flex gap-2">
                                                      <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setResetStep('request')}>Back</Button>
                                                      <Button onClick={handlePasswordReset} disabled={isSendingReset} className="flex-[2] h-12 font-bold text-lg shadow-lg active:scale-95 transition-transform bg-green-600 hover:bg-green-700">
                                                          {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Reset"}
                                                      </Button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </>
                          )}
                      </div>
                  </DialogContent>
              </Dialog>
          </CardFooter>
      </Card>
      
      {loginError && (
          <Alert variant="destructive" className="mt-4 animate-fade-in-up">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Login failed</AlertTitle>
              <AlertDescription className="font-normal">
                  {loginError}
              </AlertDescription>
          </Alert>
      )}

      {setupError && (
          <Alert variant="destructive" className="mt-4 animate-fade-in-up">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Action required: enable sign-in method</AlertTitle>
              <AlertDescription className="space-y-3 font-normal">
                  <p>For the one-time initial setup, you must enable the 'Email/Password' provider in your Firebase project. This allows the app to create the first admin user.</p>
                  <Button asChild variant="secondary" size="sm" className="mt-3 w-full transition-transform active:scale-95 font-bold">
                      <Link href={authUrl} target="_blank">
                          Go to Firebase Console to enable
                          <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                  </Button>
              </AlertDescription>
          </Alert>
      )}
      </TabsContent>

      <TabsContent value="donor" className="mt-0 outline-none">
          <Card className="shadow-xl border-primary/10 bg-white">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                  <div className="bg-primary/5 p-4 rounded-full">
                      <HeartHandshake className="h-12 w-12 text-primary" />
                  </div>
                  <div className="space-y-2">
                      <h3 className="font-bold text-xl text-primary">Donor Portal</h3>
                      <p className="text-sm font-normal text-muted-foreground">Access your comprehensive donation summaries and secure tax receipts via Mobile OTP.</p>
                  </div>
                  <Button asChild className="w-full h-12 font-bold transition-transform active:scale-95 text-lg">
                      <Link href="/portal-login">Continue via Mobile</Link>
                  </Button>
              </CardContent>
          </Card>
      </TabsContent>

      <TabsContent value="beneficiary" className="mt-0 outline-none">
          <Card className="shadow-xl border-primary/10 bg-white">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                  <div className="bg-primary/5 p-4 rounded-full">
                      <HandHelping className="h-12 w-12 text-primary" />
                  </div>
                  <div className="space-y-2">
                      <h3 className="font-bold text-xl text-primary">Beneficiary Portal</h3>
                      <p className="text-sm font-normal text-muted-foreground">Check your assistance request status securely and submit real-time updates.</p>
                  </div>
                  <Button asChild className="w-full h-12 font-bold transition-transform active:scale-95 text-lg">
                      <Link href="/portal-login">Continue via Mobile</Link>
                  </Button>
              </CardContent>
          </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<BrandedLoader message="Synchronizing Auth Protocols..." />}>
            <LoginContent />
        </Suspense>
    );
}
