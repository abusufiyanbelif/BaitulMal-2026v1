'use client';

import { useState, useMemo, useCallback } from 'react';
import { 
    Bell, 
    IndianRupee, 
    Users, 
    Lightbulb, 
    FolderKanban, 
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    HeartHandshake,
    ShieldAlert,
    FileLock,
    X,
    Filter,
    MessageCircle,
    Clock,
    Check
} from 'lucide-react';
import Link from 'next/link';
import { 
    useFirestore, 
    useCollection, 
    useMemoFirebase, 
    collection, 
    query, 
    where,
    orderBy,
    limit,
    doc,
    writeBatch
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
import type { Donation, Beneficiary, Lead, Campaign, InAppNotification } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const moduleIcons: Record<string, any> = {
    donations: IndianRupee,
    campaigns: FolderKanban,
    leads: Lightbulb,
    beneficiaries: Users,
    users: ShieldAlert,
    donors: HeartHandshake,
    approvals: ShieldAlert,
    system: AlertCircle
};

export function NotificationBell() {
    const firestore = useFirestore();
    const { user, userProfile } = useSession();

    // --- PERSONAL NOTIFICATIONS FROM FIRESTORE ---
    const personalNotifQuery = useMemoFirebase(() => 
        (firestore && user) ? query(
            collection(firestore, 'notifications'), 
            where('userId', '==', user.uid),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(20)
        ) : null, 
    [firestore, user]);
    const { data: personalNotifications } = useCollection<InAppNotification>(personalNotifQuery);

    // --- EXISTING TASK-BASED QUERIES ---
    const unverifiedBenQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'beneficiaries'), where('status', '!=', 'Verified')) : null, 
    [firestore, user]);
    const { data: unverifiedBeneficiaries } = useCollection<Beneficiary>(unverifiedBenQuery);

    const unverifiedDonQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore, user]);
    const { data: unverifiedDonations } = useCollection<Donation>(unverifiedDonQuery);

    const verifiedDonQuery = useMemoFirebase(() => 
        (firestore && user) ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, 
    [firestore, user]);
    const { data: verifiedDonations } = useCollection<Donation>(verifiedDonQuery);
    const unlinkedDonations = useMemo(() => verifiedDonations?.filter(d => !d.donorId) || [], [verifiedDonations]);

    const pendingCampsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '==', 'Pending Verification')) : null, [firestore, user]);
    const { data: pendingCampaigns } = useCollection<Campaign>(pendingCampsQuery);

    const pendingLeadsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'leads'), where('authenticityStatus', '==', 'Pending Verification')) : null, [firestore, user]);
    const { data: pendingLeads } = useCollection<Lead>(pendingLeadsQuery);

    const holdCampsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'campaigns'), where('publicVisibility', '==', 'Hold'), where('authenticityStatus', '==', 'Verified')) : null, [firestore, user]);
    const { data: privateCampaigns } = useCollection<Campaign>(holdCampsQuery);

    const holdLeadsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'leads'), where('publicVisibility', '==', 'Hold'), where('authenticityStatus', '==', 'Verified')) : null, [firestore, user]);
    const { data: privateLeads } = useCollection<Lead>(holdLeadsQuery);

    const taskAlerts = (unverifiedBeneficiaries?.length || 0) + 
                        (unverifiedDonations?.length || 0) + 
                        unlinkedDonations.length +
                        (pendingCampaigns?.length || 0) + 
                        (pendingLeads?.length || 0) +
                        (privateCampaigns?.length || 0) +
                        (privateLeads?.length || 0);

    const personalCount = personalNotifications?.length || 0;
    const totalAlerts = taskAlerts + personalCount;

    const markAllRead = useCallback(async () => {
        if (!firestore || !personalNotifications || personalNotifications.length === 0) return;
        try {
            const batch = writeBatch(firestore);
            personalNotifications.forEach(n => {
                batch.update(doc(firestore, 'notifications', n.id), { isRead: true });
            });
            await batch.commit();
        } catch (e) {
            console.error('Failed to mark all as read:', e);
        }
    }, [firestore, personalNotifications]);

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
            <PopoverContent className="w-[90vw] sm:w-96 p-0 overflow-hidden rounded-[24px] border-primary/10 shadow-2xl animate-fade-in-zoom bg-white flex flex-col max-h-[85vh]" align="end" sideOffset={12}>
                <div className="bg-primary/5 p-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Notification Center</h3>
                            <p className="text-[9px] text-muted-foreground font-medium tracking-tight opacity-60">Alerts, Tasks & Updates</p>
                        </div>
                        <Badge variant="eligible" className="text-[9px] font-black">{totalAlerts} Active</Badge>
                    </div>
                </div>
                
                <Tabs defaultValue={personalCount > 0 ? "updates" : "tasks"} className="flex flex-col flex-1 min-h-0">
                    <div className="px-2 pt-2 shrink-0">
                        <TabsList className="grid w-full grid-cols-2 h-9 bg-primary/5 p-0.5 rounded-xl">
                            <TabsTrigger value="updates" className="font-bold text-[10px] data-[state=active]:shadow-sm relative">
                                <MessageCircle className="mr-1.5 h-3 w-3" /> Updates
                                {personalCount > 0 && <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 px-1 text-[8px] font-black">{personalCount}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="tasks" className="font-bold text-[10px] data-[state=active]:shadow-sm relative">
                                <AlertCircle className="mr-1.5 h-3 w-3" /> Tasks
                                {taskAlerts > 0 && <Badge variant="outline" className="ml-1.5 h-4 min-w-4 px-1 text-[8px] font-black border-primary/20">{taskAlerts}</Badge>}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="updates" className="flex-1 min-h-0 mt-0 overflow-hidden">
                        <ScrollArea className="h-full w-full">
                            <div className="p-2 pb-6 min-w-full">
                                {personalCount === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                        <div className="p-4 rounded-full bg-blue-50 text-blue-200 mb-4">
                                            <MessageCircle className="h-8 w-8" />
                                        </div>
                                        <p className="text-sm font-bold text-primary tracking-tight">No New Updates</p>
                                        <p className="text-[10px] text-muted-foreground font-normal">You will see donation receipts, cause allocations, and initiative updates here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {personalCount > 0 && (
                                            <div className="flex justify-end px-2 mb-1">
                                                <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold text-primary/50 hover:text-primary" onClick={markAllRead}>
                                                    <Check className="mr-1 h-3 w-3" /> Mark All Read
                                                </Button>
                                            </div>
                                        )}
                                        {personalNotifications?.map(n => {
                                            const Icon = moduleIcons[n.module] || AlertCircle;
                                            let timeStr = '';
                                            try {
                                                const ts = (n.createdAt as any)?.toDate ? (n.createdAt as any).toDate() : null;
                                                if (ts) {
                                                    const diffMin = Math.ceil((ts.getTime() - Date.now()) / 60000);
                                                    timeStr = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffMin, 'minute');
                                                }
                                            } catch {}
                                            return (
                                                <Link
                                                    key={n.id}
                                                    href={n.linkUrl || '#'}
                                                    className="group flex items-start gap-3 p-3 rounded-xl hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10 active:scale-[0.98]"
                                                >
                                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-0.5">
                                                        <p className="text-xs font-bold text-primary truncate tracking-tight">{n.title}</p>
                                                        <p className="text-[10px] text-muted-foreground font-normal line-clamp-2 leading-relaxed">{n.body}</p>
                                                        {timeStr && <p className="text-[8px] text-muted-foreground/50 font-medium flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {timeStr}</p>}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="tasks" className="flex-1 min-h-0 mt-0 overflow-hidden">
                        <ScrollArea className="h-full w-full">
                            <div className="p-2 pb-6 min-w-full">
                                {taskAlerts === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                        <div className="p-4 rounded-full bg-primary/5 text-primary/20 mb-4">
                                            <CheckCircle2 className="h-10 w-10" />
                                        </div>
                                        <p className="text-sm font-bold text-primary tracking-tight">No Pending Tasks</p>
                                        <p className="text-[10px] text-muted-foreground font-normal">Everything Has Been Verified And Secured.</p>
                                    </div>
                                ) : (
                                    <Accordion type="multiple" className="w-full space-y-1">
                                        
                                        {unlinkedDonations.length > 0 && (
                                            <AccordionItem value="donors" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] text-primary/60">
                                                    <div className="flex items-center gap-2">
                                                        <HeartHandshake className="h-3.5 w-3.5"/>
                                                        Donor Profile Linking ({unlinkedDonations.length})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-1 pb-2">
                                                    {unlinkedDonations.slice(0, 5).map(d => (
                                                        <NotificationItem key={`unlinked_${d.id}`} icon={AlertCircle} title={d.donorName} subtitle="Link To Profile" href={`/donations/${d.id}`} variant="warning" />
                                                    ))}
                                                    {unlinkedDonations.length > 5 && (
                                                        <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40"><Link href="/donors">Open Resolver Center</Link></Button>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {unverifiedDonations && unverifiedDonations.length > 0 && (
                                            <AccordionItem value="donations" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] text-primary/60">
                                                    <div className="flex items-center gap-2">
                                                        <IndianRupee className="h-3.5 w-3.5"/>
                                                        Payment Verification ({unverifiedDonations.length})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-1 pb-2">
                                                    {unverifiedDonations.slice(0, 5).map(d => (
                                                        <NotificationItem key={d.id} icon={IndianRupee} title={d.donorName} subtitle="Confirm Contribution" href={`/donations/${d.id}`} variant="destructive" />
                                                    ))}
                                                    {unverifiedDonations.length > 5 && (
                                                        <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40"><Link href="/donations?status=Pending">View Pending Payments</Link></Button>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {unverifiedBeneficiaries && unverifiedBeneficiaries.length > 0 && (
                                            <AccordionItem value="beneficiaries" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] text-primary/60">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-3.5 w-3.5"/>
                                                        Beneficiary Verification ({unverifiedBeneficiaries.length})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-1 pb-2">
                                                    {unverifiedBeneficiaries.slice(0, 5).map(b => (
                                                        <NotificationItem key={b.id} icon={Users} title={b.name} subtitle="Review Case Files" href={`/beneficiaries/${b.id}`} variant="destructive" />
                                                    ))}
                                                    {unverifiedBeneficiaries.length > 5 && (
                                                        <Button variant="ghost" asChild className="w-full h-8 text-[9px] font-bold text-primary/40"><Link href="/beneficiaries?status=Pending">View All Cases</Link></Button>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {((pendingCampaigns?.length || 0) + (pendingLeads?.length || 0)) > 0 && (
                                            <AccordionItem value="initiative-approvals" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] text-primary/60">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldAlert className="h-3.5 w-3.5"/>
                                                        Pending Approvals ({(pendingCampaigns?.length || 0) + (pendingLeads?.length || 0)})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-1 pb-2">
                                                    {pendingCampaigns?.slice(0, 3)?.map(c => (
                                                        <NotificationItem key={`pending_camp_${c.id}`} icon={FolderKanban} title={c.name} subtitle="Awaiting Verification" href={`/campaign-members/${c.id}/summary`} variant="warning" />
                                                    ))}
                                                    {pendingLeads?.slice(0, 3)?.map(l => (
                                                        <NotificationItem key={`pending_lead_${l.id}`} icon={Lightbulb} title={l.name} subtitle="Awaiting Verification" href={`/leads-members/${l.id}/summary`} variant="warning" />
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {((privateCampaigns?.length || 0) + (privateLeads?.length || 0)) > 0 && (
                                            <AccordionItem value="visibility-holds" className="border rounded-xl bg-white shadow-sm border-primary/5 overflow-hidden">
                                                <AccordionTrigger className="px-3 py-2 hover:no-underline font-bold text-[10px] text-primary/60">
                                                    <div className="flex items-center gap-2">
                                                        <FileLock className="h-3.5 w-3.5"/>
                                                        Ready To Publish ({(privateCampaigns?.length || 0) + (privateLeads?.length || 0)})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-1 pb-2">
                                                    {privateCampaigns?.slice(0, 3)?.map(c => (
                                                        <NotificationItem key={`hold_camp_${c.id}`} icon={FolderKanban} title={c.name} subtitle="Internal Draft" href={`/campaign-members/${c.id}/summary`} variant="info" />
                                                    ))}
                                                    {privateLeads?.slice(0, 3)?.map(l => (
                                                        <NotificationItem key={`hold_lead_${l.id}`} icon={Lightbulb} title={l.name} subtitle="Internal Draft" href={`/leads-members/${l.id}/summary`} variant="info" />
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
                    </TabsContent>
                </Tabs>
                
                {totalAlerts > 0 && (
                    <div className="p-3 bg-muted/20 border-t flex justify-center shrink-0">
                        <Button variant="ghost" size="sm" asChild className="h-7 text-[9px] font-black text-primary tracking-tighter hover:bg-primary/5">
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
