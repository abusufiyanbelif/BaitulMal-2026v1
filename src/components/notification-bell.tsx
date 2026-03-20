'use client';

import { useState, useMemo } from 'react';
import { 
    Bell, 
    IndianRupee, 
    Users, 
    Lightbulb, 
    FolderKanban, 
    ChevronRight,
    AlertCircle,
    DatabaseZap,
    FileLock,
    ShieldAlert,
    CheckCircle2,
    HeartHandshake
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
                <p className="text-xs font-bold text-primary truncate tracking-tight">{title}</p>
                <p className="text-[9px] text-muted-foreground truncate font-medium tracking-tight opacity-80">{subtitle}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
        </Link>
    );
}

export function NotificationBell() {
    const firestore = useFirestore();
    const { user, userProfile } = useSession();

    // 1. Beneficiaries
    const unverifiedBenQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'beneficiaries'), where('status', '!=', 'Verified')) : null, 
    [firestore, user]);
    const { data: unverifiedBeneficiaries } = useCollection<Beneficiary>(unverifiedBenQuery);

    // 2. Donations
    const unverifiedDonQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore, user]);
    const { data: unverifiedDonations } = useCollection<Donation>(unverifiedDonQuery);

    // 3. Identity Resolution (Unlinked & Unallocated)
    const verifiedDonQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, 
    [firestore, user]);
    const { data: verifiedDonations } = useCollection<Donation>(verifiedDonQuery);

    const unlinkedDonations = useMemo(() => verifiedDonations?.filter(d => !d.donorId) || [], [verifiedDonations]);

    // 4. Campaigns
    const pendingCampsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '==', 'Pending Verification')) : null, [firestore, user]);
    const { data: pendingCampaigns } = useCollection<Campaign>(pendingCampsQuery);

    const holdCampsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'campaigns'), where('publicVisibility', '==', 'Hold'), where('authenticityStatus', '==', 'Verified')) : null, [firestore, user]);
    const { data: privateCampaigns } = useCollection<Campaign>(holdCampsQuery);

    // 5. Leads
    const pendingLeadsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'leads'), where('authenticityStatus', '==', 'Pending Verification')) : null, [firestore, user]);
    const { data: pendingLeads } = useCollection<Lead>(pendingLeadsQuery);

    const holdLeadsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'leads'), where('publicVisibility', '==', 'Hold'), where('authenticityStatus', '==', 'Verified')) : null, [firestore, user]);
    const { data: privateLeads } = useCollection<Lead>(holdLeadsQuery);

    const totalAlerts = (unverifiedBeneficiaries?.length || 0) + 
                        (unverifiedDonations?.length || 0) + 
                        unlinkedDonations.length +
                        (pendingCampaigns?.length || 0) + 
                        (pendingLeads?.length || 0) +
                        (privateCampaigns?.length || 0) +
                        (privateLeads?.length || 0);

    if (!user || !userProfile) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-primary/10 group transition-all active:scale-95 shadow-none border-none">
                    <Bell className="h-5 w-5 text-primary transition-transform group-hover:rotate-12" />
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
            <PopoverContent className="w-[90vw] sm:w-96 p-0 overflow-hidden rounded-[20px] border-primary/10 shadow-2xl animate-fade-in-zoom bg-white" align="end" sideOffset={12}>
                <div className="bg-primary/5 p-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Pending Tasks</h3>
                            <p className="text-[9px] text-muted-foreground font-medium tracking-tight opacity-60">Action Required For Registry Health</p>
                        </div>
                        {totalAlerts > 0 && <Badge className="bg-primary text-white border-none font-bold text-[9px] px-2 h-5">Action Hub</Badge>}
                    </div>
                </div>
                
                <ScrollArea className="h-full max-h-[500px]">
                    <div className="p-2 pb-6 min-w-full">
                        {totalAlerts === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                <div className="p-4 rounded-full bg-primary/5 text-primary/20 mb-4 animate-fade-in-zoom">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <p className="text-sm font-bold text-primary tracking-tight">Registry Is Secure</p>
                                <p className="text-[10px] text-muted-foreground font-normal">All Data Has Been Verified And Allocated.</p>
                            </div>
                        ) : (
                            <Accordion type="multiple" className="w-full space-y-1">
                                
                                {/* Donors Category */}
                                {unlinkedDonations.length > 0 && (
                                    <AccordionItem value="donors" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] uppercase text-primary/60">
                                            <div className="flex items-center gap-2">
                                                <HeartHandshake className="h-3.5 w-3.5"/>
                                                Donor Identity ({unlinkedDonations.length})
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-2">
                                            {unlinkedDonations.slice(0, 5).map(d => (
                                                <NotificationItem key={`unlinked_${d.id}`} icon={AlertCircle} title={d.donorName} subtitle="Resolve Identity" href={`/donations/${d.id}`} variant="warning" />
                                            ))}
                                            {unlinkedDonations.length > 5 && (
                                                <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40 uppercase"><Link href="/donors">View All Unlinked</Link></Button>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                                {/* Donations Category */}
                                {unverifiedDonations && unverifiedDonations.length > 0 && (
                                    <AccordionItem value="donations" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] uppercase text-primary/60">
                                            <div className="flex items-center gap-2">
                                                <IndianRupee className="h-3.5 w-3.5"/>
                                                Donations ({unverifiedDonations.length})
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-2">
                                            {unverifiedDonations.slice(0, 5).map(d => (
                                                <NotificationItem key={d.id} icon={IndianRupee} title={`From: ${d.donorName}`} subtitle="Verify Payment" href={`/donations/${d.id}`} variant="destructive" />
                                            ))}
                                            {unverifiedDonations.length > 5 && (
                                                <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40 uppercase"><Link href="/donations?status=Pending">View All Pending</Link></Button>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                                {/* Beneficiaries Category */}
                                {unverifiedBeneficiaries && unverifiedBeneficiaries.length > 0 && (
                                    <AccordionItem value="beneficiaries" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] uppercase text-primary/60">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5"/>
                                                Beneficiaries ({unverifiedBeneficiaries.length})
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-2">
                                            {unverifiedBeneficiaries.slice(0, 5).map(b => (
                                                <NotificationItem key={b.id} icon={Users} title={b.name} subtitle="Vetting Required" href={`/beneficiaries/${b.id}`} variant="destructive" />
                                            ))}
                                            {unverifiedBeneficiaries.length > 5 && (
                                                <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40 uppercase"><Link href="/beneficiaries?status=Pending">View All Unverified</Link></Button>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                                {/* Campaigns Category */}
                                {((pendingCampaigns?.length || 0) + (privateCampaigns?.length || 0)) > 0 && (
                                    <AccordionItem value="campaigns" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] uppercase text-primary/60">
                                            <div className="flex items-center gap-2">
                                                <FolderKanban className="h-3.5 w-3.5"/>
                                                Campaigns ({(pendingCampaigns?.length || 0) + (privateCampaigns?.length || 0)})
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-2">
                                            {pendingCampaigns?.slice(0, 3).map(c => (
                                                <NotificationItem key={`pc_${c.id}`} icon={ShieldAlert} title={c.name} subtitle="Approve Authenticity" href={`/campaign-members/${c.id}/summary`} variant="warning" />
                                            ))}
                                            {privateCampaigns?.slice(0, 3).map(c => (
                                                <NotificationItem key={`hc_${c.id}`} icon={FileLock} title={c.name} subtitle="Visibility Hold" href={`/campaign-members/${c.id}/summary`} variant="info" />
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                                {/* Leads Category */}
                                {((pendingLeads?.length || 0) + (privateLeads?.length || 0)) > 0 && (
                                    <AccordionItem value="leads" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] uppercase text-primary/60">
                                            <div className="flex items-center gap-2">
                                                <Lightbulb className="h-3.5 w-3.5"/>
                                                Public Appeals ({(pendingLeads?.length || 0) + (privateLeads?.length || 0)})
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-2">
                                            {pendingLeads?.slice(0, 3).map(l => (
                                                <NotificationItem key={`pl_${l.id}`} icon={ShieldAlert} title={l.name} subtitle="Approve Authenticity" href={`/leads-members/${l.id}/summary`} variant="warning" />
                                            ))}
                                            {privateLeads?.slice(0, 3).map(l => (
                                                <NotificationItem key={`hl_${l.id}`} icon={FileLock} title={l.name} subtitle="Visibility Hold" href={`/leads-members/${l.id}/summary`} variant="info" />
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                            </Accordion>
                        )}
                    </div>
                    <ScrollBar orientation="vertical" />
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                
                {totalAlerts > 0 && (
                    <div className="p-3 bg-muted/20 border-t flex justify-center shrink-0">
                        <Button variant="ghost" size="sm" asChild className="h-7 text-[9px] font-bold text-primary tracking-tighter hover:bg-primary/5 uppercase">
                            <Link href="/dashboard" className="flex items-center">
                                Management Dashboard <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
