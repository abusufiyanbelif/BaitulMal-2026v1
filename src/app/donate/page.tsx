'use client';
import { useSearchParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, type DocumentReference } from 'firebase/firestore';
import { PublicDonationForm } from '@/components/public-donation-form';
import { BrandedLoader } from '@/components/branded-loader';
import type { Campaign, Lead } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Landmark, Verified, ShieldCheck, ChevronRight } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PublicDonatePage() {
    const searchParams = useSearchParams();
    const campaignId = searchParams.get('campaignId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const firestore = useFirestore();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

    const campaignRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const leadRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignRef);
    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadRef);

    const isLoading = isBrandingLoading || isCampaignLoading || isLeadLoading;

    if (isLoading) return <BrandedLoader message="Preparing Secure Payment Gateway..." />;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-12 text-primary font-normal overflow-hidden animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-primary/10 pb-8 mt-4">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-primary lg:text-5xl">Contribute To A Cause</h1>
                    <p className="text-muted-foreground font-normal text-lg max-w-2xl leading-relaxed">Your generosity fuels our mission. Every contribution is verified and tracked for full transparency.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="p-3 rounded-2xl bg-primary/5 text-primary">
                        <Verified className="h-6 w-6" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-60">Verified Organization</p>
                        <p className="text-sm font-bold text-primary">{brandingSettings?.name || 'BaitulAmal'}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                <div className="lg:col-span-8">
                    <PublicDonationForm 
                        initialCampaignId={campaignId} 
                        initialLeadId={leadId}
                        campaignName={campaign?.name}
                        leadName={lead?.name}
                    />
                </div>

                <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
                    <Card className="border-primary/10 shadow-lg bg-primary/[0.02] overflow-hidden">
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Why Donate?</h3>
                                <div className="space-y-4 pt-4">
                                    <div className="flex gap-3">
                                        <div className="mt-1 p-1.5 rounded-full bg-green-500/10 text-green-600"><ShieldCheck className="h-4 w-4" /></div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-primary">100% Transparency</p>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground font-normal">Every rupee is tracked and linked to specific beneficiaries or campaigns.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 p-1.5 rounded-full bg-blue-500/10 text-blue-600"><Verified className="h-4 w-4" /></div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-primary">Shariah Compliance</p>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground font-normal">Funds are strictly categorized (Zakat, Sadaqah, Fitra) as per religious guidelines.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 p-1.5 rounded-full bg-amber-500/10 text-amber-600"><Landmark className="h-4 w-4" /></div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-primary">Direct Impact</p>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground font-normal">We link donations directly to local verified requirements to minimize overhead.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="bg-primary/10" />

                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-widest opacity-60">Donor Verification</h3>
                                <p className="text-xs leading-relaxed text-muted-foreground font-normal">After submitting, our finance team will verify the Transaction ID against our bank statement. Once confirmed, you will receive an official digital receipt.</p>
                                <Button variant="link" asChild className="p-0 h-auto font-bold text-primary hover:no-underline underline-offset-4 decoration-primary/20 hover:decoration-primary">
                                    <Link href="/guidance">View Guiding Principles <ChevronRight className="ml-1 h-3 w-3" /></Link>
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="p-6 rounded-2xl border border-dashed border-primary/20 text-center space-y-2 opacity-60">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Questions or Support?</p>
                        <p className="text-xs font-bold text-primary">Contact: {brandingSettings?.name || 'Trust Office'}</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
