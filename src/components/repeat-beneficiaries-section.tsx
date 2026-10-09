'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection, getDocs } from '@/firebase';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    RotateCw, 
    Users, 
    FolderKanban, 
    Lightbulb, 
    Search, 
    Eye, 
    Coins, 
    Package, 
    Stethoscope, 
    GraduationCap, 
    HeartHandshake, 
    ChevronRight,
    ArrowUpRight,
    Filter,
    ShieldCheck,
    Calendar,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useSession } from '@/hooks/use-session';

interface RepeatCauseItem {
    initiativeId: string;
    initiativeName: string;
    initiativeType: 'Campaign' | 'Lead';
    caseId?: string;
    causeCategory: string;
    amount: number;
    zakatAllocation?: number;
    status?: string;
    addedDate?: string;
}

export interface RepeatBeneficiaryProfile {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    referralBy?: string;
    beneficiaryKey?: string;
    status?: string;
    verificationStatus?: string;
    initiativeCount: number;
    totalAmount: number;
    totalZakat: number;
    causes: RepeatCauseItem[];
}

export function RepeatBeneficiariesSection() {
    const firestore = useFirestore();
    const { userProfile, isStaff, isLoading: isSessionLoading } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [displayLimit, setDisplayLimit] = useState<number>(5);
    const [rawSubBeneficiaries, setRawSubBeneficiaries] = useState<any[]>([]);

    // 1. Fetch Master Beneficiaries
    const masterBeneficiariesRef = useMemoFirebase(() => {
        if (!firestore || isSessionLoading || (!isStaff && userProfile?.role !== 'Admin')) return null;
        return collection(firestore, 'beneficiaries');
    }, [firestore, isStaff, userProfile, isSessionLoading]);
    const { data: rawMasterBeneficiaries, isLoading: isMasterLoading } = useCollection<Beneficiary>(masterBeneficiariesRef);

    // 2. Fetch Campaigns
    const campaignsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'campaigns');
    }, [firestore]);
    const { data: rawCampaigns, isLoading: isCampaignsLoading } = useCollection<Campaign>(campaignsRef);

    // 3. Fetch Leads
    const leadsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'leads');
    }, [firestore]);
    const { data: rawLeads, isLoading: isLeadsLoading } = useCollection<Lead>(leadsRef);

    // Fetch subcollection records safely using direct collection references instead of collectionGroup
    useEffect(() => {
        if (!firestore || !rawCampaigns || !rawLeads || isSessionLoading) return;
        let isCancelled = false;

        const fetchSubcollections = async () => {
            const results: any[] = [];

            // Fetch campaign subcollection beneficiaries
            for (const camp of rawCampaigns) {
                try {
                    const snap = await getDocs(collection(firestore, 'campaigns', camp.id, 'beneficiaries'));
                    snap.docs.forEach(docSnap => {
                        results.push({
                            ...docSnap.data(),
                            id: docSnap.id,
                            path: `campaigns/${camp.id}/beneficiaries/${docSnap.id}`,
                        });
                    });
                } catch (e) {
                    // Ignore single campaign subcollection permission error
                }
            }

            // Fetch lead subcollection beneficiaries
            for (const lead of rawLeads) {
                try {
                    const snap = await getDocs(collection(firestore, 'leads', lead.id, 'beneficiaries'));
                    snap.docs.forEach(docSnap => {
                        results.push({
                            ...docSnap.data(),
                            id: docSnap.id,
                            path: `leads/${lead.id}/beneficiaries/${docSnap.id}`,
                        });
                    });
                } catch (e) {
                    // Ignore single lead subcollection permission error
                }
            }

            if (!isCancelled) {
                setRawSubBeneficiaries(results);
            }
        };

        fetchSubcollections();

        return () => { isCancelled = true; };
    }, [firestore, rawCampaigns, rawLeads, isSessionLoading]);

    // Map campaigns and leads by ID for fast lookup
    const campaignsMap = useMemo(() => {
        const map = new Map<string, Campaign>();
        if (rawCampaigns) {
            rawCampaigns.forEach(c => map.set(c.id, c));
        }
        return map;
    }, [rawCampaigns]);

    const leadsMap = useMemo(() => {
        const map = new Map<string, Lead>();
        if (rawLeads) {
            rawLeads.forEach(l => map.set(l.id, l));
        }
        return map;
    }, [rawLeads]);

    // Process & group repeat beneficiaries with linked causes
    const repeatBeneficiariesList = useMemo(() => {
        if (!rawMasterBeneficiaries) return [];

        // Build mapping of beneficiaryId -> RepeatCauseItem[]
        const beneficiaryCausesMap = new Map<string, RepeatCauseItem[]>();

        if (rawSubBeneficiaries && rawSubBeneficiaries.length > 0) {
            rawSubBeneficiaries.forEach((subDoc: any) => {
                const benId = subDoc.id;
                if (!benId) return;

                const path = subDoc.path || subDoc.ref?.path || '';
                const pathParts = path.split('/');
                const isCampaign = subDoc.initiativeType === 'Campaign' || pathParts[0] === 'campaigns';
                const isLead = subDoc.initiativeType === 'Lead' || pathParts[0] === 'leads';
                const initiativeId = subDoc.initiativeId || pathParts[1] || '';

                let initiativeName = 'General Initiative';
                let caseId = '';
                let defaultCategory = 'Relief Assistance';
                let type: 'Campaign' | 'Lead' = 'Campaign';

                if (isCampaign && campaignsMap.has(initiativeId)) {
                    const camp = campaignsMap.get(initiativeId)!;
                    initiativeName = camp.name || 'Campaign';
                    caseId = camp.caseId || initiativeId;
                    defaultCategory = camp.category || camp.purpose || 'Campaign Relief';
                    type = 'Campaign';
                } else if (isLead && leadsMap.has(initiativeId)) {
                    const lead = leadsMap.get(initiativeId)!;
                    initiativeName = lead.name || 'Help Request';
                    caseId = lead.caseId || initiativeId;
                    defaultCategory = lead.category || lead.purpose || 'Appeal Support';
                    type = 'Lead';
                }

                const causeCat = subDoc.itemCategoryName || subDoc.itemCategoryId || defaultCategory;
                const kitAmt = Number(subDoc.kitAmount || 0);
                const zakatAmt = Number(subDoc.zakatAllocation || 0);

                const causeItem: RepeatCauseItem = {
                    initiativeId,
                    initiativeName,
                    initiativeType: type,
                    caseId,
                    causeCategory: causeCat,
                    amount: kitAmt,
                    zakatAllocation: zakatAmt,
                    status: subDoc.status,
                    addedDate: subDoc.addedDate
                };

                const existing = beneficiaryCausesMap.get(benId) || [];
                // Avoid duplicating exact same initiative entry
                if (!existing.some(c => c.initiativeId === initiativeId)) {
                    existing.push(causeItem);
                }
                beneficiaryCausesMap.set(benId, existing);
            });
        }

        // Now aggregate master beneficiaries
        const result: RepeatBeneficiaryProfile[] = [];

        rawMasterBeneficiaries.forEach(master => {
            const linkedCauses = beneficiaryCausesMap.get(master.id) || [];
            const masterCount = master.initiativeCount || 0;

            // Determine if repeat beneficiary:
            // Either master.initiativeCount > 1, OR linkedCauses.length > 1
            const isRepeat = masterCount > 1 || linkedCauses.length > 1;

            if (isRepeat) {
                // If subcollections didn't yield multiple causes yet, generate fallback from master data
                let finalCauses = [...linkedCauses];
                if (finalCauses.length === 0) {
                    finalCauses.push({
                        initiativeId: 'master-record',
                        initiativeName: master.itemCategoryName || 'Multiple Relief Initiatives',
                        initiativeType: 'Campaign',
                        causeCategory: master.itemCategoryName || 'Recurring Support',
                        amount: Number(master.kitAmount || 0),
                        zakatAllocation: Number(master.zakatAllocation || 0),
                        status: master.status
                    });
                }

                const totalAmount = finalCauses.reduce((sum, c) => sum + c.amount, 0);
                const totalZakat = finalCauses.reduce((sum, c) => sum + (c.zakatAllocation || 0), 0);

                result.push({
                    id: master.id,
                    name: master.name || 'Unnamed Recipient',
                    phone: master.phone || '',
                    address: master.address || '',
                    referralBy: master.referralBy || '',
                    beneficiaryKey: master.beneficiaryKey || `BEN-${master.id.slice(0, 5).toUpperCase()}`,
                    status: master.status || 'Verified',
                    verificationStatus: master.verificationStatus || master.status || 'Verified',
                    initiativeCount: Math.max(masterCount, finalCauses.length),
                    totalAmount,
                    totalZakat,
                    causes: finalCauses
                });
            }
        });

        // Sort repeat beneficiaries by repeat count descending, then total amount descending
        return result.sort((a, b) => b.initiativeCount - a.initiativeCount || b.totalAmount - a.totalAmount);
    }, [rawMasterBeneficiaries, rawSubBeneficiaries, campaignsMap, leadsMap]);

    // Extract unique cause categories for filter dropdown
    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        repeatBeneficiariesList.forEach(b => {
            b.causes.forEach(c => {
                if (c.causeCategory) set.add(c.causeCategory);
            });
        });
        return Array.from(set);
    }, [repeatBeneficiariesList]);

    // Filter repeat beneficiaries by search term & category
    const filteredRepeatList = useMemo(() => {
        return repeatBeneficiariesList.filter(b => {
            const query = searchTerm.toLowerCase().trim();
            const matchesSearch = !query || 
                b.name.toLowerCase().includes(query) ||
                (b.phone && b.phone.includes(query)) ||
                (b.beneficiaryKey && b.beneficiaryKey.toLowerCase().includes(query)) ||
                b.causes.some(c => 
                    c.causeCategory.toLowerCase().includes(query) ||
                    c.initiativeName.toLowerCase().includes(query) ||
                    (c.caseId && c.caseId.toLowerCase().includes(query))
                );

            const matchesCategory = selectedCategory === 'all' || 
                b.causes.some(c => c.causeCategory.toLowerCase() === selectedCategory.toLowerCase());

            return matchesSearch && matchesCategory;
        });
    }, [repeatBeneficiariesList, searchTerm, selectedCategory]);

    // Calculate Summary Metrics for Dashboard Card
    const totalRepeatCount = repeatBeneficiariesList.length;
    const totalMasterCount = rawMasterBeneficiaries?.length || 1;
    const repeatRatio = Math.round((totalRepeatCount / totalMasterCount) * 100);
    const totalRepeatAssistanceSum = repeatBeneficiariesList.reduce((acc, b) => acc + b.totalAmount, 0);

    // Most repeated cause frequency
    const causeFrequencyMap = useMemo(() => {
        const freq: Record<string, number> = {};
        repeatBeneficiariesList.forEach(b => {
            b.causes.forEach(c => {
                const cat = c.causeCategory || 'Relief';
                freq[cat] = (freq[cat] || 0) + 1;
            });
        });
        const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a);
        return sorted.length > 0 ? sorted[0] : ['General Relief', 0];
    }, [repeatBeneficiariesList]);

    const isLoading = isMasterLoading || isCampaignsLoading || isLeadsLoading;

    const getCauseIcon = (categoryName: string) => {
        const lower = categoryName.toLowerCase();
        if (lower.includes('ration') || lower.includes('food') || lower.includes('kit')) return Package;
        if (lower.includes('medical') || lower.includes('health') || lower.includes('hospital')) return Stethoscope;
        if (lower.includes('education') || lower.includes('school') || lower.includes('fee')) return GraduationCap;
        if (lower.includes('zakat')) return Coins;
        return HeartHandshake;
    };

    return (
        <div id="repeat-beneficiaries-section" className="space-y-6 my-8 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            {/* Top Cards Row: Repeat Summary Stat & Quick Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Main Stat Card */}
                <Card className="glass-card border-primary/10 p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-500 bg-gradient-to-br from-primary/5 via-white to-emerald-50/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <RotateCw className="h-20 w-20 text-primary" />
                    </div>
                    <div className="space-y-2 relative z-10">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground/80">
                                Dashboard Overview
                            </span>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Live Analytics
                            </Badge>
                        </div>
                        
                        <div className="flex items-baseline gap-3 pt-1">
                            <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-primary">
                                {isLoading ? <Skeleton className="h-12 w-20 rounded-xl" /> : totalRepeatCount}
                            </h3>
                            <span className="text-xs font-bold text-muted-foreground">Repeat Beneficiaries</span>
                        </div>

                        <p className="text-xs text-muted-foreground font-medium pt-1">
                            Recipients supported in <strong>2 or more</strong> distinct causes or campaigns.
                        </p>

                        <div className="pt-2 flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                {repeatRatio}% of Total Beneficiaries
                            </Badge>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold">
                                Multi-Initiative Support
                            </Badge>
                        </div>
                    </div>
                </Card>

                {/* Total Recurring Financial Support Card */}
                <Card className="glass-card border-primary/10 p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-500">
                    <div className="space-y-2 relative z-10">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground/80">
                                Total Repeat Assistance
                            </span>
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                                <Coins className="h-4 w-4" />
                            </div>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 pt-1">
                            {isLoading ? <Skeleton className="h-9 w-32 rounded-xl" /> : `₹${totalRepeatAssistanceSum.toLocaleString('en-IN')}`}
                        </h3>

                        <p className="text-xs text-muted-foreground font-medium">
                            Cumulative kit & financial aid disbursed across all recurring causes.
                        </p>
                    </div>
                </Card>

                {/* Top Recurring Cause Card */}
                <Card className="glass-card border-primary/10 p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-500">
                    <div className="space-y-2 relative z-10">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground/80">
                                Top Recurring Cause
                            </span>
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <HeartHandshake className="h-4 w-4" />
                            </div>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-primary capitalize pt-1">
                            {isLoading ? <Skeleton className="h-8 w-28 rounded-xl" /> : causeFrequencyMap[0]}
                        </h3>

                        <p className="text-xs text-muted-foreground font-medium">
                            Occurs <strong>{causeFrequencyMap[1]} times</strong> across repeat recipient allocations.
                        </p>
                    </div>
                </Card>
            </div>

            {/* Dedicated Repeat Beneficiaries Table Card */}
            <Card className="glass-card border-primary/10 overflow-hidden shadow-xl rounded-[28px] transition-all duration-500 hover:border-primary/20">
                <CardHeader className="bg-primary/5 py-5 px-6 border-b border-primary/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                    <RotateCw className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                                    Repeat Beneficiaries Directory
                                </CardTitle>
                                <Badge className="bg-primary text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                                    {filteredRepeatList.length} Recipients
                                </Badge>
                            </div>
                            <CardDescription className="text-xs text-muted-foreground font-medium">
                                Comprehensive list of individuals receiving recurring support and the specific causes for which aid was provided.
                            </CardDescription>
                        </div>

                        {/* Search & Filter Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[200px] sm:min-w-[260px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-60" />
                                <Input
                                    placeholder="Search by name, phone, cause..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 text-xs font-bold rounded-xl border-primary/10 bg-white/80 focus:bg-white transition-all"
                                />
                            </div>

                            {availableCategories.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                    <Button
                                        size="sm"
                                        variant={selectedCategory === 'all' ? 'default' : 'outline'}
                                        onClick={() => setSelectedCategory('all')}
                                        className={cn(
                                            "h-8 text-[11px] font-bold rounded-xl px-3 transition-all",
                                            selectedCategory === 'all' ? "bg-primary text-white" : "border-primary/10 text-primary hover:bg-primary/5"
                                        )}
                                    >
                                        All Causes
                                    </Button>
                                    {availableCategories.slice(0, 3).map(cat => (
                                        <Button
                                            key={cat}
                                            size="sm"
                                            variant={selectedCategory === cat ? 'default' : 'outline'}
                                            onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                                            className={cn(
                                                "h-8 text-[11px] font-bold rounded-xl px-3 transition-all capitalize",
                                                selectedCategory === cat ? "bg-primary text-white" : "border-primary/10 text-primary hover:bg-primary/5"
                                            )}
                                        >
                                            {cat}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                            ))}
                        </div>
                    ) : filteredRepeatList.length === 0 ? (
                        <div className="text-center py-16 px-4 space-y-3">
                            <div className="p-4 rounded-full bg-primary/5 text-primary inline-block">
                                <Users className="h-8 w-8 opacity-40" />
                            </div>
                            <h4 className="text-base font-bold text-primary">No Repeat Beneficiaries Found</h4>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
                                {searchTerm || selectedCategory !== 'all' 
                                    ? "No recipients matched your current search filters." 
                                    : "No beneficiaries are currently registered under multiple initiatives."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b border-primary/10 bg-primary/[0.02]">
                                        <TableHead className="w-[50px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4 pl-6">#</TableHead>
                                        <TableHead className="min-w-[200px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4">Beneficiary Profile</TableHead>
                                        <TableHead className="min-w-[120px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4">Repeat Count</TableHead>
                                        <TableHead className="min-w-[340px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4">Which Causes It Repeats (Initiatives)</TableHead>
                                        <TableHead className="min-w-[140px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4 text-right">Total Assistance</TableHead>
                                        <TableHead className="min-w-[100px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4 text-center">Status</TableHead>
                                        <TableHead className="w-[100px] font-black text-[10px] text-muted-foreground uppercase tracking-wider py-4 pr-6 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody className="divide-y divide-primary/5">
                                    {filteredRepeatList.slice(0, displayLimit).map((beneficiary, index) => (
                                        <TableRow 
                                            key={beneficiary.id} 
                                            className="hover:bg-primary/[0.02] transition-colors group"
                                        >
                                            <TableCell className="font-bold text-xs text-muted-foreground pl-6 py-4">
                                                {index + 1}
                                            </TableCell>

                                            <TableCell className="py-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-primary group-hover:text-primary transition-colors">
                                                            {beneficiary.name}
                                                        </span>
                                                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 h-4 bg-primary/5 border-primary/20 text-primary">
                                                            {beneficiary.beneficiaryKey}
                                                        </Badge>
                                                    </div>
                                                    {beneficiary.phone && (
                                                        <p className="text-xs text-muted-foreground font-medium">
                                                            📞 {beneficiary.phone}
                                                        </p>
                                                    )}
                                                    {beneficiary.referralBy && (
                                                        <p className="text-[10px] text-muted-foreground/70 font-normal">
                                                            Ref: {beneficiary.referralBy}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-4">
                                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold text-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5 w-fit">
                                                    <RotateCw className="h-3.5 w-3.5 animate-spin-slow text-amber-600" />
                                                    {beneficiary.initiativeCount} Causes
                                                </Badge>
                                            </TableCell>

                                            {/* Repeating Causes Badges Cell */}
                                            <TableCell className="py-4">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {beneficiary.causes.map((cause, cIdx) => {
                                                        const IconComp = getCauseIcon(cause.causeCategory);
                                                        return (
                                                            <div 
                                                                key={`${cause.initiativeId}-${cIdx}`}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-primary/10 shadow-2xs hover:border-primary/30 transition-all text-xs font-semibold text-primary"
                                                            >
                                                                <IconComp className="h-3.5 w-3.5 text-primary shrink-0 opacity-70" />
                                                                <span className="capitalize">{cause.causeCategory}</span>
                                                                <span className="text-[10px] text-muted-foreground font-normal">({cause.initiativeName})</span>
                                                                {cause.amount > 0 && (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[9px] font-bold px-1.5 py-0 h-4 ml-0.5">
                                                                        ₹{cause.amount.toLocaleString('en-IN')}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-4 text-right">
                                                <div className="space-y-0.5">
                                                    <span className="font-extrabold text-sm text-emerald-600 block">
                                                        ₹{beneficiary.totalAmount.toLocaleString('en-IN')}
                                                    </span>
                                                    {beneficiary.totalZakat > 0 && (
                                                        <span className="text-[10px] text-muted-foreground font-medium block">
                                                            Zakat: ₹{beneficiary.totalZakat.toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-4 text-center">
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn(
                                                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize",
                                                        beneficiary.status === 'Verified' || beneficiary.status === 'Given' 
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                                    )}
                                                >
                                                    {beneficiary.status || 'Verified'}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="py-4 pr-6 text-right">
                                                <Button 
                                                    asChild 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 text-xs font-bold border-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl transition-all shadow-2xs"
                                                >
                                                    <Link href={`/beneficiaries/${beneficiary.id}`}>
                                                        <Eye className="h-3.5 w-3.5 mr-1" />
                                                        View
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>

                {/* Footer Controls: Pagination / Show All */}
                {filteredRepeatList.length > 5 && (
                    <div className="p-4 bg-primary/[0.02] border-t border-primary/10 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                            Showing {Math.min(displayLimit, filteredRepeatList.length)} of {filteredRepeatList.length} repeat recipients
                        </span>

                        <div className="flex items-center gap-2">
                            {displayLimit < filteredRepeatList.length ? (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setDisplayLimit(prev => prev + 10)}
                                    className="h-8 text-xs font-bold border-primary/20 text-primary rounded-xl"
                                >
                                    Load More ({filteredRepeatList.length - displayLimit} left)
                                </Button>
                            ) : (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setDisplayLimit(5)}
                                    className="h-8 text-xs font-bold text-muted-foreground hover:text-primary rounded-xl"
                                >
                                    Collapse List
                                </Button>
                            )}

                            <Button 
                                asChild 
                                size="sm" 
                                className="h-8 text-xs font-bold bg-primary text-white rounded-xl shadow-sm"
                            >
                                <Link href="/beneficiaries">
                                    Full Beneficiary Registry
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
