
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PublicCampaignsView } from '@/components/public-campaigns-view';
import { PublicLeadsView } from '@/components/public-leads-view';
import { OverallFundingSummary } from '@/components/overall-funding-summary';
import { DonationSummary } from '@/components/donation-summary';
import { LeadAndCampaignSummary } from '@/components/lead-campaign-summary';
import { WisdomAndReflection } from '@/components/WisdomAndReflection';

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
              </Card>

              <WisdomAndReflection />

              <div className="space-y-6">
                <OverallFundingSummary />
                <DonationSummary />
                <LeadAndCampaignSummary />
              </div>

              <Tabs defaultValue="campaigns" className="w-full animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <TabsList className="grid w-full grid-cols-2 max-w-lg mx-auto">
                  <TabsTrigger value="campaigns">Public Campaigns</TabsTrigger>
                  <TabsTrigger value="leads">Public Leads & Initiatives</TabsTrigger>
                </TabsList>
                <TabsContent value="campaigns" className="mt-6">
                  <PublicCampaignsView />
                </TabsContent>
                <TabsContent value="leads" className="mt-6">
                  <PublicLeadsView />
                </TabsContent>
              </Tabs>
            </div>
        </div>
    );
}
