'use client';

import { useState, useMemo } from 'react';
import { 
    Bell, 
    IndianRupee, 
    Users, 
    Lightbulb, 
    FolderKanban, 
    ExternalLink,
    AlertCircle
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AlertItemProps {
    icon: any;
    label: string;
    count: number;
    href: string;
    description: string;
}

function AlertItem({ icon: Icon, label, count, href, description }: AlertItemProps) {
    if (count === 0) return null;

    return (
        <Link href={href} className="group flex items-start gap-4 p-3 rounded-lg hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10">
            <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-primary tracking-tight">{label}</p>
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-black">{count}</Badge>
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

    // 1. Pending Donations
    const pendingDonationsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore]);
    const { data: pendingDonations } = useCollection(pendingDonationsQuery);

    // 2. Pending Beneficiaries (Master List)
    const pendingBeneficiariesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'beneficiaries'), where('status', '==', 'Pending')) : null, 
    [firestore]);
    const { data: pendingBeneficiaries } = useCollection(pendingBeneficiariesQuery);

    // 3. Unverified Leads
    const pendingLeadsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'leads'), where('authenticityStatus', '==', 'Pending Verification')) : null, 
    [firestore]);
    const { data: pendingLeads } = useCollection(pendingLeadsQuery);

    // 4. Unverified Campaigns
    const pendingCampaignsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '==', 'Pending Verification')) : null, 
    [firestore]);
    const { data: pendingCampaigns } = useCollection(pendingCampaignsQuery);

    const counts = {
        donations: pendingDonations?.length || 0,
        beneficiaries: pendingBeneficiaries?.length || 0,
        leads: pendingLeads?.length || 0,
        campaigns: pendingCampaigns?.length || 0
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
                        {totalAlerts > 0 && <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary uppercase">Needs Action</Badge>}
                    </div>
                </div>
                
                <ScrollArea className="h-full max-h-[400px]">
                    <div className="p-2 space-y-1">
                        {totalAlerts === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="p-4 rounded-full bg-primary/5 text-primary/20 mb-4">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <p className="text-sm font-bold text-primary tracking-tight">Queue Is Empty</p>
                                <p className="text-[10px] text-muted-foreground font-normal">All Institutional Tasks Are Currently Up To Date.</p>
                            </div>
                        ) : (
                            <>
                                <AlertItem 
                                    icon={IndianRupee} 
                                    label="Pending Donations" 
                                    count={counts.donations} 
                                    href="/donations" 
                                    description="Financial Contributions Awaiting Verification."
                                />
                                <AlertItem 
                                    icon={Users} 
                                    label="Pending Beneficiaries" 
                                    count={counts.beneficiaries} 
                                    href="/beneficiaries" 
                                    description="New Registrations Requiring Document Vetting."
                                />
                                <AlertItem 
                                    icon={Lightbulb} 
                                    label="Unverified Leads" 
                                    count={counts.leads} 
                                    href="/leads-members" 
                                    description="Individual Appeals Awaiting Institutional Vetting."
                                />
                                <AlertItem 
                                    icon={FolderKanban} 
                                    label="Unverified Campaigns" 
                                    count={counts.campaigns} 
                                    href="/campaign-members" 
                                    description="New Initiatives Awaiting Final Approval."
                                />
                            </>
                        )}
                    </div>
                </ScrollArea>
                
                {totalAlerts > 0 && (
                    <div className="p-3 bg-muted/20 border-t flex justify-center">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Showing Active Pending Actions Only</p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
