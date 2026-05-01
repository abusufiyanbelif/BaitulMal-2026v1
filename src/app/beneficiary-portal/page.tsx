'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc, collection, getDocs, getDoc } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Gift, 
    HandHelping, 
    Sparkles, 
    CheckCircle2, 
    Activity, 
    LogOut,
    ShieldCheck,
    Landmark,
    UserCircle2,
    Smartphone
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    initiativeStatus: string;
    purpose: string;
    kitAmount: number;
    beneficiaryStatus: string;
    addedDate: string;
}

export default function BeneficiaryPortalPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();

    const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [beneficiaryDoc, setBeneficiaryDoc] = useState<Beneficiary | null>(null);

    const fetchInitiatives = useCallback(async () => {
        if (!firestore || !userProfile?.id) return;
        setIsDataLoading(true);
        try {
            // Fetch Master Profile
            const masterRef = doc(firestore, 'beneficiaries', userProfile.id);
            const masterSnap = await getDoc(masterRef);
            if (masterSnap.exists()) {
                setBeneficiaryDoc(masterSnap.data() as Beneficiary);
            }

            const results: LinkedInitiative[] = [];
            const targetId = userProfile.id;

            // 1. Scan Campaigns
            const campsSnap = await getDocs(collection(firestore, 'campaigns'));
            for (const c of campsSnap.docs) {
                const benRef = doc(firestore, `campaigns/${c.id}/beneficiaries`, targetId);
                const benSnap = await getDoc(benRef);
                if (benSnap.exists()) {
                    const bData = benSnap.data();
                    const cData = c.data();
                    results.push({
                        id: c.id,
                        name: cData.name,
                        type: 'Campaign',
                        initiativeStatus: cData.status,
                        purpose: cData.category || 'General Assistance',
                        kitAmount: bData.kitAmount || 0,
                        beneficiaryStatus: bData.status || 'Verified',
                        addedDate: bData.addedDate || ''
                    });
                }
            }

            // 2. Scan Leads
            const leadsSnap = await getDocs(collection(firestore, 'leads'));
            for (const l of leadsSnap.docs) {
                const benRef = doc(firestore, `leads/${l.id}/beneficiaries`, targetId);
                const benSnap = await getDoc(benRef);
                if (benSnap.exists()) {
                    const bData = benSnap.data();
                    const lData = l.data();
                    results.push({
                        id: l.id,
                        name: lData.name,
                        type: 'Lead',
                        initiativeStatus: lData.status,
                        purpose: lData.purpose || 'Individual Support',
                        kitAmount: bData.kitAmount || 0,
                        beneficiaryStatus: bData.status || 'Verified',
                        addedDate: bData.addedDate || ''
                    });
                }
            }

            setLinkedInitiatives(results.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()));
        } catch (error) {
            console.error("Error fetching beneficiary data:", error);
        } finally {
            setIsDataLoading(false);
        }
    }, [firestore, userProfile?.id]);

    useEffect(() => {
        fetchInitiatives();
    }, [fetchInitiatives]);

    if (isSessionLoading || isDataLoading) {
         return <BrandedLoader message="Accessing Your Support Dashboard..." />;
    }

    if (!userProfile || userProfile.role !== 'Beneficiary') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <HandHelping className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Access Restricted to Beneficiaries</p>
                <Button asChild variant="outline"><Link href="/portal-login">Return to Login</Link></Button>
            </div>
        );
    }

    const totalDisbursed = linkedInitiatives.reduce((sum, i) => sum + (Number(i.kitAmount) || 0), 0);
    const activeCount = linkedInitiatives.length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <HandHelping className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Assistance Dashboard</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-green-500" /> Member Registry: {userProfile.name}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-12 border-slate-200">
                        <Link href="/beneficiary-portal/profile">
                            <UserCircle2 className="mr-2 h-4 w-4" /> My Profile
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-12 border-slate-200">
                        <Link href="/beneficiary-portal/settings">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Security
                        </Link>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="font-bold h-12 w-12 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                        onClick={() => auth?.signOut().then(() => router.push('/portal-login'))}
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/40 bg-white group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support Received</CardTitle>
                        <Gift className="h-5 w-5 text-primary opacity-60" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                            {formatCurrency(totalDisbursed)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Institutional assistance allocated
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/40 bg-white group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked Programs</CardTitle>
                        <Sparkles className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                            {activeCount}
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                            Verified participation
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/40 bg-slate-900 text-white group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Application State</CardTitle>
                        <Activity className="h-5 w-5 text-white/40" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tight">
                            Verified Member
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
                            Active registry status
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Institutional Action Required */}
            {beneficiaryDoc && (!beneficiaryDoc.aadhaarNumber || !beneficiaryDoc.bankDetails || beneficiaryDoc.bankDetails.length === 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {!beneficiaryDoc.aadhaarNumber && (
                        <Alert className="bg-red-50 border-red-200 rounded-[32px] p-6 shadow-sm border-2 animate-pulse">
                            <ShieldCheck className="h-5 w-5 text-red-600" />
                            <div className="ml-2">
                                <AlertTitle className="text-red-900 font-black text-xs uppercase tracking-[0.2em]">KYC Verification Pending</AlertTitle>
                                <AlertDescription className="text-red-700/80 text-[11px] font-bold mt-1 leading-relaxed">
                                    Identity records are incomplete. Please link your Aadhaar details to maintain verified status.
                                </AlertDescription>
                                <Button asChild variant="link" className="p-0 h-auto text-red-600 font-black text-[10px] uppercase tracking-widest mt-3 hover:text-red-700">
                                    <Link href="/beneficiary-portal/profile">Update Identity Records <Sparkles className="ml-1 h-3 w-3" /></Link>
                                </Button>
                            </div>
                        </Alert>
                    )}
                    {(!beneficiaryDoc.bankDetails || beneficiaryDoc.bankDetails.length === 0) && (
                        <Alert className="bg-blue-50 border-blue-200 rounded-[32px] p-6 shadow-sm border-2 animate-pulse">
                            <Landmark className="h-5 w-5 text-blue-600" />
                            <div className="ml-2">
                                <AlertTitle className="text-blue-900 font-black text-xs uppercase tracking-[0.2em]">Settlement Record Required</AlertTitle>
                                <AlertDescription className="text-blue-700/80 text-[11px] font-bold mt-1 leading-relaxed">
                                    No bank details found. Please add an account to receive institutional disbursements.
                                </AlertDescription>
                                <Button asChild variant="link" className="p-0 h-auto text-blue-600 font-black text-[10px] uppercase tracking-widest mt-3 hover:text-blue-700">
                                    <Link href="/beneficiary-portal/profile">Link Bank Account <Sparkles className="ml-1 h-3 w-3" /></Link>
                                </Button>
                            </div>
                        </Alert>
                    )}
                    {(!beneficiaryDoc.upiIds || beneficiaryDoc.upiIds.length === 0 || (beneficiaryDoc.upiIds.length === 1 && !beneficiaryDoc.upiIds[0])) && (
                        <Alert className="bg-amber-50 border-amber-200 rounded-[32px] p-6 shadow-sm border-2 animate-pulse">
                            <Smartphone className="h-5 w-5 text-amber-600" />
                            <div className="ml-2">
                                <AlertTitle className="text-amber-900 font-black text-xs uppercase tracking-[0.2em]">UPI Identity Missing</AlertTitle>
                                <AlertDescription className="text-amber-700/80 text-[11px] font-bold mt-1 leading-relaxed">
                                    No UPI handles linked. Adding a UPI ID allows for faster digital settlements and mobile-first support.
                                </AlertDescription>
                                <Button asChild variant="link" className="p-0 h-auto text-amber-600 font-black text-[10px] uppercase tracking-widest mt-3 hover:text-amber-700">
                                    <Link href="/beneficiary-portal/profile">Link UPI Handle <Sparkles className="ml-1 h-3 w-3" /></Link>
                                </Button>
                            </div>
                        </Alert>
                    )}
                </div>
            )}

            {/* Assistance Records */}
            <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 px-8 py-6 border-b border-slate-100">
                    <div>
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary/60" />
                            Allocated Support
                        </CardTitle>
                        <p className="text-slate-500 text-xs font-normal">Records of institutional support linked to your profile.</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/30">
                                <TableRow className="border-slate-100 hover:bg-transparent">
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 pl-8 py-4">Linked Program</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Support Type</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Allocation Value</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {linkedInitiatives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-20">
                                                <HandHelping className="h-12 w-12" />
                                                <p className="font-black text-xs uppercase tracking-widest">No Active Records</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    linkedInitiatives.map((item) => (
                                        <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="pl-8 py-5">
                                                <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.type}</div>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-600 text-xs">
                                                {item.purpose}
                                            </TableCell>
                                            <TableCell className="font-black text-primary text-base font-mono">
                                                {formatCurrency(item.kitAmount)}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Badge variant={item.beneficiaryStatus === 'Given' || item.beneficiaryStatus === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[9px] uppercase tracking-widest px-2 py-0.5">
                                                    {item.beneficiaryStatus}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
