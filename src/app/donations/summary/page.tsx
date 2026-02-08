

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, collectionGroup, query } from 'firebase/firestore';
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

import type { Donation, DonationCategory, Beneficiary } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Wallet, CheckCircle, Hourglass, XCircle, Link as LinkIcon, Link2Off, Download, DatabaseZap, DollarSign, CheckCircle2 } from 'lucide-react';
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
import { syncDonationsAction } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const donationCategoryChartConfig = {
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

export default function DonationsSummaryPage() {
    const firestore = useFirestore();
    const pathname = usePathname();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    const donationsCollectionRef = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);
    const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

    const beneficiariesCollectionGroup = useMemo(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'beneficiaries'));
    }, [firestore]);
    const { data: allBeneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionGroup);

    const canRead = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.read;
    const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.update;

    const handleSync = async () => {
        setIsSyncing(true);
        toast({ title: 'Syncing Donations...', description: 'Please wait while old donation records are updated to the new format.' });

        try {
            const result = await syncDonationsAction();
            if (result.success) {
                toast({ title: 'Sync Complete', description: result.message, variant: 'success' });
            } else {
                toast({ title: 'Sync Failed', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
             toast({ title: 'Sync Error', description: 'An unexpected client-side error occurred.', variant: 'destructive' });
        }

        setIsSyncing(false);
    };

    const summaryData = useMemo(() => {
        if (!donations || !allBeneficiaries) return null;
        
        const allocatedCount = donations.filter(d => d.campaignId).length;
        const unallocatedCount = donations.length - allocatedCount;

        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const amountsByStatus: Record<string, number> = { Verified: 0, Pending: 0, Canceled: 0 };
        const countsByStatus: Record<string, number> = { Verified: 0, Pending: 0, Canceled: 0 };
        
        donations.forEach(d => {
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

        const paymentTypeData = donations.reduce((acc, d) => {
            const key = d.donationType || 'Other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

        const zakatAllocated = allBeneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);

        return {
            allocatedCount,
            unallocatedCount,
            totalCount: donations.length,
            amountsByCategory,
            amountsByStatus,
            countsByStatus,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            zakatAllocated,
            fundTotals: {
                zakat: zakatTotal,
                loan: loanTotal,
                interest: interestTotal,
                sadaqah: sadaqahTotal,
                lillah: lillahTotal,
                monthlyContribution: monthlyContributionTotal,
                grandTotal: grandTotal,
            }
        };
    }, [donations, allBeneficiaries]);
    
    const isLoading = areDonationsLoading || isProfileLoading || areBeneficiariesLoading;

    if (isLoading) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }
    
     if (!canRead) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view this page.
                    </AlertDescription>
                </Alert>
            </main>
        );
    }
    
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Donations Summary</h1>
                {canUpdate && (
                    <Button onClick={handleSync} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                        Sync Donation Data
                    </Button>
                )}
            </div>

            <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-4">
                        <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === '/donations' ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
                            <Link href="/donations">All Donations</Link>
                        </Button>
                        <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === '/donations/summary' ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
                            <Link href="/donations/summary">Summary</Link>
                        </Button>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            
            <div className="space-y-6 animate-fade-in-zoom">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                        <CardContent className="p-2">
                            <div className="text-2xl font-bold">{summaryData?.countsByStatus.Verified ?? 0}</div>
                            <p className="text-xs text-muted-foreground">₹{(summaryData?.amountsByStatus.Verified ?? 0).toLocaleString('en-IN')}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2">
                            <div className="text-2xl font-bold">{summaryData?.countsByStatus.Pending ?? 0}</div>
                            <p className="text-xs text-muted-foreground">₹{(summaryData?.amountsByStatus.Pending ?? 0).toLocaleString('en-IN')}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                        <CardContent className="p-2">
                            <div className="text-2xl font-bold">{summaryData?.countsByStatus.Canceled ?? 0}</div>
                            <p className="text-xs text-muted-foreground">₹{(summaryData?.amountsByStatus.Canceled ?? 0).toLocaleString('en-IN')}</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Grand Total</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.grandTotal ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Zakat</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.zakat ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Interest</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.interest ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Loan</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.loan ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Sadaqah</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.sadaqah ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Lillah</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.lillah ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Contribution</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent className="p-2"><div className="text-xl font-bold">₹{(summaryData?.fundTotals.monthlyContribution ?? 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                            <CardDescription>A breakdown of all collected funds by their designated purpose.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Zakat</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Sadaqah</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Lillah</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Monthly Contribution</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Interest (for disposal)</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Loan (Qard-e-Hasana)</span>
                                <span className="font-semibold">Rupee {summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Grand Total</span>
                                <span className="font-bold text-primary">Rupee {summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>Overall tracking of Zakat funds collected vs. allocated.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Collected</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Allocated</span>
                                <span className="font-semibold">₹{summaryData?.zakatAllocated.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Zakat Balance</span>
                                <span className="font-bold text-primary">₹{((summaryData?.fundTotals.zakat || 0) - (summaryData?.zakatAllocated || 0)).toLocaleString('en-IN')}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                <BarChart data={Object.entries(summaryData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                    />
                                    <YAxis tickFormatter={(value) => `Rupee ${Number(value).toLocaleString()}`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="value" radius={4}>
                                        {Object.keys(summaryData?.amountsByCategory || {}).map((name) => (
                                            <Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Payment Type</CardTitle>
                            <CardDescription>Count of donations per payment type.</CardDescription>
                        </CardHeader>
                        <CardContent>
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
                        </CardContent>
                    </Card>
                </div>

                
                 
            </div>
        </main>
    );
}
