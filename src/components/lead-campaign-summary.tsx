
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Campaign, Lead } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FolderKanban, Lightbulb } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            Campaigns
          </CardTitle>
          <CardDescription>
            Total of {campaignSummary?.total || 0} campaigns recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={campaignCategoryChartConfig} className="h-[150px] w-full">
            <BarChart data={campaignSummary?.chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={60} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4} layout="vertical">
                 {campaignSummary?.chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Leads
          </CardTitle>
          <CardDescription>
            Total of {leadSummary?.total || 0} leads being tracked.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <ChartContainer config={leadCategoryChartConfig} className="h-[150px] w-full">
            <BarChart data={leadSummary?.chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4} layout="vertical">
                 {leadSummary?.chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
