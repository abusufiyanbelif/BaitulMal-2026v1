'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useStorage, useAuth } from '@/firebase';
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
import { ArrowLeft, Edit, Download, Loader2, Image as ImageIcon, FileText, Share2, ZoomIn, ZoomOut, RotateCw, RefreshCw, FolderKanban, Lightbulb, AlertCircle, ShieldCheck, DatabaseZap, Clock, History, Calendar } from 'lucide-react';
import { ShareDialog } from '@/components/share-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BrandedLoader } from '@/components/branded-loader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { upsertDonationWithDonorAction } from '../actions';
import { UnlinkedDonationResolver } from '@/components/unlinked-donation-resolver';

const DetailItem = ({ label, value, isMono = false }: { label: string; value: React.ReactNode; isMono?: boolean }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`text-sm font-bold text-primary ${isMono ? 'font-mono' : ''}`}>{value || <span className="italic opacity-30 font-normal">N/A</span>}</div>
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
    const [isResolverOpen, setIsResolverOpen] = useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<{ url: string; title: string } | null>(null);
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
            toast({ title: "Authentication Error", description: "Authorization Session Expired.", variant: "destructive" });
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

                return { linkId: id, linkName: linkedItem?.name || 'Unknown Initiative', linkType: linkType, amount: split.amount };
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
                toast({ title: 'Save Failed', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Operation Error', description: error.message || 'An Unexpected Error Occurred.', variant: 'destructive' });
        }
    };
    
    const handleShare = () => { if (donation) setIsShareDialogOpen(true); };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: 'Donation Receipt', documentName: `donation-receipt-${donationId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string, title: string = 'Evidence Artifact') => {
        setImageToView({ url, title });
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isDonationLoading || areAllCampaignsLoading || areAllLeadsLoading;

    if (isLoading) return <BrandedLoader />;
    
    if (!donation) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <p className="text-lg text-primary font-bold opacity-60">Sorry, Record Not Found.</p>
                <Button asChild className="mt-4 font-bold border-primary/20 text-primary transition-transform active:scale-95" variant="outline"><Link href="/donations"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Registry</Link></Button>
            </main>
        );
    }

    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount }] : []);


    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal animate-fade-in-up">
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
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download Receipt
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

            <div className="space-y-6">
                {!donation.donorId && (
                    <Alert className="bg-amber-50 border-amber-200 text-amber-800 animate-fade-in-down">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="font-bold">Identity Mapping Required</AlertTitle>
                        <AlertDescription className="font-normal text-sm flex items-center justify-between gap-4 flex-wrap">
                            This Donation Is Currently An Unlinked Record. Please Map It To A Verified Profile.
                            <Button onClick={() => setIsResolverOpen(true)} variant="secondary" size="sm" className="font-bold bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-transform shrink-0 shadow-sm">
                                <DatabaseZap className="mr-2 h-4 w-4"/> Resolve Identity Now
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {donation.donorId && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-800 text-xs font-bold animate-fade-in-down">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Donor Identity Successfully Mapped To Registry.
                    </div>
                )}

                <div ref={summaryRef} className="space-y-6">
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                        <div className="lg:col-span-8 space-y-6">
                            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Donation Summary</CardTitle></CardHeader>
                                <CardContent className="grid gap-6 sm:grid-cols-2 pt-6">
                                    <DetailItem label="Total Amount" value={`₹${donation.amount.toFixed(2)}`} isMono />
                                    <DetailItem label="Donation Date" value={donation.donationDate} />
                                    <DetailItem label="Status" value={<Badge variant={donation.status === 'Verified' ? 'eligible' : donation.status === 'Canceled' ? 'given' : 'secondary'} className="font-bold">{donation.status}</Badge>} />
                                    <DetailItem label="Payment Method" value={<Badge variant="outline" className="font-bold border-primary/20 text-primary">{donation.donationType}</Badge>} />
                                </CardContent>
                            </Card>

                            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Allocation Breakdown</CardTitle></CardHeader>
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
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Initiative Allocation</h3>
                                        <div className="border border-primary/5 rounded-xl overflow-hidden shadow-inner">
                                            <ScrollArea className="w-full">
                                                <Table>
                                                    <TableHeader className="bg-primary/5">
                                                        <TableRow><TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Initiative</TableHead><TableHead className="text-right font-bold text-primary text-[9px] uppercase tracking-tighter">Amount</TableHead></TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {donation.linkSplit && donation.linkSplit.length > 0 ? donation.linkSplit.map((link: DonationLink) => (
                                                            <TableRow key={link.linkId} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                                <TableCell className="flex items-center gap-2 py-2">
                                                                    {link.linkType === 'campaign' ? <FolderKanban className="h-3.5 w-3.5 text-primary/40" /> : <Lightbulb className="h-3.5 w-3.5 text-primary/40" />}
                                                                    <span className="font-bold text-xs truncate max-w-[150px]">{link.linkName}</span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono text-primary text-xs">₹{link.amount.toFixed(2)}</TableCell>
                                                            </TableRow>
                                                        )) : (
                                                            <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6 italic text-xs font-normal">Unallocated General Fund</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                                <ScrollBar orientation="horizontal" />
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Identity Hub</CardTitle></CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <DetailItem 
                                        label="Donor Profile" 
                                        value={donation.donorId ? (
                                            <Link href={`/donors/${donation.donorId}`} className="text-primary hover:underline flex items-center gap-2">
                                                {donation.donorName} <ShieldCheck className="h-3 w-3 text-green-600"/>
                                            </Link>
                                        ) : donation.donorName} 
                                    />
                                    <DetailItem label="Contact Identity" value={donation.donorPhone} isMono />
                                    <DetailItem label="Receiving Agent" value={donation.receiverName} />
                                    <DetailItem label="Referral Logic" value={donation.referral} />
                                </CardContent>
                            </Card>

                            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 tracking-tight uppercase"><History className="h-4 w-4 opacity-40"/> Organization Audit History</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-1.5 rounded bg-primary/5 text-primary"><Clock className="h-3.5 w-3.5"/></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Registry Entry Secured</p>
                                            <p className="text-xs font-bold text-primary">{donation.uploadedBy}</p>
                                            <p className="text-[9px] font-mono opacity-60">ID: {donation.uploadedById}</p>
                                        </div>
                                    </div>
                                    {donation.createdAt && (
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 p-1.5 rounded bg-primary/5 text-primary"><Calendar className="h-3.5 w-3.5"/></div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Creation Timestamp</p>
                                                <p className="text-xs font-bold text-primary">{(donation.createdAt as any).toDate?.().toLocaleString() || new Date(donation.createdAt as any).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {donation.transactions && donation.transactions.length > 0 && (
                        <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Verified Transaction Logs</CardTitle></CardHeader>
                            <CardContent className="pt-6">
                                <div className="border border-primary/5 rounded-xl overflow-hidden shadow-inner">
                                    <ScrollArea className="w-full">
                                        <div className="min-w-[800px]">
                                            <Table>
                                                <TableHeader className="bg-primary/5">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Transaction Value</TableHead>
                                                        <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Reference ID</TableHead>
                                                        <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Date Record</TableHead>
                                                        <TableHead className="font-bold text-primary text-[9px] uppercase tracking-tighter">Sender UPI</TableHead>
                                                        <TableHead className="text-right font-bold text-primary text-[9px] uppercase tracking-tighter pr-6">Validation Artifact</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {donation.transactions.map((tx: TransactionDetail) => (
                                                        <TableRow key={tx.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                            <TableCell className="font-bold font-mono text-primary text-xs">₹{tx.amount.toFixed(2)}</TableCell>
                                                            <TableCell className="text-xs font-mono opacity-60">{tx.transactionId || 'N/A'}</TableCell>
                                                            <TableCell className="text-xs font-normal">{tx.date || donation.donationDate}</TableCell>
                                                            <TableCell className="text-xs font-mono opacity-60">{tx.upiId || 'N/A'}</TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                {tx.screenshotUrl ? (
                                                                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-primary/20 text-primary active:scale-95 transition-transform" onClick={() => handleViewImage(tx.screenshotUrl!, 'Transaction Evidence')}>
                                                                        <ImageIcon className="mr-1.5 h-3 w-3"/> View Evidence
                                                                    </Button>
                                                                ) : <span className="text-muted-foreground text-[10px] italic">No Artifact Attached</span>}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(donation.comments || donation.suggestions) && (
                        <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg font-bold tracking-tight text-primary">Organizational Observations</CardTitle></CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                {donation.comments && (
                                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Donor Remarks</p><p className="text-sm font-normal bg-primary/[0.02] p-4 rounded-lg italic border border-primary/5 leading-relaxed">"{donation.comments}"</p></div>
                                )}
                                {donation.suggestions && (
                                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Member Insights</p><p className="text-sm font-normal bg-primary/[0.02] p-4 rounded-lg italic border border-primary/5 leading-relaxed">"{donation.suggestions}"</p></div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
                    <DialogHeader className="px-6 py-4 bg-primary/5 border-b shrink-0"><DialogTitle className="text-xl font-bold text-primary tracking-tight">Modify Donation Record</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-hidden relative">
                        <DonationForm donation={donation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} campaigns={allCampaigns || []} leads={allLeads || []} defaultLinkId={'unlinked'} />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 rounded-[12px] border-primary/10 overflow-hidden shadow-2xl animate-fade-in-zoom">
                    <DialogHeader className="px-6 py-4 bg-primary/5 border-b">
                        <DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase tracking-widest">{imageToView ? imageToView.title : 'Artifact Viewer'}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 bg-secondary/20">
                        <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                            {imageToView && (
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Evidence Document" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                            )}
                        </div>
                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white flex">
                        <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomIn className="mr-1 h-4 w-4"/> Zoom In</Button>
                        <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5)) } className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomOut className="mr-1 h-4 w-4"/> Zoom Out</Button>
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
                    url: typeof window !== 'undefined' ? window.location.href : '',
                }} 
            />
            <UnlinkedDonationResolver open={isResolverOpen} onOpenChange={setIsResolverOpen} initialDonationId={donationId} />
        </main>
    );
}