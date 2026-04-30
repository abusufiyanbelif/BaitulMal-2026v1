'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useDoc, doc, collection, getDocs, getDoc, useAuth } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    HeartHandshake, 
    Calendar, 
    ShieldCheck, 
    User,
    Gift,
    HandHelping,
    Sparkles,
    CheckCircle2,
    Activity,
    LogOut
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';
import { useState, useEffect, useCallback } from 'react';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    initiativeStatus: Campaign['status'] | Lead['status'];
    purpose: string;
    category?: string;
    kitAmount: number;
    zakatAllocation: number;
    beneficiaryStatus: Beneficiary['status'];
    addedDate: string;
}

export default function BeneficiaryPortalPage() {
    const { user, userProfile } = useSession();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const { brandingSettings } = useBranding();

    const targetBeneficiaryId = userProfile?.linkedBeneficiaryId || userProfile?.id || user?.uid;

    const beneficiaryDocRef = useMemoFirebase(() => {
        if (!firestore || !targetBeneficiaryId) return null;
        return doc(firestore, 'beneficiaries', targetBeneficiaryId) as any;
    }, [firestore, targetBeneficiaryId]);

    const { data: beneficiaryProfile, isLoading: isBenLoading } = useDoc<any>(beneficiaryDocRef);

    const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
    const [isLinksLoading, setIsLinksLoading] = useState(true);

    const fetchLinkedInitiatives = useCallback(async () => {
        if (!firestore || !targetBeneficiaryId) return;
        setIsLinksLoading(true);
        try {
            const initiatives: LinkedInitiative[] = [];
            
            // 1. Fetch from Campaigns
            const camps = await getDocs(collection(firestore, 'campaigns'));
            for (const c of camps.docs) {
                const bRef = doc(firestore, `campaigns/${c.id}/beneficiaries`, targetBeneficiaryId);
                const bSnap = await getDoc(bRef);
                if (bSnap.exists()) {
                    const bData = bSnap.data() as Beneficiary;
                    const cData = c.data() as Campaign;
                    initiatives.push({ 
                        id: c.id, 
                        name: cData.name, 
                        type: 'Campaign', 
                        initiativeStatus: cData.status, 
                        purpose: cData.category || 'General',
                        category: bData.itemCategoryName || 'N/A',
                        kitAmount: bData.kitAmount || 0, 
                        zakatAllocation: bData.zakatAllocation || 0,
                        beneficiaryStatus: bData.status || 'Pending',
                        addedDate: bData.addedDate || 'N/A'
                    });
                }
            }

            // 2. Fetch from Leads
            const leads = await getDocs(collection(firestore, 'leads'));
            for (const l of leads.docs) {
                const bRef = doc(firestore, `leads/${l.id}/beneficiaries`, targetBeneficiaryId);
                const bSnap = await getDoc(bRef);
                if (bSnap.exists()) {
                    const bData = bSnap.data() as Beneficiary;
                    const lData = l.data() as Lead;
                    initiatives.push({ 
                        id: l.id, 
                        name: lData.name, 
                        type: 'Lead', 
                        initiativeStatus: lData.status, 
                        purpose: lData.purpose || 'General',
                        category: bData.idProofType || 'N/A',
                        kitAmount: bData.kitAmount || 0, 
                        zakatAllocation: bData.zakatAllocation || 0,
                        beneficiaryStatus: bData.status || 'Pending',
                        addedDate: bData.addedDate || 'N/A'
                    });
                }
            }

            setLinkedInitiatives(initiatives.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()));
        } catch (error) {
            console.error('Error fetching linked beneficiary records:', error);
        } finally {
            setIsLinksLoading(false);
        }
    }, [firestore, targetBeneficiaryId]);

    useEffect(() => {
        fetchLinkedInitiatives();
    }, [fetchLinkedInitiatives]);

    if (isBenLoading || isLinksLoading || !user) {
         return <BrandedLoader message="Accessing Your Support Records..." />;
    }

    const disbursedAssistance = linkedInitiatives.filter(i => i.beneficiaryStatus === 'Given' || i.beneficiaryStatus === 'Verified');
    const totalDisbursedValue = disbursedAssistance.reduce((sum, i) => sum + (Number(i.kitAmount) || Number(i.zakatAllocation) || 0), 0);
    const pendingAssistanceCount = linkedInitiatives.filter(i => i.beneficiaryStatus === 'Pending' || i.beneficiaryStatus === 'Hold').length;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 text-primary font-normal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                        <HandHelping className="h-8 w-8 text-primary/60" />
                        My Beneficiary Portal
                    </h1>
                    <p className="text-sm font-normal text-muted-foreground tracking-tight">
                        Welcome back, {beneficiaryProfile?.name || userProfile?.name || 'Community Member'}. Below is a secure summary of support allocations prepared for you.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5 flex items-center gap-2 px-3 py-1.5 rounded-xl h-10">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Verified Profile
                    </Badge>
                    <Button 
                        variant="outline" 
                        className="font-bold shadow-sm border-primary/20 hover:bg-red-50 hover:text-red-600 transition-colors h-10 px-4 rounded-xl flex items-center gap-2"
                        onClick={async () => {
                            if (auth) {
                                await auth.signOut();
                                if (typeof window !== 'undefined') {
                                    localStorage.removeItem('portal_role');
                                }
                                router.push('/portal-login');
                            }
                        }}
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Support Delivered</CardTitle>
                        <Gift className="h-4 w-4 text-primary opacity-60" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {formatCurrency(totalDisbursedValue)}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 font-bold tracking-tight">Cumulative institutional assistance provided</p>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ongoing Initiatives</CardTitle>
                        <Sparkles className="h-4 w-4 text-green-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {disbursedAssistance.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending Disbursals</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {pendingAssistanceCount}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 font-bold tracking-tight">Requires administrative verification</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xl border-primary/10 bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 border-b px-6 py-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary/60" />
                        Allocated Support Records
                    </CardTitle>
                    <CardDescription className="font-normal text-primary/70">
                        Track your application progress and verification workflows.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/[0.02]">
                                <TableRow className="border-b border-primary/10">
                                    <TableHead className="font-bold text-[10px] tracking-widest uppercase pl-6 py-4">Linked Program</TableHead>
                                    <TableHead className="font-bold text-[10px] tracking-widest uppercase">Support Type</TableHead>
                                    <TableHead className="font-bold text-[10px] tracking-widest uppercase">Disbursement Value</TableHead>
                                    <TableHead className="font-bold text-[10px] tracking-widest uppercase">Allocation Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {linkedInitiatives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-64 bg-primary/[0.01]">
                                            <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                                                <HeartHandshake className="h-16 w-16 text-primary" />
                                                <p className="font-bold text-sm tracking-widest uppercase italic">No Active Allocations Provided.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    linkedInitiatives.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-primary/[0.02] transition-colors border-b border-primary/5 last:border-0 bg-white">
                                            <TableCell className="font-bold text-xs whitespace-nowrap pl-6">
                                                {item.name}
                                                <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">{item.type}</span>
                                            </TableCell>
                                            <TableCell className="font-bold text-xs">
                                                {item.purpose}
                                            </TableCell>
                                            <TableCell className="font-black text-sm tracking-tight text-primary font-mono">
                                                {formatCurrency(Number(item.kitAmount) || Number(item.zakatAllocation) || 0)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={item.beneficiaryStatus === 'Given' || item.beneficiaryStatus === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[9px] tracking-widest uppercase">
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
