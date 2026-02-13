
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { WisdomAndReflection } from '@/components/WisdomAndReflection';

const DonationSummary = dynamic(() => import('@/components/donation-summary').then(mod => mod.DonationSummary), {
    loading: () => (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full md:col-span-2 lg:col-span-1" />
            <Skeleton className="h-48 w-full" />
        </div>
    ),
    ssr: false,
});

const LeadAndCampaignSummary = dynamic(() => import('@/components/lead-campaign-summary').then(mod => mod.LeadAndCampaignSummary), {
    loading: () => (
        <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    ),
    ssr: false,
});

export default function Home() {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-8">
              <Card className="max-w-4xl mx-auto text-center animate-fade-in-up">
                  <CardHeader>
                      <CardTitle className="text-3xl font-bold">Welcome to Baitulmal Samajik Sanstha Solapur</CardTitle>
                      <CardDescription className="text-lg text-muted-foreground pt-2">
                          An overview of our organization's impact and activities.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button asChild size="lg">
                          <Link href="/campaign-public">View Public Campaigns</Link>
                      </Button>
                      <Button asChild variant="outline" size="lg">
                          <Link href="/leads-public">View Public Leads</Link>
                      </Button>
                  </CardContent>
              </Card>
              <WisdomAndReflection />
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-center">Live Summary</h2>
                <DonationSummary />
                <LeadAndCampaignSummary />
              </div>
            </div>
        </div>
    );
}
