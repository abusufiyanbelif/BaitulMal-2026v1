'use client';

import { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, DocumentReference, setDoc, serverTimestamp, collection, deleteField } from 'firebase/firestore';
import Link from 'next/link';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';
import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import type { Donation, Campaign, BrandingSettings, PaymentSettings, Lead, DonationLink, TransactionDetail } from '@/lib/types';
import { DonationForm, type DonationFormData } from '@/components/donation-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Download, Loader2, Image as ImageIcon, FileText, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UnlinkedDonationDetailsPage() {
    const params = useParams();
    const donationId = params.donationId as string;
    const firestore = useFirestore();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const donationDocRef = useMemoFirebase(() => (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, [firestore, donationId]);
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { toast } = useToast();

    const handleFormSubmit = (data: DonationFormData) => {
        if (!firestore || !donation) return;
        const ref = doc(firestore, 'donations', donation.id);
        setDoc(ref, data, { merge: true })
          .catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: data }));
          });
        setIsFormOpen(false);
        toast({ title: "Updated." });
    };

    if (isDonationLoading || isProfileLoading) return <Loader2 className="animate-spin mx-auto mt-20" />;
    if (!donation) return <p className="text-center mt-20">Not found.</p>;

    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6"><Button variant="outline" asChild><Link href="/donations"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button><Button onClick={() => setIsFormOpen(true)}><Edit className="mr-2 h-4 w-4" /> Edit</Button></div>
            <Card><CardHeader><CardTitle>Donation Details</CardTitle></CardHeader><CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Donor</p><p className="font-bold">{donation.donorName}</p></div><div><p className="text-sm text-muted-foreground">Amount</p><p className="font-bold">₹{donation.amount.toFixed(2)}</p></div></div>
                <Separator /><p><strong>Date:</strong> {donation.donationDate}</p><p><strong>Status:</strong> <Badge>{donation.status}</Badge></p>
            </CardContent></Card>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Edit</DialogTitle></DialogHeader><DonationForm donation={donation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} /></DialogContent></Dialog>
        </main>
    );
}
