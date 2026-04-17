'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useCollection, collection, query, where } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    HeartHandshake, 
    CreditCard, 
    Calendar, 
    Download, 
    ShieldCheck, 
    Activity, 
    WalletCards, 
    User,
    ArrowRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Donation } from '@/lib/types';
import { useBranding } from '@/hooks/use-branding';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

/**
 * Donor Portal Page - Self-service dashboard for community supporters.
 */
export default function DonorPortalPage() {
    const { user, userProfile } = useSession();
    const firestore = useFirestore();
    const { brandingSettings } = useBranding();

    const targetDonorId = userProfile?.linkedDonorId || userProfile?.id || user?.uid;

    const donationsRef = useMemoFirebase(() => {
        if (!firestore || !targetDonorId) return null;
        return query(
            collection(firestore, 'donations'),
            where('donorId', '==', targetDonorId),
        );
    }, [firestore, targetDonorId]);

    const { data: donations, isLoading } = useCollection<Donation>(donationsRef);

    if (isLoading || !user) {
         return <BrandedLoader message="Loading Your Impact Records..." />;
    }

    const verifiedDonations = donations?.filter(d => d.status === 'Verified') || [];
    const totalImpactAmount = verifiedDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const pendingDonations = donations?.filter(d => d.status === 'Pending').length || 0;
    
    // Sort donations securely client side
    const sortedDonations = [...(donations || [])].sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());
    
    const latestDonation = sortedDonations.length > 0 ? sortedDonations[0] : null;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20 text-primary font-normal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                        <User className="h-8 w-8 text-primary/60" />
                        My Donor Portal
                    </h1>
                    <p className="text-sm font-normal text-muted-foreground tracking-tight">
                        Welcome back, {userProfile?.name || 'Supporter'}. Below is your cumulative impact via {brandingSettings?.name || 'Our Organization'}.
                    </p>
                </div>
                {brandingSettings?.isDonorSelfRecordPaymentEnabled && (
                    <Button asChild className="font-bold shadow-xl active:scale-95 transition-transform h-12 px-6 rounded-xl">
                        <Link href="/donate">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record A New Donation
                        </Link>
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Impact</CardTitle>
                        <HeartHandshake className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {formatCurrency(totalImpactAmount)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Contributions</CardTitle>
                        <WalletCards className="h-4 w-4 text-primary opacity-60" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {verifiedDonations.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending Verification</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight font-mono">
                            {pendingDonations}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 font-bold tracking-tight">Awaiting Admin Confirmation</p>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-primary tracking-tight truncate">
                            {latestDonation ? formatDate(latestDonation.donationDate, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Activity'}
                        </div>
                        {latestDonation && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-full font-bold">
                                {formatCurrency(latestDonation.amount)} • {latestDonation.status}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xl border-primary/10 bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 border-b px-6 py-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary/60" />
                        Contribution History
                    </CardTitle>
                    <CardDescription className="font-normal text-primary/70">
                        Track Your Secure Record Of Donations And Download Official Receipts.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                     <ScrollArea className="w-full">
                        <div className="min-w-[800px]">
                            <Table>
                                <TableHeader className="bg-primary/[0.02]">
                                    <TableRow className="border-b border-primary/10">
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase pl-6 py-4">Entry Date</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Verified Amount</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Validation Status</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase text-right pr-6">Institutional Receipt</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedDonations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-64 bg-primary/[0.01]">
                                                <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                                                    <WalletCards className="h-16 w-16 text-primary" />
                                                    <p className="font-bold text-sm tracking-widest uppercase italic">No Contributions Logged Yet.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedDonations.map((donation) => (
                                            <TableRow key={donation.id} className="group hover:bg-primary/[0.02] transition-colors border-b border-primary/5 last:border-0 bg-white">
                                                <TableCell className="font-bold text-xs whitespace-nowrap pl-6">
                                                    {formatDate(donation.donationDate, { dateStyle: 'medium' })}
                                                </TableCell>
                                                <TableCell className="font-black text-sm tracking-tight text-primary font-mono">
                                                    {formatCurrency(donation.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[9px] tracking-widest uppercase">
                                                        {donation.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {donation.status === 'Verified' ? (
                                                        <Button variant="ghost" size="sm" className="h-8 font-bold text-primary hover:bg-primary/10 transition-all active:scale-95 rounded-lg" asChild>
                                                            <Link href={`/campaign-public/${donation.linkSplit?.[0]?.linkId?.replace('campaign_', '') || 'general'}/donations/${donation.id}`}>
                                                                <Download className="h-4 w-4 mr-2 opacity-60" />
                                                                Secure Receipt
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-muted-foreground opacity-40 italic flex items-center justify-end gap-1">
                                                            <Activity className="h-3 w-3" /> Awaiting Verification
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" className="h-1.5" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
