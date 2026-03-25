'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderKanban, Lightbulb } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from './ui/skeleton';
import { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

/**
 * Lead And Campaign Summary - Real-time counts of active community projects.
 * Title Case typography enforced.
 */
export function LeadAndCampaignSummary() {
  const { isLoading, campaignsWithProgress, leadsWithProgress } = usePublicData();

  const campaignSummary = useMemo(() => {
    if (!campaignsWithProgress) return null;
    const counts = campaignsWithProgress.reduce((acc, c) => {
      const category = c.category || 'General';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: campaignsWithProgress.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value })),
    }
  }, [campaignsWithProgress]);
  
  const leadSummary = useMemo(() => {
    if (!leadsWithProgress) return null;
    const counts = leadsWithProgress.reduce((acc, l) => {
      const category = l.purpose || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: leadsWithProgress.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value })),
    }
  }, [leadsWithProgress]);
  
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/10"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card className="border-primary/10"><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Card className="animate-fade-in-up border-primary/10 bg-white shadow-md overflow-hidden flex flex-col" style={{ animationDelay: '1000ms' }}>
        <CardHeader className="bg-primary/5 border-b shrink-0">
          <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-bold text-primary tracking-tight uppercase">
                <FolderKanban className="h-6 w-6 text-primary" />
                Active Campaigns
              </CardTitle>
              <span className="text-2xl font-bold text-primary">{campaignSummary?.total || 0}</span>
          </div>
          <CardDescription className="font-normal text-primary/70">Public Campaigns Grouped By Category.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="w-full h-full">
            <div className="min-w-[400px] p-4">
                <Table>
                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                    <TableRow className="border-b border-primary/10">
                        <TableHead className="pl-6 font-bold text-[hsl(var(--table-header-fg))] uppercase text-[10px] tracking-widest">Category Name</TableHead>
                        <TableHead className="text-right pr-6 font-bold text-[hsl(var(--table-header-fg))] uppercase text-[10px] tracking-widest">Project Count</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {campaignSummary?.chartData.map((entry) => (
                        <TableRow key={entry.name} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                        <TableCell className="font-bold text-primary text-sm pl-6">{entry.name}</TableCell>
                        <TableCell className="text-right font-normal pr-6">{entry.value}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up border-primary/10 bg-white shadow-md overflow-hidden flex flex-col" style={{ animationDelay: '1100ms' }}>
        <CardHeader className="bg-primary/5 border-b shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-bold text-primary tracking-tight uppercase">
              <Lightbulb className="h-6 w-6 text-primary" />
              Verified Leads
            </CardTitle>
            <span className="text-2xl font-bold text-primary">{leadSummary?.total || 0}</span>
          </div>
          <CardDescription className="font-normal text-primary/70">
            Current Support Appeals Organized By Purpose.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="w-full h-full">
            <div className="min-w-[400px] p-4">
                <Table>
                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                    <TableRow className="border-b border-primary/10">
                        <TableHead className="pl-6 font-bold text-[hsl(var(--table-header-fg))] uppercase text-[10px] tracking-widest">Appeal Purpose</TableHead>
                        <TableHead className="text-right pr-6 font-bold text-[hsl(var(--table-header-fg))] uppercase text-[10px] tracking-widest">Case Count</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {leadSummary?.chartData.map((entry) => (
                        <TableRow key={entry.name} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                        <TableCell className="font-bold text-primary text-sm pl-6">{entry.name}</TableCell>
                        <TableCell className="text-right font-normal pr-6">{entry.value}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
