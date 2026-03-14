
'use client';

import { useState, useMemo } from 'react';
import { 
    Bell, 
    IndianRupee, 
    Users, 
    Lightbulb, 
    FolderKanban, 
    Wallet,
    CheckCircle2,
    ChevronRight,
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

interface NotificationItemProps {
    icon: any;
    title: string;
    subtitle: string;
    href: string;
    variant?: 'destructive' | 'warning' | 'info' | 'success';
}

function NotificationItem({ icon: Icon, title, subtitle, href, variant = 'info' }: NotificationItemProps) {
    return (
        <Link 
            href={href} 
            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10 active:scale-[0.98]"
        >
            <div className={cn(
                "p-2 rounded-lg transition-colors shrink-0",
                variant === 'destructive' ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : 
                variant === 'warning' ? "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white" :
                variant === 'success' ? "bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white" :
                "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-medium text-primary truncate tracking-tight">{title}</p>
                <p className="text-[9px] text-muted-foreground truncate font-medium tracking-tight opacity-80">{subtitle}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
        </Link>
    );
}

function SectionHeader({ title, count, icon: Icon }: { title: string, count: number, icon: any }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 mt-2 first:mt-0">
            <div className="flex items-center gap-2">
                <Icon className="h-3 w-3 text-primary/40" />
                <span className="text-[10px] font-medium text-muted-foreground tracking-tight">{title}</span>
            </div>
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold rounded-full">{count}</Badge>
        </div>
    );
}

export function NotificationBell() {
    const firestore = useFirestore();
    const { user, userProfile } = useSession();

    // 1. Unverified Beneficiaries
    const unverifiedBeneficiariesQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'beneficiaries'), where('status', '!=', 'Verified')) : null, 
    [firestore, user]);
    const { data: unverifiedBeneficiaries } = useCollection<Beneficiary>(unverifiedBeneficiariesQuery);

    // 2. Unverified Donations (Pending)
    const unverifiedDonationsQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore, user]);
    const { data: unverifiedDonations } = useCollection<Donation>(unverifiedDonationsQuery);

    // 3. Unallocated Donations (Verified with Balance)
    const verifiedDonationsQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, 
    [firestore, user]);
    const { data: verifiedDonations } = useCollection<Donation>(verifiedDonationsQuery);

    const unallocatedCount = useMemo(() => {
        if (!verifiedDonations) return 0;
        return verifiedDonations.filter(d => {
            const allocatedSum = d.linkSplit?.reduce((sum, link) => sum + link.amount, 0) || 0;
            return (d.amount - allocatedSum) > 0.01;
        }).length;
    }, [verifiedDonations]);

    // 4. Unverified Initiatives (Leads & Campaigns)
    const unverifiedLeadsQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'leads'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore, user]);
    const { data: unverifiedLeads } = useCollection<Lead>(unverifiedLeadsQuery);

    const unverifiedCampaignsQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore, user]);
    const { data: unverifiedCampaigns } = useCollection<Campaign>(unverifiedCampaignsQuery);

    const totalAlerts = (unverifiedBeneficiaries?.length || 0) + 
                        (unverifiedDonations?.length || 0) + 
                        (unallocatedCount) + 
                        (unverifiedLeads?.length || 0) + 
                        (unverifiedCampaigns?.length || 0);

    if (!user || !userProfile) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-primary/10 group transition-all active:scale-95 shadow-none border-none">
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
            <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-primary/10 shadow-2xl animate-fade-in-zoom bg-white" align="end" sideOffset={12}>
                <div className="bg-primary/5 p-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Pending Tasks</h3>
                            <p className="text-[9px] text-muted-foreground font-medium tracking-tight opacity-60">Action Required For Review</p>
                        </div>
                        {totalAlerts > 0 && <Badge className="bg-primary text-white border-none font-bold text-[9px] px-2 h-5">Action Items</Badge>}
                    </div>
                </div>
                
                <ScrollArea className="h-full max-h-[450px]">
                    <div className="p-2 space-y-4 pb-6">
                        {totalAlerts === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="p-4 rounded-full bg-primary/5 text-primary/20 mb-4 animate-fade-in-zoom">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <p className="text-sm font-bold text-primary tracking-tight">Everything is verified</p>
                                <p className="text-[10px] text-muted-foreground font-normal">All data has been reviewed and allocated.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Beneficiaries Section */}
                                {unverifiedBeneficiaries && unverifiedBeneficiaries.length > 0 && (
                                    <div className="space-y-1">
                                        <SectionHeader title="Verify Profiles" count={unverifiedBeneficiaries.length} icon={Users} />
                                        <div className="space-y-1">
                                            {unverifiedBeneficiaries.slice(0, 5).map(b => (
                                                <NotificationItem 
                                                    key={b.id}
                                                    icon={Users}
                                                    title={b.name}
                                                    subtitle="Action: Review Details & Verify"
                                                    href={`/beneficiaries/${b.id}`}
                                                    variant="destructive"
                                                />
                                            ))}
                                            {unverifiedBeneficiaries.length > 5 && (
                                                <Link href="/beneficiaries" className="block text-[9px] font-bold text-center text-primary py-2 hover:underline">Manage All Profile Vetting</Link>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Unverified Donations Section */}
                                {unverifiedDonations && unverifiedDonations.length > 0 && (
                                    <div className="space-y-1">
                                        <SectionHeader title="Confirm Donations" count={unverifiedDonations.length} icon={IndianRupee} />
                                        <div className="space-y-1">
                                            {unverifiedDonations.slice(0, 5).map(d => (
                                                <NotificationItem 
                                                    key={d.id}
                                                    icon={IndianRupee}
                                                    title={`From: ${d.donorName}`}
                                                    subtitle="Action: Verify Transaction Details"
                                                    href={`/donations/${d.id}`}
                                                    variant="destructive"
                                                />
                                            ))}
                                            {unverifiedDonations.length > 5 && (
                                                <Link href="/donations" className="block text-[9px] font-bold text-center text-primary py-2 hover:underline">View All Pending Vetting</Link>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Unallocated Funds Section */}
                                {unallocatedCount > 0 && (
                                    <div className="space-y-1">
                                        <SectionHeader title="Allocate Funds" count={unallocatedCount} icon={Wallet} />
                                        <div className="space-y-1">
                                            {verifiedDonations?.filter(d => {
                                                const allocated = d.linkSplit?.reduce((s, l) => s + l.amount, 0) || 0;
                                                return (d.amount - allocated) > 0.01;
                                            }).slice(0, 5).map(d => {
                                                const allocated = d.linkSplit?.reduce((s, l) => s + l.amount, 0) || 0;
                                                const balance = d.amount - allocated;
                                                return (
                                                    <NotificationItem 
                                                        key={d.id}
                                                        icon={Wallet}
                                                        title={`Balance: ₹${balance.toLocaleString()}`}
                                                        subtitle="Action: Link Remaining Funds"
                                                        href={`/donations/${d.id}`}
                                                        variant="warning"
                                                    />
                                                );
                                            })}
                                            {unallocatedCount > 5 && (
                                                <Link href="/donations" className="block text-[9px] font-bold text-center text-primary py-2 hover:underline">Complete Fund Allocations</Link>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Initiatives Section */}
                                {( (unverifiedLeads?.length || 0) + (unverifiedCampaigns?.length || 0) ) > 0 && (
                                    <div className="space-y-1">
                                        <SectionHeader title="Approve Appeals" count={(unverifiedLeads?.length || 0) + (unverifiedCampaigns?.length || 0)} icon={Lightbulb} />
                                        <div className="space-y-1">
                                            {unverifiedCampaigns?.slice(0, 3).map(c => (
                                                <NotificationItem 
                                                    key={c.id}
                                                    icon={FolderKanban}
                                                    title={c.name}
                                                    subtitle="Action: Verify Authenticity"
                                                    href={`/campaign-members/${c.id}/summary`}
                                                    variant="info"
                                                />
                                            ))}
                                            {unverifiedLeads?.slice(0, 3).map(l => (
                                                <NotificationItem 
                                                    key={l.id}
                                                    icon={Lightbulb}
                                                    title={l.name}
                                                    subtitle="Action: Verify Authenticity"
                                                    href={`/leads-members/${l.id}/summary`}
                                                    variant="info"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>
                
                {totalAlerts > 0 && (
                    <div className="p-3 bg-muted/20 border-t flex justify-center">
                        <Button variant="ghost" size="sm" asChild className="h-7 text-[9px] font-bold text-primary tracking-tighter hover:bg-primary/5">
                            <Link href="/dashboard" className="flex items-center">
                                Return To Dashboard <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
