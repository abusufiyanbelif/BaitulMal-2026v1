

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, query, DocumentData } from 'firebase/firestore';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfYear, subMonths, startOfYear, endOfQuarter } from 'date-fns';

import type { Donation, DonationCategory, Campaign, Lead } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Wallet, PieChart as PieChartIcon, BarChart as BarChartIcon, Calendar as CalendarIcon, TrendingUp, FolderKanban, Lightbulb } from 'lucide-react';
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
import { ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-5))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const donationStatusChartConfig = {
    Verified: { label: "Verified", color: "hsl(var(--chart-2))" },
    Pending: { label: "Pending", color: "hsl(var(--chart-4))" },
    Canceled: { label: "Canceled", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const monthlyContributionChartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function DonationsSummaryPage() {
    const firestore = useFirestore();
    const pathname = usePathname();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { toast } = useToast();

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
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

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
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            fundTotals: {
                fitra: fitraTotal,
                zakat: zakatTotal,
                loan: loanTotal,
                interest: interestTotal,
                sadaqah: sadaqahTotal,
                lillah: lillahTotal,
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
                } catch(e) { /* ignore invalid dates */ }
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
                    <AlertDescription>
                        You do not have permission to view this page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Donation Summary</h1>
            </div>

            <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        <Link href="/donations/summary" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            pathname === '/donations/summary' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                        )}>Donation Summary</Link>
                        <Link href="/donations" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            pathname === '/donations' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
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
                        className={cn("w-full sm:w-[300px] justify-start text-left font-normal",!date && "text-muted-foreground")}
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
                            <span>All time</span>
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
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Quick Select" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_time">All Time</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_quarter">This Quarter</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                        <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-6 animate-fade-in-zoom">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-6 w-6 text-primary" />
                            Donations by Initiative
                        </CardTitle>
                        <CardDescription>
                            Total donation amounts allocated to each campaign and lead.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Initiative</TableHead>
                                        <TableHead className="text-right">Donation Count</TableHead>
                                        <TableHead className="text-right">Total Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summaryData?.sortedInitiatives.map((initiative) => (
                                        <TableRow key={`${initiative.type}_${initiative.name}`}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                {initiative.type === 'campaign' ? <FolderKanban className="h-4 w-4 text-muted-foreground" /> : initiative.type === 'lead' ? <Lightbulb className="h-4 w-4 text-muted-foreground" /> : <Wallet className="h-4 w-4 text-muted-foreground" />}
                                                {initiative.name}
                                            </TableCell>
                                            <TableCell className="text-right">{initiative.count}</TableCell>
                                            <TableCell className="text-right font-mono">₹{initiative.amount.toLocaleString('en-IN')}</TableCell>
                                        </TableRow>
                                    ))}
                                    {summaryData?.sortedInitiatives.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                                No specific initiative allocations in this period.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                            <CardDescription>A breakdown of all collected funds by their designated purpose.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fitra</span><span className="font-semibold">₹{summaryData?.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (for disposal)</span><span className="font-semibold">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator />
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Grand Total</span>
                                <span className="font-bold text-primary">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>Overall tracking of Zakat funds collected across all initiatives.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Total Zakat Collected</span>
                                <span className="font-bold text-primary">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                To see how Zakat is allocated, please view the summary page for each individual campaign and lead.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {isClient ? (
                            <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                <BarChart data={Object.entries(summaryData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                    />
                                    <YAxis tickFormatter={(value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)}`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="value" radius={4}>
                                        {Object.keys(summaryData?.amountsByCategory || {}).map((name) => (
                                            <Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                          ) : <Skeleton className="h-[250px] w-full"/>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Payment Type</CardTitle>
                            <CardDescription>Count of donations per payment type.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isClient ? (
                             <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                    <Pie data={summaryData?.donationPaymentTypeChartData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={5}>
                                        {summaryData?.donationPaymentTypeChartData?.map((entry) => (
                                            <Cell key={entry.name} fill={`var(--color-${entry.name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Pie>
                                    <ChartLegend content={<ChartLegendContent />} />
                                </PieChart>
                            </ChartContainer>
                          ) : <Skeleton className="h-[250px] w-full"/>}
                        </CardContent>
                    </Card>
                </div>
                {monthlyContributionData && monthlyContributionData.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Contributions Over Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {isClient ? (
                            <ChartContainer config={monthlyContributionChartConfig} className="h-[300px] w-full">
                                <BarChart data={monthlyContributionData}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
                                />
                                <YAxis
                                    tickFormatter={(value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)}`}
                                />
                                <ChartTooltip
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={4} />
                                </BarChart>
                            </ChartContainer>
                            ) : <Skeleton className="h-[300px] w-full"/>}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
