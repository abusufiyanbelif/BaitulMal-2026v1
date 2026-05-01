'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc, useCollection, query, collection, where, storageRef, uploadBytes, getDownloadURL, useStorage } from '@/firebase';
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
    SmartphoneNfc,
    HeartHandshake,
    Briefcase,
    Users
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Beneficiary, BankDetail, PendingVerification } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/file-uploader';
import { useToast } from '@/hooks/use-toast';
import { processPortalBeneficiaryUpdateAction, checkPendingVerificationAction } from '@/app/verifications/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

export default function BeneficiaryProfilePage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<PendingVerification | null>(null);
    
    // Form States
    const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
    const [upiIds, setUpiIds] = useState<string[]>([]);
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

    const beneficiaryRef = useMemoFirebase(() => {
        if (!firestore || !userProfile?.id || userProfile.role !== 'Beneficiary') return null;
        return doc(firestore, 'beneficiaries', userProfile.id);
    }, [firestore, userProfile?.id, userProfile?.role]);

    const { data: beneficiaryData, isLoading: isBeneficiaryLoading } = useDoc<Beneficiary>(beneficiaryRef);

    useEffect(() => {
        if (beneficiaryData) {
            setBankDetails(beneficiaryData.bankDetails || [{ bankName: '', accountNumber: '', ifscCode: '' }]);
            setUpiIds(beneficiaryData.upiIds || ['']);
            
            // Check for pending requests
            checkPendingVerificationAction(beneficiaryData.id).then(req => {
                if (req) setPendingRequest(req as any);
            });
        }
    }, [beneficiaryData]);

    if (isSessionLoading || isBeneficiaryLoading) {
         return <BrandedLoader message="Synchronizing Identity Records..." />;
    }

    if (!beneficiaryData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <UserCircle2 className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Profile Data Unavailable</p>
            </div>
        );
    }

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);
            let aadhaarUrl = beneficiaryData.aadhaarProofUrl;

            // Handle File Upload if exists
            if (aadhaarFile && storage) {
                const fileRef = storageRef(storage, `kyc/beneficiaries/${beneficiaryData.id}/aadhaar_${Date.now()}`);
                const uploadRes = await uploadBytes(fileRef, aadhaarFile);
                aadhaarUrl = await getDownloadURL(uploadRes.ref);
            }

            const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
            const validUpis = upiIds.filter(u => u.trim() !== '');

            const updatePayload: Partial<Beneficiary> = {
                name: formData.get('name') as string,
                phone: formData.get('phone') as string,
                address: formData.get('address') as string,
                aadhaarNumber: formData.get('aadhaarNumber') as string,
                aadhaarName: formData.get('aadhaarName') as string,
                aadhaarDob: formData.get('aadhaarDob') as string,
                aadhaarGender: formData.get('aadhaarGender') as string,
                aadhaarAddress: formData.get('aadhaarAddress') as string,
                aadhaarProofUrl: aadhaarUrl,
                bankDetails: validBanks,
                upiIds: validUpis,
                telegramChatId: formData.get('telegramChatId') as string,
                occupation: formData.get('occupation') as string,
                members: Number(formData.get('members')) || 0,
                earningMembers: Number(formData.get('earningMembers')) || 0,
            };

            const res = await processPortalBeneficiaryUpdateAction(beneficiaryData.id, beneficiaryData.name, updatePayload);
            
            if (res.success) {
                toast({ title: 'Request Dispatched', description: 'Your changes are awaiting administrative approval.', variant: 'success' });
                setIsEditDialogOpen(false);
                const req = await checkPendingVerificationAction(beneficiaryData.id);
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

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in-up pb-12">
            {/* Pending Alert */}
            {pendingRequest && (
                <Alert className="bg-amber-50 border-amber-200 rounded-3xl animate-pulse">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 font-black text-xs uppercase tracking-widest">Update Pending Approval</AlertTitle>
                    <AlertDescription className="text-amber-700 text-[11px] font-bold">
                        Institutional records modification is awaiting administrative review. Edits are temporarily restricted.
                    </AlertDescription>
                </Alert>
            )}

            {/* Profile Overview Header */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="h-28 w-28 rounded-3xl bg-primary/10 flex items-center justify-center text-primary relative shadow-inner">
                    <UserCircle2 className="h-14 w-14" />
                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-xl shadow-lg border-4 border-white">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                </div>
                <div className="flex-1 text-center md:text-left z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{beneficiaryData.name}</h1>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-widest px-3 py-1">Community Member</Badge>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Smartphone className="h-3 w-3 text-primary/60" /> {beneficiaryData.phone || 'No phone recorded'}
                        </div>
                        {beneficiaryData.telegramChatId && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <SmartphoneNfc className="h-3 w-3 text-primary/60" /> {beneficiaryData.telegramChatId}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-3">
                    <Button 
                        onClick={() => setIsEditDialogOpen(true)} 
                        disabled={!!pendingRequest}
                        className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 shadow-xl shadow-primary/10 active:scale-95 transition-all"
                    >
                        <Edit3 className="mr-2 h-4 w-4" /> Modify Profile
                    </Button>
                    <Button asChild variant="outline" className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 border-slate-200">
                        <Link href="/beneficiary-portal/settings">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Security Settings
                        </Link>
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
                                <p className="text-sm font-bold text-slate-800">{beneficiaryData.aadhaarName || beneficiaryData.name}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aadhaar Number</p>
                                <p className="text-sm font-bold text-slate-800 font-mono">{beneficiaryData.aadhaarNumber ? `XXXX XXXX ${beneficiaryData.aadhaarNumber.slice(-4)}` : 'Not Linked'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                                <p className="text-sm font-bold text-slate-800">{beneficiaryData.aadhaarDob || 'Not specified'}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                                <p className="text-sm font-bold text-slate-800">{beneficiaryData.aadhaarGender || 'Not specified'}</p>
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Address</p>
                                <div className="flex items-start gap-2 pt-1 text-sm font-medium text-slate-700 leading-relaxed">
                                    <MapPin className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
                                    {beneficiaryData.address || beneficiaryData.aadhaarAddress || 'No address recorded'}
                                </div>
                            </div>
                            {beneficiaryData.aadhaarProofUrl && (
                                <div className="sm:col-span-2 pt-4">
                                    <Button variant="outline" asChild size="sm" className="font-bold text-[10px] uppercase tracking-widest rounded-xl border-slate-200">
                                        <a href={beneficiaryData.aadhaarProofUrl} target="_blank" rel="noopener noreferrer">
                                            <FileText className="mr-2 h-4 w-4 opacity-40" /> View Document Evidence
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Household Details */}
                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Users className="h-5 w-5 text-primary/60" /> Household Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Family Members</p>
                                <p className="text-xl font-black text-slate-800">{beneficiaryData.members || 0}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Earning Members</p>
                                <p className="text-xl font-black text-slate-800">{beneficiaryData.earningMembers || 0}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Occupation</p>
                                <p className="text-sm font-bold text-slate-800">{beneficiaryData.occupation || 'Not specified'}</p>
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
                                    {beneficiaryData.upiIds && beneficiaryData.upiIds.length > 0 ? (
                                        beneficiaryData.upiIds.map((upi, i) => (
                                            <Badge key={i} variant="outline" className="font-mono text-[10px] font-bold border-slate-200 bg-slate-50 text-slate-600 px-3 py-1 rounded-xl">
                                                {upi}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-[10px] font-bold text-slate-300 italic">No UPI handles linked</p>
                                    )}
                                </div>
                            </div>
                            
                            <Separator className="bg-slate-100" />

                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Accounts</p>
                                {beneficiaryData.bankDetails && beneficiaryData.bankDetails.length > 0 ? (
                                    beneficiaryData.bankDetails.map((bank, idx) => (
                                        <div key={idx} className="space-y-3 p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-primary/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="h-4 w-4 text-primary/40" />
                                                <span className="text-sm font-black tracking-tight text-slate-800">{bank.bankName}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Number</p>
                                                <p className="text-xs font-mono text-slate-900 font-bold">{bank.accountNumber}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IFSC Code</p>
                                                <p className="text-xs font-mono text-slate-900 font-bold">{bank.ifscCode}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 opacity-40">
                                        <p className="text-[10px] font-bold uppercase tracking-widest">No Bank Details Linked</p>
                                    </div>
                                )}
                            </div>
                            <Separator className="bg-slate-100" />
                            <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic">
                                Institutional support and disbursements are processed using these verified settlement records.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/40 bg-slate-900 text-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/10 pb-6">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
                                <ShieldCheck className="h-5 w-5 text-primary" /> Registry Metadata
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 space-y-6">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Profile Status</p>
                                <Badge variant={beneficiaryData.status === 'Verified' ? 'eligible' : 'outline'} className="font-black text-[10px] uppercase tracking-widest">{beneficiaryData.status}</Badge>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Verified Since</p>
                                <p className="text-xs font-bold text-white/80">{formatDate(beneficiaryData.createdAt as any)}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Referral Source</p>
                                <p className="text-xs font-bold text-white/80">{beneficiaryData.referralBy || 'Direct Registry'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl rounded-[32px] border-slate-100 p-0 flex flex-col max-h-[90vh] overflow-hidden shadow-3xl">
                    <DialogHeader className="px-8 py-6 bg-slate-50/50 border-b shrink-0">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Propose Identity Modification</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">Proposed changes will be synchronized after administrative verification.</DialogDescription>
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
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                                            <Input name="name" defaultValue={beneficiaryData.name} required className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Phone</Label>
                                            <Input name="phone" defaultValue={beneficiaryData.phone} required className="h-11 rounded-xl border-slate-200 font-mono font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telegram Chat ID</Label>
                                            <Input name="telegramChatId" defaultValue={beneficiaryData.telegramChatId} placeholder="e.g. 123456789" className="h-11 rounded-xl border-slate-200 font-mono font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Occupation</Label>
                                            <Input name="occupation" defaultValue={beneficiaryData.occupation} className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Household Members</Label>
                                            <Input name="members" type="number" defaultValue={beneficiaryData.members} className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Earning Members</Label>
                                            <Input name="earningMembers" type="number" defaultValue={beneficiaryData.earningMembers} className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Address</Label>
                                            <Input name="address" defaultValue={beneficiaryData.address} className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identification (KYC)</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Aadhaar Number</Label>
                                            <Input name="aadhaarNumber" defaultValue={beneficiaryData.aadhaarNumber} maxLength={12} className="h-11 rounded-xl border-slate-200 font-mono font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Name on Aadhaar</Label>
                                            <Input name="aadhaarName" defaultValue={beneficiaryData.aadhaarName} className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date of Birth (ID)</Label>
                                            <Input name="aadhaarDob" defaultValue={beneficiaryData.aadhaarDob} placeholder="DD/MM/YYYY" className="h-11 rounded-xl border-slate-200 font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gender</Label>
                                            <Select name="aadhaarGender" defaultValue={beneficiaryData.aadhaarGender}>
                                                <SelectTrigger className="h-11 rounded-xl border-slate-200 font-bold">
                                                    <SelectValue placeholder="Select Gender" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Aadhaar Proof Document</Label>
                                            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                                                <FileUploader onFilesChange={(files) => setAadhaarFile(files[0] || null)} acceptedFileTypes="image/*,application/pdf" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Landmark className="h-3.5 w-3.5 text-primary" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details</h4>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setBankDetails([...bankDetails, { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-8 text-[9px] font-black uppercase tracking-widest rounded-xl border-slate-200">
                                            <Plus className="h-3 w-3 mr-1" /> Add Account
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {bankDetails.map((bank, idx) => (
                                            <div key={idx} className="relative p-6 rounded-2xl border border-slate-100 bg-slate-50/30 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {bankDetails.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => setBankDetails(bankDetails.filter((_, i) => i !== idx))} className="absolute top-2 right-2 h-7 w-7 text-slate-300 hover:text-red-500 rounded-full">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <div className="space-y-2">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bank Name</Label>
                                                    <Input value={bank.bankName} onChange={(e) => { const newB = [...bankDetails]; newB[idx].bankName = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-bold rounded-xl border-slate-200 bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Account No.</Label>
                                                    <Input value={bank.accountNumber} onChange={(e) => { const newB = [...bankDetails]; newB[idx].accountNumber = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-bold rounded-xl border-slate-200 bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">IFSC Code</Label>
                                                    <Input value={bank.ifscCode} onChange={(e) => { const newB = [...bankDetails]; newB[idx].ifscCode = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-bold rounded-xl border-slate-200 bg-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">UPI Identities</Label>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setUpiIds([...upiIds, ''])} className="h-7 text-[9px] font-black uppercase tracking-widest rounded-xl border-slate-200">
                                                <Plus className="h-3 w-3 mr-1" /> Add UPI
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {upiIds.map((upi, idx) => (
                                                <div key={idx} className="flex gap-2 items-center group">
                                                    <Input value={upi} onChange={(e) => { const newU = [...upiIds]; newU[idx] = e.target.value; setUpiIds(newU); }} placeholder="handle@upi" className="flex-1 h-11 text-xs font-mono font-bold rounded-xl border-slate-200" />
                                                    {upiIds.length > 1 && (
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => setUpiIds(upiIds.filter((_, i) => i !== idx))} className="h-9 w-9 text-slate-300 hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex flex-col md:flex-row gap-3 rounded-b-[32px]">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full md:w-auto font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl bg-white border-slate-200">Discard changes</Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto font-black uppercase tracking-widest text-[10px] h-12 px-10 rounded-2xl shadow-xl shadow-primary/20">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Submit for Approval
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
