

'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Campaign, Lead, Donation, DonationCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp } from 'lucide-react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Tooltip
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export function OverallFundingSummary() {
  const firestore = useFirestore();

  const campaignsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'campaigns'), where('status', 'in', ['Active', 'Upcoming']));
  }, [firestore]);

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'leads'), where('status', 'in', ['Active', 'Upcoming']));
  }, [firestore]);
  
  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const isLoading = areCampaignsLoading || areLeadsLoading || areDonationsLoading;

  const summaryData = useMemo(() => {
    if (!campaigns || !leads || !donations) return null;

    const allItems = [...campaigns, ...leads];
    const totalTarget = allItems.reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    const grandTotalRaised = donations.reduce((sum, d) => sum + d.amount, 0);

    const collectedAmounts = new Map<string, number>();
    const itemsById = new Map(allItems.map(item => [item.id, item]));

    donations.forEach(donation => {
      const links = (donation.linkSplit && donation.linkSplit.length > 0)
        ? donation.linkSplit
        : (donation as any).campaignId ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] : [];
      
      links.forEach(link => {
        const item = itemsById.get(link.linkId);
        if (!item) return;

        const amountForThisItem = link.amount;
        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const proportionForThisItem = amountForThisItem / totalDonationAmount;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
          ? donation.typeSplit
          : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);
        
        const applicableAmountInDonation = typeSplits.reduce((acc, split) => {
          const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
          if (item.allowedDonationTypes?.includes(category as DonationCategory)) {
            return acc + split.amount;
          }
          return acc;
        }, 0);
        
        const currentCollected = collectedAmounts.get(link.linkId) || 0;
        collectedAmounts.set(link.linkId, currentCollected + (applicableAmountInDonation * proportionForThisItem));
      });
    });

    const totalCollectedForGoals = Array.from(collectedAmounts.values()).reduce((sum, amount) => sum + amount, 0);
    const progress = totalTarget > 0 ? Math.min((totalCollectedForGoals / totalTarget) * 100, 100) : 0;
    
    const chartData = [
      {
        name: 'Progress',
        value: progress,
        fill: 'hsl(var(--primary))',
      },
    ];

    return {
      totalTarget,
      grandTotalRaised,
      totalCollectedForGoals,
      progress,
      chartData,
    };
  }, [campaigns, leads, donations]);

  if (isLoading) {
    return (
        <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
    )
  }

  if (!summaryData) {
    return <p>Could not load funding summary.</p>
  }

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Overall Fundraising Progress
        </CardTitle>
        <CardDescription>A real-time look at our total collected donations against our active goals.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="relative h-48 w-full">
                <ChartContainer
                    config={{
                        progress: {
                            label: 'Progress',
                            color: 'hsl(var(--primary))',
                        },
                    }}
                    className="mx-auto aspect-square h-full"
                >
                    <RadialBarChart
                        data={summaryData.chartData}
                        startAngle={-270}
                        endAngle={90}
                        innerRadius="75%"
                        outerRadius="100%"
                        barSize={20}
                    >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                        dataKey="value"
                        background={{ fill: 'hsl(var(--muted))' }}
                        cornerRadius={10}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                    />
                    </RadialBarChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-primary">
                        {summaryData.progress.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">Funded</span>
                </div>
            </div>
             <div className="space-y-4 text-center md:text-left">
                <div>
                    <p className="text-sm text-muted-foreground">Total Raised for Goals</p>
                    <p className="text-3xl font-bold">
                    ₹{summaryData.totalCollectedForGoals.toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Combined Target</p>
                    <p className="text-3xl font-bold">
                    ₹{summaryData.totalTarget.toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Grand Total Received (All Types)</p>
                    <p className="text-3xl font-bold">
                    ₹{summaryData.grandTotalRaised.toLocaleString('en-IN')}
                    </p>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

    