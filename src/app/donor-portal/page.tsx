'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useCollection, query, collection, where } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    HeartHandshake, 
    CreditCard, 
    Download, 
    ShieldCheck, 
    Activity, 
    WalletCards, 
    User,
    LogOut,
    ExternalLink,
    TrendingUp,
    PieChart as PieChartIcon,
    Calendar,
    Target
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Donation } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend 
} from 'recharts';

export default function DonorPortalPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();

    const donationsRef = useMemoFirebase(() => {
        if (!firestore || !userProfile?.id) return null;
        return query(
            collection(firestore, 'donations'),
            where('donorId', '==', userProfile.id)
        );
    }, [firestore, userProfile?.id]);

    const { data: donations, isLoading: isDonationsLoading } = useCollection<Donation>(donationsRef);

    if (isSessionLoading || isDonationsLoading) {
         return <BrandedLoader message="Syncing Your Impact Records..." />;
    }

    if (!userProfile || userProfile.role !== 'Donor') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <ShieldCheck className="h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Unauthorized Workspace Access</p>
                <Button asChild variant="outline"><Link href="/portal-login">Return to Login</Link></Button>
            </div>
        );
    }

    const verifiedDonations = donations?.filter(d => d.status === 'Verified') || [];
    const totalImpact = verifiedDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const pendingCount = donations?.filter(d => d.status === 'Pending').length || 0;
    const sortedDonations = [...(donations || [])].sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());

    // --- DATA AGGREGATION FOR CHARTS ---

    // 1. Breakdown by Type (Zakat vs Sadaqah vs others)
    const typeTotals: Record<string, number> = {};
    verifiedDonations.forEach(d => {
        // Use type from typeSplit or fallback to type
        const types = d.typeSplit?.length ? d.typeSplit : [{ category: d.type || 'General', amount: d.amount }];
        types.forEach(t => {
            const cat = t.category || 'General';
            typeTotals[cat] = (typeTotals[cat] || 0) + (Number(t.amount) || 0);
        });
    });
    
    const pieData = Object.entries(typeTotals).map(([name, value]) => ({ name, value }));
    const PIE_COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // 2. Monthly Trend (Last 6 months)
    const monthlyData: Record<string, number> = {};
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d.toLocaleString('default', { month: 'short' });
    }).reverse();

    verifiedDonations.forEach(d => {
        const date = new Date(d.donationDate);
        const month = date.toLocaleString('default', { month: 'short' });
        if (last6Months.includes(month)) {
            monthlyData[month] = (monthlyData[month] || 0) + (Number(d.amount) || 0);
        }
    });

    const barData = last6Months.map(month => ({
        month,
        amount: monthlyData[month] || 0
    }));

    // 3. Cause Breakdown
    const causeTotals: Record<string, number> = {};
    verifiedDonations.forEach(d => {
        const name = d.linkName || 'General Fund';
        causeTotals[name] = (causeTotals[name] || 0) + (Number(d.amount) || 0);
    });
    const causeData = Object.entries(causeTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <User className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Assalam-o-Alaikum, {userProfile.name?.split(' ')[0]}</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 mt-1">
                            <ShieldCheck className="h-3 w-3 text-primary" /> Verified Institutional Donor Profile
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" className="font-bold border-slate-200 rounded-xl h-12 px-6">
                        <Link href="/donor-portal/causes">
                            <Target className="mr-2 h-4 w-4" />
                            Discover Causes
                        </Link>
                    </Button>
                    <Button asChild className="font-bold shadow-lg shadow-primary/20 rounded-xl h-12 px-6">
                        <Link href="/donate">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Contribute Now
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/40 bg-white group hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden" onClick={() => router.push('/donor-portal/donations')}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Impact</CardTitle>
                        <HeartHandshake className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                            {formatCurrency(totalImpact)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                            <Activity className="h-3 w-3" /> {verifiedDonations.length} Verified Contributions
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/40 bg-white group hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden" onClick={() => router.push('/donor-portal/donations')}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing Audits</CardTitle>
                        <WalletCards className="h-5 w-5 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                            {pendingCount}
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-3 w-3" /> Awaiting Institutional Clearance
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/40 bg-slate-900 text-white group hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden" onClick={() => router.push('/donor-portal/profile')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Loyalty Status</CardTitle>
                        <ShieldCheck className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tight truncate flex items-center gap-2">
                            Platinum Member
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-green-400" /> High Integrity Scoring
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <PieChartIcon className="h-5 w-5 text-primary" /> Contribution Mix
                            </CardTitle>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allocation by Purpose</p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No Data Available</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" /> Monthly Impact
                            </CardTitle>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contribution Trend (6m)</p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity & Causes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity Table */}
                <Card className="lg:col-span-2 border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex flex-row justify-between items-center">
                        <div>
                            <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Recent Activity</CardTitle>
                            <p className="text-slate-500 text-xs font-normal">Audit trail of your recent contributions.</p>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-primary">
                            <Link href="/donor-portal/donations">View Registry <ExternalLink className="ml-2 h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/30">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 pl-8 py-4">Timeline</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Impact</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Allocation</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Audit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedDonations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3 opacity-20">
                                                    <WalletCards className="h-12 w-12" />
                                                    <p className="font-black text-xs uppercase tracking-widest">No Activity Records Found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedDonations.slice(0, 5).map((donation) => (
                                            <TableRow key={donation.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="pl-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-sm">{formatDate(donation.donationDate, { dateStyle: 'medium' })}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{donation.id.slice(0, 8)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-black text-slate-900 text-base font-mono">
                                                    {formatCurrency(donation.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{donation.linkName || 'General Fund'}</span>
                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">{donation.typeSplit?.[0]?.category || donation.type || 'General'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[9px] uppercase tracking-widest px-2 py-0.5">
                                                        {donation.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    {donation.status === 'Verified' ? (
                                                        <Button variant="ghost" size="sm" asChild className="font-bold text-primary hover:bg-primary/5 rounded-xl h-9">
                                                            <Link href={`/donor-portal/receipt/${donation.id}`}>
                                                                <Download className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <ShieldCheck className="h-4 w-4 text-slate-200 ml-auto" />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Impact by Cause List */}
                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-900 px-8 py-6 border-b border-white/10">
                        <CardTitle className="text-lg font-black text-white tracking-tight">Cause Allocation</CardTitle>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Top Impact Areas</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {causeData.length > 0 ? (
                                causeData.map((cause, idx) => (
                                    <div key={idx} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                {idx + 1}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{cause.name}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Contribution</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(cause.value)}</span>
                                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary" 
                                                    style={{ width: `${(cause.value / totalImpact) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No allocations found</div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50/50">
                            <Button asChild variant="outline" className="w-full font-black text-[10px] uppercase tracking-widest border-slate-200 h-10 rounded-xl">
                                <Link href="/donor-portal/causes">Discover More Causes</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
