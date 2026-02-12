
'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, DocumentReference, doc } from 'firebase/firestore';
import type { Donation, Lead } from '@/lib/types';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, DollarSign, CheckCircle2, Hourglass, XCircle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getNestedValue } from '@/lib/utils';

export default function DonationsSummaryPage() {
  const params = useParams();
  const pathname = usePathname();
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  
  const allDonationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

  const donations = useMemo(() => {
    if (!allDonations) return [];
    return allDonations.filter(d => d.linkSplit?.some(link => link.linkId === leadId));
  }, [allDonations, leadId]);
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

  const { zakatTotal, loanTotal, interestTotal, sadaqahTotal, lillahTotal, monthlyContributionTotal, grandTotal } = useMemo(() => {
    if (!donations) {
        return { zakatTotal: 0, loanTotal: 0, interestTotal: 0, sadaqahTotal: 0, lillahTotal: 0, monthlyContributionTotal: 0, grandTotal: 0 };
    }

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
    const grandTotal = zakat + loan + interest + sadaqah + lillah + monthlyContribution;

    return {
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
      if (status === 'Verified') {
        acc.verified.count += 1;
        acc.verified.amount += donation.amount;
      } else if (status === 'Pending') {
        acc.pending.count += 1;
        acc.pending.amount += donation.amount;
      } else if (status === 'Canceled') {
        acc.canceled.count += 1;
        acc.canceled.amount += donation.amount;
      }
      return acc;
    }, {
      verified: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      canceled: { count: 0, amount: 0 },
    });
  }, [donations]);

  const isLoading = isLeadLoading || areDonationsLoading || isProfileLoading;

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
                <Link href="/leads-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </Button>
        </div>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">{lead?.name}</h1>
        </div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/summary`}>Summary</Link>
                        </Button>
                    )}
                    <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                        <Link href={`/leads-members/${leadId}`}>Item List</Link>
                    </Button>
                    {canReadBeneficiaries && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link>
                        </Button>
                    )}
                    {canReadDonations && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/donations`}>Donations</Link>
                        </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        {canReadDonations && (
            <div className="border-b mb-4">
              <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex w-max space-x-2">
                      <Link href={`/leads-members/${leadId}/donations/summary`} className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          pathname === `/leads-members/${leadId}/donations/summary` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                      )}>Donation Summary</Link>
                      <Link href={`/leads-members/${leadId}/donations`} className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          pathname === `/leads-members/${leadId}/donations` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                      )}>Donation List</Link>
                  </div>
                  <ScrollBar orientation="horizontal" />
              </ScrollArea>
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
                    <CardContent className="p-2">
                        <div className="text-2xl font-bold">{statusStats.verified.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.verified.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2">
                        <div className="text-2xl font-bold">{statusStats.pending.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.pending.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                    <CardContent className="p-2">
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
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Zakat</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{zakatTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Interest</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{interestTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Loan</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{loanTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Sadaqah</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{sadaqahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Lillah</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{lillahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Contribution</CardTitle></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">₹{monthlyContributionTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
