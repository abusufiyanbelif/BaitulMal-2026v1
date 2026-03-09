'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users, CheckCircle2, Hourglass, XCircle, UserCheck } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfYear, subMonths, startOfYear, endOfQuarter } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const statusChartConfig = {
    Verified: { label: "Verified", color: "hsl(var(--chart-1))" },
    Pending: { label: "Pending", color: "hsl(var(--chart-2))" },
    Hold: { label: "On Hold", color: "hsl(var(--chart-3))" },
    'Need More Details': { label: "Need Details", color: "hsl(var(--chart-4))" },
    Given: { label: "Given", color: "hsl(var(--chart-6))" },
} satisfies ChartConfig;

const zakatChartConfig = {
    Eligible: { label: "Eligible", color: "hsl(var(--chart-1))" },
    'Not Eligible': { label: "Not Eligible", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;


export default function BeneficiariesSummaryPage() {
    const firestore = useFirestore();
    const pathname = usePathname();
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const beneficiariesCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'beneficiaries');
    }, [firestore]);
    const { data: beneficiaries, isLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

    const filteredBeneficiaries = useMemo(() => {
        if (!beneficiaries) return [];
        if (!date?.from) return beneficiaries;

        return beneficiaries.filter(b => {
            if (!b.addedDate) return false;
            try {
                const addedDate = new Date(b.addedDate);
                if (isNaN(addedDate.getTime())) return false;
                
                const fromDate = new Date(date.from!);
                fromDate.setHours(0, 0, 0, 0);

                if (date.to) {
                    const toDate = new Date(date.to);
                    toDate.setHours(23, 59, 59, 999);
                    return addedDate >= fromDate && addedDate <= toDate;
                }
                
                const fromDateEnd = new Date(fromDate);
                fromDateEnd.setHours(23, 59, 59, 999);
                return addedDate >= fromDate && addedDate <= fromDateEnd;

            } catch (e) {
                return false;
            }
        });
    }, [beneficiaries, date]);
    
    const summaryData = useMemo(() => {
        if (!filteredBeneficiaries) return null;

        const statusCounts = filteredBeneficiaries.reduce((acc, b) => {
            const status = b.status || 'Pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const zakatCounts = filteredBeneficiaries.reduce((acc, b) => {
            const key = b.isEligibleForZakat ? 'Eligible' : 'Not Eligible';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, { Eligible: 0, 'Not Eligible': 0 } as Record<string, number>);

        const referralCounts = filteredBeneficiaries.reduce((acc, b) => {
            const referral = b.referralBy?.trim() || 'Unknown';
            acc[referral] = (acc[referral] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const topReferrals = Object.entries(referralCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return {
            total: filteredBeneficiaries.length,
            statusCounts,
            zakatCounts,
            topReferrals,
            statusChartData: Object.entries(statusCounts).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
            zakatChartData: Object.entries(zakatCounts).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` }))
        };

    }, [filteredBeneficiaries]);

    if (isLoading) {
        return <main className="container mx-auto p-4 md:p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></main>;
    }
    
    if (!summaryData) {
         return <main className="container mx-auto p-4 md:p-8"><p>Could Not Load Summary Data.</p></main>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 text-primary font-normal">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/beneficiaries">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Beneficiary List
                    </Link>
                </Button>
            </div>
            
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold tracking-tight">Beneficiary Summary</h1>
            </div>

            <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2 pb-2">
                         <Link href="/beneficiaries/summary" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                            pathname === '/beneficiaries/summary' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}>Summary</Link>
                        <Link href="/beneficiaries" className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                            pathname === '/beneficiaries' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}>Beneficiary List</Link>
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
                            <span>All Time</span>
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
                    <SelectTrigger className="w-full sm:w-[180px] font-bold border-primary/20 text-primary">
                        <SelectValue placeholder="Quick Select" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white border-primary/10">
                        <CardHeader className="p-4 flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Total Beneficiaries</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground"/>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold text-primary">{summaryData.total}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-white border-primary/10">
                        <CardHeader className="p-4 flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Verified</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500"/>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold text-primary">{summaryData.statusCounts.Verified || 0}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-white border-primary/10">
                        <CardHeader className="p-4 flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Pending</CardTitle>
                            <Hourglass className="h-4 w-4 text-amber-500"/>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold text-primary">{summaryData.statusCounts.Pending || 0}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-white border-primary/10">
                        <CardHeader className="p-4 flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Zakat Eligible</CardTitle>
                            <UserCheck className="h-4 w-4 text-primary"/>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold text-primary">{summaryData.zakatCounts.Eligible || 0}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Beneficiaries By Status</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isClient ? (
                                <ChartContainer config={statusChartConfig} className="h-[250px] w-full">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                        <Pie data={summaryData.statusChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} strokeWidth={5} paddingAngle={2}>
                                            {summaryData.statusChartData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : <Skeleton className="h-[250px] w-full" />}
                        </CardContent>
                    </Card>
                     <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="font-bold text-primary">Beneficiaries By Zakat Eligibility</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isClient ? (
                                <ChartContainer config={zakatChartConfig} className="h-[250px] w-full">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                        <Pie data={summaryData.zakatChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} strokeWidth={5} paddingAngle={2}>
                                             {summaryData.zakatChartData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : <Skeleton className="h-[250px] w-full" />}
                        </CardContent>
                    </Card>
                </div>
                 <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="font-bold text-primary">Top Referral Sources</CardTitle>
                        <CardDescription className="font-normal text-primary/70">Top 10 Sources Referring The Most Beneficiaries.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isClient ? (
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={summaryData.topReferrals.map(([name, value]) => ({name, value}))} layout="vertical" margin={{left: 30, right: 30}}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: 'hsl(var(--primary))' }} width={120}/>
                                <XAxis type="number" hide />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ChartContainer>
                         ) : <Skeleton className="h-[300px] w-full" />}
                    </CardContent>
                 </Card>
            </div>
        </div>
    );
}
