'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { authenticatePortalUserAction, sendPortalOTPAction, verifyPortalOTPAction, sendPortalOTPViaWhatsAppAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
    Loader2, 
    ShieldCheck, 
    UserCircle2, 
    ArrowRight, 
    KeyRound, 
    MessageSquare,
    ShieldQuestion,
    Smartphone,
    AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { updatePortalPasswordAction, resetPasswordWithOTPAction } from './actions';
import { BrandedLoader } from '@/components/branded-loader';

function PortalLoginContent() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [authMethod, setAuthMethod] = useState<'Password' | 'OTP'>('Password');
    const [workspace, setWorkspace] = useState<'Donor' | 'Beneficiary'>('Donor');
    const [otpChannel, setOtpChannel] = useState<'Telegram' | 'WhatsApp'>('Telegram');

    const auth = useAuth();
    const router = useRouter();
    
    // Optimistic Prefetching to speed up redirection after login
    React.useEffect(() => {
        router.prefetch('/donor-portal');
        router.prefetch('/beneficiary-portal');
        router.prefetch('/dashboard');
    }, [router]);
    const { toast } = useToast();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const searchParams = useSearchParams();
    const isRevoked = searchParams.get('revoked') === 'true';
    const disabledParam = searchParams.get('disabled');

    React.useEffect(() => {
        if (disabledParam === 'donor') setWorkspace('Donor');
        else if (disabledParam === 'beneficiary') setWorkspace('Beneficiary');
        else if (brandingSettings) {
            if (brandingSettings.isDonorLoginEnabled === false && brandingSettings.isBeneficiaryLoginEnabled !== false) {
                setWorkspace('Beneficiary');
            } else if (brandingSettings.isBeneficiaryLoginEnabled === false && brandingSettings.isDonorLoginEnabled !== false) {
                setWorkspace('Donor');
            }
        }
    }, [disabledParam, brandingSettings?.isDonorLoginEnabled, brandingSettings?.isBeneficiaryLoginEnabled]);

    const isPortalDisabled = (workspace === 'Donor' && brandingSettings?.isDonorLoginEnabled === false) || 
                             (workspace === 'Beneficiary' && brandingSettings?.isBeneficiaryLoginEnabled === false);

    // Forgot Password Flow
    const [showForgotDialog, setShowForgotDialog] = useState(false);
    const [forgotIdentifier, setForgotIdentifier] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotStep, setForgotStep] = useState<'ID' | 'OTP' | 'RESET'>('ID');
    const [newPassword, setNewPassword] = useState('');
    const [isForgotLoading, setIsForgotLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPortalDisabled) {
            toast({ title: "Portal Disabled", description: `The ${workspace} Portal is currently offline by institutional configuration.`, variant: "destructive" });
            return;
        }
        if (!identifier) {
            toast({ title: "Identification Required", description: "Please enter your mobile or ID number.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            if (authMethod === 'Password') {
                if (!password) {
                    toast({ title: "Missing Password", description: "Security password is required.", variant: "destructive" });
                    setIsLoading(false);
                    return;
                }
                const res = await authenticatePortalUserAction(identifier, password, workspace);
                handleAuthResult(res);
            } else {
                if (!otpSent) {
                    let res;
                    if (otpChannel === 'WhatsApp') {
                        res = await sendPortalOTPViaWhatsAppAction(identifier, workspace);
                    } else {
                        res = await sendPortalOTPAction(identifier, workspace);
                    }
                    if (res.success) {
                        setOtpSent(true);
                        toast({ title: "OTP Dispatched", description: res.message, variant: "success" });
                    } else {
                        toast({ title: "Dispatch Failed", description: res.message, variant: "destructive" });
                    }
                } else {
                    if (!otp) {
                        toast({ title: "Code Required", description: "Please enter the 6-digit OTP.", variant: "destructive" });
                        setIsLoading(false);
                        return;
                    }
                    const res = await verifyPortalOTPAction(identifier, otp, workspace);
                    handleAuthResult(res);
                }
            }
        } catch (error: any) {
            toast({ title: "System Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthResult = async (res: any) => {
        if (res.success && res.token && auth) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('portal_role', res.role || '');
                localStorage.setItem('portal_session_start', res.sessionStart?.toString() || Date.now().toString());
                if (res.sessionId) localStorage.setItem('portal_session_id', res.sessionId);
            }
            
            const callbackUrl = searchParams.get('callbackUrl');
            const defaultRedirect = res.redirect || (res.role === 'Donor' ? '/donor-portal' : '/beneficiary-portal');
            
            await signInWithCustomToken(auth, res.token);
            toast({ title: "Welcome", description: res.message, variant: "success" });
            router.push(callbackUrl || defaultRedirect);
        } else {
            toast({ title: "Access Denied", description: res.message, variant: "destructive" });
        }
    };

    const handleForgotFlow = async () => {
        if (forgotStep === 'ID') {
            if (!forgotIdentifier) { toast({ title: "Identification Needed", variant: "destructive" }); return; }
            setIsForgotLoading(true);
            const res = await sendPortalOTPAction(forgotIdentifier, workspace);
            if (res.success) { setForgotStep('OTP'); toast({ title: "OTP Sent", description: res.message, variant: "success" }); }
            else { toast({ title: "Failed", description: res.message, variant: "destructive" }); }
            setIsForgotLoading(false);
        } else if (forgotStep === 'OTP') {
            if (!forgotOtp) { toast({ title: "OTP Needed", variant: "destructive" }); return; }
            setIsForgotLoading(true);
            const res = await verifyPortalOTPAction(forgotIdentifier, forgotOtp);
            if (res.success) { setForgotStep('RESET'); }
            else { toast({ title: "Invalid OTP", description: res.message, variant: "destructive" }); }
            setIsForgotLoading(false);
        } else if (forgotStep === 'RESET') {
            if (newPassword.length < 6) { toast({ title: "Too Short", description: "Min 6 characters", variant: "destructive" }); return; }
            setIsForgotLoading(true);
            const res = await resetPasswordWithOTPAction(forgotIdentifier, forgotOtp, newPassword);
            if (res.success) {
                toast({ title: "Password Reset", description: "You can now log in with your new password.", variant: "success" });
                setShowForgotDialog(false);
                setForgotStep('ID');
            } else {
                toast({ title: "Update Failed", description: res.message, variant: "destructive" });
            }
            setIsForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 animate-fade-in-up">
                <div className="text-center space-y-2">
                    <div className="inline-flex p-4 rounded-3xl bg-primary text-white shadow-xl shadow-primary/20 mb-2">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Portal Access</h1>
                    <p className="text-slate-500 font-medium">Secure entry for {brandingSettings?.name || 'Organization'} supporters.</p>
                </div>

                {isRevoked && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-fade-in text-center space-y-1">
                        <p className="text-sm font-bold text-red-700">Access Revoked</p>
                        <p className="text-[10px] text-red-600/70 font-medium tracking-widest">Previous session terminated by administrator.</p>
                    </div>
                )}

                {isBrandingLoading ? (
                    <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden p-12 flex justify-center items-center min-h-[350px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </Card>
                ) : brandingSettings?.isDonorLoginEnabled === false && brandingSettings?.isBeneficiaryLoginEnabled === false ? (
                    <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden p-8 text-center space-y-4">
                        <div className="h-16 w-16 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Supporter Portals Offline</h2>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                            Both Inbound Supporter (Donor) and Outbound Assistance (Beneficiary) portals have been temporarily taken offline by organizational administration. Please contact support if you require urgent assistance.
                        </p>
                    </Card>
                ) : (
                    <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                        {(brandingSettings?.isDonorLoginEnabled !== false && brandingSettings?.isBeneficiaryLoginEnabled !== false) && (
                            <div className="bg-slate-900 p-1 flex rounded-none">
                            {brandingSettings?.isDonorLoginEnabled !== false && (
                                <button 
                                    onClick={() => { setWorkspace('Donor'); setOtpSent(false); }}
                                    className={cn(
                                        "flex-1 py-3 text-[10px] font-black tracking-[0.2em] transition-all rounded-t-2xl",
                                        workspace === 'Donor' ? "bg-white text-primary" : "text-white/40 hover:text-white"
                                    )}
                                >
                                    Donor Portal
                                </button>
                            )}
                            {brandingSettings?.isBeneficiaryLoginEnabled !== false && (
                                <button 
                                    onClick={() => { setWorkspace('Beneficiary'); setOtpSent(false); }}
                                    className={cn(
                                        "flex-1 py-3 text-[10px] font-black tracking-[0.2em] transition-all rounded-t-2xl",
                                        workspace === 'Beneficiary' ? "bg-white text-primary" : "text-white/40 hover:text-white"
                                    )}
                                >
                                    Beneficiary Portal
                                </button>
                            )}
                        </div>
                        )}

                        <Tabs defaultValue={authMethod} onValueChange={(v) => { setAuthMethod(v as any); setOtpSent(false); }} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 rounded-none h-14 bg-slate-50/50 border-b border-slate-100">
                                <TabsTrigger value="Password" disabled={isLoading} className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-none border-r border-slate-100">
                                    <KeyRound className="h-4 w-4 mr-2" /> Password
                                </TabsTrigger>
                                <TabsTrigger value="OTP" disabled={isLoading} className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-none">
                                    <MessageSquare className="h-4 w-4 mr-2" /> Telegram OTP
                                </TabsTrigger>
                            </TabsList>
                            
                            <CardContent className="pt-8">
                                {isPortalDisabled && (
                                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl animate-fade-in text-center space-y-1">
                                        <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm">
                                            <AlertTriangle className="h-5 w-5" />
                                            <span>Portal Offline</span>
                                        </div>
                                        <p className="text-xs text-amber-700 font-medium">
                                            The {workspace} Portal has been temporarily disabled by organizational management. Please contact support if you require urgent access.
                                        </p>
                                    </div>
                                )}
                                <form onSubmit={handleLogin} className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black tracking-widest text-slate-400 pl-1">Identification</Label>
                                        <div className="relative group">
                                            <UserCircle2 className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                                            <Input 
                                                placeholder="Mobile or ID Number"
                                                className="pl-12 h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-primary/20 transition-all rounded-2xl font-medium"
                                                value={identifier}
                                                onChange={(e) => { 
                                                    const val = e.target.value;
                                                    setIdentifier(val); 
                                                    setOtpSent(false); 
                                                }}
                                                disabled={isLoading || isPortalDisabled || (authMethod === 'OTP' && otpSent)}
                                            />
                                        </div>
                                    </div>

                                    <TabsContent value="Password" title="Password Login" className="mt-0 space-y-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center pl-1">
                                                <Label className="text-[10px] font-black tracking-widest text-slate-400">Security Password</Label>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowForgotDialog(true)}
                                                    className="text-[10px] font-black text-primary hover:underline tracking-widest"
                                                    disabled={isPortalDisabled}
                                                >
                                                    Forgot?
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                                                <Input 
                                                    type="password"
                                                    placeholder="••••••••"
                                                    className="pl-12 h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-primary/20 transition-all rounded-2xl font-medium"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    disabled={isLoading || isPortalDisabled}
                                                />
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="OTP" title="OTP Login" className="mt-0 space-y-6">
                                        {!otpSent && (
                                            <div className="space-y-4">
                                                <Label className="text-[10px] font-black tracking-widest text-slate-400 pl-1">OTP Channel</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => !isPortalDisabled && setOtpChannel('Telegram')}
                                                        disabled={isPortalDisabled}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-bold",
                                                            otpChannel === 'Telegram' ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-400 hover:border-slate-300",
                                                            isPortalDisabled ? "opacity-50 cursor-not-allowed" : ""
                                                        )}
                                                    >
                                                        <MessageSquare className="h-4 w-4" /> Telegram
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => !isPortalDisabled && setOtpChannel('WhatsApp')}
                                                        disabled={isPortalDisabled}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-bold",
                                                            otpChannel === 'WhatsApp' ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-400 hover:border-slate-300",
                                                            isPortalDisabled ? "opacity-50 cursor-not-allowed" : ""
                                                        )}
                                                    >
                                                        <Smartphone className="h-4 w-4" /> WhatsApp
                                                    </button>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                                                    <ShieldQuestion className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                                        {otpChannel === 'Telegram'
                                                            ? 'We will send a secure verification code to your linked Telegram account. Ensure you have started a chat with our charity bot.'
                                                            : 'We will send a secure verification code to your registered WhatsApp number. Standard messaging applies.'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {otpSent && (
                                            <div className="space-y-2 animate-fade-in-up">
                                                <Label className="text-[10px] font-black tracking-widest text-slate-400 pl-1">Verification Code</Label>
                                                <div className="relative group">
                                                    <ShieldCheck className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                                                    <Input 
                                                        placeholder="6-Digit OTP"
                                                        className="pl-12 h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-primary/20 transition-all rounded-2xl font-mono tracking-[0.5em] text-center text-lg"
                                                        value={otp}
                                                        maxLength={6}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        disabled={isLoading || isPortalDisabled}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-center text-slate-400 font-bold tracking-widest">
                                                    Code sent via {otpChannel}. <button type="button" onClick={() => !isPortalDisabled && setOtpSent(false)} disabled={isPortalDisabled} className="text-primary hover:underline disabled:opacity-50">Change Method</button>
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <Button 
                                        type="submit" 
                                        className="w-full h-14 font-black text-sm tracking-widest shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all rounded-2xl group disabled:opacity-50"
                                        disabled={isLoading || isPortalDisabled}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                {authMethod === 'OTP' && !otpSent ? 'Send OTP Code' : 'Verify Identity'}
                                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Tabs>
                    </Card>
                )}

                <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 tracking-widest pt-4">
                    <Link href="/" className="hover:text-primary transition-colors">Home</Link>
                    <span className="opacity-20">|</span>
                    <Link href="/portal-register" className="hover:text-primary transition-colors">Register</Link>
                    <span className="opacity-20">|</span>
                    <Link href="/campaign-public" className="hover:text-primary transition-colors">Campaigns</Link>
                </div>
            </div>

            <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Security Recovery</DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            {forgotStep === 'ID' && "Enter your identification to receive a recovery code via Telegram."}
                            {forgotStep === 'OTP' && "A secure code has been sent to your Telegram account."}
                            {forgotStep === 'RESET' && "Identity verified. Please set your new portal password."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-4">
                        {forgotStep === 'ID' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black tracking-widest text-slate-400">Mobile or ID Number</Label>
                                <Input 
                                    placeholder="Enter identifier" 
                                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-medium"
                                    value={forgotIdentifier}
                                    onChange={(e) => setForgotIdentifier(e.target.value)}
                                />
                            </div>
                        )}
                        {forgotStep === 'OTP' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black tracking-widest text-slate-400">Recovery Code</Label>
                                <Input 
                                    placeholder="6-Digit OTP" 
                                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-mono text-center text-lg tracking-[0.5em]"
                                    value={forgotOtp}
                                    maxLength={6}
                                    onChange={(e) => setForgotOtp(e.target.value)}
                                />
                            </div>
                        )}
                        {forgotStep === 'RESET' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black tracking-widest text-slate-400">New Password</Label>
                                <Input 
                                    type="password"
                                    placeholder="••••••••" 
                                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-medium"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button 
                            className="w-full h-12 font-black text-xs tracking-widest rounded-2xl shadow-xl shadow-primary/20"
                            onClick={handleForgotFlow}
                            disabled={isForgotLoading}
                        >
                            {isForgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                forgotStep === 'ID' ? "Send Recovery Code" : (forgotStep === 'OTP' ? "Verify Code" : "Update Password")
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function PortalLoginPage() {
    return (
        <Suspense fallback={<BrandedLoader message="Authenticating Supporter Identity..." />}>
            <PortalLoginContent />
        </Suspense>
    );
}
