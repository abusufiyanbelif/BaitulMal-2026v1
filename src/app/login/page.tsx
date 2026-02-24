

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore, sendPasswordResetEmail } from '@/firebase';
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
import { Loader2, AlertTriangle, ExternalLink, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

const loginSchema = z.object({
  loginId: z.string().min(3, 'Login ID or Phone Number is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  usePageHit('login');

  // State for password reset dialog
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
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
      await signInWithLoginId(auth, firestore, data.loginId, data.password);
      toast({ title: 'Login Successful', description: "Welcome back!", variant: 'success' });
      router.push('/dashboard');
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
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
        toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive"});
        return;
    }

    setIsSendingReset(true);
    const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
    };
    try {
        await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
        // Always show success to prevent user enumeration
        toast({
            title: "Password Reset Email Sent",
            description: `If an account exists for ${resetEmail}, you will receive an email with instructions to reset your password.`,
            variant: "success",
            duration: 9000,
        });
    } catch (error: any) {
        // Log the actual error for debugging but show a generic success message to the user for security.
        console.error("Password reset error:", error);
        toast({
            title: "Password Reset Email Sent",
            description: `If an account exists for ${resetEmail}, you will receive an email with instructions to reset your password.`,
            variant: "success",
            duration: 9000,
        });
    } finally {
        setIsSendingReset(false);
        setIsResetDialogOpen(false);
        setResetEmail('');
    }
  };


  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/sign-in-method`;

  return (
    <div className="w-full max-w-sm">
        <div className="mb-4 flex animate-slide-in-from-top" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <Button variant="outline" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </div>
      <Card className="animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
          <CardHeader className="text-center">
              <div className="flex justify-center items-center gap-3 mb-4">
                {isBrandingLoading ? (
                    <Skeleton className="h-9 w-full max-w-xs" />
                ) : (
                    <h1 className="text-2xl sm:text-3xl font-bold font-headline text-foreground">
                        {brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur'}
                    </h1>
                )}
              </div>
          <CardTitle>Welcome Back!</CardTitle>
          <CardDescription>Organization Member Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                  control={form.control}
                  name="loginId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Login ID or Phone Number</FormLabel>
                      <FormControl>
                      <Input 
                          placeholder="e.g. your_login_id or 0000000000" 
                          {...field}
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                      <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
              </Button>
              </form>
          </Form>
          </CardContent>
          <CardFooter className="justify-center pt-4">
              <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                  <DialogTrigger asChild>
                      <Button variant="link" className="p-0 h-auto text-sm font-normal">Forgot Password?</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                          <DialogTitle>Reset Password</DialogTitle>
                          <DialogDescription>
                              Enter your email address and we'll send you a link to reset your password.
                          </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-2">
                          <Label htmlFor="reset-email">Email Address</Label>
                          <Input
                              id="reset-email"
                              type="email"
                              placeholder="user@example.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              disabled={isSendingReset}
                          />
                      </div>
                      <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={isSendingReset}>Cancel</Button>
                          <Button type="submit" onClick={handlePasswordReset} disabled={isSendingReset}>
                              {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Send Reset Link
                          </Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>
          </CardFooter>
      </Card>
      
      {loginError && (
          <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                  {loginError}
              </AlertDescription>
          </Alert>
      )}

      {setupError && (
          <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Action Required: Enable Sign-In Method</AlertTitle>
              <AlertDescription className="space-y-3">
                  <p>For the one-time initial setup, you must enable the 'Email/Password' provider in your Firebase project. This allows the app to create the first admin user.</p>
                  <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
                      <Link href={authUrl} target="_blank">
                          Go to Firebase Console to Enable
                          <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                  </Button>
              </AlertDescription>
          </Alert>
      )}
  </div>
  );
}

