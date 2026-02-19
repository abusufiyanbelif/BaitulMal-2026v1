
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
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
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
          <CardDescription>Total public campaigns by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignSummary?.chartData.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="text-right">{entry.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            Total public leads by purpose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadSummary?.chartData.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="text-right">{entry.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
