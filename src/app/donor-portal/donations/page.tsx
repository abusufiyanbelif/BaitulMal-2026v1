'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useCollection, query, collection, where } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    HeartHandshake, 
    Download, 
    WalletCards, 
    Calendar,
    ArrowUpDown,
    Filter,
    ShieldCheck,
    TrendingUp,
    PieChart as PieChartIcon,
    ArrowLeft,
    Search
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Donation } from '@/lib/types';
import { useState, useMemo } from 'react';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip, 
    Legend 
} from 'recharts';
import { Input } from '@/components/ui/input';

export default function DonorDonationsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');

    const donationsRef = useMemoFirebase(() => {
        if (!firestore || !userProfile?.id) return null;
        return query(
            collection(firestore, 'donations'),
            where('donorId', '==', userProfile.id)
        );
    }, [firestore, userProfile?.id]);

    const { data: donations, isLoading: isDonationsLoading } = useCollection<Donation>(donationsRef);

    const verifiedDonations = useMemo(() => donations?.filter(d => d.status === 'Verified') || [], [donations]);

    const typeBreakdown = useMemo(() => {
        const breakdown: Record<string, number> = {};
        verifiedDonations.forEach(d => {
            const types = d.typeSplit?.length ? d.typeSplit : [{ category: d.type || 'General', amount: d.amount }];
            types.forEach(t => {
                const cat = t.category || 'General';
                breakdown[cat] = (breakdown[cat] || 0) + (Number(t.amount) || 0);
            });
        });
        return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
    }, [verifiedDonations]);

    const PIE_COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    const filteredAndSortedDonations = useMemo(() => {
        let result = [...(donations || [])];
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(d => 
                d.id.toLowerCase().includes(q) || 
                (d.linkName || '').toLowerCase().includes(q) ||
                (d.campaignName || '').toLowerCase().includes(q) ||
                (d.type || '').toLowerCase().includes(q)
            );
        }

        return result.sort((a, b) => {
            const timeA = new Date(a.donationDate).getTime();
            const timeB = new Date(b.donationDate).getTime();
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
    }, [donations, searchQuery, sortOrder]);

    const totalAmount = donations?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0;

    if (isSessionLoading || isDonationsLoading) {
         return <BrandedLoader message="Fetching Your Contribution Records..." />;
    }

    if (!userProfile || userProfile.role !== 'Donor') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <HeartHandshake className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Authorized Profile Found</p>
                <Button asChild variant="outline"><Link href="/portal-login">Return to Login</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Contribution Registry</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">A verifiable audit trail of your institutional impact.</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl shadow-xl z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Total Lifecycle Impact</span>
                        <span className="text-xl font-black text-white font-mono">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10 mx-2" />
                    <WalletCards className="h-6 w-6 text-primary" />
                </div>
            </div>

            {/* Impact Breakdown Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-primary" /> Categorization
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px] pt-4">
                        {typeBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={typeBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {typeBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-[9px]">No verified data</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/40 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Contribution Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            {typeBreakdown.map((item, idx) => (
                                <div key={idx} className="space-y-1 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/20 transition-colors">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                                    <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(item.value)}</p>
                                    <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-primary" 
                                            style={{ width: `${(item.value / (totalAmount || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {typeBreakdown.length === 0 && (
                                <div className="col-span-full py-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No contribution categories found</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Registry Table */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
                    <div className="relative w-full sm:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Search by ID, Cause, or Type..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 h-12 rounded-2xl border-slate-200 bg-white focus:ring-primary/10 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                            <span className="flex items-center gap-1"><Filter className="h-3 w-3" /> All Records</span>
                            <span className="opacity-20">|</span>
                            <span>{filteredAndSortedDonations.length} items</span>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs font-black uppercase tracking-widest text-slate-600 rounded-xl h-10 border-slate-200"
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        >
                            <ArrowUpDown className="h-3 w-3 mr-2" />
                            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                        </Button>
                    </div>
                </div>

                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-[32px] overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 pl-8 py-5">Date & Reference</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Impact Area (Cause)</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Categorization</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Value</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Audit State</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Certificate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedDonations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3 opacity-20">
                                                    <Calendar className="h-12 w-12" />
                                                    <p className="font-black text-xs uppercase tracking-widest">No matching records found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredAndSortedDonations.map((donation) => {
                                            return (
                                                <TableRow key={donation.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="pl-8 py-6">
                                                        <div className="font-bold text-slate-900 text-sm">
                                                            {formatDate(donation.donationDate, { dateStyle: 'medium' })}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                            ID: {donation.id.substring(0, 10).toUpperCase()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-bold text-slate-700 text-xs truncate max-w-[180px]">
                                                            {donation.linkName || donation.campaignName || 'General Institutional Fund'}
                                                        </div>
                                                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">
                                                            {donation.linkSplit?.[0]?.linkType || (donation.campaignId ? 'campaign' : (donation.leadId ? 'lead' : 'unallocated'))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {donation.typeSplit?.length ? (
                                                                donation.typeSplit.map((ts, idx) => (
                                                                    <Badge key={idx} variant="outline" className="text-[8px] font-black uppercase tracking-tight bg-slate-50 text-slate-500 border-slate-200">
                                                                        {ts.category}: {formatCurrency(ts.amount)}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tight bg-slate-50 text-slate-500 border-slate-200">
                                                                    {donation.type || 'General'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">
                                                            via {donation.donationType}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-black text-slate-900 text-base font-mono">
                                                        {formatCurrency(donation.amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 shadow-sm">
                                                            {donation.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-8">
                                                        {donation.status === 'Verified' ? (
                                                            <Button variant="ghost" size="sm" asChild className="font-bold text-primary hover:bg-primary/5 rounded-xl h-9 group">
                                                                <Link href={`/donor-portal/receipt/${donation.id}`}>
                                                                    <Download className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                                                                    PDF
                                                                </Link>
                                                            </Button>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
                                                                <ShieldCheck className="h-3 w-3" /> In Audit
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
