'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { OverallFundingSummary } from '@/components/overall-funding-summary';
import { DonationSummary } from '@/components/donation-summary';
import { PurposeFundingSummary } from '@/components/purpose-funding-summary';
import { LeadAndCampaignSummary } from '@/components/lead-campaign-summary';
import { WisdomAndReflection } from '@/components/WisdomAndReflection';
import { NewsTicker } from '@/components/news-ticker';
import { RecentVerificationTicker } from '@/components/recent-verification-ticker';
import { usePublicData } from '@/hooks/use-public-data';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';
import { FolderKanban, Lightbulb, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function Home() {
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted } = usePublicData();
    const { brandingSettings } = useBranding();

    const activeTickerItems = useMemo(() => {
        const activeCampaigns = (campaignsWithProgress || [])
            .filter(c => c.status === 'Active' || c.status === 'Upcoming')
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                return {
                    id: c.id,
                    text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/campaign-public/${c.id}/summary`
                };
            });
        
        const activeLeads = (leadsWithProgress || [])
            .filter(l => l.status === 'Active' || l.status === 'Upcoming')
            .map(l => {
                const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
                return {
                    id: l.id,
                    text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/leads-public/${l.id}/summary`
                };
            });

        return [...activeCampaigns, ...activeLeads];
    }, [campaignsWithProgress, leadsWithProgress]);

    const completedTickerItems = useMemo(() => {
        const completedCampaigns = (campaignsWithProgress || [])
            .filter(c => c.status === 'Completed')
            .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-public/${c.id}/summary` }));
        
        const completedLeads = (leadsWithProgress || [])
            .filter(l => l.status === 'Completed')
            .map(l => ({ id: l.id, text: `Lead: ${l.name}`, href: `/leads-public/${l.id}/summary` }));

        return [...completedCampaigns, ...completedLeads];
    }, [campaignsWithProgress, leadsWithProgress]);

    const heroTitle = brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.';
    const heroDescription = brandingSettings?.heroDescription || `Join ${brandingSettings?.name || 'Baitulmal Samajik Sanstha'} To Make A Lasting Impact. Your Contribution Brings Hope, Changes Lives, And Empowers Our Community.`;
    const showRecentVerification = brandingSettings?.isRecentVerificationVisible !== false;

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-10 text-primary">
            {/* Hero Section */}
            <section className="text-center py-12 md:py-20 animate-fade-in-zoom">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-primary max-w-5xl mx-auto">
                    {heroTitle}
                </h1>
                <p className="mt-6 max-w-3xl mx-auto text-lg text-primary font-normal leading-relaxed opacity-80">
                    {heroDescription}
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild size="lg" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md bg-primary text-white px-8 h-12">
                        <Link href="/campaign-public">
                            <FolderKanban className="mr-2 h-5 w-5" />
                            Our Campaigns
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md px-8 h-12">
                        <Link href="/leads-public">
                            <Lightbulb className="mr-2 h-5 w-5" />
                            Public Appeals (Leads)
                        </Link>
                    </Button>
                </div>
            </section>

            {/* News & Updates */}
            <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
                <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
                <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <WisdomAndReflection />
            </div>

            {/* Detailed Data Sections */}
            <div className="space-y-10 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                <OverallFundingSummary />
                <div className="grid gap-10 lg:grid-cols-2">
                    <DonationSummary />
                    <PurposeFundingSummary />
                </div>
                <LeadAndCampaignSummary />
                
                {/* Recent Verification Ticker at end */}
                {showRecentVerification && (
                    <RecentVerificationTicker items={recentDonationsFormatted} />
                )}
            </div>
        </div>
    );
}
