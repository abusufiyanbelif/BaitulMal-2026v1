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
import { FolderKanban, Lightbulb, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function Home() {
    const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted } = usePublicData();
    const { brandingSettings } = useBranding();

    const activeTickerItems = useMemo(() => {
        const activeCampaigns = campaignsWithProgress
            .filter(c => c.status === 'Active')
            .map(c => {
                const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
                return {
                    id: c.id,
                    text: `Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
                    href: `/campaign-public/${c.id}/summary`
                };
            });
        
        const activeLeads = leadsWithProgress
            .filter(l => l.status === 'Active')
            .map(l => {
                const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
                return {
                    id: l.id,
                    text: `Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
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

    const heroTitle = brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.';
    const heroDescription = brandingSettings?.heroDescription || `Join ${brandingSettings?.name || 'Baitulmal Samajik Sanstha'} to make a lasting impact. Your contribution brings hope, changes lives, and empowers our community.`;

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
                            Active Campaigns
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 font-bold shadow-md px-8 h-12">
                        <Link href="/leads-public">
                            <Lightbulb className="mr-2 h-5 w-5" />
                            Public Appeals
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
                
                <Card className="border-primary/10 overflow-hidden bg-white shadow-md transition-all duration-300 hover:shadow-xl">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2"><CheckCircle2 className="h-6 w-6"/> Recent Verification</CardTitle>
                        <CardDescription className="font-normal text-primary/70">Secure tracking of confirmed community contributions.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="w-full">
                            <Table>
                                <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                    <TableRow>
                                        <TableHead className="font-semibold text-[10px] uppercase text-[hsl(var(--table-header-fg))] tracking-widest pl-6">Reference</TableHead>
                                        <TableHead className="font-semibold text-[10px] uppercase text-[hsl(var(--table-header-fg))] tracking-widest">Allocation</TableHead>
                                        <TableHead className="font-semibold text-[10px] uppercase text-[hsl(var(--table-header-fg))] tracking-widest text-right pr-6">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentDonationsFormatted.length > 0 ? (
                                        recentDonationsFormatted.slice(0, 10).map((item) => (
                                            <TableRow key={item.id} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-primary/10 bg-white">
                                                <TableCell className="pl-6"><div className="text-xs font-bold text-primary truncate max-w-[200px]">{item.text.split(' for ')[0]}</div></TableCell>
                                                <TableCell><Link href={item.href} className="text-xs font-normal text-muted-foreground hover:text-primary hover:underline transition-colors tracking-tight">{item.text.split(' for ')[1]}</Link></TableCell>
                                                <TableCell className="text-right pr-6"><Badge variant="eligible" className="text-[10px] font-bold uppercase tracking-tighter">VERIFIED</Badge></TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground font-normal italic opacity-60">No recent activity verified.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </CardContent>
                </Card>

                <DonationSummary />
                <LeadAndCampaignSummary />
            </div>
        </div>
    );
}