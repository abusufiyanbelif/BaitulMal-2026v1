'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Target, Users, CheckCircle2, IndianRupee } from 'lucide-react';
import { useMemo } from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';

/**
 * Overall Funding Summary - Aggregate organizational impact reporting.
 * Follows the professional Title Case typography standard.
 */
export function OverallFundingSummary() {
  const { isLoading, overallSummary, summaryDateRange } = usePublicData();

  const chartData = useMemo(() => {
    return [
      {
        name: 'Progress',
        value: overallSummary?.progress || 0,
        fill: 'hsl(var(--primary))',
      },
    ];
  }, [overallSummary?.progress]);

  if (isLoading) {
    return (
        <div className="grid gap-10">
            <Card className="border-primary/20 bg-white">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!overallSummary) {
    return (
        <div className="text-center py-10 font-bold text-primary italic opacity-40">
            Impact Summary Currently Unavailable.
        </div>
    );
  }

  const rangeDescription = summaryDateRange 
    ? `Verified Goal Contributions From ${summaryDateRange.start || 'The Beginning'} To ${summaryDateRange.end || 'Today'}.`
    : 'A Summary Of Verified Goal Contributions Across All Projects.';

  return (
    <div className="space-y-10">
        <Card className="animate-fade-in-up border-primary/20 bg-white shadow-md transition-all duration-300 hover:shadow-xl overflow-hidden flex flex-col" style={{ animationDelay: '700ms' }}>
            <CardHeader className="bg-primary/5 border-b shrink-0">
                <CardTitle className="flex items-center gap-2 font-bold text-primary tracking-tight">
                    <Target className="h-6 w-6 text-primary" />
                    Overall Funding Impact
                </CardTitle>
                <CardDescription className="font-normal text-primary/70">{rangeDescription}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="relative h-48 sm:h-64 w-full">
                        <ChartContainer
                            config={{
                                progress: {
                                    label: 'Progress',
                                    color: 'hsl(var(--primary))',
                                },
                            }}
                            className="mx-auto aspect-square h-full"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart
                                    data={chartData}
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
                            </ResponsiveContainer>
                        </ChartContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in-zoom">
                            <span className="text-4xl font-bold text-primary">
                                {Math.round(overallSummary.progress || 0)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground font-bold tracking-tight capitalize">Funded</span>
                        </div>
                    </div>
                    <div className="space-y-4 text-center md:text-left font-bold text-primary">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Raised For Goal</p>
                            <p className="text-3xl font-bold font-mono">
                            ₹{(overallSummary.totalCollectedForGoals || 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Combined Target Goal</p>
                            <p className="text-3xl font-bold font-mono opacity-40">
                            ₹{(overallSummary.totalTarget || 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Period Total Received</p>
                            <p className="text-3xl font-bold font-mono">
                            ₹{(overallSummary.grandTotalRaised || 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                        {overallSummary.showUnlinkedFunds && (
                            <div className="space-y-1 pt-2 border-t border-primary/5">
                                <p className="text-[10px] font-bold text-amber-600 tracking-tight capitalize">Available Unlinked Funds</p>
                                <p className="text-xl font-bold font-mono text-amber-700">
                                ₹{(overallSummary.grandTotalUnlinked || 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-primary/10 transition-all hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="flex items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-bold text-primary tracking-tight opacity-60 capitalize">Families Impacted</CardTitle>
                    <Users className="h-5 w-5 text-primary opacity-40" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary">{overallSummary.familiesImpacted.toLocaleString()}</div>
                    <p className="text-[9px] text-muted-foreground mt-1 font-normal">Unique Beneficiaries Supported Across Initiatives.</p>
                </CardContent>
            </Card>
            
            <Card className="bg-white border-primary/10 transition-all hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="flex items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-bold text-primary tracking-tight opacity-60 capitalize">Verified Donations</CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-primary opacity-40" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary font-mono">₹{overallSummary.grandTotalRaised.toLocaleString('en-IN')}</div>
                    <p className="text-[9px] text-muted-foreground mt-1 font-normal">Confirmed Community Contributions Recorded.</p>
                </CardContent>
            </Card>

            <Card className="bg-white border-primary/10 transition-all hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="flex items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-bold text-primary tracking-tight opacity-60 capitalize">Target Progress</CardTitle>
                    <Target className="h-5 w-5 text-primary opacity-40" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary font-mono">{Math.round(overallSummary.progress)}%</div>
                    <p className="text-[9px] text-muted-foreground mt-1 font-normal">Organization Goal Achievement For Selected Period.</p>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}