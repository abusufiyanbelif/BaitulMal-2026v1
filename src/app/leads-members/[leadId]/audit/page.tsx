'use client';

import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, doc, type DocumentReference } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Lead } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { AuditHistory } from '@/components/audit-history';

export default function LeadAuditPage() {
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

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

    const isLoading = isLeadLoading || isProfileLoading;

    if (isLoading) return <BrandedLoader message="Retrieving Institutional Logs..." />;

    if (!lead) return <p className="text-center mt-20 text-primary font-bold">Appeal Record Not Found.</p>;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal overflow-hidden animate-fade-in-up">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                    <Link href="/leads-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Leads
                    </Link>
                </Button>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-primary">{lead.name}</h1>

            <div className="border-b border-primary/10 mb-4">
                <ScrollArea className="w-full">
                    <div className="flex w-max space-x-2 pb-2">
                        {canReadSummary && (
                            <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                        )}
                        <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                        {canReadBeneficiaries && (
                            <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                        )}
                        {canReadDonations && (
                            <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                        )}
                        <Link href={`/leads-members/${leadId}/audit`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/audit') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>
                            <ShieldCheck className="mr-2 h-4 w-4"/> Audit Trail
                        </Link>
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>

            <div className="space-y-6">
                <AuditHistory targetId={leadId} module="leads" />
            </div>
        </main>
    );
}
