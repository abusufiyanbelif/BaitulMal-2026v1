
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Campaign, Lead } from '@/lib/types';
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
      const category = c.category || 'General';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: campaigns.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value })),
    }
  }, [campaigns]);
  
  const leadSummary = useMemo(() => {
    if (!leads) return null;
    const counts = leads.reduce((acc, l) => {
      const category = l.category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: leads.length,
      chartData: Object.entries(counts).map(([name, value]) => ({ name, value })),
    }
  }, [leads]);
  
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
          <CardDescription>Total campaigns recorded by category.</CardDescription>
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
            Total leads being tracked by category.
          </CardDescription>
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
