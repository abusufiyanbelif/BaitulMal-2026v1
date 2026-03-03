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
import { ArrowLeft, Edit, Download, Loader2, Image as ImageIcon, FileText, Share2, ZoomIn, ZoomOut, RotateCw, RefreshCw, FolderKanban, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandedLoader } from '@/components/branded-loader';
import { ShareDialog } from '@/components/share-dialog';

const DetailItem = ({ label, value, isMono = false }: { label: string; value: React.ReactNode; isMono?: boolean }) => (
    <div className="space-y-1">
        <p className="text-xs font-normal text-muted-foreground">{label}</p>
        <div className={`text-sm font-bold text-primary ${isMono ? 'font-mono' : ''}`}>{value || 'N/A'}</div>
    </div>
);

export default function UnlinkedDonationDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const donationId = params.donationId as string;
    
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const summaryRef = useRef<HTMLDivElement>(null);
    const { download } = useDownloadAs();
    const auth = useAuth();

    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const donationDocRef = useMemoFirebase(() => (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, [firestore, donationId]);
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);

    const allCampaignsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
    const { data: allCampaigns, isLoading: areAllCampaignsLoading } = useCollection<Campaign>(allCampaignsCollectionRef);

    const allLeadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
    const { data: allLeads, isLoading: areAllLeadsLoading } = useCollection<Lead>(allLeadsCollectionRef);

    const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.update;

    const handleFormSubmit = async (data: DonationFormData) => {
        const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
        if (hasFilesToUpload && !auth?.currentUser) {
            toast({
                title: "Authentication error",
                description: "User is not authenticated. Please wait for the session to load or log in again.",
                variant: "destructive",
            });
            return;
        }

        if (!firestore || !storage || !userProfile || !canUpdate || !donation || !allCampaigns || !allLeads) return;

        setIsFormOpen(false);

        const docRef = doc(firestore, 'donations', donation.id);
        
        let finalData: any;

        try {
            const transactionPromises = data.transactions.map(async (transaction) => {
                let screenshotUrl = transaction.screenshotUrl || '';
                // @ts-ignore
                if (transaction.screenshotFile) {
                    const file = (transaction.screenshotFile as FileList)[0];
                    if(file) {
                        const resizedBlob = await new Promise<Blob>((resolve) => {
                            (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                        });
                        const filePath = `donations/${docRef.id}/${data.donationDate}_${transaction.id}.png`;
                        const fileRef = storageRef(storage, filePath);
                        const uploadResult = await uploadBytes(fileRef, resizedBlob);
                        screenshotUrl = await getDownloadURL(uploadResult.ref);
                    }
                }
                return {
                    id: transaction.id,
                    amount: transaction.amount,
                    transactionId: transaction.transactionId || '',
                    date: transaction.date || '',
                    upiId: transaction.upiId || '',
                    screenshotUrl: screenshotUrl,
                    screenshotIsPublic: transaction.screenshotIsPublic || false,
                };
            });

            const finalTransactions = await Promise.all(transactionPromises);
            const { transactions, ...donationData } = data;

            const finalLinkSplit = data.linkSplit?.map(split => {
                if (!split.linkId || split.linkId === 'unlinked') {
                    if (split.amount > 0) {
                        return {
                            linkId: 'unallocated',
                            linkName: 'Unallocated',
                            linkType: 'general' as const,
                            amount: split.amount
                        };
                    }
                    return null;
                }
                const [type, id] = split.linkId.split('_');
                const linkType = type as 'campaign' | 'lead';
                const source = linkType === 'campaign' ? allCampaigns : allLeads;
                const linkedItem = source?.find((item: Campaign | Lead) => item.id === id);

                return {
                    linkId: id,
                    linkName: linkedItem?.name || 'Unknown initiative',
                    linkType: linkType,
                    amount: split.amount
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null && item.amount > 0);

            finalData = {
                ...donationData,
                transactions: finalTransactions,
                amount: finalTransactions.reduce((sum, t) => sum + t.amount, 0),
                linkSplit: finalLinkSplit,
                uploadedBy: userProfile.name,
                uploadedById: userProfile.id,
                campaignId: deleteField(),
                campaignName: deleteField(),
            };

            await setDoc(docRef, finalData, { merge: true });
            toast({ title: 'Success', description: `Donation updated.`, variant: 'success' });
        } catch (error: any) {
            console.error("Error during form submission:", error);
            if (error.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: finalData,
                });
                errorEmitter.emit('permission-error', permissionError);
            } else {
                toast({ title: 'Save failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
            }
        }
    };
    
    const handleShare = () => {
        if (!donation) return;
        setIsShareDialogOpen(true);
    };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, {
            contentRef: summaryRef,
            documentTitle: 'Donation receipt',
            documentName: `donation-receipt-${donationId}`,
            brandingSettings,
            paymentSettings,
        });
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isDonationLoading || areAllCampaignsLoading || areAllLeadsLoading;

    if (isLoading) return <BrandedLoader />;
    
    if (!donation) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <p className="text-lg text-muted-foreground">Donation not found.</p>
                <Button asChild className="mt-4 font-bold"><Link href="/donations"><ArrowLeft className="mr-2 h-4 w-4" /> Back to donations</Link></Button>
            </main>
        );
    }

    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount }] : []);


    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <Button variant="outline" asChild>
                    <Link href="/donations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to donations
                    </Link>
                </Button>
                <div className="flex gap-2">
                    {canUpdate && (
                        <Button onClick={() => setIsFormOpen(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download receipt
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDownload('png')}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                As image (PNG)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')}>
                                <FileText className="mr-2 h-4 w-4" />
                                As PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div ref={summaryRef} className="space-y-6 p-4 bg-background font-normal">
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Donation summary</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <DetailItem label="Total amount" value={`₹${donation.amount.toFixed(2)}`} isMono />
                            <DetailItem label="Donation date" value={donation.donationDate} />
                             {donation.contributionFromDate && donation.contributionToDate && (
                                <DetailItem label="Contribution period" value={`${donation.contributionFromDate} to ${donation.contributionToDate}`} />
                            )}
                            <DetailItem label="Status" value={<Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'secondary'}>{donation.status}</Badge>} />
                            <DetailItem label="Payment type" value={<Badge variant="outline">{donation.donationType}</Badge>} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Donor & receiver</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <DetailItem label="Donor name" value={donation.donorName} />
                            <DetailItem label="Donor phone" value={donation.donorPhone} isMono />
                            <DetailItem label="Receiver name" value={donation.receiverName} />
                            <DetailItem label="Referred by" value={donation.referral} />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><CardTitle>Financial breakdown</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="font-semibold">Category breakdown</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {typeSplit.map((s: { category: string, amount: number }) => (
                                            <TableRow key={s.category}><TableCell>{s.category}</TableCell><TableCell className="text-right font-mono">₹{s.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                         {donation.linkSplit && donation.linkSplit.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold">Initiative allocation</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow><TableHead>Initiative</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.linkSplit.map((link: DonationLink) => (
                                                <TableRow key={link.linkId}>
                                                    <TableCell className="flex items-center gap-2">
                                                        {link.linkType === 'campaign' ? <FolderKanban className="h-4 w-4 text-muted-foreground" /> : <Lightbulb className="h-4 w-4 text-muted-foreground" />}
                                                        {link.linkName}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">₹{link.amount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {donation.transactions && donation.transactions.length > 0 && (
                     <Card>
                        <CardHeader><CardTitle>Transaction details</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Transaction ID</TableHead>
                                        <TableHead>UPI ID</TableHead>
                                        <TableHead>Artifact</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {donation.transactions.map((tx: TransactionDetail) => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="font-mono">₹{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell>{tx.date || 'N/A'}</TableCell>
                                            <TableCell>{tx.transactionId || 'N/A'}</TableCell>
                                            <TableCell>{tx.upiId || 'N/A'}</TableCell>
                                            <TableCell>
                                                {tx.screenshotUrl ? (
                                                     <Button variant="outline" size="sm" asChild>
                                                        <a href={`/api/image-proxy?url=${encodeURIComponent(tx.screenshotUrl)}`} target="_blank" rel="noopener noreferrer">
                                                            <ImageIcon className="mr-2"/> View
                                                        </a>
                                                    </Button>
                                                ) : 'No'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                 {(donation.comments || donation.suggestions) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Additional information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {donation.comments && (
                                <DetailItem label="Comments" value={donation.comments} />
                            )}
                            {donation.suggestions && (
                                <DetailItem label="Suggestions" value={donation.suggestions} />
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
            
            <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={{
                    title: `Thank you for your donation!`,
                    text: `JazakAllah Khair for your generous donation of ₹${donation.amount.toFixed(2)}. May Allah accept it and bless you abundantly.`,
                    url: window.location.href,
                }} 
            />

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit donation</DialogTitle>
                    </DialogHeader>
                    <DonationForm
                        donation={donation}
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                        campaigns={allCampaigns || []}
                        leads={allLeads || []}
                        defaultLinkId={'unlinked'}
                    />
                </DialogContent>
            </Dialog>
        </main>
    );
}
