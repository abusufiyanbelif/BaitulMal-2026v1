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
import { FolderKanban, Lightbulb, CheckCircle2, AlertTriangle, ArrowUpCircle, MinusCircle, ArrowDownCircle, HandHelping, HeartHandshake } from 'lucide-react';

const getPriorityIcon = (priority?: string) => {
  switch (priority) {
    case 'Urgent': return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'High': return <ArrowUpCircle className="h-5 w-5 text-orange-500" />;
    case 'Medium': return <MinusCircle className="h-5 w-5 text-yellow-500" />;
    case 'Low': return <ArrowDownCircle className="h-4 w-4 text-blue-500" />;
    default: return null;
  }
};

const priorityWeight: Record<string, number> = {
  'Urgent': 4,
  'High': 3,
  'Medium': 2,
  'Low': 1
};

export default function Home() {
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted, isLoading } = usePublicData();
    const { brandingSettings } = useBranding();

    const activeTickerItems = useMemo(() => {
        const activeCampaigns = (campaignsWithProgress || [])
            .filter(c => c.status === 'Active' || c.status === 'Upcoming')
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                const isUrgent = c.priority === 'Urgent';
                const isHigh = c.priority === 'High';
                return {
                    id: c.id,
                    text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/campaign-public/${c.id}/summary`,
                    priority: c.priority || 'Medium',
                    priorityIcon: getPriorityIcon(c.priority),
                    isUrgent,
                    isHigh
                };
            });
        
        const activeLeads = (leadsWithProgress || [])
            .filter(l => l.status === 'Active' || l.status === 'Upcoming')
            .map(l => {
                const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
                const isUrgent = l.priority === 'Urgent';
                const isHigh = l.priority === 'High';
                return {
                    id: l.id,
                    text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/leads-public/${l.id}/summary`,
                    priority: l.priority || 'Medium',
                    priorityIcon: getPriorityIcon(l.priority),
                    isUrgent,
                    isHigh
                };
            });

        return [...activeCampaigns, ...activeLeads].sort((a, b) => 
            (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
        );
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
    
    const isHeroVisible = brandingSettings?.isHeroVisible !== false;
    const isNewsTickerVisible = brandingSettings?.isNewsTickerVisible !== false;
    const isWisdomVisible = brandingSettings?.isWisdomVisible !== false;
    const isOverallSummaryVisible = brandingSettings?.isOverallSummaryVisible !== false;
    const isDonationSummaryVisible = brandingSettings?.isDonationSummaryVisible !== false;
    const isPurposeSummaryVisible = brandingSettings?.isPurposeSummaryVisible !== false;
    const isInitiativeSummaryVisible = brandingSettings?.isInitiativeSummaryVisible !== false;
    const isRecentVerificationVisible = brandingSettings?.isRecentVerificationVisible !== false;

    const showTickers = isNewsTickerVisible && !isLoading && (activeTickerItems.length > 0 || recentDonationsFormatted.length > 0 || completedTickerItems.length > 0);

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-10 text-primary transition-colors duration-500 pb-20">
            {/* Hero Section */}
            {isHeroVisible && (
                <section className="text-center py-12 md:py-20 animate-fade-in-zoom">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-primary max-w-5xl mx-auto drop-shadow-sm leading-tight">
                        {heroTitle}
                    </h1>
                    <p className="mt-6 max-w-3xl mx-auto text-lg text-primary font-normal leading-relaxed opacity-80">
                        {heroDescription}
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md px-8 h-12 rounded-xl">
                            <Link href="/campaign-public">
                                <FolderKanban className="mr-2 h-5 w-5" />
                                Our Campaigns
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="secondary" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md px-8 h-12 rounded-xl border border-primary/10">
                            <Link href="/leads-public">
                                <Lightbulb className="mr-2 h-5 w-5" />
                                Public Appeals
                            </Link>
                        </Button>
                    </div>
                </section>
            )}

            {/* News & Updates */}
            {showTickers && (
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    {activeTickerItems.length > 0 && <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />}
                    {recentDonationsFormatted.length > 0 && <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />}
                    {completedTickerItems.length > 0 && <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />}
                </div>
            )}

            {isWisdomVisible && (
                <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <WisdomAndReflection />
                </div>
            )}

            <div className="space-y-10 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                {isOverallSummaryVisible && <OverallFundingSummary />}
                
                <div className="grid gap-10 lg:grid-cols-2">
                    {isDonationSummaryVisible && <DonationSummary />}
                    {isPurposeSummaryVisible && <PurposeFundingSummary />}
                </div>
                
                {isInitiativeSummaryVisible && <LeadAndCampaignSummary />}
                
                {isRecentVerificationVisible && recentDonationsFormatted.length > 0 && (
                    <RecentVerificationTicker items={recentDonationsFormatted} />
                )}
            </div>

            {/* Support CTA Section */}
            <section className="max-w-4xl mx-auto pt-10 animate-fade-in-up" style={{ animationDelay: '800ms' }}>
                <Card className="bg-primary/[0.02] border-primary/20 border-2 border-dashed shadow-none">
                    <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                        <div className="p-4 rounded-full bg-primary/10 text-primary">
                            <HeartHandshake className="h-10 w-10" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <h3 className="text-2xl font-bold tracking-tight">Contribute To Institutional Impact</h3>
                            <p className="text-sm font-normal text-muted-foreground leading-relaxed">
                                Every donation is verified and precisely allocated to your selected cause. Join us in making a difference.
                            </p>
                        </div>
                        <Button asChild size="lg" className="font-bold shadow-md h-12 px-10 rounded-xl active:scale-95 transition-transform shrink-0">
                            <Link href="/info/members">View Donation Channels</Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
