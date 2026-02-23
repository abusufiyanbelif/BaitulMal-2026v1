
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import { OverallFundingSummary } from '@/components/overall-funding-summary';
import { DonationSummary } from '@/components/donation-summary';
import { LeadAndCampaignSummary } from '@/components/lead-campaign-summary';
import { WisdomAndReflection } from '@/components/WisdomAndReflection';
import { cn } from '@/lib/utils';
import { FolderKanban, Lightbulb } from 'lucide-react';

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
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="flex-1">
                            <Link href="/campaign-public">
                                <FolderKanban className="mr-2 h-5 w-5" />
                                View Public Campaigns
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="secondary" className="flex-1">
                            <Link href="/leads-public">
                                <Lightbulb className="mr-2 h-5 w-5" />
                                View Public Leads
                            </Link>
                        </Button>
                    </div>
                  </CardContent>
              </Card>

              <WisdomAndReflection />

              <div className="space-y-6">
                <OverallFundingSummary />
                <DonationSummary />
                <LeadAndCampaignSummary />
              </div>
            </div>
        </div>
    );
}
