'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

export function DonationSummary() {
  const { isLoading, yearlySummary, categorySummary } = usePublicData();

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Card className="border-primary/20"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card className="border-primary/20"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  if (!yearlySummary || !categorySummary) {
    return <p className="font-bold text-primary">No Donation Data Available.</p>;
  }

  return (
    <div className="grid gap-10">
      <Card className="animate-fade-in-up border-primary/20 bg-white shadow-md transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}>
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-bold text-primary">
                <Calendar className="h-6 w-6 text-primary" />
                Yearly Financial Summary
              </CardTitle>
              <span className="text-2xl font-bold text-primary">{yearlySummary[0]?.year || new Date().getFullYear()}</span>
          </div>
          <CardDescription className="font-normal text-primary/70">A Year-By-Year Breakdown Of Funds Received Against Fundraising Goals.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            <ScrollArea className="w-full">
                <div className="min-w-[600px]">
                    <Table>
                        <TableHeader className="bg-primary/5">
                            <TableRow>
                                <TableHead className="font-bold text-primary">Year</TableHead>
                                <TableHead className="font-bold text-primary">Goal</TableHead>
                                <TableHead className="font-bold text-primary">Raised For Goal</TableHead>
                                <TableHead className="font-bold text-primary">Total Received</TableHead>
                                <TableHead className="text-right font-bold text-primary">Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {yearlySummary.map(({ year, totalTarget, totalGoalReceived, overallTotalReceived, progress }) => (
                                <TableRow key={year} className="hover:bg-primary/5">
                                    <TableCell className="font-bold text-primary">{year}</TableCell>
                                    <TableCell className="font-normal text-primary/80">₹{totalTarget.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="font-normal text-primary">₹{totalGoalReceived.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="font-normal text-primary/60">₹{overallTotalReceived.toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="text-right w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <Progress value={progress} className="h-2 flex-1" />
                                            <span className="text-xs font-normal text-primary">{Math.round(progress)}%</span>
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
      
      <Card className="animate-fade-in-up border-primary/20 bg-white shadow-md transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}>
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="flex items-center gap-2 font-bold text-primary">
            <PieChartIcon className="h-6 w-6 text-primary" />
            Donations By Category
          </CardTitle>
           <CardDescription className="font-normal text-primary/70">A Lifetime Breakdown Of All Donations By Their Category.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartContainer config={donationCategoryChartConfig} className="h-[300px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={categorySummary} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={5} paddingAngle={2}>
                {categorySummary.map((entry: any) => (
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