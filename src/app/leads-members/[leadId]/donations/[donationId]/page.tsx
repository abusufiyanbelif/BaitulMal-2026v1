'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, useStorage, useAuth } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, DocumentReference, setDoc, serverTimestamp, collection, deleteField } from 'firebase/firestore';
import Link from 'next/link';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';
import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import type { Donation, Lead, BrandingSettings, PaymentSettings, Campaign, DonationLink, TransactionDetail } from '@/lib/types';
import { DonationForm, type DonationFormData } from '@/components/donation-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Edit, Download, Loader2, Image as ImageIcon, FileText, Share2, FolderKanban, Lightbulb, ZoomIn, ZoomOut, RotateCw, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { ShareDialog } from '@/components/share-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BrandedLoader } from '@/components/branded-loader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { upsertDonationWithDonorAction } from '@/app/donations/actions';

const DetailItem = ({ label, value, isMono = false }: { label: string; value: React.ReactNode; isMono?: boolean }) => (
    <div className="space-y-1">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`text-sm font-bold text-primary ${isMono ? 'font-mono' : ''}`}>{value || <span className="italic opacity-30">N/A</span>}</div>
    </div>
);

export default function DonationDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.leadId as string;
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

    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const donationDocRef = useMemoFirebase(() => (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, [firestore, donationId]);
    
    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);

    const allCampaignsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
    const { data: allCampaigns, isLoading: areAllCampaignsLoading } = useCollection<Campaign>(allCampaignsCollectionRef);

    const allLeadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
    const { data: allLeads, isLoading: areAllLeadsLoading } = useCollection<Lead>(allLeadsCollectionRef);

    const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.['leads-members']?.donations?.update;

    const handleFormSubmit = async (data: DonationFormData) => {
        const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
        if (hasFilesToUpload && !auth?.currentUser) {
            toast({ title: "Authentication error", description: "User session expired.", variant: "destructive" });
            return;
        }

        if (!firestore || !storage || !userProfile || !canUpdate || !donation || !allCampaigns || !allLeads) return;

        setIsFormOpen(false);

        try {
            const transactionPromises = data.transactions.map(async (transaction) => {
                let screenshotUrl = transaction.screenshotUrl || '';
                if (transaction.screenshotFile) {
                    const file = (transaction.screenshotFile as FileList)[0];
                    if(file) {
                        const resizedBlob = await new Promise<Blob>((resolve) => {
                            (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                        });
                        const filePath = `donations/${donation.id}/${data.donationDate}_${transaction.id}.png`;
                        const fileRef = storageRef(storage, filePath);
                        const uploadResult = await uploadBytes(fileRef, resizedBlob);
                        screenshotUrl = await getDownloadURL(fileRef);
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
            const { transactions, ...donationCoreData } = data;

            const finalLinkSplit = data.linkSplit?.map(split => {
                if (!split.linkId || split.linkId === 'unlinked') {
                    if (split.amount > 0) {
                        return { linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general' as const, amount: split.amount };
                    }
                    return null;
                }
                const [type, id] = split.linkId.split('_');
                const linkType = type as 'campaign' | 'lead';
                const source = linkType === 'campaign' ? allCampaigns : allLeads;
                const linkedItem = source?.find((item: Campaign | Lead) => item.id === id);

                return { linkId: id, linkName: linkedItem?.name || 'Unknown initiative', linkType: linkType, amount: split.amount };
            }).filter((item): item is NonNullable<typeof item> => item !== null && item.amount > 0);

            const processedDonationData = {
                ...donationCoreData,
                transactions: finalTransactions,
                amount: finalTransactions.reduce((sum, t) => sum + t.amount, 0),
                linkSplit: finalLinkSplit,
            };

            const result = await upsertDonationWithDonorAction(
                donation.id,
                processedDonationData as any,
                { id: userProfile.id, name: userProfile.name }
            );

            if (result.success) {
                toast({ title: 'Success', description: result.message, variant: 'success' });
            } else {
                toast({ title: 'Save failed', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Operation Error', description: error.message || 'An Unexpected Error Occurred.', variant: 'destructive' });
        }
    };
    
    const handleShare = () => { if (donation) setIsShareDialogOpen(true); };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: 'Donation receipt', documentName: `donation-receipt-${donationId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isLeadLoading || isDonationLoading || areAllCampaignsLoading || areAllLeadsLoading;

    if (isLoading) return <BrandedLoader />;
    
    if (!donation || !lead) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <p className="text-lg text-muted-foreground">Donation or lead record not found.</p>
                <Button asChild className="mt-4 font-bold"><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to leads</Link></Button>
            </main>
        );
    }

    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount }] : []);

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href={`/leads-members/${leadId}/donations`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to donations
                    </Link>
                </Button>
                <div className="flex gap-2">
                    {canUpdate && (
                        <Button onClick={() => setIsFormOpen(true)} className="font-bold shadow-md active:scale-95 transition-transform">
                            <Edit className="mr-2 h-4 w-4" /> Edit Record
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleShare} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                                <Download className="mr-2 h-4 w-4" />
                                Receipt
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                            <DropdownMenuItem onClick={() => handleDownload('png')} className="font-normal text-primary">
                                <ImageIcon className="mr-2 h-4 w-4 opacity-60" />
                                As image (PNG)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')} className="font-normal text-primary">
                                <FileText className="mr-2 h-4 w-4 opacity-60" />
                                As PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="space-y-6 animate-fade-in-up">
                {!donation.donorId && (
                    <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="font-bold">Identity Mapping Required</AlertTitle>
                        <AlertDescription className="font-normal text-sm flex items-center justify-between">
                            This donation is currently an unlinked "dummy" record. Please map it to a verified Donor Profile.
                            <Button variant="link" asChild className="font-bold text-amber-800 p-0 h-auto underline tracking-tighter">
                                <Link href="/donors">Open Resolver Hub</Link>
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {donation.donorId && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-800 text-xs font-bold animate-fade-in-down">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Institutional Identity Securely Mapped To Registry
                    </div>
                )}

                <div ref={summaryRef} className="space-y-6 bg-white rounded-xl border border-primary/10 overflow-hidden shadow-sm p-4 sm:p-8">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-2">Donation summary</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <DetailItem label="Total amount" value={`₹${donation.amount.toFixed(2)}`} isMono />
                                <DetailItem label="Donation date" value={donation.donationDate} />
                                {donation.contributionFromDate && donation.contributionToDate && (
                                    <div className="sm:col-span-2">
                                        <DetailItem label="Contribution period" value={`${donation.contributionFromDate} to ${donation.contributionToDate}`} />
                                    </div>
                                )}
                                <DetailItem label="Status" value={<Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'secondary'} className="font-bold">{donation.status}</Badge>} />
                                <DetailItem label="Payment method" value={<Badge variant="outline" className="font-bold border-primary/20 text-primary">{donation.donationType}</Badge>} />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary border-b border-primary/10 pb-2">Donor & receiver</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <DetailItem 
                                    label="Donor name" 
                                    value={donation.donorId ? (
                                        <Link href={`/donors/${donation.donorId}`} className="text-primary hover:underline flex items-center gap-2">
                                            {donation.donorName} <ShieldCheck className="h-3 w-3 text-green-600"/>
                                        </Link>
                                    ) : donation.donorName} 
                                />
                                <DetailItem label="Donor phone" value={donation.donorPhone} isMono />
                                <DetailItem label="Receiver name" value={donation.receiverName} />
                                <DetailItem label="Referred by" value={donation.referral} />
                                <div className="sm:col-span-2">
                                    <DetailItem label="Uploaded by" value={donation.uploadedBy} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-2 pt-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Category breakdown</h3>
                            <div className="border border-primary/10 rounded-lg overflow-hidden">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="font-bold text-primary">Category</TableHead>
                                                <TableHead className="text-right font-bold text-primary">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {typeSplit.map((s: { category: string, amount: number }) => (
                                                <TableRow key={s.category}>
                                                    <TableCell className="font-normal">{s.category}</TableCell>
                                                    <TableCell className="text-right font-bold font-mono text-primary">₹{s.amount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Initiative allocation</h3>
                            <div className="border border-primary/10 rounded-lg overflow-hidden">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="font-bold text-primary">Initiative</TableHead>
                                                <TableHead className="text-right font-bold text-primary">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.linkSplit && donation.linkSplit.length > 0 ? donation.linkSplit.map((link: DonationLink) => (
                                                <TableRow key={link.linkId}>
                                                    <TableCell className="flex items-center gap-2 font-normal">
                                                        {link.linkType === 'campaign' ? <FolderKanban className="h-4 w-4 text-muted-foreground" /> : <Lightbulb className="h-4 w-4 text-muted-foreground" />}
                                                        {link.linkName}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold font-mono text-primary">₹{link.amount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic font-normal">No specific allocations / General fund</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    {donation.transactions && donation.transactions.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Transaction records</h3>
                            <div className="border border-primary/10 rounded-lg overflow-hidden">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="font-bold text-primary">Amount</TableHead>
                                                <TableHead className="font-bold text-primary">Date</TableHead>
                                                <TableHead className="font-bold text-primary">Reference ID</TableHead>
                                                <TableHead className="font-bold text-primary">Sender UPI</TableHead>
                                                <TableHead className="text-right font-bold text-primary">Artifact</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.transactions.map((tx: TransactionDetail) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="font-bold font-mono text-primary">₹{tx.amount.toFixed(2)}</TableCell>
                                                    <TableCell className="font-normal">{tx.date || donation.donationDate}</TableCell>
                                                    <TableCell className="font-mono text-xs">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{tx.upiId || 'N/A'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {tx.screenshotUrl ? (
                                                            <Button variant="outline" size="sm" onClick={() => handleViewImage(tx.screenshotUrl!)} className="font-bold border-primary/20 text-primary hover:bg-primary/10 transition-transform active:scale-95">
                                                                <ImageIcon className="mr-2 h-4 w-4"/> View
                                                            </Button>
                                                        ) : <span className="text-muted-foreground text-xs italic">No screenshot</span>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    {(donation.comments || donation.suggestions) && (
                        <div className="grid gap-8 lg:grid-cols-2 pt-4">
                            {donation.comments && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Donor comments</h3>
                                    <p className="text-sm font-normal bg-primary/5 p-4 rounded-lg border border-primary/5 italic">"{donation.comments}"</p>
                                </div>
                            )}
                            {donation.suggestions && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Internal suggestions</h3>
                                    <p className="text-sm font-normal bg-primary/5 p-4 rounded-lg border border-primary/5 italic">"{donation.suggestions}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={{
                    title: `Thank you for your donation!`,
                    text: `JazakAllah Khair for your generous donation of ₹${donation.amount.toFixed(2)} towards the "${lead.name}" initiative. May Allah accept it and bless you abundantly.`,
                    url: `${window.location.origin}/leads-public/${leadId}/summary`
                }} 
            />

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary">Edit donation record</DialogTitle>
                    </DialogHeader>
                    <DonationForm
                        donation={donation}
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                        campaigns={allCampaigns || []}
                        leads={allLeads || []}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary">Artifact viewer</DialogTitle>
                    </DialogHeader>
                    {imageToView && (
                        <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border border-primary/10 rounded-md">
                            <Image
                                src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                                alt="Artifact"
                                fill
                                sizes="100vw"
                                className="object-contain transition-transform duration-200 ease-out origin-center"
                                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                                unoptimized
                            />
                        </div>
                    )}
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-primary border-primary/20"><ZoomIn className="mr-2 h-4 w-4"/> Zoom in</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z / 1.2)} className="font-bold text-primary border-primary/20"><ZoomOut className="mr-2 h-4 w-4"/> Zoom out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-primary border-primary/20"><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-primary border-primary/20"><RefreshCw className="mr-2 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}