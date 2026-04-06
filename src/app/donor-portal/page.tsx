'use client';

import { useSession } from '@/hooks/use-session';
import { useFirestore, useMemoFirebase, useCollection, collection, query, where, orderBy } from '@/firebase';
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
         return <BrandedLoader message="Loading your impact..." />;
    }

    const verifiedDonations = donations?.filter(d => d.status === 'Verified') || [];
    const totalImpactAmount = verifiedDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const pendingDonations = donations?.filter(d => d.status === 'Pending') || [];
    
    // Sort donations securely client side since we might not have the composite index for (donorId, date) deployed
    const sortedDonations = [...(donations || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const latestDonation = sortedDonations.length > 0 ? sortedDonations[0] : null;

    return (
        <div className="space-y-8 animate-fade-in-up pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                        <User className="h-8 w-8 text-primary/60" />
                        My Donor Portal
                    </h1>
                    <p className="text-sm font-normal text-muted-foreground mt-1 tracking-tight">
                        Welcome back, {userProfile?.name || 'Supporter'}. Below is your lifetime impact via {brandingSettings?.name || 'Our Organization'}.
                    </p>
                </div>
                {brandingSettings?.isDonorSelfRecordPaymentEnabled && (
                    <Button asChild className="font-bold shadow-xl active:scale-95 transition-transform h-12 px-6">
                        <Link href="/public-donation">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record a New Donation
                        </Link>
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-lg border-primary/10 overflow-hidden relative group">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground">Total Verified Impact</CardTitle>
                        <HeartHandshake className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight">
                            {formatCurrency(totalImpactAmount)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground">Total Contributions</CardTitle>
                        <WalletCards className="h-4 w-4 text-primary opacity-60" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight">
                            {verifiedDonations.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground">Pending Verifications</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary tracking-tight">
                            {pendingDonations.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Pending admin confirmation</p>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-primary/10 overflow-hidden relative group">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground">Latest Activity</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-primary tracking-tight truncate">
                            {latestDonation ? formatDate(latestDonation.date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Activity'}
                        </div>
                        {latestDonation && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-full">
                                {formatCurrency(latestDonation.amount)} • {latestDonation.purpose}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xl border-primary/10 bg-white">
                <CardHeader>
                    <CardTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary/60" />
                        Complete Donation History
                    </CardTitle>
                    <CardDescription>
                        Track your pledges and download official receipts for your tax records.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6 pb-6">
                     <div className="rounded-md border border-primary/5 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-primary/5 border-b border-primary/10">
                                <TableRow>
                                    <TableHead className="font-bold text-xs">Date</TableHead>
                                    <TableHead className="font-bold text-xs">Amount</TableHead>
                                    <TableHead className="font-bold text-xs hidden md:table-cell">Purpose / Cause</TableHead>
                                    <TableHead className="font-bold text-xs">Status</TableHead>
                                    <TableHead className="font-bold text-xs text-right">Receipt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDonations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center space-y-4 opacity-50">
                                                <WalletCards className="h-12 w-12 text-primary" />
                                                <p className="font-bold text-primary">No donations found.</p>
                                                {brandingSettings?.isDonorSelfRecordPaymentEnabled && (
                                                    <Button asChild variant="outline" size="sm" className="font-bold mt-2">
                                                        <Link href="/public-donation">Record First Donation <ArrowRight className="ml-2 w-3 h-3"/></Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedDonations.map((donation) => (
                                        <TableRow key={donation.id} className="group hover:bg-primary/5 transition-colors">
                                            <TableCell className="font-bold text-xs whitespace-nowrap">
                                                {formatDate(donation.date, { dateStyle: 'medium' })}
                                            </TableCell>
                                            <TableCell className="font-black text-sm tracking-tight text-primary">
                                                {formatCurrency(donation.amount)}
                                            </TableCell>
                                            <TableCell className="font-normal text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">
                                                {donation.purpose || donation.category}
                                                {donation.paymentMethod && <span className="block text-[10px] opacity-60">via {donation.paymentMethod}</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={
                                                        donation.status === 'Verified' ? 'success' : 
                                                        donation.status === 'Rejected' ? 'destructive' : 'outline'
                                                    }
                                                    className="font-bold text-[10px] tracking-widest uppercase"
                                                >
                                                    {donation.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {donation.status === 'Verified' && donation.receiptUrl ? (
                                                    <Button variant="ghost" size="sm" className="h-8 font-bold whitespace-nowrap text-primary hover:text-primary transition-all active:scale-95" asChild>
                                                        <a href={donation.receiptUrl} target="_blank" rel="noopener noreferrer">
                                                            <Download className="h-4 w-4 sm:mr-2" />
                                                            <span className="hidden sm:inline">Receipt</span>
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-muted-foreground opacity-50 italic pr-4">Unavailable</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
