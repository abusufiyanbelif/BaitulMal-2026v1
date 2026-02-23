
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
import { Eye } from 'lucide-react';

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
                    <Button asChild size="lg">
                        <Link href="/public-initiatives">
                            <Eye className="mr-2 h-5 w-5" />
                            View Public Initiatives
                        </Link>
                    </Button>
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
