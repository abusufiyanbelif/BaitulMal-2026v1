
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, FolderKanban, Lightbulb, HandHelping, DollarSign, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import type { Donation, Beneficiary, Campaign } from '@/lib/types';

import { Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { donationCategories } from '@/lib/modules';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

    const { data: users, isLoading: usersLoading } = useCollection(usersRef);
    const { data: campaigns, isLoading: campaignsLoading } = useCollection<Campaign>(campaignsRef);
    const { data: leads, isLoading: leadsLoading } = useCollection(leadsRef);
    const { data: donations, isLoading: donationsLoading } = useCollection<Donation>(donationsRef);
    const { data: beneficiaries, isLoading: beneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

    const isLoading = usersLoading || campaignsLoading || leadsLoading || donationsLoading || beneficiariesLoading;
    
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
            <div className="space-y-6">
                <Card className="animate-fade-in-zoom">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-3xl"><BarChart /> Data & Analytics Overview</CardTitle>
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
                        <CardTitle>Advanced Analytics (Future)</CardTitle>
                        <CardDescription>
                            Metrics for storage usage, database operations, and user activity are planned for a future update. For detailed usage, please check your project's dashboards in the Firebase and Google Cloud Console.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
