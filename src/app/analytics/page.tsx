
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, FolderKanban, Lightbulb, HandHelping, DollarSign, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemo } from 'react';

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
                    <div className="text-2xl font-bold">{value.toLocaleString()}</div>
                )}
            </CardContent>
        </Card>
    )
}

export default function AnalyticsPage() {
    const firestore = useFirestore();

    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const campaignsRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
    const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
    const beneficiariesRef = useMemoFirebase(() => firestore ? collection(firestore, 'beneficiaries') : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection(usersRef);
    const { data: campaigns, isLoading: campaignsLoading } = useCollection(campaignsRef);
    const { data: leads, isLoading: leadsLoading } = useCollection(leadsRef);
    const { data: donations, isLoading: donationsLoading } = useCollection(donationsRef);
    const { data: beneficiaries, isLoading: beneficiariesLoading } = useCollection(beneficiariesRef);

    const isLoading = usersLoading || campaignsLoading || leadsLoading || donationsLoading || beneficiariesLoading;
    
    const totalDonationAmount = useMemo(() => {
        return donations?.reduce((sum, d) => sum + d.amount, 0) || 0;
    }, [donations]);

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
                 <Card>
                    <CardHeader>
                        <CardTitle>Advanced Analytics</CardTitle>
                        <CardDescription>
                            More detailed analytics, including storage usage, database reads/writes, and performance metrics will be available in a future update. For detailed usage, please check your Firebase and Google Cloud Console.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
