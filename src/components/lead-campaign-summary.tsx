
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Campaign, Lead } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FolderKanban, Lightbulb } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

const campaignCategoryChartConfig = {
  Ration: { label: "Ration", color: "hsl(var(--chart-1))" },
  Relief: { label: "Relief", color: "hsl(var(--chart-2))" },
  General: { label: "General", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const leadCategoryChartConfig = {
  Ration: { label: "Ration", color: "hsl(var(--chart-1))" },
  Relief: { label: "Relief", color: "hsl(var(--chart-2))" },
  General: { label: "General", color: "hsl(var(--chart-3))" },
  Education: { label: "Education", color: "hsl(var(--chart-4))" },
  Medical: { label: "Medical", color: "hsl(var(--chart-5))" },
  Other: { label: "Other", color: "hsl(var(--chart-6))" },
} satisfies ChartConfig;

export function LeadAndCampaignSummary() {
  const firestore = useFirestore();
  const campaignsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'campaigns');
  }, [firestore]);
  const leadsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  
  const isLoading = areCampaignsLoading || areLeadsLoading;

  const campaignSummary = useMemo(() => {
    if (!campaigns) return null;
    const counts = campaigns.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: campaigns.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value, fill: `var(--color-${name})`})),
    }
  }, [campaigns]);
  
  const leadSummary = useMemo(() => {
    if (!leads) return null;
    const counts = leads.reduce((acc, l) => {
      acc[l.category] = (acc[l.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: leads.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value, fill: `var(--color-${name})`})),
    }
  }, [leads]);
  
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardHeader><CardContent><Loader2 className="h-24 w-full animate-spin text-muted-foreground" /></CardContent></Card>
        <Card><CardHeader><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardHeader><CardContent><Loader2 className="h-24 w-full animate-spin text-muted-foreground" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-6 w-6 text-primary" />
                Campaigns
              </CardTitle>
              <span className="text-2xl font-bold">{campaignSummary?.total || 0}</span>
          </div>
          <CardDescription>Total campaigns recorded by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={campaignCategoryChartConfig} className="h-[150px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={campaignSummary?.chartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} strokeWidth={2}>
                 {campaignSummary?.chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-primary" />
              Leads
            </CardTitle>
            <span className="text-2xl font-bold">{leadSummary?.total || 0}</span>
          </div>
          <CardDescription>
            Total leads being tracked by category.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <ChartContainer config={leadCategoryChartConfig} className="h-[150px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={leadSummary?.chartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} strokeWidth={2}>
                 {leadSummary?.chartData.map((entry) => (
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
