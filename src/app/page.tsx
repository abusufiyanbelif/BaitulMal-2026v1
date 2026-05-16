'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React, { useMemo, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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
import { 
    FolderKanban, 
    Lightbulb, 
    AlertTriangle, 
    ArrowUpCircle, 
    MinusCircle, 
    ArrowDownCircle, 
    HeartHandshake,
    Sparkles,
    ShieldCheck,
    TrendingUp,
    ChevronRight,
    Activity
} from 'lucide-react';

const getPriorityIcon = (priority?: string) => {
  switch (priority) {
    case 'Urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'High': return <ArrowUpCircle className="h-4 w-4 text-orange-500" />;
    case 'Medium': return <MinusCircle className="h-4 w-4 text-yellow-500" />;
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
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted, isLoading, isTickerActiveVisible, isTickerCompletedVisible, skipIds, maxCompleted } = usePublicData();
    const { brandingSettings } = useBranding();

    const activeTickerItems = useMemo(() => {
        if (!isTickerActiveVisible) return [];
        
        const activeCampaigns = (campaignsWithProgress || [])
            .filter(c => (c.status === 'Active' || c.status === 'Upcoming') && !skipIds.has(c.id))
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                return {
                    id: c.id,
                    text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/campaign-public/${c.id}/summary`,
                    priority: c.priority || 'Medium',
                    priorityIcon: getPriorityIcon(c.priority)
                };
            });
        
        const activeLeads = (leadsWithProgress || [])
            .filter(l => (l.status === 'Active' || l.status === 'Upcoming') && !skipIds.has(l.id))
            .map(l => {
                const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
                return {
                    id: l.id,
                    text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Appeal: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/leads-public/${l.id}/summary`,
                    priority: l.priority || 'Medium',
                    priorityIcon: getPriorityIcon(l.priority)
                };
            });

        return [...activeCampaigns, ...activeLeads].sort((a, b) => 
            (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
        );
    }, [campaignsWithProgress, leadsWithProgress, isTickerActiveVisible, skipIds]);

    const completedTickerItems = useMemo(() => {
        if (!isTickerCompletedVisible) return [];

        const completedCampaigns = (campaignsWithProgress || [])
            .filter(c => c.status === 'Completed' && !skipIds.has(c.id))
            .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-public/${c.id}/summary` }));
        
        const completedLeads = (leadsWithProgress || [])
            .filter(l => l.status === 'Completed' && !skipIds.has(l.id))
            .map(l => ({ id: l.id, text: `Appeal: ${l.name}`, href: `/leads-public/${l.id}/summary` }));

        return [...completedCampaigns, ...completedLeads].slice(0, maxCompleted);
    }, [campaignsWithProgress, leadsWithProgress, isTickerCompletedVisible, skipIds, maxCompleted]);

    const heroTitle = brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.';
    const heroDescription = brandingSettings?.heroDescription || `Join ${brandingSettings?.name || 'Our Community'} To Make A Lasting Impact. Your Contribution Brings Hope And Changes Lives.`;
    
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
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-12 text-primary font-normal relative min-h-screen pb-32 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[120px] -z-10 animate-pulse" />
            <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute bottom-0 left-0 w-full h-[800px] bg-gradient-to-t from-primary/[0.01] to-transparent -z-10" />

            {isHeroVisible && (
                <section className="relative text-center py-16 sm:py-24 lg:py-32 space-y-10">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/5 text-primary rounded-full border border-primary/10 mb-2 shadow-sm animate-fade-in-up">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-xs font-black tracking-[0.2em]">{brandingSettings?.name || 'Baitulmal'} Official Website</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl lg:text-8xl font-black tracking-tighter text-primary max-w-[1200px] mx-auto leading-[1.1] sm:leading-[0.95] drop-shadow-sm px-4 animate-fade-in-up animate-hero-text-glow">
                        {heroTitle}
                    </h1>

                    <p className="mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground font-normal leading-relaxed px-4 opacity-70 animate-stagger-reveal" style={{ animationDelay: '400ms' }}>
                        {heroDescription}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
                        {brandingSettings?.isLandingDonateNowVisible !== false && (
                            <Button asChild size="lg" className="h-16 px-12 rounded-[24px] bg-primary text-white font-black text-lg shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 group">
                                <Link href="/donate">
                                    <HeartHandshake className="mr-3 h-6 w-6 text-emerald-400 transition-transform group-hover:scale-125" />
                                    Donate Now
                                </Link>
                            </Button>
                        )}
                        <div className="flex gap-4">
                            <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-2xl border-primary/10 bg-white/50 backdrop-blur-md font-black text-xs tracking-widest transition-all hover:bg-white hover:shadow-xl active:scale-95">
                                <Link href="/campaign-public">
                                    <FolderKanban className="mr-2 h-4 w-4 opacity-40" />
                                    Campaigns
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-2xl border-primary/10 bg-white/50 backdrop-blur-md font-black text-xs tracking-widest transition-all hover:bg-white hover:shadow-xl active:scale-95">
                                <Link href="/leads-public">
                                    <Lightbulb className="mr-2 h-4 w-4 opacity-40" />
                                    Appeals
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {showTickers && (
                <div className="space-y-4">
                    {activeTickerItems.length > 0 && (
                        <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
                    )}
                    {recentDonationsFormatted.length > 0 && (
                        <NewsTicker items={recentDonationsFormatted} label="Donations" variant="donation" />
                    )}
                    {completedTickerItems.length > 0 && (
                        <NewsTicker items={completedTickerItems} label="Success Stories" variant="completed" />
                    )}
                </div>
            )}

            <div className="space-y-32 py-20 relative">
                {isWisdomVisible && <WisdomAndReflection />}

                <div className="space-y-32">
                    {isOverallSummaryVisible && (
                        <div className="rounded-[48px] bg-white/30 backdrop-blur-2xl border border-primary/5 p-4 sm:p-8 shadow-none transition-all hover:shadow-2xl">
                            <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-[48px]" />}>
                                <OverallFundingSummary />
                            </Suspense>
                        </div>
                    )}
                    
                    <div className="grid gap-12 lg:grid-cols-2">
                        {isDonationSummaryVisible && (
                            <div className="rounded-[40px] bg-white/30 backdrop-blur-2xl border border-primary/5 p-4 sm:p-8 shadow-none transition-all hover:shadow-2xl">
                                <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-[40px]" />}>
                                    <DonationSummary />
                                </Suspense>
                            </div>
                        )}
                        {isPurposeSummaryVisible && (
                            <div className="rounded-[40px] bg-white/30 backdrop-blur-2xl border border-primary/5 p-4 sm:p-8 shadow-none transition-all hover:shadow-2xl">
                                <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-[40px]" />}>
                                    <PurposeFundingSummary />
                                </Suspense>
                            </div>
                        )}
                    </div>
                    
                    {isInitiativeSummaryVisible && (
                        <div className="rounded-[48px] bg-white/30 backdrop-blur-2xl border border-primary/5 p-4 sm:p-12 shadow-none transition-all hover:shadow-2xl">
                            <div className="flex items-center gap-4 mb-10 border-b border-primary/5 pb-8">
                                <div className="h-14 w-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center">
                                    <TrendingUp className="h-8 w-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black tracking-tighter">Our Work & Cases</h2>
                                    <p className="text-sm font-normal opacity-40 tracking-widest">Live Updates & Progress</p>
                                </div>
                            </div>
                            <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-[48px]" />}>
                                <LeadAndCampaignSummary />
                            </Suspense>
                        </div>
                    )}
                    
                    {isRecentVerificationVisible && recentDonationsFormatted.length > 0 && (
                        <div className="rounded-[48px] bg-primary/[0.02] border border-primary/5 p-8 sm:p-12 relative overflow-hidden group transition-all hover:bg-primary/[0.04]">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center animate-pulse">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tighter">Verified Donations</h3>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 text-[10px] font-normal tracking-widest text-primary/40">
                                    <Activity className="h-4 w-4" /> Live List
                                </div>
                            </div>
                            <RecentVerificationTicker items={recentDonationsFormatted} />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Global Portal Quick Access */}
            <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 animate-fade-in-up" style={{ animationDelay: '1s' }}>
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-white/80 backdrop-blur-2xl p-2 rounded-[24px] sm:rounded-full border border-primary/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full sm:w-auto">
                    <div className="flex w-full sm:w-auto items-center">
                        <Button asChild variant="ghost" className="flex-1 sm:flex-none h-10 sm:h-12 px-4 sm:px-6 rounded-full font-black text-[11px] sm:text-xs tracking-widest text-primary hover:bg-primary/5">
                            <Link href="/login">Admin Login</Link>
                        </Button>
                        {(brandingSettings?.isDonorLoginEnabled !== false || brandingSettings?.isBeneficiaryLoginEnabled !== false) && (
                            <>
                                <div className="w-px h-6 bg-primary/10 mx-1" />
                                <Button asChild className="flex-[2] sm:flex-none h-10 sm:h-12 px-6 sm:px-8 rounded-full bg-primary text-white font-black text-[11px] sm:text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all">
                                    <Link href="/portal-login">
                                        {brandingSettings?.isDonorLoginEnabled !== false ? "Donor Login" : "Beneficiary Login"} <ChevronRight className="ml-1 sm:ml-2 h-3 sm:h-4 w-3 sm:h-4" />
                                    </Link>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
