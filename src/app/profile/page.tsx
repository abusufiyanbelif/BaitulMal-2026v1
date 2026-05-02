'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc, storageRef, uploadBytes, getDownloadURL, useStorage } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { NotificationManager } from '@/components/notification-manager';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    UserCircle2, 
    Smartphone, 
    Mail, 
    MapPin, 
    ShieldCheck, 
    FileText, 
    IdCard,
    Landmark,
    Building2,
    CalendarDays,
    Activity,
    Edit3,
    Loader2,
    Clock,
    X,
    Plus,
    Building,
    KeyRound,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    Hash,
    ShieldAlert,
    ArrowLeft
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { UserProfile, BankDetail, PendingVerification } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';
import { useToast } from '@/hooks/use-toast';
import { processPortalProfileUpdateAction, checkPendingVerificationAction } from '@/app/verifications/actions';
import { updatePortalPasswordAction } from '@/app/portal-login/actions';
import { revokeUserSessionsAction } from '../settings/auth-actions';
import { sendUserWhatsAppTestAction, sendUserTelegramTestAction } from '@/app/messages/actions';
import { SessionTable } from '@/components/session-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<PendingVerification | null>(null);
    const [refreshSessionsKey, setRefreshSessionsKey] = useState(0);
    
    // Password States
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Form States
    const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
    const [upiIds, setUpiIds] = useState<string[]>([]);
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
    const [idProofFile, setIdProofFile] = useState<File | null>(null);

    // Viewer States
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Testing States
    const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
    const [isTestingTelegram, setIsTestingTelegram] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setBankDetails(userProfile.bankDetails || [{ bankName: '', accountNumber: '', ifscCode: '' }]);
            setUpiIds(userProfile.upiIds || ['']);
            
            checkPendingVerificationAction(userProfile.id).then(req => {
                if (req) setPendingRequest(req as any);
            });
        }
    }, [userProfile, isEditDialogOpen]);

    const handleRevokeSessions = async () => {
        if (!userProfile) return;
        if (!confirm("Are you sure you want to terminate all other active sessions?")) return;

        setIsSubmitting(true);
        try {
            const res = await revokeUserSessionsAction(userProfile.id);
            if (res.success) {
                localStorage.setItem('portal_session_start', Date.now().toString());
                setRefreshSessionsKey(prev => prev + 1);
                toast({ title: "Sessions Terminated", description: res.message, variant: "success" });
            } else {
                toast({ title: "Operation Failed", description: res.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "System Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);
            let aadhaarUrl = userProfile?.aadhaarProofUrl;
            let idProofUrl = userProfile?.idProofUrl;

            if (aadhaarFile && storage && userProfile) {
                const fileRef = storageRef(storage, `kyc/users/${userProfile.id}/aadhaar_${Date.now()}`);
                const uploadRes = await uploadBytes(fileRef, aadhaarFile);
                aadhaarUrl = await getDownloadURL(uploadRes.ref);
            }

            if (idProofFile && storage && userProfile) {
                const fileRef = storageRef(storage, `kyc/users/${userProfile.id}/idproof_${Date.now()}`);
                const uploadRes = await uploadBytes(fileRef, idProofFile);
                idProofUrl = await getDownloadURL(uploadRes.ref);
            }

            const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
            const validUpis = upiIds.filter(u => u.trim() !== '');

            const updatePayload: Partial<UserProfile> = {
                name: formData.get('name') as string,
                phone: formData.get('phone') as string,
                email: formData.get('email') as string,
                address: formData.get('address') as string,
                aadhaarNumber: formData.get('aadhaarNumber') as string,
                aadhaarName: formData.get('aadhaarName') as string,
                aadhaarDob: formData.get('aadhaarDob') as string,
                aadhaarGender: formData.get('aadhaarGender') as string,
                aadhaarAddress: formData.get('aadhaarAddress') as string,
                aadhaarProofUrl: aadhaarUrl,
                idProofUrl: idProofUrl,
                idProofType: formData.get('idProofType') as string,
                idNumber: formData.get('idNumber') as string,
                bankDetails: validBanks,
                upiIds: validUpis,
                telegramChatId: formData.get('telegramChatId') as string,
                panNumber: formData.get('panNumber') as string,
            };

            if (userProfile) {
                const res = await processPortalProfileUpdateAction(userProfile.id, userProfile.name, updatePayload);
                if (res.success) {
                    toast({ title: 'Request Dispatched', description: 'Changes awaiting approval.', variant: 'success' });
                    setIsEditDialogOpen(false);
                    const req = await checkPendingVerificationAction(userProfile.id);
                    if (req) setPendingRequest(req as any);
                } else {
                    toast({ title: 'Update Failed', description: res.message, variant: 'destructive' });
                }
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordSave = async () => {
        if (!userProfile) return;
        if (!newPassword || newPassword.length < 6) {
            toast({ title: 'Invalid Password', description: 'At least 6 characters required.', variant: 'destructive'});
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: 'Mismatch', description: 'Passwords do not match.', variant: 'destructive'});
            return;
        }

        setIsSavingPassword(true);
        try {
            const res = await updatePortalPasswordAction(userProfile.id, userProfile.role, newPassword);
            if (res.success) {
                toast({ title: 'Success', description: res.message, variant: 'success' });
                setIsPasswordDialogOpen(false);
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast({ title: 'Error', description: res.message, variant: 'destructive' });
            }
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleTestWhatsApp = async () => {
        setIsTestingWhatsApp(true);
        try {
            const res = await sendUserWhatsAppTestAction();
            if (res.success) {
                toast({ title: 'Test Dispatched', description: 'Connectivity verified. Check your WhatsApp.', variant: 'success' });
            } else {
                toast({ title: 'Verification Failed', description: res.message, variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'System Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsTestingWhatsApp(false);
        }
    };

    const handleTestTelegram = async () => {
        setIsTestingTelegram(true);
        try {
            const res = await sendUserTelegramTestAction();
            if (res.success) {
                toast({ title: 'Telegram Pulse Sent', description: 'Diagnostic message received successfully.', variant: 'success' });
            } else {
                toast({ title: 'Telegram Fault', description: res.message, variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'System Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    if (isSessionLoading) {
        return <BrandedLoader message="Synchronizing Identity Records..." />;
    }

    if (!userProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <UserCircle2 className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Profile Data Unavailable</p>
                <Button asChild variant="outline">
                    <Link href="/portal-login">Return to Login</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in-up pb-12">
            <div className="flex items-center justify-between">
                <Button variant="outline" asChild className="rounded-xl border-slate-200">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" /> 
                        <span>Dashboard</span>
                    </Link>
                </Button>
            </div>

            {pendingRequest && (
                <Alert className="bg-amber-50 border-amber-200 rounded-3xl animate-pulse">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 font-black text-xs uppercase tracking-widest">Update Pending Approval</AlertTitle>
                    <AlertDescription className="text-amber-700 text-[11px] font-bold">
                        A change request is awaiting administrative review. Edits are restricted.
                    </AlertDescription>
                </Alert>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="h-28 w-28 rounded-3xl bg-primary/10 flex items-center justify-center text-primary relative shadow-inner">
                    <UserCircle2 className="h-14 w-14" />
                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-xl shadow-lg border-4 border-white">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                </div>
                <div className="flex-1 text-center md:text-left z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{userProfile.name}</h1>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-widest px-3 py-1">{userProfile.role}</Badge>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Smartphone className="h-3 w-3 text-primary/60" /> {userProfile.phone || 'No phone'}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Mail className="h-3 w-3 text-primary/60" /> {userProfile.email}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-3">
                    <Button 
                        onClick={() => setIsEditDialogOpen(true)} 
                        disabled={!!pendingRequest}
                        className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 shadow-xl"
                    >
                        <Edit3 className="mr-2 h-4 w-4" /> Modify Profile
                    </Button>
                    <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)} className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 border-slate-200">
                        <KeyRound className="mr-2 h-4 w-4" /> Change Password
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <IdCard className="h-5 w-5 text-primary/60" /> Identification Records (KYC)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name (As per ID)</p>
                                <p className="text-sm font-bold text-slate-800">{userProfile.aadhaarName || userProfile.name}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aadhaar Number</p>
                                <p className="text-sm font-bold text-slate-800 font-mono">{userProfile.aadhaarNumber ? `XXXX XXXX ${userProfile.aadhaarNumber.slice(-4)}` : 'Not Linked'}</p>
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residential Address</p>
                                <div className="flex items-start gap-2 pt-1 text-sm font-medium text-slate-700 leading-relaxed">
                                    <MapPin className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
                                    {userProfile.address || userProfile.aadhaarAddress || 'No address recorded'}
                                </div>
                            </div>
                            <div className="flex gap-4 sm:col-span-2 pt-4">
                                {userProfile.aadhaarProofUrl && (
                                    <Button variant="outline" size="sm" onClick={() => handleViewImage(userProfile.aadhaarProofUrl!)} className="font-bold text-[10px] uppercase tracking-widest rounded-xl border-slate-200">
                                        <FileText className="mr-2 h-4 w-4 opacity-40" /> View Aadhaar
                                    </Button>
                                )}
                                {userProfile.idProofUrl && (
                                    <Button variant="outline" size="sm" onClick={() => handleViewImage(userProfile.idProofUrl!)} className="font-bold text-[10px] uppercase tracking-widest rounded-xl border-slate-200">
                                        <FileText className="mr-2 h-4 w-4 opacity-40" /> View ID Proof
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Building className="h-5 w-5 text-primary/60" /> Organization Context
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Group / Department</p>
                                <p className="text-sm font-bold text-slate-800">{userProfile.organizationGroup || 'General'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Since</p>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                    <CalendarDays className="h-4 w-4 text-slate-300" />
                                    {userProfile.createdAt ? formatDate(userProfile.createdAt as any) : 'N/A'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Landmark className="h-5 w-5 text-primary/60" /> Settlement Methods
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 space-y-6">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPI Identities</p>
                                <div className="flex flex-wrap gap-2">
                                    {userProfile.upiIds && userProfile.upiIds.length > 0 ? (
                                        userProfile.upiIds.map((upi, i) => (
                                            <Badge key={i} variant="outline" className="font-mono text-[10px] font-bold border-slate-200 bg-slate-50 text-slate-600 px-3 py-1 rounded-xl">{upi}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-[10px] font-bold text-slate-300 italic">No handles linked</p>
                                    )}
                                </div>
                            </div>
                            <Separator className="bg-slate-100" />
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Accounts</p>
                                {userProfile.bankDetails && userProfile.bankDetails.length > 0 ? (
                                    userProfile.bankDetails.map((bank, idx) => (
                                        <div key={idx} className="space-y-3 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="h-4 w-4 text-primary/40" />
                                                <span className="text-sm font-black text-slate-800">{bank.bankName}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Number</p>
                                                <p className="text-xs font-mono text-slate-900 font-bold">{bank.accountNumber}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-300 italic">No accounts linked</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-slate-900 text-white rounded-3xl overflow-hidden mt-8">
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <ShieldAlert className="h-8 w-8 text-white/40" />
                                <Badge className="bg-white/10 text-white border-white/20 font-mono text-[9px]">SECURE-SSL</Badge>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-lg">Session Security</h3>
                                <p className="text-xs text-white/60 leading-relaxed">Terminate other sessions if you suspect unauthorized access.</p>
                            </div>
                            <SessionTable userId={userProfile.id} refreshKey={refreshSessionsKey} />
                            <Button 
                                variant="outline" 
                                className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold h-11 rounded-xl"
                                onClick={handleRevokeSessions}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />} Terminate Sessions
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden mt-8">
                        <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-emerald-900">
                                <Activity className="h-5 w-5 text-emerald-600/60" /> Connectivity Diagnostics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp (OTP) Status</p>
                                    <div className="flex items-center justify-between gap-4 pt-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                            <div className={cn("h-2 w-2 rounded-full", userProfile.phone ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                                            {userProfile.phone ? "Ready to Receive" : "Phone Missing"}
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            disabled={isTestingWhatsApp || !userProfile.phone}
                                            onClick={handleTestWhatsApp}
                                            className="h-8 font-black text-[9px] uppercase tracking-widest rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        >
                                            {isTestingWhatsApp ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Smartphone className="h-3 w-3 mr-2" />} Test OTP
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="bg-slate-100" />

                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telegram Integration</p>
                                    <div className="flex items-center justify-between gap-4 pt-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                            <div className={cn("h-2 w-2 rounded-full", userProfile.telegramChatId ? "bg-sky-500 animate-pulse" : "bg-slate-300")} />
                                            {userProfile.telegramChatId ? "Linked & Active" : "Not Integrated"}
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            disabled={isTestingTelegram || !userProfile.telegramChatId}
                                            onClick={handleTestTelegram}
                                            className="h-8 font-black text-[9px] uppercase tracking-widest rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
                                        >
                                            {isTestingTelegram ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Hash className="h-3 w-3 mr-2" />} Test Telegram
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="bg-slate-100" />
                                
                                <div className="space-y-4 pt-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Taskbar Alerts</p>
                                    <NotificationManager />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Infrastructure Support Card */}
                    <Card className="rounded-[32px] overflow-hidden border-pink-100 bg-pink-50/20 group">
                        <CardHeader className="px-8 pt-8 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-pink-100 rounded-2xl text-pink-600 group-hover:scale-110 transition-transform duration-500">
                                    <HeartHandshake className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Institutional Support</CardTitle>
                                    <CardDescription className="text-xs font-medium text-slate-500">Contribute to portal maintenance & resources.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-8 pb-8 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                Help us keep the BaitulMal Registry running. Your contributions fund our WhatsApp APIs, AI Vision systems, and secure cloud storage.
                            </p>
                            <Link href="/settings/resources/fundraising">
                                <Button className="w-full h-11 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-pink-200">
                                    Contribute to Infrastructure
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl rounded-[32px] p-0 flex flex-col max-h-[90vh] overflow-hidden">
                    <DialogHeader className="px-8 py-6 bg-slate-50/50 border-b shrink-0">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Modify Identity Records</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">Changes will be reviewed by administrators.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateProfile} className="flex flex-col h-[75vh] bg-white">
                        <ScrollArea className="flex-1">
                            <div className="p-8 space-y-10 pb-32">
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                                            <Input name="name" defaultValue={userProfile.name} required className="h-11 rounded-xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
                                            <Input name="phone" defaultValue={userProfile.phone} required className="h-11 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold">Submit for Approval</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Image Viewer */}
            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl rounded-[32px]">
                    <DialogHeader><DialogTitle className="text-lg font-black text-slate-900">Document Viewer</DialogTitle></DialogHeader>
                    {imageToView && (
                        <div className="relative h-[60vh] w-full mt-4 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden">
                            <div style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.2s' }} className="relative w-full h-full">
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Document" fill className="object-contain" unoptimized />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setZoom(z => z * 1.2)} className="rounded-xl"><ZoomIn className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => setZoom(z => z / 1.2)} className="rounded-xl"><ZoomOut className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => setRotation(r => r + 90)} className="rounded-xl"><RotateCw className="h-4 w-4"/></Button>
                        <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }} className="rounded-xl font-bold">Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary flex items-center gap-2"><KeyRound className="h-5 w-5" /> Update Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs">New Password</Label>
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs">Confirm Password</Label>
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handlePasswordSave} disabled={isSavingPassword} className="rounded-xl font-bold">Update Password</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
