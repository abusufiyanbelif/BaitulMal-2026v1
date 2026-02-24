
'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, where, DocumentReference, doc } from 'firebase/firestore';
import type { Donation, Lead, DonationCategory } from '@/lib/types';
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
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  
  const allDonationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

  const donations = useMemo(() => {
    if (!allDonations) return [];
    return allDonations.filter(d => d.linkSplit?.some(link => link.linkId === leadId && link.linkType === 'lead'));
  }, [allDonations, leadId]);
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

  const { fitraTotal, zakatTotal, sadaqahTotal, fidiyaTotal, interestTotal, lillahTotal, loanTotal, monthlyContributionTotal, grandTotal } = useMemo(() => {
    if (!donations) {
        return { fitraTotal: 0, zakatTotal: 0, sadaqahTotal: 0, fidiyaTotal: 0, interestTotal: 0, lillahTotal: 0, loanTotal: 0, monthlyContributionTotal: 0, grandTotal: 0 };
    }

    let fitra = 0;
    let zakat = 0;
    let sadaqah = 0;
    let fidiya = 0;
    let interest = 0;
    let lillah = 0;
    let loan = 0;
    let monthlyContribution = 0;

    for (const d of donations) {
        const leadLink = d.linkSplit?.find(l => l.linkId === leadId && l.linkType === 'lead');
        if (!leadLink) continue;
        
        const amountForThisLead = leadLink.amount;
        if (amountForThisLead === 0) continue;

        const totalDonationAmount = d.amount > 0 ? d.amount : 1;
        const proportionForThisLead = amountForThisLead / totalDonationAmount;
        
        const splits = d.typeSplit && d.typeSplit.length > 0
            ? d.typeSplit
            : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            
        splits.forEach(split => {
            const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
            const splitAmountForThisLead = split.amount * proportionForThisLead;
            
            switch (category) {
                case 'Fitra':
                    fitra += splitAmountForThisLead;
                    break;
                case 'Zakat':
                    zakat += splitAmountForThisLead;
                    break;
                case 'Sadaqah':
                    sadaqah += splitAmountForThisLead;
                    break;
                case 'Fidiya':
                    fidiya += splitAmountForThisLead;
                    break;
                case 'Interest':
                    interest += splitAmountForThisLead;
                    break;
                case 'Lillah':
                    lillah += splitAmountForThisLead;
                    break;
                case 'Loan':
                    loan += splitAmountForThisLead;
                    break;
                case 'Monthly Contribution':
                    monthlyContribution += splitAmountForThisLead;
                    break;
            }
        });
    }
    const grandTotal = fitra + zakat + sadaqah + fidiya + interest + lillah + loan + monthlyContribution;

    return {
        fitraTotal: fitra,
        zakatTotal: zakat,
        sadaqahTotal: sadaqah,
        fidiyaTotal: fidiya,
        interestTotal: interest,
        lillahTotal: lillah,
        loanTotal: loan,
        monthlyContributionTotal: monthlyContribution,
        grandTotal: grandTotal,
    };
  }, [donations, leadId]);

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
      const leadLink = donation.linkSplit?.find(l => l.linkId === leadId && l.linkType === 'lead');
      const amountForThisLead = leadLink?.amount || 0;

      if (status === 'Verified') {
        acc.verified.count += 1;
        acc.verified.amount += amountForThisLead;
      } else if (status === 'Pending') {
        acc.pending.count += 1;
        acc.pending.amount += amountForThisLead;
      } else if (status === 'Canceled') {
        acc.canceled.count += 1;
        acc.canceled.amount += amountForThisLead;
      }
      return acc;
    }, {
      verified: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      canceled: { count: 0, amount: 0 },
    });
  }, [donations, leadId]);

  const isLoading = isLeadLoading || areDonationsLoading || isProfileLoading;

  if (isLoading) {
    return (
        <div>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!lead) {
    return (
      <main className="container mx-auto p-4 md:p-8 text-center">
        <p>Lead not found.</p>
      </main>
    );
  }

  return (
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
                <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Sadaqah</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₹{sadaqahTotal.toLocaleString('en-IN')}</div></CardContent>
            </Card>
             <Card>
                <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Fidiya</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₹{fidiyaTotal.toLocaleString('en-IN')}</div></CardContent>
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
  );
}
