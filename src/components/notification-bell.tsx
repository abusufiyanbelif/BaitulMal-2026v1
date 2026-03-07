'use client';

import { useState, useMemo } from 'react';
import { 
    Bell, 
    IndianRupee, 
    Users, 
    Lightbulb, 
    FolderKanban, 
    ExternalLink,
    AlertCircle,
    Wallet,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { 
    useFirestore, 
    useCollection, 
    useMemoFirebase, 
    collection, 
    query, 
    where 
} from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Donation, Beneficiary, Lead, Campaign } from '@/lib/types';

interface AlertItemProps {
    icon: any;
    label: string;
    count: number;
    href: string;
    description: string;
    variant?: 'destructive' | 'warning' | 'info';
}

function AlertItem({ icon: Icon, label, count, href, description, variant = 'destructive' }: AlertItemProps) {
    if (count === 0) return null;

    return (
        <Link href={href} className="group flex items-start gap-4 p-3 rounded-lg hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10">
            <div className={cn(
                "mt-1 p-2 rounded-full transition-colors",
                variant === 'destructive' ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : 
                variant === 'warning' ? "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white" :
                "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-primary tracking-tight">{label}</p>
                    <Badge className={cn(
                        "h-5 px-1.5 text-[10px] font-black",
                        variant === 'destructive' ? "bg-red-500 text-white border-none" :
                        variant === 'warning' ? "bg-amber-500 text-white border-none" :
                        "bg-blue-500 text-white border-none"
                    )}>{count}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-normal leading-tight">{description}</p>
                <div className="flex items-center gap-1 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter pt-1">
                    Take Action <ExternalLink className="h-2 w-2" />
                </div>
            </div>
        </Link>
    );
}

export function NotificationBell() {
    const firestore = useFirestore();
    const { user, userProfile } = useSession();

    // 1. Unverified Beneficiaries (Status != 'Verified')
    const unverifiedBeneficiariesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'beneficiaries'), where('status', '!=', 'Verified')) : null, 
    [firestore]);
    const { data: unverifiedBeneficiaries } = useCollection<Beneficiary>(unverifiedBeneficiariesQuery);

    // 2. Unverified Donations (Status == 'Pending')
    const unverifiedDonationsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore]);
    const { data: unverifiedDonations } = useCollection<Donation>(unverifiedDonationsQuery);

    // 3. Unallocated Donations (Status == 'Verified' but balance > 0)
    const verifiedDonationsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, 
    [firestore]);
    const { data: verifiedDonations } = useCollection<Donation>(verifiedDonationsQuery);

    const unallocatedDonationsCount = useMemo(() => {
        if (!verifiedDonations) return 0;
        return verifiedDonations.filter(d => {
            const allocatedSum = d.linkSplit?.reduce((sum, link) => sum + link.amount, 0) || 0;
            return (d.amount - allocatedSum) > 0.01;
        }).length;
    }, [verifiedDonations]);

    // 4. Unverified Leads (Authenticity != 'Verified')
    const unverifiedLeadsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'leads'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore]);
    const { data: unverifiedLeads } = useCollection<Lead>(unverifiedLeadsQuery);

    // 5. Unverified Campaigns (Authenticity != 'Verified')
    const unverifiedCampaignsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore]);
    const { data: unverifiedCampaigns } = useCollection<Campaign>(unverifiedCampaignsQuery);

    const counts = {
        unverifiedBeneficiaries: unverifiedBeneficiaries?.length || 0,
        unverifiedDonations: unverifiedDonations?.length || 0,
        unallocatedDonations: unallocatedDonationsCount,
        unverifiedLeads: unverifiedLeads?.length || 0,
        unverifiedCampaigns: unverifiedCampaigns?.length || 0
    };

    const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);

    if (!user || !userProfile) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-primary/10 group">
                    <Bell className={cn(
                        "h-5 w-5 text-primary transition-transform group-hover:rotate-12",
                        totalAlerts > 0 && "animate-shake"
                    )} />
                    {totalAlerts > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive text-[10px] font-black text-white items-center justify-center">
                                {totalAlerts > 9 ? '9+' : totalAlerts}
                            </span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden rounded-xl border-primary/10 shadow-2xl animate-fade-in-zoom" align="end">
                <div className="bg-primary/5 p-4 border-b">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Institutional Alerts</h3>
                        {totalAlerts > 0 && <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary uppercase">Attention Required</Badge>}
                    </div>
                </div>
                
                <ScrollArea className="h-full max-h-[450px]">
                    <div className="p-2 space-y-1">
                        {totalAlerts === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="p-4 rounded-full bg-primary/5 text-primary/20 mb-4">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <p className="text-sm font-bold text-primary tracking-tight">Queue is Empty</p>
                                <p className="text-[10px] text-muted-foreground font-normal">All institutional data has been processed and verified.</p>
                            </div>
                        ) : (
                            <>
                                <AlertItem 
                                    icon={Users} 
                                    label="Beneficiaries To Vette" 
                                    count={counts.unverifiedBeneficiaries} 
                                    href="/beneficiaries" 
                                    description="Profiles requiring identification or status verification."
                                />
                                <AlertItem 
                                    icon={IndianRupee} 
                                    label="Unverified Donations" 
                                    count={counts.unverifiedDonations} 
                                    href="/donations" 
                                    description="Incoming contributions awaiting financial vetting."
                                />
                                <AlertItem 
                                    icon={Wallet} 
                                    label="Unallocated Funds" 
                                    count={counts.unallocatedDonations} 
                                    href="/donations" 
                                    variant="warning"
                                    description="Verified donations with unassigned balance."
                                />
                                <AlertItem 
                                    icon={Lightbulb} 
                                    label="Leads To Vette" 
                                    count={counts.unverifiedLeads} 
                                    href="/leads-members" 
                                    description="Individual appeals awaiting authenticity verification."
                                />
                                <AlertItem 
                                    icon={FolderKanban} 
                                    label="Campaigns To Vette" 
                                    count={counts.unverifiedCampaigns} 
                                    href="/campaign-members" 
                                    description="Institutional initiatives awaiting final approval."
                                />
                            </>
                        )}
                    </div>
                </ScrollArea>
                
                {totalAlerts > 0 && (
                    <div className="p-3 bg-muted/20 border-t flex justify-center">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Priority Institutional Backlog</p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}