
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Donation, DonationCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wallet, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
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

const DynamicPieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false, loading: () => <Skeleton className="h-[150px] w-full" /> });
const DynamicBarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false, loading: () => <Skeleton className="h-[150px] w-full" /> });

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

    const amountsByYear = donations.reduce((acc, d) => {
        if (d.donationDate) {
            const year = new Date(d.donationDate).getFullYear();
            if (!isNaN(year)) {
                acc[year] = (acc[year] || 0) + d.amount;
            }
        }
        return acc;
    }, {} as Record<string, number>);

    return {
      totalAmount,
      categoryChartData: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`})),
      yearChartData: Object.entries(amountsByYear)
        .map(([year, total]) => ({ year, total }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year)),
    };
  }, [donations]);

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
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">₹{summaryData.totalAmount.toLocaleString('en-IN')}</p>
          <p className="text-muted-foreground">across all initiatives.</p>
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
            <DynamicPieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={summaryData.categoryChartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} strokeWidth={2}>
                {summaryData.categoryChartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </DynamicPieChart>
          </ChartContainer>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChartIcon className="h-6 w-6 text-primary" />
            Donations by Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[150px] w-full">
            <DynamicBarChart data={summaryData.yearChartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} tickMargin={10} axisLine={false} stroke="#888888" fontSize={12} />
              <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)}`} />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={4} />
            </DynamicBarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
