'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useSession } from '@/hooks/use-session';
import { collection } from 'firebase/firestore';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfQuarter, subMonths, startOfYear, endOfQuarter } from 'date-fns';

import type { Donation, DonationCategory, Campaign, Lead } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Wallet, Calendar as CalendarIcon, TrendingUp, FolderKanban, Lightbulb, ShieldAlert } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-3))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-1))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-8))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-6))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-2))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-3))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const monthlyContributionChartConfig = {
  total: {
    label: "Total Amount (₹)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function DonationsSummaryPage() {
    const firestore = useFirestore();
    const pathname = usePathname();
    const { userProfile, isLoading: isProfileLoading } = useSession();

    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const donationsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);
    const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);
    
    const campaignsCollectionRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'campaigns');
    }, [firestore]);
    const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

    const leadsCollectionRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'leads');
    }, [firestore]);
    const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

    const canRead = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.read;

    const filteredDonations = useMemo(() => {
        if (!donations) return [];
        if (!date?.from) return donations;

        return donations.filter(d => {
            if (!d.donationDate) return false;
            try {
                const donationDate = new Date(d.donationDate);
                if (isNaN(donationDate.getTime())) return false;
                
                const fromDate = new Date(date.from!);
                fromDate.setHours(0, 0, 0, 0);

                if (date.to) {
                    const toDate = new Date(date.to);
                    toDate.setHours(23, 59, 59, 999);
                    return donationDate >= fromDate && donationDate <= toDate;
                }
                
                const fromDateEnd = new Date(fromDate);
                fromDateEnd.setHours(23, 59, 59, 999);
                return donationDate >= fromDate && donationDate <= fromDateEnd;

            } catch (e) {
                return false;
            }
        });
    }, [donations, date]);

    const summaryData = useMemo(() => {
        if (!filteredDonations || !campaigns || !leads) return null;
        
        const allocatedCount = filteredDonations.filter(d => d.linkSplit && d.linkSplit.length > 0 && d.linkSplit.some(l => l.linkType !== 'general')).length;
        const unallocatedCount = filteredDonations.length - allocatedCount;

        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const amountsByStatus: Record<string, number> = { Verified: 0, Pending: 0, Canceled: 0 };
        const countsByStatus: Record<string, number> = { Verified: 0, Pending: 0, Canceled: 0 };
        
        filteredDonations.forEach(d => {
            amountsByStatus[d.status] = (amountsByStatus[d.status] || 0) + d.amount;
            countsByStatus[d.status] = (countsByStatus[d.status] || 0) + 1;

            const splits = d.typeSplit && d.typeSplit.length > 0
                ? d.typeSplit
                : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    amountsByCategory[category as DonationCategory] += split.amount;
                }
            });
        });

        const paymentTypeData = filteredDonations.reduce((acc, d) => {
            const key = d.donationType || 'Other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const fitraTotal = amountsByCategory['Fitra'] || 0;
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const fidiyaTotal = amountsByCategory['Fidiya'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + sadaqahTotal + fidiyaTotal + interestTotal + lillahTotal + loanTotal + monthlyContributionTotal;

        const initiativeTotals: Record<string, { name: string; type: 'campaign' | 'lead' | 'general'; amount: number; count: number }> = {};
        
        campaigns?.forEach(c => {
            initiativeTotals[`campaign_${c.id}`] = { name: c.name, type: 'campaign', amount: 0, count: 0 };
        });
        leads?.forEach(l => {
            initiativeTotals[`lead_${l.id}`] = { name: l.name, type: 'lead', amount: 0, count: 0 };
        });
        initiativeTotals.unallocated = { name: 'Unallocated', type: 'general', amount: 0, count: 0 };

        const donationsPerInitiative: Record<string, Set<string>> = {};

        filteredDonations.forEach(donation => {
            const links = donation.linkSplit && donation.linkSplit.length > 0 ? donation.linkSplit : [];

            if (links.length === 0 || links.every(l => l.linkType === 'general')) {
                const legacyCampaignId = (donation as any).campaignId;
                if (legacyCampaignId) {
                    const key = `campaign_${legacyCampaignId}`;
                    if (initiativeTotals[key]) {
                        initiativeTotals[key].amount += donation.amount;
                        if (!donationsPerInitiative[key]) donationsPerInitiative[key] = new Set();
                        donationsPerInitiative[key].add(donation.id);
                    }
                } else {
                    initiativeTotals.unallocated.amount += donation.amount;
                    if (!donationsPerInitiative.unallocated) donationsPerInitiative.unallocated = new Set();
                    donationsPerInitiative.unallocated.add(donation.id);
                }
            } else {
                links.forEach(link => {
                    const key = link.linkType === 'general' ? 'unallocated' : `${link.linkType}_${link.linkId}`;
                    if (initiativeTotals[key]) {
                        initiativeTotals[key].amount += link.amount;
                        if (!donationsPerInitiative[key]) donationsPerInitiative[key] = new Set();
                        donationsPerInitiative[key].add(donation.id);
                    }
                });
            }
        });

        Object.keys(donationsPerInitiative).forEach(key => {
            if(initiativeTotals[key]) {
                initiativeTotals[key].count = donationsPerInitiative[key].size;
            }
        });

        const sortedInitiatives = Object.values(initiativeTotals)
            .filter(item => item.amount > 0 || item.count > 0)
            .sort((a, b) => b.amount - a.amount);


        return {
            allocatedCount,
            unallocatedCount,
            totalCount: filteredDonations.length,
            amountsByCategory,
            amountsByStatus,
            countsByStatus,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
            donationCategoryChartData: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
            fundTotals: {
                fitra: fitraTotal,
                zakat: zakatTotal,
                sadaqah: sadaqahTotal,
                fidiya: fidiyaTotal,
                interest: interestTotal,
                lillah: lillahTotal,
                loan: loanTotal,
                monthlyContribution: monthlyContributionTotal,
                grandTotal: grandTotal,
            },
            sortedInitiatives
        };
    }, [filteredDonations, campaigns, leads]);
    
    const monthlyContributionData = useMemo(() => {
        if (!filteredDonations) return null;
        const monthlyTotals = filteredDonations.reduce((acc, d) => {
            const typeSplit = d.typeSplit || [];
            const contribution = typeSplit.find(s => s.category === 'Monthly Contribution');
            if (contribution && contribution.amount > 0 && d.donationDate) {
                try {
                    const month = format(new Date(d.donationDate), 'yyyy-MM');
                    acc[month] = (acc[month] || 0) + contribution.amount;
                } catch(e) { /* ignore */ }
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(monthlyTotals)
            .map(([month, total]) => ({ month, total }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [filteredDonations]);

    const isLoading = areDonationsLoading || isProfileLoading || areCampaignsLoading || areLeadsLoading;

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }
    
     if (!canRead) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription className="font-normal">
                        You Do Not Have Permission To View This Page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 md:p-8 text-primary font-normal">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Dashboard
                    </Link>
                </Button>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold tracking-tight">Donation Summary</h1>
            </div>

            <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2 pb-2">
                        <Link href="/donations/summary" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                            pathname === '/donations/summary' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}>Donation Summary</Link>
                        <Link href="/donations" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                            pathname === '/donations' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}>Donation List</Link>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-full sm:w-[300px] justify-start text-left font-bold border-primary/20 text-primary",!date && "text-muted-foreground")}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Filter By All Time</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
                 <Select
                    onValueChange={(value) => {
                        const now = new Date();
                        if (value === 'all_time') {
                            setDate(undefined);
                        } else if (value === 'this_month') {
                            setDate({ from: startOfMonth(now), to: endOfMonth(now) });
                        } else if (value === 'this_quarter') {
                            setDate({ from: startOfQuarter(now), to: endOfQuarter(now) });
                        } else if (value === 'this_year') {
                            setDate({ from: startOfYear(now), to: endOfYear(now) });
                        } else if (value === 'last_3_months') {
                            setDate({ from: subMonths(now, 3), to: now });
                        }
                    }}
                    >
                    <SelectTrigger className="w-full sm:w-[180px] font-bold border-primary/20 text-primary rounded-[10px]">
                        <SelectValue placeholder="Quick Period Select" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_time" className="font-bold">All Time</SelectItem>
                        <SelectItem value="this_month" className="font-bold">This Month</SelectItem>
                        <SelectItem value="this_quarter" className="font-bold">This Quarter</SelectItem>
                        <SelectItem value="this_year" className="font-bold">This Year</SelectItem>
                        <SelectItem value="last_3_months" className="font-bold">Last 3 Months</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-6 animate-fade-in-zoom">
                <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2 font-bold text-primary">
                            <TrendingUp className="h-6 w-6 text-primary" />
                            Donations By Initiative
                        </CardTitle>
                        <CardDescription className="font-normal text-primary/70">
                            Total Donation Amounts Allocated To Each Campaign And Lead.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : (
                            <Table>
                                <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                    <TableRow>
                                        <TableHead className="font-bold text-[hsl(var(--table-header-fg))]">Initiative</TableHead>
                                        <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))]">Donation Count</TableHead>
                                        <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))]">Total Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summaryData?.sortedInitiatives.map((initiative) => (
                                        <TableRow key={`${initiative.type}_${initiative.name}`} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                                            <TableCell className="font-bold text-sm flex items-center gap-2 text-primary">
                                                {initiative.type === 'campaign' ? <FolderKanban className="h-4 w-4 opacity-40" /> : initiative.type === 'lead' ? <Lightbulb className="h-4 w-4 opacity-40" /> : <Wallet className="h-4 w-4 opacity-40" />}
                                                {initiative.name}
                                            </TableCell>
                                            <TableCell className="text-right font-normal">{initiative.count}</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-primary">₹{initiative.amount.toLocaleString('en-IN')}</TableCell>
                                        </TableRow>
                                    ))}
                                    {summaryData?.sortedInitiatives.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground font-normal italic opacity-60">
                                                No Specific Initiative Allocations In This Period.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Fund Totals By Type</CardTitle>
                            <CardDescription className="font-normal text-primary/70">A Breakdown Of All Collected Funds By Their Designated Purpose.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-6 font-normal">
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Fitra</span><span className="font-mono">₹{summaryData?.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Zakat</span><span className="font-mono">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Sadaqah</span><span className="font-mono">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Fidiya</span><span className="font-mono">₹{summaryData?.fundTotals?.fidiya.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Lillah</span><span className="font-mono">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Monthly Contribution</span><span className="font-mono">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Interest (For Disposal)</span><span className="font-mono">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded"><span className="text-muted-foreground font-normal">Loan (Qard-e-Hasana)</span><span className="font-mono">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator className="bg-primary/10 my-2" />
                            <div className="flex justify-between items-center text-lg font-bold text-primary px-2">
                                <span>Grand Total</span>
                                <span className="font-mono text-primary">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Zakat Utilization</CardTitle>
                            <CardDescription className="font-normal text-primary/70">Overall Tracking Of Zakat Funds Collected Across All Initiatives.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="flex justify-between items-center text-xl font-bold text-primary">
                                <span className="tracking-tight">Total Zakat Collected</span>
                                <span className="font-mono">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <Separator className="bg-primary/10" />
                            <p className="text-xs text-muted-foreground font-normal leading-relaxed italic">
                                To Observe How Zakat Resources Are Distributed At The Individual Case Level, Please Review The Summary Page For Each Dedicated Initiative.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Donations By Category</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          {isClient ? (
                            <ChartContainer config={donationCategoryChartConfig} className="h-[300px] w-full">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                    <Pie data={summaryData?.donationCategoryChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} strokeWidth={5} paddingAngle={2} className="transition-all duration-1000 ease-out focus:outline-none">
                                        {summaryData?.donationCategoryChartData?.map((entry) => (
                                            <Cell key={`cell-cat-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                                        ))}
                                    </Pie>
                                    <ChartLegend content={<ChartLegendContent />} />
                                </PieChart>
                            </ChartContainer>
                          ) : <Skeleton className="h-[300px] w-full rounded-md"/>}
                        </CardContent>
                    </Card>
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Donations By Payment Type</CardTitle>
                            <CardDescription className="font-normal text-primary/70">Count Of Donations Per Payment Channel.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          {isClient ? (
                             <ChartContainer config={donationPaymentTypeChartConfig} className="h-[300px] w-full">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                    <Pie data={summaryData?.donationPaymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} strokeWidth={5} paddingAngle={2} className="transition-all duration-1000 ease-out focus:outline-none">
                                        {summaryData?.donationPaymentTypeChartData?.map((entry) => (
                                            <Cell key={`cell-pay-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                                        ))}
                                    </Pie>
                                    <ChartLegend content={<ChartLegendContent />} />
                                </PieChart>
                            </ChartContainer>
                          ) : <Skeleton className="h-[300px] w-full rounded-md"/>}
                        </CardContent>
                    </Card>
                </div>
                {monthlyContributionData && monthlyContributionData.length > 0 && (
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Monthly Contributions Over Time</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          {isClient ? (
                            <ChartContainer config={monthlyContributionChartConfig} className="h-[300px] w-full">
                                <BarChart data={monthlyContributionData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
                                    tick={{ fontSize: 10, fontWeight: 'bold' }}
                                />
                                <YAxis
                                    tickFormatter={(value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)}`}
                                    tick={{ fontSize: 10, fontWeight: 'bold' }}
                                />
                                <ChartTooltip
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Bar dataKey="total" fill="var(--color-total)" radius={4} className="transition-all duration-1000 ease-out" />
                                </BarChart>
                            </ChartContainer>
                            ) : <Skeleton className="h-[300px] w-full rounded-md"/>}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}