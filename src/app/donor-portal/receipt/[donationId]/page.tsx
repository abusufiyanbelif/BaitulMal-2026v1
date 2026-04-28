'use client';

import { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, DocumentReference } from 'firebase/firestore';
import type { Donation } from '@/lib/types';
import { DonationReceipt } from '@/components/donation-receipt';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { useDownloadAs } from '@/hooks/use-download-as';
import { BrandedLoader } from '@/components/branded-loader';

export default function DonorPortalReceiptPage() {
    const params = useParams();
    const router = useRouter();
    const donationId = params.donationId as string;
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const firestore = useFirestore();
    const receiptRef = useRef<HTMLDivElement>(null);
    const { download } = useDownloadAs();

    const donationDocRef = useMemoFirebase(() => 
        (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, 
        [firestore, donationId]
    );
    
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);

    if (isProfileLoading || isDonationLoading) {
        return <BrandedLoader message="Fetching Official Receipt..." />;
    }

    // Security check: Ensure that the logged-in Donor actually owns this donation record.
    const isOwner = userProfile?.id === donation?.donorId || userProfile?.linkedDonorId === donation?.donorId;
    const isStaff = userProfile?.role === 'Admin' || userProfile?.role === 'User';

    if (!donation || (!isOwner && !isStaff)) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <p className="text-lg text-primary font-bold opacity-60">Record Unauthorized or Missing.</p>
                <Button asChild className="mt-4 font-bold border-primary/20 text-primary transition-transform active:scale-95" variant="outline">
                    <Link href="/donor-portal">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back To Portal
                    </Link>
                </Button>
            </main>
        );
    }

    const handleDownload = async () => {
        if (!receiptRef.current) return;
        await download('png', {
            contentRef: receiptRef,
            documentTitle: `Official Donation Receipt`,
            documentName: `Receipt-${donationId}`,
            brandingSettings: null,
            paymentSettings: null
        });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal animate-fade-in-up max-w-2xl">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4 print:hidden">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/donor-portal">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Portal
                    </Link>
                </Button>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handlePrint}
                        className="font-bold border-primary/20 text-primary transition-all active:scale-95 rounded-lg"
                    >
                        <Printer className="h-4 w-4 mr-2 opacity-60" />
                        Print
                    </Button>
                    <Button 
                        onClick={handleDownload}
                        className="font-bold shadow-md bg-primary hover:bg-primary/90 text-white active:scale-95 transition-all rounded-lg"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Download Image
                    </Button>
                </div>
            </div>

            <div className="border border-primary/10 rounded-2xl shadow-xl overflow-hidden bg-white p-4">
                <div ref={receiptRef}>
                    <DonationReceipt donation={donation} />
                </div>
            </div>
        </main>
    );
}
