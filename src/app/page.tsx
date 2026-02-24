
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
              <section className="text-center py-12 md:py-20 animate-fade-in-up">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                      Baitulmal Samajik Sanstha Solapur
                  </h1>
                  <p className="mt-4 max-w-3xl mx-auto text-lg text-muted-foreground">
                      An overview of our organization's impact and activities. Join us in making a difference.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                      <Button asChild size="lg" className="flex-1 max-w-xs">
                          <Link href="/campaign-public">
                              <FolderKanban className="mr-2 h-5 w-5" />
                              View Public Campaigns
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="flex-1 max-w-xs">
                          <Link href="/leads-public">
                              <Lightbulb className="mr-2 h-5 w-5" />
                              View Public Leads
                          </Link>
                      </Button>
                  </div>
              </section>

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
