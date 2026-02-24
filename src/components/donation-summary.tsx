
'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, PieChart as PieChartIcon } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const donationCategoryChartConfig = donationCategories.reduce((acc, category, index) => {
  acc[category.replace(/\s+/g, '')] = {
    label: category,
    color: `hsl(var(--chart-${index + 1}))`,
  };
  return acc;
}, {} as ChartConfig);

export function DonationSummary() {
  const { isLoading, yearlySummary, categorySummary } = usePublicData();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  if (!yearlySummary || !categorySummary) {
    return <p>No donation data available.</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="animate-fade-in-up" style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                Yearly Financial Summary
              </CardTitle>
              <span className="text-2xl font-bold">{yearlySummary[0]?.year || new Date().getFullYear()}</span>
          </div>
          <CardDescription>A year-by-year breakdown of funds received against fundraising goals.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Year</TableHead>
                        <TableHead>Fundraising Goal</TableHead>
                        <TableHead>Donations for Goal</TableHead>
                        <TableHead>Overall Donations</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {yearlySummary.map(({ year, totalTarget, totalGoalReceived, overallTotalReceived, progress }) => (
                        <TableRow key={year}>
                            <TableCell className="font-bold">{year}</TableCell>
                            <TableCell>₹{totalTarget.toLocaleString('en-IN')}</TableCell>
                            <TableCell>₹{totalGoalReceived.toLocaleString('en-IN')}</TableCell>
                            <TableCell>₹{overallTotalReceived.toLocaleString('en-IN')}</TableCell>
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
      
      <Card className="animate-fade-in-up" style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" />
            Donations by Category
          </CardTitle>
           <CardDescription>A lifetime breakdown of all donations by their category.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={donationCategoryChartConfig} className="h-[200px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={categorySummary} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} strokeWidth={2}>
                {categorySummary.map((entry) => (
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
