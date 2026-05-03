'use client';

import { useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
    Settings, 
    KeyRound, 
    Bell, 
    Smartphone, 
    ShieldAlert,
    Loader2,
    CheckCircle2,
    Eye,
    EyeOff,
    RefreshCw
} from 'lucide-react';
import { updatePortalPasswordAction } from '@/app/portal-login/actions';
import { revokeUserSessionsAction } from '../../settings/auth-actions';
import { SessionTable } from '@/components/session-table';
import Link from 'next/link';

export default function BeneficiarySettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [refreshSessionsKey, setRefreshSessionsKey] = useState(0);

    // Fetch Beneficiary Config for notification visibility
    const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
    const { data: config } = useDoc<any>(configRef);

    if (isSessionLoading) {
         return <BrandedLoader message="Synchronizing Security Preferences..." />;
    }

    if (!userProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <ShieldAlert className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Security Session Unavailable</p>
                <Button asChild variant="outline">
                    <Link href="/portal-login">Return to Login</Link>
                </Button>
            </div>
        );
    }

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const res = await updatePortalPasswordAction(userProfile!.id, 'Beneficiary', newPassword);
            if (res.success) {
                toast({ title: "Security Updated", description: "Your portal password has been synchronized.", variant: "success" });
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast({ title: "Update Failed", description: res.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "System Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleRevokeSessions = async () => {
        if (!userProfile) return;
        if (!confirm("Are you sure you want to terminate all other active sessions? You will need to log back in on your other devices.")) return;

        setIsUpdatingPassword(true);
        try {
            const res = await revokeUserSessionsAction(userProfile.id);
            if (res.success) {
                // Update local session start to prevent logging out the current tab
                localStorage.setItem('portal_session_start', Date.now().toString());
                setRefreshSessionsKey(prev => prev + 1);
                toast({ title: "Sessions Terminated", description: res.message, variant: "success" });
            } else {
                toast({ title: "Operation Failed", description: res.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "System Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in-up pb-12">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Settings className="h-6 w-6 text-primary" /> Security & Preferences
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">Manage your access credentials and organization notification rules.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Password Management */}
                <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                            <KeyRound className="h-5 w-5 text-primary/60" /> Portal Password
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Update your secure entry password for the beneficiary portal.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handlePasswordUpdate} className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">New Secure Password</Label>
                                <div className="relative group">
                                    <Input 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="••••••••" 
                                        className="h-12 rounded-xl border-slate-200 focus:ring-primary/20 transition-all pr-12"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={isUpdatingPassword}
                                    />
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1.5 h-9 w-9 text-slate-300 hover:text-primary rounded-lg"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm New Password</Label>
                                <Input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••••" 
                                    className="h-12 rounded-xl border-slate-200 focus:ring-primary/20 transition-all"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isUpdatingPassword}
                                />
                            </div>
                            <Button 
                                type="submit" 
                                className="w-full h-12 font-bold shadow-lg shadow-primary/20 rounded-xl"
                                disabled={isUpdatingPassword || !newPassword}
                            >
                                {isUpdatingPassword ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sync New Password"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Notifications & System Status */}
                <div className="space-y-8">
                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Bell className="h-5 w-5 text-primary/60" /> Organization Alerts
                            </CardTitle>
                            <CardDescription className="text-xs font-medium">Global notification rules configured by administrators.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8 space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                        <Smartphone className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-800">WhatsApp Updates</p>
                                        <p className="text-[10px] text-slate-400">Transaction notifications & verifications</p>
                                    </div>
                                </div>
                                {config?.enableWhatsAppNotifications !== false ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <ShieldAlert className="h-5 w-5 text-slate-300" />
                                )}
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-800">In-App Notifications</p>
                                        <p className="text-[10px] text-slate-400">Portal alerts and system news</p>
                                    </div>
                                </div>
                                {config?.enableInAppNotifications !== false ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <ShieldAlert className="h-5 w-5 text-slate-300" />
                                )}
                            </div>
                            
                            <p className="text-[10px] text-slate-400 text-center pt-2 font-medium italic">
                                * To modify notification channels, please contact the administrative desk.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-slate-900 text-white rounded-3xl overflow-hidden">
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <ShieldAlert className="h-8 w-8 text-white/40" />
                                <Badge className="bg-white/10 text-white border-white/20 font-mono text-[9px]">
                                    SECURE-SSL-256-BIT
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-lg">Session Security</h3>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    Your session is protected by multi-layer encryption. If you suspect unauthorized access, terminate all other active sessions immediately.
                                </p>
                            </div>

                            <SessionTable userId={userProfile.id} refreshKey={refreshSessionsKey} />

                            <Button 
                                variant="outline" 
                                className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold h-11 rounded-xl transition-all active:scale-95 mt-4"
                                onClick={handleRevokeSessions}
                                disabled={isUpdatingPassword}
                            >
                                {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Terminate Other Sessions
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
