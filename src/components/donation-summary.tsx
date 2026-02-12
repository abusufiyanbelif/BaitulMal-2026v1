
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Donation, DonationCategory, Campaign, Lead } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, PieChart as PieChartIcon, Target } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { donationCategories } from '@/lib/modules';
import { Skeleton } from './ui/skeleton';
import dynamic from 'next/dynamic';
import { Progress } from '@/components/ui/progress';

const DynamicPieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> });

const donationCategoryChartConfig = donationCategories.reduce((acc, category, index) => {
  acc[category.replace(/\s+/g, '')] = {
    label: category,
    color: `hsl(var(--chart-${index + 1}))`,
  };
  return acc;
}, {} as ChartConfig);

export function DonationSummary() {
  const firestore = useFirestore();
  const donationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  
  const campaignsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'campaigns');
  }, [firestore]);
  const leadsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  
  const isLoading = areDonationsLoading || areCampaignsLoading || areLeadsLoading;

  const summaryData = useMemo(() => {
    if (!donations || !campaigns || !leads) return null;

    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalTargetAmount = [...campaigns, ...leads].reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    
    // Create maps for quick lookup of campaigns and leads by their ID.
    const campaignsMap = new Map(campaigns.map(c => [c.id, c]));
    const leadsMap = new Map(leads.map(l => [l.id, l]));
    
    const allocatedAmountForGoal = donations.reduce((sum, donation) => {
        if (!donation.linkSplit || donation.linkSplit.length === 0) {
            return sum;
        }

        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
            ? donation.typeSplit
            : [];
        
        // Calculate the total contribution to the goal from this single donation
        const contributionFromThisDonation = donation.linkSplit.reduce((splitSum, link) => {
            if (link.linkType === 'general') {
                return splitSum; // Unallocated funds don't count towards goal
            }

            const initiative = link.linkType === 'campaign' 
                ? campaignsMap.get(link.linkId) 
                : leadsMap.get(link.linkId);
            
            if (!initiative) {
                return splitSum; // Linked initiative not found
            }

            const allowedDonationTypes = initiative.allowedDonationTypes || [];

            // Calculate the portion of the donation that is of an allowed type for *this specific initiative*
            const applicableTypeTotal = typeSplits.reduce((acc, split) => {
                if (allowedDonationTypes.includes(split.category)) {
                    return acc + split.amount;
                }
                return acc;
            }, 0);
            
            // The proportion of the whole donation that can be applied to this goal
            const proportionOfApplicableTypes = applicableTypeTotal / totalDonationAmount;
            
            // The final amount from this allocation that counts towards the goal
            const finalAmountForGoal = link.amount * proportionOfApplicableTypes;

            return splitSum + finalAmountForGoal;
        }, 0);

        return sum + contributionFromThisDonation;
    }, 0);
    
    const allocatedProgress = totalTargetAmount > 0 ? (allocatedAmountForGoal / totalTargetAmount) * 100 : 0;

    const amountsByCategory = donations.reduce((acc, d) => {
      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : [];
      splits.forEach(split => {
        const category = split.category as DonationCategory;
        if (donationCategories.includes(category)) {
          acc[category] = (acc[category] || 0) + split.amount;
        }
      });
      return acc;
    }, {} as Record<DonationCategory, number>);

    return {
      totalAmount,
      totalTargetAmount,
      allocatedAmount: allocatedAmountForGoal,
      allocatedProgress,
      categoryChartData: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`})),
    };
  }, [donations, campaigns, leads]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>)}
      </div>
    );
  }
  
  if (!summaryData) {
    return <p>No donation data available.</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Total Donations Received
          </CardTitle>
          <CardDescription>The grand total of all donations received, including unallocated funds.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">₹{summaryData.totalAmount.toLocaleString('en-IN')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Fundraising Progress
          </CardTitle>
          <CardDescription>Donations allocated to specific campaigns and leads against their goals.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">₹{summaryData.allocatedAmount.toLocaleString('en-IN')}</p>
          <Progress value={summaryData.allocatedProgress} className="mt-2 h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            of ₹{summaryData.totalTargetAmount.toLocaleString('en-IN')} goal from all initiatives
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" />
            Donations by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={donationCategoryChartConfig} className="h-[200px] w-full">
            <DynamicPieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={summaryData.categoryChartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} strokeWidth={2}>
                {summaryData.categoryChartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </DynamicPieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
