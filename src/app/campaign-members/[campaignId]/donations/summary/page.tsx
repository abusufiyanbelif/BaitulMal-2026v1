

'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase/firestore/use-doc';
import { collection, query, where, DocumentReference, doc } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, DollarSign, CheckCircle2, Hourglass, XCircle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';

export default function DonationsSummaryPage() {
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
  
  const allDonationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

  const donations = useMemo(() => {
    if (!allDonations) return [];
    return allDonations.filter(d => {
      if (d.linkSplit && d.linkSplit.length > 0) {
        return d.linkSplit.some(link => link.linkId === campaignId);
      }
      return d.campaignId === campaignId;
    });
  }, [allDonations, campaignId]);
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const { fitraTotal, zakatTotal, loanTotal, interestTotal, sadaqahTotal, lillahTotal, monthlyContributionTotal, grandTotal } = useMemo(() => {
    if (!donations) {
        return { fitraTotal: 0, zakatTotal: 0, loanTotal: 0, interestTotal: 0, sadaqahTotal: 0, lillahTotal: 0, monthlyContributionTotal: 0, grandTotal: 0 };
    }

    let fitra = 0;
    let zakat = 0;
    let loan = 0;
    let interest = 0;
    let sadaqah = 0;
    let lillah = 0;
    let monthlyContribution = 0;

    for (const d of donations) {
        if (d.typeSplit && d.typeSplit.length > 0) {
            for (const split of d.typeSplit) {
                switch (split.category) {
                    case 'Fitra':
                        fitra += split.amount;
                        break;
                    case 'Zakat':
                        zakat += split.amount;
                        break;
                    case 'Loan':
                        loan += split.amount;
                        break;
                    case 'Interest':
                        interest += split.amount;
                        break;
                    case 'Sadaqah':
                        sadaqah += split.amount;
                        break;
                    case 'Lillah':
                        lillah += split.amount;
                        break;
                    case 'Monthly Contribution':
                        monthlyContribution += split.amount;
                        break;
                }
            }
        }
    }
    const grandTotal = fitra + zakat + loan + interest + sadaqah + lillah + monthlyContribution;

    return {
        fitraTotal: fitra,
        zakatTotal: zakat,
        loanTotal: loan,
        interestTotal: interest,
        sadaqahTotal: sadaqah,
        lillahTotal: lillah,
        monthlyContributionTotal: monthlyContribution,
        grandTotal: grandTotal,
    };
}, [donations]);

  const statusStats = useMemo(() => {
    if (!donations) {
      return {
        verified: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        canceled: { count: 0, amount: 0 },
      };
    }
    return donations.reduce((acc, donation) => {
      const status = donation.status || 'Pending';
      let amountForThisCampaign = 0;
      const campaignLink = donation.linkSplit?.find(l => l.linkId === campaignId && l.linkType === 'campaign');
      if (campaignLink) {
          amountForThisCampaign = campaignLink.amount;
      } else if ((!donation.linkSplit || donation.linkSplit.length === 0) && donation.campaignId === campaignId) {
          amountForThisCampaign = donation.amount;
      }

      if (status === 'Verified') {
        acc.verified.count += 1;
        acc.verified.amount += amountForThisCampaign;
      } else if (status === 'Pending') {
        acc.pending.count += 1;
        acc.pending.amount += amountForThisCampaign;
      } else if (status === 'Canceled') {
        acc.canceled.count += 1;
        acc.canceled.amount += amountForThisCampaign;
      }
      return acc;
    }, {
      verified: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      canceled: { count: 0, amount: 0 },
    });
  }, [donations, campaignId]);

  const isLoading = isCampaignLoading || areDonationsLoading || isProfileLoading;

  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
            <Button variant="outline" asChild>
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
                </Link>
            </Button>
        </div>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">{campaign?.name}</h1>
        </div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/summary`}>Summary</Link>
                        </Button>
                    )}
                    {canReadRation && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}`}>{campaign?.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                        </Button>
                    )}
                    {canReadBeneficiaries && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                        </Button>
                    )}
                    {canReadDonations && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/donations`}>Donations</Link>
                        </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        {canReadDonations && (
            <div className="border-b mb-4">
              <div className="flex flex-wrap items-center">
                  <Link href={`/campaign-members/${campaignId}/donations/summary`} className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pathname === `/campaign-members/${campaignId}/donations/summary` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                  )}>Donation Summary</Link>
                  <Link href={`/campaign-members/${campaignId}/donations`} className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pathname === `/campaign-members/${campaignId}/donations` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                  )}>Donation List</Link>
              </div>
            </div>
        )}

        <Card className="animate-fade-in-zoom">
          <CardHeader>
            <CardTitle>Donations Summary ({donations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statusStats.verified.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.verified.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statusStats.pending.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.pending.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statusStats.canceled.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.canceled.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Grand Total</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{grandTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Fitra</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{fitraTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Zakat</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{zakatTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Interest</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{interestTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Loan</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{loanTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Sadaqah</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{sadaqahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Lillah</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{lillahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Contribution</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">₹{monthlyContributionTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

    
