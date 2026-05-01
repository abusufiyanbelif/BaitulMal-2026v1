'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc, storageRef, uploadBytes, getDownloadURL, useStorage } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
    CheckCircle2,
    Clock,
    X,
    Plus,
    Building,
    KeyRound,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    BadgeInfo,
    Hash,
    Eye,
    ShieldAlert
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { User, BankDetail, PendingVerification } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/file-uploader';
import { useToast } from '@/hooks/use-toast';
import { processPortalProfileUpdateAction, checkPendingVerificationAction } from '@/app/verifications/actions';
import { supporterUpdatePasswordAction } from '@/app/portal-login/actions';
import { revokeUserSessionsAction } from '../settings/auth-actions';
import { SessionTable } from '@/components/session-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function ProfilePage() {
    const { userProfile, isLoading: isSessionLoading, forceRefetch: forceRefetchUser } = useSession();
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
        if (!confirm("Are you sure you want to terminate all other active sessions? You will need to log back in on your other devices.")) return;

        setIsSubmitting(true);
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
            setIsSubmitting(false);
        }
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
                    <Link href="/login">Return to Login</Link>
                </Button>
            </div>
        );
    }

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);
            let aadhaarUrl = userProfile.aadhaarProofUrl;
            let idProofUrl = userProfile.idProofUrl;

            if (aadhaarFile && storage) {
                const fileRef = storageRef(storage, `kyc/users/${userProfile.id}/aadhaar_${Date.now()}`);
                const uploadRes = await uploadBytes(fileRef, aadhaarFile);
                aadhaarUrl = await getDownloadURL(uploadRes.ref);
            }

            if (idProofFile && storage) {
                const fileRef = storageRef(storage, `kyc/users/${userProfile.id}/idproof_${Date.now()}`);
                const uploadRes = await uploadBytes(fileRef, idProofFile);
                idProofUrl = await getDownloadURL(uploadRes.ref);
            }

            const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
            const validUpis = upiIds.filter(u => u.trim() !== '');

            const updatePayload: Partial<User> = {
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

            const res = await processPortalProfileUpdateAction(userProfile.id, userProfile.name, updatePayload);
            
            if (res.success) {
                toast({ title: 'Request Dispatched', description: 'Your changes are awaiting administrative approval.', variant: 'success' });
                setIsEditDialogOpen(false);
                const req = await checkPendingVerificationAction(userProfile.id);
                if (req) setPendingRequest(req as any);
            } else {
                toast({ title: 'Update Failed', description: res.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordSave = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast({ title: 'Invalid Password', description: 'Password must be at least 6 characters long.', variant: 'destructive'});
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: 'Mismatch', description: 'Passwords do not match.', variant: 'destructive'});
            return;
        }

        setIsSavingPassword(true);
        try {
            const res = await supporterUpdatePasswordAction(userProfile.id, userProfile.role, newPassword);
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

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in-up pb-12">
            <div className="flex items-center justify-between">
                <Button variant="outline" asChild className="rounded-xl border-slate-200">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
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
                        {userProfile.telegramChatId && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <Activity className="h-3 w-3 text-primary/60" /> {userProfile.telegramChatId}
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Mail className="h-3 w-3 text-primary/60" /> {userProfile.email}
                        </div>
                        {userProfile.panNumber && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <Hash className="h-3 w-3 text-primary/60" /> {userProfile.panNumber}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-3">
                    <Button 
                        onClick={() => setIsEditDialogOpen(true)} 
                        disabled={!!pendingRequest}
                        className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 shadow-xl active:scale-95 transition-all"
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
                    {/* Identity & KYC */}
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
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PAN Number</p>
                                <p className="text-sm font-bold text-slate-800 font-mono uppercase">{userProfile.panNumber || 'Not Linked'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secondary ID Type</p>
                                <p className="text-sm font-bold text-slate-800">{userProfile.idProofType || 'None'}</p>
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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</p>
                                <p className="text-sm font-bold text-slate-800">{userProfile.organizationRole || 'Member'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Since</p>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                    <CalendarDays className="h-4 w-4 text-slate-300" />
                                    {userProfile.createdAt ? formatDate(userProfile.createdAt as any) : 'N/A'}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                <Badge variant={userProfile.status === 'Active' ? 'default' : 'outline'}>{userProfile.status}</Badge>
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
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Terminate Other Sessions
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl rounded-[32px] border-slate-100 p-0 flex flex-col max-h-[90vh] overflow-hidden">
                    <DialogHeader className="px-8 py-6 bg-slate-50/50 border-b shrink-0">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Modify Identity Records</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">Proposed changes will be reviewed by administrators.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateProfile} className="flex flex-col h-[75vh] bg-white rounded-b-[32px]">
                        <ScrollArea className="flex-1">
                            <div className="p-8 space-y-10 pb-32">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <Activity className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Information</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                                        <Input name="name" defaultValue={userProfile.name} required className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
                                        <Input name="phone" defaultValue={userProfile.phone} required className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</Label>
                                        <Input name="email" defaultValue={userProfile.email} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telegram ID</Label>
                                        <Input name="telegramChatId" defaultValue={userProfile.telegramChatId} className="h-11 rounded-xl font-mono" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Address</Label>
                                        <Input name="address" defaultValue={userProfile.address} className="h-11 rounded-xl" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identification (Aadhaar/PAN)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aadhaar Number</Label>
                                        <Input name="aadhaarNumber" defaultValue={userProfile.aadhaarNumber} maxLength={12} className="h-11 rounded-xl font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PAN Number</Label>
                                        <Input name="panNumber" defaultValue={userProfile.panNumber} className="h-11 rounded-xl font-mono uppercase" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secondary ID Type</Label>
                                        <Input name="idProofType" defaultValue={userProfile.idProofType} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Number</Label>
                                        <Input name="idNumber" defaultValue={userProfile.idNumber} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="md:col-span-2 space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Proof Documents</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50 text-center">Aadhaar Card</p>
                                                <FileUploader onFilesChange={(files) => setAadhaarFile(files[0] || null)} acceptedFileTypes="image/*,application/pdf" />
                                            </div>
                                            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50 text-center">Secondary ID Proof</p>
                                                <FileUploader onFilesChange={(files) => setIdProofFile(files[0] || null)} acceptedFileTypes="image/*,application/pdf" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-3.5 w-3.5 text-primary" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement Details</h4>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setBankDetails([...bankDetails, { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-8 text-[9px] font-black uppercase tracking-widest rounded-xl">
                                        <Plus className="h-3 w-3 mr-1" /> Add Account
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {bankDetails.map((bank, idx) => (
                                        <div key={idx} className="relative p-6 rounded-2xl border border-slate-100 bg-slate-50/30 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {bankDetails.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setBankDetails(bankDetails.filter((_, i) => i !== idx))} className="absolute top-2 right-2 h-7 w-7 text-slate-300 hover:text-red-500 rounded-full"><X className="h-4 w-4" /></Button>
                                            )}
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bank Name</Label>
                                                <Input value={bank.bankName} onChange={(e) => { const newB = [...bankDetails]; newB[idx].bankName = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Account No.</Label>
                                                <Input value={bank.accountNumber} onChange={(e) => { const newB = [...bankDetails]; newB[idx].accountNumber = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-bold rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">IFSC Code</Label>
                                                <Input value={bank.ifscCode} onChange={(e) => { const newB = [...bankDetails]; newB[idx].ifscCode = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-bold rounded-xl" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">UPI Handles</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setUpiIds([...upiIds, ''])} className="h-7 text-[9px] font-black uppercase tracking-widest rounded-xl"><Plus className="h-3 w-3 mr-1" /> Add UPI</Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {upiIds.map((upi, idx) => (
                                            <div key={idx} className="flex gap-2 items-center group">
                                                <Input value={upi} onChange={(e) => { const newU = [...upiIds]; newU[idx] = e.target.value; setUpiIds(newU); }} placeholder="handle@upi" className="flex-1 h-11 text-xs font-mono font-bold rounded-xl" />
                                                {upiIds.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => setUpiIds(upiIds.filter((_, i) => i !== idx))} className="h-9 w-9 text-slate-300 hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex flex-col md:flex-row gap-3 rounded-b-[32px]">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full md:w-auto font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl bg-white">Discard changes</Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto font-black uppercase tracking-widest text-[10px] h-12 px-10 rounded-2xl shadow-xl">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Submit for Approval
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Image Viewer */}
            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">Identity Proof Document</DialogTitle>
                    </DialogHeader>
                    {imageToView && (
                        <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center">
                            <div className="relative w-full h-full" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease-out' }}>
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Document" fill className="object-contain" unoptimized />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="sm:justify-center pt-4 flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setZoom(z => z * 1.2)} className="rounded-xl"><ZoomIn className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => setZoom(z => z / 1.2)} className="rounded-xl"><ZoomOut className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => setRotation(r => r + 90)} className="rounded-xl"><RotateCw className="h-4 w-4"/></Button>
                        <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }} className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-4">Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary flex items-center gap-2"><KeyRound className="h-5 w-5" /> Update Portal Password</DialogTitle>
                        <DialogDescription className="text-xs">Ensure your credentials remain secure and confidential.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs uppercase tracking-widest opacity-60">New Password</Label>
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isSavingPassword} className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs uppercase tracking-widest opacity-60">Confirm Password</Label>
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isSavingPassword} className="h-11 rounded-xl" />
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handlePasswordSave} disabled={isSavingPassword} className="rounded-xl font-bold">
                            {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Update Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
