'use client';

import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, Timestamp, DocumentData, QueryDocumentSnapshot } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, FolderKanban, Lightbulb, HandHelping, IndianRupee, BarChart, CalendarIcon, Database, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import type { Donation, Beneficiary, Campaign, UserProfile } from '@/lib/types';

import { Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { donationCategories } from '@/lib/modules';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfYear, subMonths, startOfYear, endOfQuarter, parseISO, isValid, startOfDay, endOfDay, startOfWeek, formatISO, getYear, getQuarter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorageAnalytics } from '@/components/storage-analytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPageHits } from './actions';
import { SectionLoader } from '@/components/section-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function StatCard({ title, value, icon: Icon, isLoading }: { title: string, value: number, icon: React.ComponentType<{className?: string}>, isLoading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-8 w-1/2" />
                ) : (
                    <div className="text-2xl font-bold">{value.toLocaleString('en-IN')}</div>
                )}
            </CardContent>
        </Card>
    )
}

const donationCategoryChartConfig = donationCategories.reduce((acc, category, index) => {
    acc[category] = {
        label: category,
        color: `hsl(var(--chart-${(index % 8) + 1}))`,
    };
    return acc;
}, {} as ChartConfig);

export default function AnalyticsPage() {
    const firestore = useFirestore();
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true) }, []);

    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const campaignsRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
    const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
    const beneficiariesRef = useMemoFirebase(() => firestore ? collection(firestore, 'beneficiaries') : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersRef);
    const { data: campaigns, isLoading: campaignsLoading } = useCollection<Campaign>(campaignsRef);
    const { data: leads, isLoading: leadsLoading } = useCollection(leadsRef);
    const { data: donations, isLoading: donationsLoading } = useCollection<Donation>(donationsRef);
    const { data: beneficiaries, isLoading: beneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

    const [pageHits, setPageHits] = useState<{ id: string, hits: number }[] | null>(null);
    const [hitsLoading, setHitsLoading] = useState(false);

    useEffect(() => {
        setHitsLoading(true);
        getPageHits().then(result => {
            if (result && !('error' in result)) {
                setPageHits(result as { id: string, hits: number }[]);
            }
            setHitsLoading(false);
        });
    }, []);

    const isLoading = usersLoading || campaignsLoading || leadsLoading || donationsLoading || beneficiariesLoading;
    
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfYear(new Date()),
      to: new Date(),
    });
    const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
    const [selectedMetric, setSelectedMetric] = useState<'donations' | 'users' | 'beneficiaries'>('donations');

    const totalDonationAmount = useMemo(() => {
        return donations?.reduce((sum, d) => sum + d.amount, 0) || 0;
    }, [donations]);
    
    const donationCategoryData = useMemo(() => {
        if (!donations) return [];
        const categoryTotals = donations.reduce((acc, donation) => {
            const splits = (donation.typeSplit && donation.typeSplit.length > 0) 
                ? donation.typeSplit 
                : (donation.type ? [{category: donation.type, amount: donation.amount}] : []);

            splits.forEach(split => {
                if(split && split.category) {
                   const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                   acc[category] = (acc[category] || 0) + split.amount;
                }
            })
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categoryTotals).map(([name, value]) => ({name, value}));
    }, [donations]);

    const chartDataWithColors = useMemo(() => {
        return donationCategoryData.map(item => ({
            ...item,
            fill: `var(--color-${item.name.replace(/\s+/g, '')})`
        }));
    }, [donationCategoryData]);
    
    const topCampaigns = useMemo(() => {
        if(!campaigns || !donations) return [];
        
        const campaignTotals = new Map<string, number>();

        donations.forEach(donation => {
            const links = (donation.linkSplit && donation.linkSplit.length > 0)
                ? donation.linkSplit
                : (donation as any).campaignId ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] : [];

            links.forEach((link: any) => {
                if (link.linkType === 'campaign') {
                    const currentTotal = campaignTotals.get(link.linkId) || 0;
                    campaignTotals.set(link.linkId, currentTotal + link.amount);
                }
            })
        });
        
        const campaignData = Array.from(campaignTotals.entries()).map(([id, collected]) => {
            const campaign = campaigns.find(c => c.id === id);
            return {
                name: campaign?.name || 'Unknown Campaign',
                collected,
            }
        });

        return campaignData.sort((a,b) => b.collected - a.collected).slice(0, 5);

    }, [campaigns, donations]);

    const timeSeriesData = useMemo(() => {
        let sourceData: any[] | null = [];
        let dateField: string;
        let amountField: string | null = null;
    
        switch (selectedMetric) {
          case 'users':
            sourceData = users;
            dateField = 'createdAt'; // Timestamp
            break;
          case 'beneficiaries':
            sourceData = beneficiaries;
            dateField = 'createdAt'; // Timestamp
            break;
          case 'donations':
          default:
            sourceData = donations;
            dateField = 'donationDate'; // String YYYY-MM-DD
            amountField = 'amount';
            break;
        }

        if (!sourceData) return [];

        const dataWithDates = sourceData.filter(item => {
            const itemDateValue = item[dateField];
            if (!itemDateValue) return false;
            if (typeof itemDateValue === 'string') {
                return isValid(parseISO(itemDateValue));
            }
            return typeof itemDateValue.toDate === 'function';
        });

        const filteredData = dataWithDates.filter(item => {
            if (!date?.from) return true;

            const itemDateValue = item[dateField];
            
            let itemDate: Date;
            if (typeof itemDateValue === 'string') {
                itemDate = parseISO(itemDateValue);
            } else { // Timestamp
                itemDate = itemDateValue.toDate();
            }

            const from = startOfDay(date.from);
            const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
            return itemDate >= from && itemDate <= to;
        });

        const groupedData = filteredData.reduce<Record<string, { date: string; count: number; amount: number }>>((acc, item) => {
            const itemDateValue = item[dateField];
            let itemDate: Date;
            if (typeof itemDateValue === 'string') {
                itemDate = parseISO(itemDateValue);
            } else {
                itemDate = itemDateValue.toDate();
            }

            let key: string;
            if (granularity === 'daily') {
                key = formatISO(itemDate, { representation: 'date' });
            } else if (granularity === 'weekly') {
                key = formatISO(startOfWeek(itemDate), { representation: 'date' });
            } else if (granularity === 'monthly') {
                key = format(itemDate, 'yyyy-MM');
            } else if (granularity === 'quarterly') {
                key = `${getYear(itemDate)}-Q${getQuarter(itemDate)}`;
            } else { // yearly
                key = format(itemDate, 'yyyy');
            }

            if (!acc[key]) {
                acc[key] = { date: key, count: 0, amount: 0 };
            }
            acc[key].count += 1;
            if (amountField && item[amountField]) {
                acc[key].amount += Number(item[amountField]);
            }

            return acc;
        }, {});
        
        return Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));
    }, [donations, users, beneficiaries, date, granularity, selectedMetric]);
    
    const activityChartConfig = {
      count: {
        label: "Count",
        color: "hsl(var(--chart-1))",
      },
      amount: {
        label: "Amount (₹)",
        color: "hsl(var(--chart-2))",
      },
    } satisfies ChartConfig;
    
    const documentDistributionChartConfig = {
        Users: { label: "Users", color: "hsl(var(--chart-5))" },
        Campaigns: { label: "Campaigns", color: "hsl(var(--chart-2))" },
        Leads: { label: "Leads", color: "hsl(var(--chart-3))" },
        Beneficiaries: { label: "Beneficiaries", color: "hsl(var(--chart-4))" },
        Donations: { label: "Donations", color: "hsl(var(--chart-1))" },
    } satisfies ChartConfig;

    const documentDistributionData = useMemo(() => {
        if (isLoading) return [];
        return [
            { name: 'Users', value: users?.length || 0, fill: 'var(--color-Users)' },
            { name: 'Campaigns', value: campaigns?.length || 0, fill: 'var(--color-Campaigns)' },
            { name: 'Leads', value: leads?.length || 0, fill: 'var(--color-Leads)' },
            { name: 'Beneficiaries', value: beneficiaries?.length || 0, fill: 'var(--color-Beneficiaries)' },
            { name: 'Donations', value: donations?.length || 0, fill: 'var(--color-Donations)' },
        ].filter(item => item.value > 0);
    }, [isLoading, users, campaigns, leads, beneficiaries, donations]);


    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Dashboard
                    </Link>
                </Button>
            </div>
            
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-primary/5 p-1 rounded-xl h-auto">
                    <TabsTrigger value="general" className="font-bold py-2.5"><BarChart className="mr-2 h-4 w-4" />General Analytics</TabsTrigger>
                    <TabsTrigger value="storage" className="font-bold py-2.5"><Database className="mr-2 h-4 w-4" />Storage Analytics</TabsTrigger>
                    <TabsTrigger value="database" className="font-bold py-2.5"><Database className="mr-2 h-4 w-4" />Database Analytics</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="animate-fade-in-up">
                    <div className="space-y-6">
                        {isLoading ? (
                            <SectionLoader label="Calculating General Analytics..." description="Aggregating counts for users, campaigns, and beneficiaries." />
                        ) : (
                            <>
                                <Card className="animate-fade-in-zoom">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-3xl text-primary font-bold"> General Analytics Overview</CardTitle>
                                        <CardDescription className="font-normal text-primary/70">A Summary Of Key Metrics From Across The Application.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <StatCard title="Total Users" value={users?.length || 0} icon={Users} isLoading={isLoading} />
                                        <StatCard title="Total Campaigns" value={campaigns?.length || 0} icon={FolderKanban} isLoading={isLoading} />
                                        <StatCard title="Total Leads" value={leads?.length || 0} icon={Lightbulb} isLoading={isLoading} />
                                        <StatCard title="Total Beneficiaries (Master)" value={beneficiaries?.length || 0} icon={HandHelping} isLoading={isLoading} />
                                        <StatCard title="Total Donations" value={donations?.length || 0} icon={IndianRupee} isLoading={isLoading} />
                                        <StatCard title="Total Donation Amount" value={totalDonationAmount} icon={IndianRupee} isLoading={isLoading} />
                                    </CardContent>
                                </Card>
                                <div className="grid gap-6 lg:grid-cols-3">
                                    <Card className="lg:col-span-1 animate-fade-in-up" style={{animationDelay: '200ms'}}>
                                        <CardHeader>
                                            <CardTitle className="text-primary font-bold">Donations By Category</CardTitle>
                                            <CardDescription className="font-normal text-primary/70">Total Amount Received For Each Donation Category.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                        {isClient ? (
                                            <ChartContainer config={donationCategoryChartConfig} className="h-[300px] w-full">
                                                <PieChart>
                                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                    <Pie data={chartDataWithColors} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} paddingAngle={2}>
                                                        {chartDataWithColors.map((entry) => (
                                                            <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <ChartLegend content={<ChartLegendContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[300px] w-full" />}
                                        </CardContent>
                                    </Card>
                                    <Card className="lg:col-span-1 animate-fade-in-up" style={{animationDelay: '300ms'}}>
                                        <CardHeader>
                                            <CardTitle className="text-primary font-bold">Top 5 Funded Campaigns</CardTitle>
                                            <CardDescription className="font-normal text-primary/70">The Campaigns That Have Received The Most Funding.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {isClient ? (
                                            <ScrollArea className="w-full">
                                                <div className="min-w-[300px]">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="font-bold text-primary">Campaign Name</TableHead>
                                                                <TableHead className="text-right font-bold text-primary">Amount Collected</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {topCampaigns.map(campaign => (
                                                                <TableRow key={campaign.name}>
                                                                    <TableCell className="font-medium text-foreground">{campaign.name}</TableCell>
                                                                    <TableCell className="text-right font-mono text-primary font-bold">₹{campaign.collected.toLocaleString('en-IN')}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                <ScrollBar orientation="horizontal" className="h-1.5" />
                                            </ScrollArea>
                                            ) : <Skeleton className="h-[300px] w-full" />}
                                        </CardContent>
                                    </Card>
                                    <Card className="lg:col-span-1 animate-fade-in-up" style={{animationDelay: '400ms'}}>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-primary font-bold"><Eye className="h-5 w-5"/> Page Visits</CardTitle>
                                            <CardDescription className="font-normal text-primary/70">Total Visits For Primary Organizational Pages.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {hitsLoading ? <Skeleton className="h-40 w-full"/> : (
                                                <ScrollArea className="w-full">
                                                    <div className="min-w-[250px]">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-primary">Page Name</TableHead>
                                                                    <TableHead className="text-right font-bold text-primary">Hit Count</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {pageHits?.sort((a, b) => b.hits - a.hits).map(hit => (
                                                                    <TableRow key={hit.id}>
                                                                        <TableCell className="font-medium capitalize text-foreground">{hit.id.replace(/_/g, ' ')}</TableCell>
                                                                        <TableCell className="text-right font-mono text-primary font-bold">{hit.hits.toLocaleString()}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    <ScrollBar orientation="horizontal" className="h-1.5" />
                                                </ScrollArea>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="storage" className="animate-fade-in-up">
                    <StorageAnalytics />
                </TabsContent>
                <TabsContent value="database" className="animate-fade-in-up">
                    <div className="space-y-6">
                        {isLoading ? (
                            <SectionLoader label="Processing Database Trends..." description="Analyzing document creation history and distribution." />
                        ) : (
                            <>
                                <Card className="animate-fade-in-zoom">
                                    <CardHeader>
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            <div>
                                                <CardTitle className="text-primary font-bold">Activity Over Time</CardTitle>
                                                <CardDescription className="font-normal text-primary/70">Track New Donations, Users, And Beneficiaries Over A Selected Period.</CardDescription>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button id="date" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-bold border-primary/20 text-primary", !date && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick A Date Range</span>)}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="end">
                                                        <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
                                                    </PopoverContent>
                                                </Popover>
                                                <UiSelect onValueChange={(value) => {
                                                    const now = new Date();
                                                    if (value === 'all_time') setDate({ from: undefined, to: undefined });
                                                    else if (value === 'this_month') setDate({ from: startOfMonth(now), to: endOfMonth(now) });
                                                    else if (value === 'this_quarter') setDate({ from: startOfQuarter(now), to: endOfQuarter(now) });
                                                    else if (value === 'this_year') setDate({ from: startOfYear(now), to: endOfYear(now) });
                                                    else if (value === 'last_3_months') setDate({ from: subMonths(now, 3), to: now });
                                                }}>
                                                    <SelectTrigger className="w-full sm:w-auto font-bold border-primary/20 text-primary"><SelectValue placeholder="Quick Selection" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all_time" className="font-bold">All Time</SelectItem>
                                                        <SelectItem value="this_month" className="font-bold">This Month</SelectItem>
                                                        <SelectItem value="this_quarter" className="font-bold">This Quarter</SelectItem>
                                                        <SelectItem value="this_year" className="font-bold">This Year</SelectItem>
                                                        <SelectItem value="last_3_months" className="font-bold">Last 3 Months</SelectItem>
                                                    </SelectContent>
                                                </UiSelect>
                                            </div>
                                        </div>
                                        <div className="pt-4 flex flex-wrap gap-4 items-center">
                                            <UiSelect value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)}>
                                            <SelectTrigger className="w-full sm:w-auto font-bold border-primary/20 text-primary">
                                                <SelectValue placeholder="Select Metric" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="donations" className="font-bold">Donations Collected</SelectItem>
                                                <SelectItem value="users" className="font-bold">New Members</SelectItem>
                                                <SelectItem value="beneficiaries" className="font-bold">New Beneficiaries</SelectItem>
                                            </SelectContent>
                                            </UiSelect>
                                            <UiSelect value={granularity} onValueChange={(value) => setGranularity(value as any)}>
                                            <SelectTrigger className="w-full sm:w-auto font-bold border-primary/20 text-primary">
                                                <SelectValue placeholder="Select Interval" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="daily" className="font-bold">Daily View</SelectItem>
                                                <SelectItem value="weekly" className="font-bold">Weekly View</SelectItem>
                                                <SelectItem value="monthly" className="font-bold">Monthly View</SelectItem>
                                                <SelectItem value="quarterly" className="font-bold">Quarterly View</SelectItem>
                                                <SelectItem value="yearly" className="font-bold">Yearly View</SelectItem>
                                            </SelectContent>
                                            </UiSelect>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isClient ? (
                                        <ChartContainer config={activityChartConfig} className="h-[350px] w-full">
                                            <AreaChart data={timeSeriesData} margin={{ left: 12, right: 12 }}>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                            <XAxis
                                                dataKey="date"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                tickFormatter={(value) => {
                                                try {
                                                    if (granularity === 'yearly') return value;
                                                    if (granularity === 'quarterly') return value;
                                                    if (granularity === 'monthly') return format(parseISO(`${value}-01`), 'MMM yy');
                                                    return format(parseISO(value), 'd MMM');
                                                } catch (e) { return value; }
                                                }}
                                            />
                                            <YAxis tickFormatter={(value) => value.toLocaleString()} tickLine={false} axisLine={false} />
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                            <Area
                                                dataKey="count"
                                                type="natural"
                                                fill="var(--color-count)"
                                                fillOpacity={0.4}
                                                stroke="var(--color-count)"
                                                stackId="a"
                                            />
                                            {selectedMetric === 'donations' && (
                                                <Area
                                                    dataKey="amount"
                                                    type="natural"
                                                    fill="var(--color-amount)"
                                                    fillOpacity={0.4}
                                                    stroke="var(--color-amount)"
                                                    stackId="b"
                                                />
                                            )}
                                            <ChartLegend content={<ChartLegendContent />} />
                                            </AreaChart>
                                        </ChartContainer>
                                        ) : (
                                        <Skeleton className="h-[350px] w-full" />
                                        )}
                                    </CardContent>
                                </Card>
                                <div className="grid gap-6 lg:grid-cols-2 animate-fade-in-up" style={{ animationDelay: '200ms'}}>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-primary font-bold">Document Distribution</CardTitle>
                                            <CardDescription className="font-normal text-primary/70">The Proportion Of Documents In Each Main Collection.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                        {isClient ? (
                                            <ChartContainer config={documentDistributionChartConfig} className="h-[300px] w-full">
                                                <PieChart>
                                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                    <Pie data={documentDistributionData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} paddingAngle={2}>
                                                        {documentDistributionData.map((entry) => (
                                                            <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <ChartLegend content={<ChartLegendContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[300px] w-full" />}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-primary font-bold">Detailed Usage Metrics</CardTitle>
                                            <CardDescription className="font-normal text-primary/70">Information About Database Reads, Writes, And Deletes.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Alert className="border-primary/20">
                                                <Database className="h-4 w-4 text-primary" />
                                                <AlertTitle className="text-primary font-bold">View Usage In Firebase Console</AlertTitle>
                                                <AlertDescription className="font-normal text-primary/80">
                                                    <p>For detailed, real-time metrics on database operations, network usage, and storage, please visit your Firebase Console.</p>
                                                    <p className="mt-2">The Activity Over Time chart can provide insight into document creation trends.</p>
                                                    <Button asChild variant="link" className="p-0 h-auto mt-2 text-primary font-bold">
                                                        <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/usage`} target="_blank" rel="noopener noreferrer">
                                                            Go To Firebase Console Usage <ExternalLink className="ml-1 h-3 w-3" />
                                                        </a>
                                                    </Button>
                                                </AlertDescription>
                                            </Alert>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}