'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Target, IndianRupee } from 'lucide-react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useMemo } from 'react';

export function OverallFundingSummary() {
  const { isLoading, overallSummary } = usePublicData();

  const chartData = useMemo(() => ([
    {
      name: 'Progress',
      value: overallSummary.progress,
      fill: 'hsl(var(--primary))',
    },
  ]), [overallSummary.progress]);

  if (isLoading) {
    return (
        <Card className="border-primary/20">
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
    )
  }

  if (!overallSummary) {
    return <p className="font-bold text-primary">Could Not Load Funding Summary.</p>
  }

  return (
    <Card className="animate-fade-in-up border-primary/20 bg-white shadow-md transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold text-primary">
            <Target className="h-6 w-6 text-primary" />
            Overall Fundraising Progress
        </CardTitle>
        <CardDescription className="font-normal text-primary/70">A real-time look at our total collected donations against our published and verified goals.</CardDescription>
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
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-primary">
                        {overallSummary.progress.toFixed(0)}%
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">Funded</span>
                </div>
            </div>
             <div className="space-y-4 text-center md:text-left font-bold text-primary">
                <div>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight">Total Raised For Goals</p>
                    <p className="text-3xl font-bold font-mono">
                    ₹{(overallSummary.totalCollectedForGoals || 0).toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight">Combined Target</p>
                    <p className="text-3xl font-bold font-mono opacity-70">
                    ₹{(overallSummary.totalTarget || 0).toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight">Grand Total Received (All Types)</p>
                    <p className="text-3xl font-bold font-mono">
                    ₹{(overallSummary.grandTotalRaised || 0).toLocaleString('en-IN')}
                    </p>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}