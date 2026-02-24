

'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, FolderKanban, Lightbulb, HandHelping, DollarSign, BarChart, CalendarIcon, Database, ExternalLink } from 'lucide-react';
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
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfYear, subMonths, startOfYear, endOfQuarter, parseISO, isValid, startOfDay, endOfDay, startOfWeek, formatISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorageAnalytics } from '@/components/storage-analytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function StatCard({ title, value, icon: Icon, isLoading }: { title: string, value: number, icon: React.ComponentType<{className?: string}>, isLoading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
    acc[category.replace(/\s+/g, '')] = {
        label: category,
        color: `hsl(var(--chart-${index + 1}))`,
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

    const isLoading = usersLoading || campaignsLoading || leadsLoading || donationsLoading || beneficiariesLoading;
    
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfYear(new Date()),
      to: new Date(),
    });
    const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
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

            links.forEach(link => {
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
            dateField = 'createdAt'; // Timestamp (prefer over addedDate for consistency)
            break;
          case 'donations':
          default:
            sourceData = donations;
            dateField = 'donationDate'; // String YYYY-MM-DD
            amountField = 'amount';
            break;
        }

        if (!sourceData) return [];

        const filteredData = sourceData.filter(item => {
            const itemDateValue = item[dateField];
            if (!itemDateValue) return false;

            let itemDate: Date;
            if (typeof itemDateValue === 'string') {
                itemDate = parseISO(itemDateValue);
            } else if (itemDateValue && typeof itemDateValue.toDate === 'function') { // Firestore Timestamp
                itemDate = itemDateValue.toDate();
            } else {
                return false;
            }

            if (!isValid(itemDate)) return false;

            if (!date?.from) return true;
            const from = startOfDay(date.from);
            const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
            return itemDate >= from && itemDate <= to;
        });

        const groupedData = filteredData.reduce((acc, item) => {
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
            } else { // monthly
                key = format(itemDate, 'yyyy-MM');
            }

            if (!acc[key]) {
                acc[key] = { date: key, count: 0, amount: 0 };
            }
            acc[key].count += 1;
            if (amountField && item[amountField]) {
                acc[key].amount += Number(item[amountField]);
            }

            return acc;
        }, {} as Record<string, { date: string, count: number, amount: number }>);
        
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
        Users: { label: "Users", color: "hsl(var(--chart-1))" },
        Campaigns: { label: "Campaigns", color: "hsl(var(--chart-2))" },
        Leads: { label: "Leads", color: "hsl(var(--chart-3))" },
        Beneficiaries: { label: "Beneficiaries", color: "hsl(var(--chart-4))" },
        Donations: { label: "Donations", color: "hsl(var(--chart-5))" },
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
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="general"><BarChart className="mr-2 h-4 w-4" />General Analytics</TabsTrigger>
                    <TabsTrigger value="storage"><Database className="mr-2 h-4 w-4" />Storage Analytics</TabsTrigger>
                    <TabsTrigger value="database"><Database className="mr-2 h-4 w-4" />Database Analytics</TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                    <div className="space-y-6">
                        <Card className="animate-fade-in-zoom">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-3xl"> General Analytics Overview</CardTitle>
                                <CardDescription>A summary of key metrics from across the application.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <StatCard title="Total Users" value={users?.length || 0} icon={Users} isLoading={isLoading} />
                                <StatCard title="Total Campaigns" value={campaigns?.length || 0} icon={FolderKanban} isLoading={isLoading} />
                                <StatCard title="Total Leads" value={leads?.length || 0} icon={Lightbulb} isLoading={isLoading} />
                                <StatCard title="Total Beneficiaries (Master)" value={beneficiaries?.length || 0} icon={HandHelping} isLoading={isLoading} />
                                <StatCard title="Total Donations" value={donations?.length || 0} icon={DollarSign} isLoading={isLoading} />
                                <StatCard title="Total Donation Amount" value={totalDonationAmount} icon={DollarSign} isLoading={isLoading} />
                            </CardContent>
                        </Card>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Donations by Category</CardTitle>
                                    <CardDescription>Total amount received for each donation category.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                {isClient ? (
                                    <ChartContainer config={donationCategoryChartConfig} className="h-[300px] w-full">
                                        <PieChart>
                                            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                            <Pie data={chartDataWithColors} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Top 5 Funded Campaigns</CardTitle>
                                    <CardDescription>The campaigns that have received the most funding.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isClient ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Campaign</TableHead>
                                                <TableHead className="text-right">Amount Collected</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {topCampaigns.map(campaign => (
                                                <TableRow key={campaign.name}>
                                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{campaign.collected.toLocaleString('en-IN')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    ) : <Skeleton className="h-[300px] w-full" />}
                                </CardContent>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <CardTitle>Activity Over Time</CardTitle>
                                        <CardDescription>Track new donations, users, and beneficiaries over a selected period.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick a date</span>)}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
                                            </PopoverContent>
                                        </Popover>
                                        <UiSelect onValueChange={(value) => {
                                            const now = new Date();
                                            if (value === 'this_month') setDate({ from: startOfMonth(now), to: endOfMonth(now) });
                                            else if (value === 'this_quarter') setDate({ from: startOfQuarter(now), to: endOfQuarter(now) });
                                            else if (value === 'this_year') setDate({ from: startOfYear(now), to: endOfYear(now) });
                                            else if (value === 'last_3_months') setDate({ from: subMonths(now, 3), to: now });
                                            else setDate({ from: undefined, to: undefined });
                                        }}>
                                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Quick Select" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all_time">All Time</SelectItem>
                                                <SelectItem value="this_month">This Month</SelectItem>
                                                <SelectItem value="this_quarter">This Quarter</SelectItem>
                                                <SelectItem value="this_year">This Year</SelectItem>
                                                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                                            </SelectContent>
                                        </UiSelect>
                                    </div>
                                </div>
                                <div className="pt-4 flex flex-wrap gap-4 items-center">
                                    <UiSelect value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder="Select Metric" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="donations">Donations</SelectItem>
                                        <SelectItem value="users">New Users</SelectItem>
                                        <SelectItem value="beneficiaries">New Beneficiaries</SelectItem>
                                    </SelectContent>
                                    </UiSelect>
                                    <UiSelect value={granularity} onValueChange={(value) => setGranularity(value as any)}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select Granularity" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                    </UiSelect>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isClient ? (
                                <ChartContainer config={activityChartConfig} className="h-[350px] w-full">
                                    <AreaChart data={timeSeriesData} margin={{ left: 12, right: 12 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => {
                                        try {
                                            if (granularity === 'monthly') return format(parseISO(`${value}-01`), 'MMM yyyy');
                                            if (granularity === 'weekly') return format(parseISO(value), 'd MMM');
                                            return format(parseISO(value), 'd MMM');
                                        } catch (e) { return value; }
                                        }}
                                    />
                                    <YAxis tickFormatter={(value) => value.toLocaleString()} />
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
                    </div>
                </TabsContent>
                <TabsContent value="storage">
                    <StorageAnalytics />
                </TabsContent>
                <TabsContent value="database">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-3xl">Database Analytics</CardTitle>
                                <CardDescription>An overview of document counts across your main Firestore collections.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <StatCard title="User Profiles" value={users?.length || 0} icon={Users} isLoading={isLoading} />
                                <StatCard title="Campaigns" value={campaigns?.length || 0} icon={FolderKanban} isLoading={isLoading} />
                                <StatCard title="Leads" value={leads?.length || 0} icon={Lightbulb} isLoading={isLoading} />
                                <StatCard title="Master Beneficiaries" value={beneficiaries?.length || 0} icon={HandHelping} isLoading={isLoading} />
                                <StatCard title="Donations" value={donations?.length || 0} icon={DollarSign} isLoading={isLoading} />
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Document Distribution</CardTitle>
                                    <CardDescription>The proportion of documents in each main collection.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                {isClient ? (
                                    <ChartContainer config={documentDistributionChartConfig} className="h-[300px] w-full">
                                        <PieChart>
                                            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                            <Pie data={documentDistributionData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
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
                                    <CardTitle>Detailed Usage Metrics</CardTitle>
                                    <CardDescription>Information about database reads, writes, and deletes.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Alert>
                                        <Database className="h-4 w-4" />
                                        <AlertTitle>View Usage in Firebase Console</AlertTitle>
                                        <AlertDescription>
                                            <p>For detailed, real-time metrics on database operations (document reads, writes, deletes), network usage, and storage, please visit your Firebase Console.</p>
                                            <p className="mt-2">The "Activity Over Time" chart in the General Analytics tab can provide insight into document creation trends.</p>
                                            <Button asChild variant="link" className="p-0 h-auto mt-2">
                                                <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/usage`} target="_blank" rel="noopener noreferrer">
                                                    Go to Firebase Console Usage <ExternalLink className="ml-1 h-3 w-3" />
                                                </a>
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
