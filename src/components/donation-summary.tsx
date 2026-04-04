'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Calendar, PieChart as PieChartIcon, IndianRupee } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const donationCategoryChartConfig = {
  Fitra: { label: "Fitra", color: "hsl(var(--chart-2))" },
  Zakat: { label: "Zakat", color: "hsl(var(--chart-3))" },
  Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-1))" },
  Fidiya: { label: "Fidiya", color: "hsl(var(--chart-7))" },
  Interest: { label: "Interest", color: "hsl(var(--chart-5))" },
  Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
  Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
  MonthlyContribution: { label: "Monthly Contribution", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;

/**
 * Donation Summary - Aggregate historical trends and category distributions.
 * Re-engineered to follow the professional Title Case standard.
 */
export function DonationSummary() {
  const { isLoading, yearlySummary, categorySummary, summaryDateRange } = usePublicData();

  if (isLoading) {
    return (
      <div className="grid gap-10">
        <Card className="border-primary/10 bg-white"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card className="border-primary/10 bg-white"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  if (!yearlySummary || !categorySummary) {
    return <p className="font-bold text-primary">No Donation Data Available.</p>;
  }

  const rangeText = summaryDateRange 
    ? `${summaryDateRange.start || 'Beginning'} To ${summaryDateRange.end || 'Today'}`
    : 'Full History';

  return (
    <div className="grid gap-10">
      <Card className="animate-fade-in-up border-primary/10 bg-white shadow-md transition-all duration-300 hover:shadow-xl overflow-hidden flex flex-col" style={{ animationDelay: '800ms' }}>
        <CardHeader className="bg-primary/5 border-b shrink-0">
          <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-bold text-primary tracking-tight">
                <Calendar className="h-6 w-6 text-primary" />
                Yearly Summary
              </CardTitle>
              <span className="text-2xl font-bold text-primary font-mono">{yearlySummary[0]?.year || new Date().getFullYear()}</span>
          </div>
          <CardDescription className="font-normal text-primary/70">Performance Trends For The Selected Period ({rangeText}).</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="w-full h-full">
                <div className="min-w-[650px] p-4">
                    <Table>
                        <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                            <TableRow className="border-b border-primary/10">
                                <TableHead className="pl-6 font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Year</TableHead>
                                <TableHead className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Target Goal</TableHead>
                                <TableHead className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Raised For Goal</TableHead>
                                <TableHead className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Overall Total</TableHead>
                                <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] pr-6 text-[10px] tracking-tight capitalize">Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {yearlySummary.map(({ year, totalTarget, totalGoalReceived, overallTotalReceived, progress }) => (
                                <TableRow key={year} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                                    <TableCell className="font-bold text-primary pl-4">{year}</TableCell>
                                    <TableCell className="font-normal text-primary/80">₹{totalTarget.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="font-bold text-primary">₹{totalGoalReceived.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="font-normal text-primary/60">₹{overallTotalReceived.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="text-right w-[150px] pr-6">
                                        <div className="flex items-center justify-end gap-3">
                                            <Progress value={progress} className="h-1 flex-1 bg-primary/10" />
                                            <span className="text-[10px] font-bold text-primary whitespace-nowrap">{Math.round(progress)}%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </CardContent>
      </Card>
      
      <Card className="animate-fade-in-up border-primary/10 bg-white shadow-md transition-all duration-300 hover:shadow-xl overflow-hidden" style={{ animationDelay: '900ms' }}>
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="flex items-center gap-2 font-bold text-primary tracking-tight">
            <PieChartIcon className="h-6 w-6 text-primary" />
            Category Distribution
          </CardTitle>
           <CardDescription className="font-normal text-primary/70">Breakdown Of Contributions In Configured Range ({rangeText}).</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartContainer config={donationCategoryChartConfig} className="h-[300px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={categorySummary} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={5} paddingAngle={2} className="transition-all duration-1000 ease-out focus:outline-none">
                {categorySummary.map((entry: any) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
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
