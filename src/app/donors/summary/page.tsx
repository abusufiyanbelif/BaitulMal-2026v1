'use client';

import { useMemo } from 'react';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import type { Donor, Donation } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Users, TrendingUp, IndianRupee, HeartHandshake, ShieldCheck, PieChart as PieChartIcon } from 'lucide-react';
import { SectionLoader } from '@/components/section-loader';
import { 
    Bar, 
    BarChart, 
    CartesianGrid, 
    XAxis, 
    YAxis, 
    ResponsiveContainer, 
    Cell,
    Pie,
    PieChart,
    Tooltip
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

const tierChartConfig = {
    Loyal: { label: "Regular Donors", color: "hsl(var(--chart-1))" },
    New: { label: "New Donors", color: "hsl(var(--chart-2))" },
    Inactive: { label: "Inactive", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;

export default function DonorSummaryPage() {
    const firestore = useFirestore();
    
    const donorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donors') : null, [firestore]);
    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);

    const { data: donors, isLoading: donorsLoading } = useCollection<Donor>(donorsRef);
    const { data: donations, isLoading: donationsLoading } = useCollection<Donation>(donationsRef);

    const analytics = useMemo(() => {
        if (!donors || !donations) return null;

        const totalVerifiedSum = donations.filter(d => d.status === 'Verified').reduce((sum, d) => sum + d.amount, 0);
        const donorContributionMap = new Map<string, { count: number, total: number }>();

        donations.filter(d => d.status === 'Verified').forEach(d => {
            const key = d.donorId || d.donorPhone || 'unknown';
            const current = donorContributionMap.get(key) || { count: 0, total: 0 };
            donorContributionMap.set(key, { count: current.count + 1, total: current.total + d.amount });
        });

        const activeDonorsCount = donors.filter(d => d.status === 'Active').length;
        const avgDonationPerDonor = donors.length > 0 ? totalVerifiedSum / donors.length : 0;

        const tierData = [
            { name: 'Loyal', value: Array.from(donorContributionMap.values()).filter(v => v.count > 2).length, fill: 'var(--color-Loyal)' },
            { name: 'New', value: Array.from(donorContributionMap.values()).filter(v => v.count <= 2).length, fill: 'var(--color-New)' },
            { name: 'Inactive', value: donors.length - donorContributionMap.size, fill: 'var(--color-Inactive)' },
        ];

        return {
            totalDonors: donors.length,
            activeDonorsCount,
            totalVerifiedSum,
            avgDonationPerDonor,
            tierData
        };
    }, [donors, donations]);

    if (donorsLoading || donationsLoading) return <SectionLoader label="Calculating Donor Analytics..." description="Aggregating contribution history and retention tiers." />;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                    <Link href="/donors"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Registry</Link>
                </Button>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Donor Impact Summary</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-primary/10 shadow-sm bg-white">
                    <CardHeader className="p-4 flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold capitalize tracking-widest opacity-60">Total Donors</CardTitle>
                        <Users className="h-4 w-4 text-primary opacity-40"/>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{analytics?.totalDonors || 0}</div>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 shadow-sm bg-white">
                    <CardHeader className="p-4 flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold capitalize tracking-widest opacity-60">Lifetime Support</CardTitle>
                        <IndianRupee className="h-4 w-4 text-primary opacity-40"/>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold font-mono">₹{analytics?.totalVerifiedSum.toLocaleString('en-IN') || 0}</div>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 shadow-sm bg-white">
                    <CardHeader className="p-4 flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold capitalize tracking-widest opacity-60">Avg / Profile</CardTitle>
                        <HeartHandshake className="h-4 w-4 text-primary opacity-40"/>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold font-mono">₹{Math.round(analytics?.avgDonationPerDonor || 0).toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 shadow-sm bg-white">
                    <CardHeader className="p-4 flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold capitalize tracking-widest opacity-60">Status Active</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-primary opacity-40"/>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{analytics?.activeDonorsCount || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2 font-bold text-primary"><PieChartIcon className="h-5 w-5"/> Retention & Loyalty</CardTitle>
                        <CardDescription className="font-normal text-primary/70">Breakdown of donors by their contribution frequency.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <ChartContainer config={tierChartConfig} className="h-[300px] w-full">
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                <Pie data={analytics?.tierData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} paddingAngle={2}>
                                    {analytics?.tierData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card className="border-primary/10 bg-white shadow-sm flex flex-col">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="font-bold text-primary">Organizational Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-6 flex flex-col justify-center text-center space-y-4">
                        <div className="p-6 rounded-2xl bg-primary/[0.02] border border-primary/5">
                            <p className="text-sm font-normal text-muted-foreground leading-relaxed italic">
                                "The Donor Module provides a clear audit trail of community generosity. Maintaining verified profiles allows the organization to express gratitude and track long-term support trends effectively."
                            </p>
                        </div>
                        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary self-center active:scale-95 transition-transform">
                            <Link href="/donors">Return To Full Registry</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
