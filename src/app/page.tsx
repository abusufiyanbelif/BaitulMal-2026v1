'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { Quote, Target } from 'lucide-react';

const WisdomAndReflection = dynamic(() => import('@/components/WisdomAndReflection').then(mod => mod.WisdomAndReflection), {
    ssr: false,
    loading: () => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Quote className="h-6 w-6 text-primary" />
                    Wisdom & Reflection
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pl-10">
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-4/5" />
            </CardContent>
        </Card>
    ),
});

const OverallFundingSummary = dynamic(() => import('@/components/overall-funding-summary').then(mod => mod.OverallFundingSummary), {
    ssr: false,
    loading: () => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-6 w-6 text-primary" />
                    Overall Fundraising Progress
                </CardTitle>
            </CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
    )
});


const DonationSummary = dynamic(() => import('@/components/donation-summary').then(mod => mod.DonationSummary), {
    ssr: false,
    loading: () => (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
      </div>
    )
});

const LeadAndCampaignSummary = dynamic(() => import('@/components/lead-campaign-summary').then(mod => mod.LeadAndCampaignSummary), {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    )
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

              <OverallFundingSummary />

              <LeadAndCampaignSummary />
              <DonationSummary />
            </div>
        </div>
    );
}
