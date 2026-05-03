'use client';

import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, Timestamp, DocumentData, QueryDocumentSnapshot } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowLeft, 
    Users, 
    FolderKanban, 
    Lightbulb, 
    HandHelping, 
    IndianRupee, 
    BarChart, 
    CalendarIcon, 
    Database, 
    ExternalLink, 
    Eye,
    TrendingUp,
    Activity,
    PieChart as PieChartIcon,
    Zap,
    Sparkles,
    ChevronRight,
    Search,
    Calendar,
    Filter,
    LayoutGrid,
    Target,
    CheckCircle2
} from 'lucide-react';
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfYear, subMonths, startOfYear, endOfQuarter, parseISO, isValid, startOfDay, endOfDay, startOfWeek, formatISO, getYear, getQuarter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorageAnalytics } from '@/components/storage-analytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPageHits } from './actions';
import { SectionLoader } from '@/components/section-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function StatCard({ title, value, description, icon: Icon, delay, colorClass }: { title: string, value: number | string, description: string, icon: any, delay: string, colorClass?: string }) {
    return (
        <Card className={cn("group relative flex flex-col p-6 bg-white border-primary/5 shadow-none animate-fade-in-up transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 overflow-hidden", colorClass)} style={{ animationDelay: delay }}>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-500">
                <Icon className="h-24 w-24" />
            </div>
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="p-3.5 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                    <Icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-40 mb-1">{title}</p>
                    <p className="text-3xl font-black text-primary tracking-tighter">{value}</p>
                </div>
            </div>
            <div className="relative z-10 mt-auto">
                <p className="text-[10px] font-normal text-muted-foreground opacity-60 leading-tight">{description}</p>
            </div>
        </Card>
    );
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
        label: "Number of Entries",
        color: "hsl(var(--chart-1))",
      },
      amount: {
        label: "Money Amount (₹)",
        color: "hsl(var(--chart-2))",
      },
    } satisfies ChartConfig;
    
    const documentDistributionChartConfig = {
        Users: { label: "Staff", color: "hsl(var(--chart-5))" },
        Campaigns: { label: "Campaigns", color: "hsl(var(--chart-2))" },
        Leads: { label: "Help Requests", color: "hsl(var(--chart-3))" },
        Beneficiaries: { label: "People Helped", color: "hsl(var(--chart-4))" },
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

    if (isLoading) return <SectionLoader label="Preparing Reports..." description="Loading all data for analytics." />;

    return (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div className="space-y-1.5">
                        <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9 mb-2">
                            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                <BarChart className="h-5 w-5" />
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Reports & Analytics</h1>
                        </div>
                        <p className="text-sm font-normal opacity-70 max-w-2xl leading-relaxed">See all data about donations, people helped, and website activity.</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full space-y-10 animate-fade-in-up">
                <div className="bg-white/30 backdrop-blur-md p-1.5 rounded-[24px] border border-primary/5 shadow-sm inline-flex w-fit overflow-hidden">
                    <TabsList className="flex flex-nowrap bg-transparent p-0 gap-1 h-auto">
                        <TabsTrigger value="general" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
                            <Activity className="h-3.5 w-3.5" /> General Stats
                        </TabsTrigger>
                        <TabsTrigger value="database" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
                            <Database className="h-3.5 w-3.5" /> Activity Trends
                        </TabsTrigger>
                        <TabsTrigger value="storage" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
                            <LayoutGrid className="h-3.5 w-3.5" /> Storage Matrix
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="general" className="animate-fade-in-up mt-0 space-y-10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <StatCard title="Staff" value={users?.length || 0} description="Verified Institutional Members" icon={Users} delay="100ms" />
                        <StatCard title="People Helped" value={beneficiaries?.length || 0} description="List of people getting help" icon={HandHelping} delay="150ms" />
                        <StatCard title="Total Money" value={`₹${totalDonationAmount.toLocaleString('en-IN')}`} description="Total money from donations" icon={IndianRupee} delay="200ms" colorClass="bg-emerald-500/[0.02] border-emerald-500/10" />
                        <StatCard title="Total Campaigns" value={campaigns?.length || 0} description="Total active campaigns" icon={FolderKanban} delay="250ms" />
                        <StatCard title="Total Help Requests" value={leads?.length || 0} description="Total active requests" icon={Lightbulb} delay="300ms" />
                        <StatCard title="Total Donations" value={donations?.length || 0} description="Total verified donations" icon={CheckCircle2} delay="350ms" />
                    </div>

                    <div className="grid gap-8 lg:grid-cols-3">
                        <Card className="lg:col-span-1 rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md p-10 space-y-8 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-3">
                                    <PieChartIcon className="h-5 w-5 text-primary opacity-40" /> Donations by Type
                                </h3>
                                <p className="text-[10px] font-normal text-primary/40 uppercase tracking-widest">Where donations come from</p>
                            </div>
                            {isClient ? (
                                <ChartContainer config={donationCategoryChartConfig} className="h-[350px] w-full">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                        <Pie data={chartDataWithColors} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={8} paddingAngle={4} stroke="rgba(255,255,255,0.5)">
                                            {chartDataWithColors.map((entry) => (
                                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : <Skeleton className="h-[350px] w-full rounded-3xl" />}
                        </Card>

                        <Card className="lg:col-span-1 rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md p-0 space-y-8 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500 overflow-hidden">
                            <div className="p-10 pb-2 space-y-1">
                                <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-3">
                                    <Target className="h-5 w-5 text-primary opacity-40" /> Top Campaigns
                                </h3>
                                <p className="text-[10px] font-normal text-primary/40 uppercase tracking-widest">Campaigns with most donations</p>
                            </div>
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-primary/5 border-b border-primary/5 h-12">
                                            <TableHead className="pl-10 text-[10px] font-black uppercase tracking-widest">Campaign Name</TableHead>
                                            <TableHead className="text-right pr-10 text-[10px] font-black uppercase tracking-widest">Collected</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topCampaigns.map((campaign, idx) => (
                                            <TableRow key={campaign.name} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02] transition-colors h-16">
                                                <TableCell className="pl-10">
                                                    <div className="font-bold text-sm text-primary tracking-tight">{campaign.name}</div>
                                                    <div className="text-[9px] font-black uppercase opacity-30 mt-1">Initiative Tier {idx + 1}</div>
                                                </TableCell>
                                                <TableCell className="text-right pr-10 font-mono font-bold text-emerald-600">₹{campaign.collected.toLocaleString('en-IN')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </Card>

                        <Card className="lg:col-span-1 rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md p-0 space-y-8 animate-fade-in-up shadow-none hover:shadow-2xl transition-all duration-500 overflow-hidden">
                            <div className="p-10 pb-2 space-y-1">
                                <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-3">
                                    <Eye className="h-5 w-5 text-primary opacity-40" /> Website Visitors
                                </h3>
                                <p className="text-[10px] font-normal text-primary/40 uppercase tracking-widest">Page View Engagement</p>
                            </div>
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-primary/5 border-b border-primary/5 h-12">
                                            <TableHead className="pl-10 text-[10px] font-black uppercase tracking-widest">Page Name</TableHead>
                                            <TableHead className="text-right pr-10 text-[10px] font-black uppercase tracking-widest">Views</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pageHits?.sort((a, b) => b.hits - a.hits).map(hit => (
                                            <TableRow key={hit.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02] transition-colors h-16">
                                                <TableCell className="pl-10">
                                                    <div className="font-bold text-sm text-primary tracking-tight capitalize">{hit.id.replace(/_/g, ' ')}</div>
                                                    <div className="text-[9px] font-black uppercase opacity-30 mt-1">System Module</div>
                                                </TableCell>
                                                <TableCell className="text-right pr-10 font-mono font-bold text-primary">{hit.hits.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="database" className="animate-fade-in-up mt-0 space-y-10">
                    <Card className="rounded-[48px] border border-primary/5 bg-white/40 backdrop-blur-md p-10 space-y-10 animate-fade-in-up shadow-none">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-primary/5 pb-8">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-primary tracking-tighter flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
                                        <Activity className="h-6 w-6" />
                                    </div>
                                    Activity Over Time
                                </h3>
                                <p className="text-sm font-normal opacity-40 text-primary max-w-xl">See how activity changes over weeks and months.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 bg-white/50 backdrop-blur-md p-2 rounded-[28px] border border-primary/5 shadow-sm">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant="outline" className={cn("h-11 px-6 justify-start text-left font-bold border-primary/10 text-primary rounded-2xl bg-white shadow-sm", !date && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-3 h-4 w-4 opacity-40" />
                                            {date?.from ? (date.to ? (<>{format(date.from, "LLL dd")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick Dates</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-[32px] border-primary/10 shadow-dropdown overflow-hidden" align="end">
                                        <CalendarComponent initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} className="p-4" />
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
                                    <SelectTrigger className="w-[180px] h-11 font-black text-xs border-primary/10 text-primary rounded-2xl bg-white shadow-sm px-5">
                                        <SelectValue placeholder="Preset Range" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-primary/10 shadow-dropdown p-1.5">
                                        <SelectItem value="all_time" className="font-bold text-xs p-3 rounded-xl">All Time</SelectItem>
                                        <SelectItem value="this_month" className="font-bold text-xs p-3 rounded-xl">This Month</SelectItem>
                                        <SelectItem value="this_year" className="font-bold text-xs p-3 rounded-xl">This Year</SelectItem>
                                        <SelectItem value="last_3_months" className="font-bold text-xs p-3 rounded-xl">Last 3 Months</SelectItem>
                                    </SelectContent>
                                </UiSelect>

                                <div className="h-8 w-px bg-primary/10 mx-2 hidden xl:block" />

                                <UiSelect value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)}>
                                    <SelectTrigger className="w-[180px] h-11 font-black text-xs border-primary/10 text-primary rounded-2xl bg-white shadow-sm px-5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-primary/10 shadow-dropdown p-1.5">
                                        <SelectItem value="donations" className="font-bold text-xs p-3 rounded-xl">Contribution Volume</SelectItem>
                                        <SelectItem value="users" className="font-bold text-xs p-3 rounded-xl">Enrollment Rate</SelectItem>
                                        <SelectItem value="beneficiaries" className="font-bold text-xs p-3 rounded-xl">Recipient Growth</SelectItem>
                                    </SelectContent>
                                </UiSelect>

                                <UiSelect value={granularity} onValueChange={(value) => setGranularity(value as any)}>
                                    <SelectTrigger className="w-[180px] h-11 font-black text-xs border-primary/10 text-primary rounded-2xl bg-white shadow-sm px-5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-primary/10 shadow-dropdown p-1.5">
                                        <SelectItem value="daily" className="font-bold text-xs p-3 rounded-xl">Daily</SelectItem>
                                        <SelectItem value="weekly" className="font-bold text-xs p-3 rounded-xl">Weekly</SelectItem>
                                        <SelectItem value="monthly" className="font-bold text-xs p-3 rounded-xl">Monthly</SelectItem>
                                    </SelectContent>
                                </UiSelect>
                            </div>
                        </div>

                        {isClient ? (
                            <ChartContainer config={activityChartConfig} className="h-[450px] w-full">
                                <AreaChart data={timeSeriesData} margin={{ left: 12, right: 12 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={20}
                                        className="text-[10px] font-black opacity-40 uppercase"
                                        tickFormatter={(value) => {
                                            try {
                                                if (granularity === 'monthly') return format(parseISO(`${value}-01`), 'MMM yy');
                                                return format(parseISO(value), 'd MMM');
                                            } catch (e) { return value; }
                                        }}
                                    />
                                    <YAxis tickFormatter={(value) => value.toLocaleString()} tickLine={false} axisLine={false} className="text-[10px] font-black opacity-40" />
                                    <ChartTooltip cursor={{stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4'}} content={<ChartTooltipContent indicator="line" className="rounded-2xl shadow-dropdown border-primary/10 p-4" />} />
                                    <Area
                                        dataKey="count"
                                        type="monotone"
                                        fill="url(#colorCount)"
                                        stroke="var(--color-count)"
                                        strokeWidth={4}
                                        stackId="a"
                                    />
                                    {selectedMetric === 'donations' && (
                                        <Area
                                            dataKey="amount"
                                            type="monotone"
                                            fill="url(#colorAmount)"
                                            stroke="var(--color-amount)"
                                            strokeWidth={4}
                                            stackId="b"
                                        />
                                    )}
                                    <ChartLegend content={<ChartLegendContent className="mt-8" />} />
                                </AreaChart>
                            </ChartContainer>
                        ) : <Skeleton className="h-[450px] w-full rounded-[40px]" />}
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md p-10 space-y-8 animate-fade-in-up shadow-none">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-3">
                                    <PieChartIcon className="h-5 w-5 text-primary opacity-40" /> Data Overview
                                </h3>
                                <p className="text-[10px] font-normal text-primary/40 uppercase tracking-widest">Record Distribution</p>
                            </div>
                            {isClient ? (
                                <ChartContainer config={documentDistributionChartConfig} className="h-[300px] w-full">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                        <Pie data={documentDistributionData} dataKey="value" nameKey="name" innerRadius={80} strokeWidth={8} paddingAngle={4} stroke="rgba(255,255,255,0.5)">
                                            {documentDistributionData.map((entry) => (
                                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : <Skeleton className="h-[300px] w-full rounded-3xl" />}
                        </Card>

                        <Card className="rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md p-10 space-y-8 animate-fade-in-up shadow-none">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-4">
                                    <div className="p-2 rounded-xl bg-primary/10">
                                        <Zap className="h-5 w-5 text-primary" />
                                    </div>
                                    System Cloud Info
                                </h3>
                                <p className="text-[10px] font-normal text-primary/40 uppercase tracking-widest">System Health & Cloud Data</p>
                            </div>
                            <div className="grid gap-4">
                                <Alert className="rounded-[28px] border-primary/10 bg-white/60 p-6 shadow-sm group hover:shadow-xl transition-all duration-500">
                                    <Database className="h-5 w-5 text-primary opacity-40" />
                                    <AlertTitle className="text-sm font-black text-primary tracking-tight">Cloud Access Required</AlertTitle>
                                    <AlertDescription className="text-xs font-normal text-primary/60 leading-relaxed mt-2">
                                        For granular neural metrics on IO operations, network latency, and physical storage clusters, please interface directly with the root cloud console.
                                        <Button asChild variant="link" className="p-0 h-auto block mt-4 text-primary font-black uppercase tracking-widest text-[9px] group-hover:translate-x-1 transition-transform">
                                            <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/usage`} target="_blank" rel="noopener noreferrer">
                                                Open Cloud Console <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-40" />
                                            </a>
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="storage" className="animate-fade-in-up mt-0">
                    <StorageAnalytics />
                </TabsContent>
            </Tabs>
        </main>
    );
}