'use client';

import { useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, DocumentReference } from 'firebase/firestore';
import Link from 'next/link';
import { useDownloadAs } from '@/hooks/use-download-as';
import type { Donation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Share2 } from 'lucide-react';
import { BrandedLoader } from '@/components/branded-loader';
import { DonationReceipt } from '@/components/donation-receipt';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function DonorReceiptPage() {
    const params = useParams();
    const donationId = params.donationId as string;
    const firestore = useFirestore();
    const receiptRef = useRef<HTMLDivElement>(null);
    const { download } = useDownloadAs();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();

    const donationDocRef = useMemoFirebase(() => (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, [firestore, donationId]);
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { 
            contentRef: receiptRef, 
            documentTitle: 'Donation Receipt', 
            documentName: `receipt-${donationId}`, 
            brandingSettings, 
            paymentSettings,
            skipLayout: true
        });
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isDonationLoading;

    if (isLoading) return <BrandedLoader message="Preparing Your Official Receipt..." />;

    if (!donation) {
        return (
            <main className="container mx-auto p-8 text-center">
                <Card className="p-12 border-none shadow-2xl bg-white rounded-3xl">
                    <p className="text-xl font-black text-slate-400 uppercase tracking-widest">Receipt Not Found</p>
                    <p className="text-slate-500 mt-2">The requested donation record could not be located in our registry.</p>
                    <Button asChild className="mt-8 font-black uppercase tracking-widest text-xs h-12 px-8 rounded-2xl" variant="outline">
                        <Link href="/donor-portal/donations"><ArrowLeft className="mr-2 h-4 w-4" /> Back to History</Link>
                    </Button>
                </Card>
            </main>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5">
                        <Link href="/donor-portal/donations"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Official Certificate</h1>
                        <p className="text-slate-500 text-sm font-medium">Verify and download your contribution evidence.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="font-bold border-slate-200 rounded-xl h-12 px-6 text-primary">
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="font-bold shadow-lg shadow-primary/20 rounded-xl h-12 px-6">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-slate-100 shadow-dropdown p-2 w-48">
                            <DropdownMenuItem onClick={() => handleDownload('png')} className="font-bold text-xs p-3 rounded-xl cursor-pointer">
                                <ImageIcon className="mr-3 h-4 w-4 opacity-40" />
                                Download PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')} className="font-bold text-xs p-3 rounded-xl cursor-pointer">
                                <FileText className="mr-3 h-4 w-4 opacity-40" />
                                Download PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex justify-center bg-slate-50/50 p-4 md:p-12 rounded-[40px] border border-slate-100 shadow-inner">
                <div className="w-full max-w-2xl bg-white shadow-2xl rounded-2xl overflow-hidden ring-1 ring-slate-200">
                    <DonationReceipt ref={receiptRef} donation={donation} brandingSettings={brandingSettings} paymentSettings={paymentSettings} />
                </div>
            </div>

            <div className="max-w-2xl mx-auto text-center space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Institutional Authentication</p>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    This document serves as an official acknowledgment of your contribution. 
                    It is electronically generated and verified by our institutional audit systems. 
                    For any discrepancies, please contact our support desk with the Donation ID.
                </p>
            </div>
        </main>
    );
}
