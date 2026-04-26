'use client';

import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, doc, type DocumentReference } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { AuditHistory } from '@/components/audit-history';

export default function CampaignAuditPage() {
    const params = useParams();
    const pathname = usePathname();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { userProfile, isLoading: isProfileLoading } = useSession();

    const campaignDocRef = useMemoFirebase(() => {
        if (!firestore || !campaignId) return null;
        return doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign>;
    }, [firestore, campaignId]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaign-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaign-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaign-members.donations.read', false);

    const isLoading = isCampaignLoading || isProfileLoading;

    if (isLoading) return <BrandedLoader message="Retrieving Institutional Logs..." />;

    if (!campaign) return <p className="text-center mt-20 text-primary font-bold">Campaign Record Not Found.</p>;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal overflow-hidden animate-fade-in-up">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                    <Link href="/campaign-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Campaigns
                    </Link>
                </Button>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-primary">{campaign.name}</h1>

            <div className="border-b border-primary/10 mb-4">
                <ScrollArea className="w-full">
                    <div className="flex w-max space-x-2 pb-2">
                        {canReadSummary && (
                            <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                        )}
                        <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Plan & Goal</Link>
                        {canReadBeneficiaries && (
                            <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiaries</Link>
                        )}
                        {canReadDonations && (
                            <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                        )}
                        <Link href={`/campaign-members/${campaignId}/audit`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/audit') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>
                            <ShieldCheck className="mr-2 h-4 w-4"/> Audit Trail
                        </Link>
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>

            <div className="space-y-6">
                <AuditHistory targetId={campaignId} module="campaigns" />
            </div>
        </main>
    );
}
