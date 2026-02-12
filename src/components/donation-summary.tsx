
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Donation, DonationCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Wallet, PieChart as PieChartIcon } from 'lucide-react';
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
  
  const { data: donations, isLoading } = useCollection<Donation>(donationsCollectionRef);

  const summaryData = useMemo(() => {
    if (!donations) return null;

    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

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
      categoryChartData: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`})),
    };
  }, [donations]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(2)].map((_, i) => <Card key={i}><CardHeader><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardHeader><CardContent><Loader2 className="h-24 w-full animate-spin text-muted-foreground" /></CardContent></Card>)}
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
            <Wallet className="h-6 w-6 text-primary" />
            Total Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">₹{summaryData.totalAmount.toLocaleString('en-IN')}</p>
          <p className="text-muted-foreground">collected across all initiatives</p>
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
          <ChartContainer config={donationCategoryChartConfig} className="h-[150px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={summaryData.categoryChartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} strokeWidth={2}>
                {summaryData.categoryChartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
