'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { OverallFundingSummary } from '@/components/overall-funding-summary';
import { DonationSummary } from '@/components/donation-summary';
import { LeadAndCampaignSummary } from '@/components/lead-campaign-summary';
import { WisdomAndReflection } from '@/components/WisdomAndReflection';
import { NewsTicker } from '@/components/news-ticker';
import { usePublicData } from '@/hooks/use-public-data';
import { cn } from '@/lib/utils';
import { FolderKanban, Lightbulb } from 'lucide-react';

export default function Home() {
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted } = usePublicData();

    const activeTickerItems = useMemo(() => {
        const activeCampaigns = campaignsWithProgress
            .filter(c => c.status === 'Active')
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                const prefix = (c as any).isUpdated ? '✨ UPDATED: ' : '';
                return {
                    id: c.id,
                    text: `${prefix}Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')} | Ends: ${c.endDate})`,
                    href: `/campaign-public/${c.id}/summary`
                };
            });
        
        const activeLeads = leadsWithProgress
            .filter(l => l.status === 'Active')
            .map(l => {
                const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
                const prefix = (l as any).isUpdated ? '✨ UPDATED: ' : '';
                return {
                    id: l.id,
                    text: `${prefix}Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')} | Ends: ${l.endDate})`,
                    href: `/leads-public/${l.id}/summary`
                };
            });

        return [...activeCampaigns, ...activeLeads];
    }, [campaignsWithProgress, leadsWithProgress]);

    const completedTickerItems = useMemo(() => {
        const completedCampaigns = campaignsWithProgress
            .filter(c => c.status === 'Completed')
            .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-public/${c.id}/summary` }));
        
        const completedLeads = leadsWithProgress
            .filter(l => l.status === 'Completed')
            .map(l => ({ id: l.id, text: `Lead: ${l.name}`, href: `/leads-public/${l.id}/summary` }));

        return [...completedCampaigns, ...completedLeads];
    }, [campaignsWithProgress, leadsWithProgress]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-8">
              <section className="text-center py-12 md:py-20 animate-fade-in-up">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                      Baitulmal Samajik Sanstha Solapur
                  </h1>
                  <p className="mt-4 max-w-3xl mx-auto text-lg text-muted-foreground font-normal">
                      An overview of our organization's impact and activities. Join us in making a difference.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                      <Button asChild size="lg" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold">
                          <Link href="/campaign-public">
                              <FolderKanban className="mr-2 h-5 w-5" />
                              View Campaigns
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold">
                          <Link href="/leads-public">
                              <Lightbulb className="mr-2 h-5 w-5" />
                              View Leads
                          </Link>
                      </Button>
                  </div>
              </section>

              <WisdomAndReflection />

              <div className="space-y-2">
                <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
                <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
                <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />
              </div>

              <div className="space-y-6">
                <OverallFundingSummary />
                <DonationSummary />
                <LeadAndCampaignSummary />
              </div>
            </div>
        </div>
    );
}