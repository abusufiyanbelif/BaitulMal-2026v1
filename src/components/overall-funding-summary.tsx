
'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Target } from 'lucide-react';
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
        <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
    )
  }

  if (!overallSummary) {
    return <p>Could not load funding summary.</p>
  }

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Overall Fundraising Progress
        </CardTitle>
        <CardDescription>A real-time look at our total collected donations against our published and verified goals.</CardDescription>
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
                    <span className="text-xs text-muted-foreground">Funded</span>
                </div>
            </div>
             <div className="space-y-4 text-center md:text-left">
                <div>
                    <p className="text-sm text-muted-foreground">Total Raised for Goals</p>
                    <p className="text-3xl font-bold">
                    ₹{overallSummary.totalCollectedForGoals.toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Combined Target</p>
                    <p className="text-3xl font-bold">
                    ₹{overallSummary.totalTarget.toLocaleString('en-IN')}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Grand Total Received (All Types)</p>
                    <p className="text-3xl font-bold">
                    ₹{overallSummary.grandTotalRaised.toLocaleString('en-IN')}
                    </p>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
