
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Donation, DonationCategory, Campaign, Lead } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, PieChart as PieChartIcon, Target, Calendar } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

    // Overall Total
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

    // Yearly Breakdown
    const yearlyData: Record<string, { totalReceived: number; totalTarget: number; }> = {};

    donations.forEach(donation => {
        if (donation.donationDate) {
            const year = new Date(donation.donationDate).getFullYear().toString();
            if (!yearlyData[year]) {
                yearlyData[year] = { totalReceived: 0, totalTarget: 0 };
            }
            yearlyData[year].totalReceived += donation.amount;
        }
    });

    [...campaigns, ...leads].forEach(item => {
        if (item.startDate && item.targetAmount) {
            const year = new Date(item.startDate).getFullYear().toString();
             if (!yearlyData[year]) {
                yearlyData[year] = { totalReceived: 0, totalTarget: 0 };
            }
            yearlyData[year].totalTarget += item.targetAmount;
        }
    });

    const sortedYearlyData = Object.entries(yearlyData)
        .map(([year, data]) => ({ year, ...data, progress: data.totalTarget > 0 ? (data.totalReceived / data.totalTarget) * 100 : 0 }))
        .sort((a, b) => parseInt(b.year) - parseInt(a.year));


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
      sortedYearlyData,
      categoryChartData: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`})),
    };
  }, [donations, campaigns, leads]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(2)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>)}
      </div>
    );
  }
  
  if (!summaryData) {
    return <p>No donation data available.</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Yearly Financial Summary
          </CardTitle>
          <CardDescription>A year-by-year breakdown of funds received against fundraising goals.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Year</TableHead>
                        <TableHead>Fundraising Goal</TableHead>
                        <TableHead>Donations Received</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summaryData.sortedYearlyData.map(({ year, totalTarget, totalReceived, progress }) => (
                        <TableRow key={year}>
                            <TableCell className="font-bold">{year}</TableCell>
                            <TableCell>₹{totalTarget.toLocaleString('en-IN')}</TableCell>
                            <TableCell>₹{totalReceived.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-right w-[150px]">
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="h-2 flex-1" />
                                    <span className="text-xs font-mono">{Math.round(progress)}%</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" />
            Donations by Category
          </CardTitle>
           <CardDescription>A lifetime breakdown of all donations by their category.</CardDescription>
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
