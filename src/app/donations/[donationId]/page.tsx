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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const DetailItem = ({ label, value, isMono = false }: { label: string; value: React.ReactNode; isMono?: boolean }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`text-sm font-bold text-primary ${isMono ? 'font-mono' : ''}`}>{value || <span className="italic opacity-30">N/A</span>}</div>
    </div>
);

export default function UnlinkedDonationDetailsPage() {
    const params = useParams();
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
            toast({ title: "Authentication Error", description: "Authorization session expired.", variant: "destructive" });
            return;
        }

        if (!firestore || !storage || !userProfile || !canUpdate || !donation || !allCampaigns || !allLeads) return;

        setIsFormOpen(false);
        const docRef = doc(firestore, 'donations', donation.id);
        
        let finalData: any;

        try {
            const transactionPromises = data.transactions.map(async (transaction) => {
                let screenshotUrl = transaction.screenshotUrl || '';
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
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: finalData }));
            } else {
                toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
            }
        }
    };
    
    const handleShare = () => { if (donation) setIsShareDialogOpen(true); };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: 'Donation Receipt', documentName: `donation-receipt-${donationId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isDonationLoading || areAllCampaignsLoading || areAllLeadsLoading;

    if (isLoading) return <BrandedLoader />;
    
    if (!donation) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <p className="text-lg text-primary font-bold opacity-60">Donation Record Not Found.</p>
                <Button asChild className="mt-4 font-bold border-primary/20 text-primary transition-transform active:scale-95" variant="outline"><Link href="/donations"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Registry</Link></Button>
            </main>
        );
    }

    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount }] : []);


    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/donations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Registry
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
                                Download PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')} className="font-normal text-primary">
                                <FileText className="mr-2 h-4 w-4 opacity-60" />
                                Download PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div ref={summaryRef} className="space-y-6 p-4 bg-background font-normal animate-fade-in-up">
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Donation Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <DetailItem label="Total Amount" value={`₹${donation.amount.toFixed(2)}`} isMono />
                            <DetailItem label="Donation Date" value={donation.donationDate} />
                             {donation.contributionFromDate && donation.contributionToDate && (
                                <DetailItem label="Contribution Period" value={`${donation.contributionFromDate} to ${donation.contributionToDate}`} />
                            )}
                            <DetailItem label="Status" value={<Badge variant={donation.status === 'Verified' ? 'eligible' : donation.status === 'Canceled' ? 'given' : 'secondary'} className="font-bold">{donation.status}</Badge>} />
                            <DetailItem label="Payment Method" value={<Badge variant="outline" className="font-bold border-primary/20 text-primary">{donation.donationType}</Badge>} />
                        </CardContent>
                    </Card>
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Donor & Receiver</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <DetailItem label="Donor Name" value={donation.donorName} />
                            <DetailItem label="Donor Phone" value={donation.donorPhone} isMono />
                            <DetailItem label="Receiver Name" value={donation.receiverName} />
                            <DetailItem label="Referred By" value={donation.referral} />
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Institutional Breakdown</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Category Designation</h3>
                            <div className="border border-primary/5 rounded-xl overflow-hidden shadow-inner">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow><TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Category</TableHead><TableHead className="text-right font-bold text-primary text-[9px] uppercase tracking-tighter">Amount</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {typeSplit.map((s: { category: string, amount: number }) => (
                                                <TableRow key={s.category} className="hover:bg-primary/[0.02] border-b border-primary/5"><TableCell className="font-medium text-xs">{s.category}</TableCell><TableCell className="text-right font-bold font-mono text-primary text-xs">₹{s.amount.toFixed(2)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </div>
                         {donation.linkSplit && donation.linkSplit.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Initiative Allocation</h3>
                                <div className="border border-primary/5 rounded-xl overflow-hidden shadow-inner">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader className="bg-primary/5">
                                                <TableRow><TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Initiative</TableHead><TableHead className="text-right font-bold text-primary text-[9px] uppercase tracking-tighter">Amount</TableHead></TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {donation.linkSplit.map((link: DonationLink) => (
                                                    <TableRow key={link.linkId} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                        <TableCell className="flex items-center gap-2 py-2">
                                                            {link.linkType === 'campaign' ? <FolderKanban className="h-3.5 w-3.5 text-primary/40" /> : <Lightbulb className="h-3.5 w-3.5 text-primary/40" />}
                                                            <span className="font-bold text-xs truncate max-w-[150px]">{link.linkName}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-primary text-xs">₹{link.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {donation.transactions && donation.transactions.length > 0 && (
                     <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Transaction Logs</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <div className="border border-primary/5 rounded-xl overflow-hidden shadow-inner">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Amount</TableHead>
                                                <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Date</TableHead>
                                                <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Ref ID</TableHead>
                                                <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Sender UPI</TableHead>
                                                <TableHead className="text-right font-bold text-primary text-[9px] uppercase tracking-tighter pr-6">Evidence</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.transactions.map((tx: TransactionDetail) => (
                                                <TableRow key={tx.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                    <TableCell className="font-bold font-mono text-primary text-xs">₹{tx.amount.toFixed(2)}</TableCell>
                                                    <TableCell className="text-xs font-normal">{tx.date || 'N/A'}</TableCell>
                                                    <TableCell className="text-xs font-mono opacity-60">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="text-xs font-mono opacity-60">{tx.upiId || 'N/A'}</TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        {tx.screenshotUrl ? (
                                                            <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-primary/20 text-primary active:scale-95 transition-transform" onClick={() => handleViewImage(tx.screenshotUrl!, 'Transaction Evidence')}>
                                                                <ImageIcon className="mr-1.5 h-3 w-3"/> View Evidence
                                                            </Button>
                                                        ) : <span className="text-muted-foreground text-[10px] italic">No Artifact</span>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 {(donation.comments || donation.suggestions) && (
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Vetting Observations</CardTitle></CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {donation.comments && (
                                <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Donor Comments</p><p className="text-sm font-normal bg-primary/[0.02] p-4 rounded-lg italic border border-primary/5">"{donation.comments}"</p></div>
                            )}
                            {donation.suggestions && (
                                <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Suggestions</p><p className="text-sm font-normal bg-primary/[0.02] p-4 rounded-lg italic border border-primary/5">"{donation.suggestions}"</p></div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
                    <DialogHeader className="px-6 py-4 bg-primary/5 border-b"><DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase tracking-widest">Edit Donation Hub</DialogTitle></DialogHeader>
                    <ScrollArea className="flex-1 p-6">
                        <DonationForm donation={donation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} campaigns={allCampaigns || []} leads={allLeads || []} defaultLinkId={'unlinked'} />
                    </ScrollArea>
                    <DialogFooter className="px-6 py-4 border-t bg-muted/5"><Button variant="outline" onClick={() => setIsFormOpen(false)} className="font-bold border-primary/20 text-primary">Close Editor</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10 animate-fade-in-zoom">
                    <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="text-sm font-bold text-primary uppercase tracking-widest">Evidence Artifact Viewer</DialogTitle></DialogHeader>
                    <ScrollArea className="flex-1 bg-secondary/20">
                        <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                            {imageToView && (
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Evidence Document" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                            )}
                        </div>
                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                        <Button variant="secondary" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomIn className="mr-1 h-4 w-4"/> Zoom In</Button>
                        <Button variant="secondary" size="sm" onClick={() => setZoom(z => z / 1.2) } className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomOut className="mr-1 h-4 w-4"/> Zoom Out</Button>
                        <Button variant="secondary" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                        <Button variant="secondary" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={{
                    title: `JazakAllah Khair!`,
                    text: `Thank you for your generous contribution of ₹${donation.amount.toFixed(2)}. May Allah accept it and reward you abundantly.`,
                    url: window.location.href,
                }} 
            />
        </main>
    );
}
