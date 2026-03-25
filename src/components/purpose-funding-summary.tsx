'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { IndianRupee, Target } from 'lucide-react';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

/**
 * Purpose Funding Summary - Verified donation totals by institutional purpose.
 * Title Case typography enforced.
 */
export function PurposeFundingSummary() {
  const { isLoading, campaignsWithProgress, leadsWithProgress } = usePublicData();

  const purposeData = useMemo(() => {
    if (isLoading || !campaignsWithProgress || !leadsWithProgress) return [];

    const totals: Record<string, number> = {};

    campaignsWithProgress.forEach(c => {
      const p = c.category || 'General';
      totals[p] = (totals[p] || 0) + c.collected;
    });

    leadsWithProgress.forEach(l => {
      const p = l.purpose || 'Other';
      totals[p] = (totals[p] || 0) + l.collected;
    });

    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [isLoading, campaignsWithProgress, leadsWithProgress]);

  if (isLoading) {
    return (
      <Card className="border-primary/10">
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (purposeData.length === 0) return null;

  return (
    <Card className="animate-fade-in-up border-primary/10 bg-white shadow-md transition-all duration-300 hover:shadow-xl overflow-hidden flex flex-col">
      <CardHeader className="bg-primary/5 border-b shrink-0">
        <CardTitle className="text-xl font-bold text-primary flex items-center gap-2 tracking-tight">
          <Target className="h-6 w-6 text-primary" />
          Impact By Purpose
        </CardTitle>
        <CardDescription className="font-normal text-primary/70">
          Verified Funds Utilized Across Community Categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="w-full h-full">
            <div className="min-w-[450px] p-4">
                <Table>
                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                        <TableRow className="border-b border-primary/10">
                            <TableHead className="pl-6 font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight">Purpose Type</TableHead>
                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] pr-6 text-[10px] tracking-tight">Amount Received</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purposeData.map((item) => (
                        <TableRow key={item.name} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                            <TableCell className="font-bold text-primary text-sm pl-6">{item.name}</TableCell>
                            <TableCell className="text-right font-bold font-mono text-primary text-sm pr-6">
                            <div className="flex items-center justify-end gap-1">
                                <IndianRupee className="h-3 w-3 opacity-40" />
                                {item.amount.toLocaleString('en-IN')}
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
  );
}
