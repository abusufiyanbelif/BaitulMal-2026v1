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
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';
import { FolderKanban, Lightbulb } from 'lucide-react';

export default function Home() {
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted } = usePublicData();
    const { brandingSettings } = useBranding();

    const activeTickerItems = useMemo(() => {
        const activeCampaigns = campaignsWithProgress
            .filter(c => c.status === 'Active')
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                const prefix = (c as any).isUpdated ? 'Updated: ' : '';
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
                const prefix = (l as any).isUpdated ? 'Updated: ' : '';
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

    const heroTitle = brandingSettings?.heroTitle || 'Empowering Our Community, One Act of Kindness at a Time.';
    const heroDescription = brandingSettings?.heroDescription || `Join ${brandingSettings?.name || 'Baitulmal Samajik Sanstha'} to make a lasting impact. Your contribution brings hope, changes lives, and empowers our community.`;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-8">
              <section className="text-center py-12 md:py-20 animate-fade-in-up">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary max-w-4xl mx-auto">
                      {heroTitle}
                  </h1>
                  <p className="mt-4 max-w-3xl mx-auto text-lg text-primary font-normal leading-relaxed opacity-80">
                      {heroDescription}
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                      <Button asChild size="lg" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md bg-primary text-white">
                          <Link href="/campaign-public">
                              <FolderKanban className="mr-2 h-5 w-5" />
                              View campaigns
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md bg-white border-primary border text-primary">
                          <Link href="/leads-public">
                              <Lightbulb className="mr-2 h-5 w-5" />
                              View leads
                          </Link>
                      </Button>
                  </div>
              </section>

              <WisdomAndReflection />

              <div className="space-y-2">
                <NewsTicker items={activeTickerItems} label="Live updates" variant="active" />
                <NewsTicker items={recentDonationsFormatted} label="Donation updates" variant="donation" />
                <NewsTicker items={completedTickerItems} label="Recently completed" variant="completed" />
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
