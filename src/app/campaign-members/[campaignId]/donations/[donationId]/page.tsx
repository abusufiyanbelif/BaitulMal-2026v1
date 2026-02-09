
'use client';

import { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, DocumentReference, setDoc, serverTimestamp, collection, deleteField } from 'firebase/firestore';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStorage } from '@/firebase';

import { useToast } from '@/hooks/use-toast';

import type { Donation, Campaign, BrandingSettings, PaymentSettings, Lead } from '@/lib/types';

import { DonationForm, type DonationFormData } from '@/components/donation-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Download, Loader2, Image as ImageIcon, FileText, MessageSquare, StickyNote, Share2, FolderKanban, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { ShareDialog } from '@/components/share-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const DetailItem = ({ label, value, isMono = false }: { label: string; value: React.ReactNode; isMono?: boolean }) => (
    <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`text-base font-semibold ${isMono ? 'font-mono' : ''}`}>{value || 'N/A'}</div>
    </div>
);

export default function DonationDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.campaignId as string;
    const donationId = params.donationId as string;
    
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const summaryRef = useRef<HTMLDivElement>(null);

    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    const campaignDocRef = useMemo(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const donationDocRef = useMemo(() => (firestore && donationId) ? doc(firestore, 'donations', donationId) as DocumentReference<Donation> : null, [firestore, donationId]);
    
    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: donation, isLoading: isDonationLoading } = useDoc<Donation>(donationDocRef);

    const allCampaignsCollectionRef = useMemo(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
    const { data: allCampaigns, isLoading: areAllCampaignsLoading } = useCollection<Campaign>(allCampaignsCollectionRef);

    const allLeadsCollectionRef = useMemo(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
    const { data: allLeads, isLoading: areAllLeadsLoading } = useCollection<Lead>(allLeadsCollectionRef);

    const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.donations?.update;

    const handleFormSubmit = async (data: DonationFormData) => {
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
                        const Resizer = (await import('react-image-file-resizer')).default;
                        const resizedBlob = await new Promise<Blob>((resolve) => {
                            Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
                        });
                        const filePath = `donations/${docRef.id}/${transaction.id}.png`;
                        const fileRef = storageRef(storage, filePath);
                        const uploadResult = await uploadBytes(fileRef, resizedBlob);
                        screenshotUrl = await getDownloadURL(uploadResult.ref);
                    }
                }
                return {
                    id: transaction.id,
                    amount: transaction.amount,
                    transactionId: transaction.transactionId || '',
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
                const linkedItem = source?.find(item => item.id === id);

                return {
                    linkId: id,
                    linkName: linkedItem?.name || 'Unknown Initiative',
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
                campaignId: deleteField(), // Ensure legacy fields are removed
                campaignName: deleteField(),
            };

            await setDoc(docRef, finalData, { merge: true });
            toast({ title: 'Success', description: `Donation updated.`, variant: 'success' });
        } catch (error: any) {
            console.warn("Error during form submission:", error);
            if (error.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: finalData,
                });
                errorEmitter.emit('permission-error', permissionError);
            } else {
                toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
            }
        }
    };
    
    const handleShare = () => {
        if (!donation || !campaign) return;
        const shareText = `JazakAllah Khair for your generous donation of ₹${donation.amount.toFixed(2)} towards the "${campaign.name}" campaign. May Allah accept it and bless you abundantly.`;
        setIsShareDialogOpen(true);
    };

    const handleDownload = async (format: 'png' | 'pdf') => {
        const element = summaryRef.current;
        if (!element) {
            toast({ title: 'Error', description: 'Cannot generate download, content is missing.', variant: 'destructive' });
            return;
        }
    
        toast({ title: `Generating ${format.toUpperCase()}...`, description: 'Please wait.' });
    
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
            });
    
            const fetchAsDataURL = async (url: string | null | undefined): Promise<string | null> => {
                if (!url) return null;
                try {
                    const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
                    if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
                    const blob = await response.blob();
                    return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (error) {
                    console.error("Image fetch error:", error);
                    return null;
                }
            };
    
            const [logoDataUrl, qrDataUrl] = await Promise.all([
                fetchAsDataURL(brandingSettings?.logoUrl),
                fetchAsDataURL(paymentSettings?.qrCodeUrl)
            ]);
    
            const logoImg = logoDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = logoDataUrl; }) : null;
            const qrImg = qrDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = qrDataUrl; }) : null;
            
            const docTitle = 'Donation Receipt';
            const docName = `donation-receipt-${donationId}`;
    
            if (format === 'png') {
                const PADDING = 50;
                const HEADER_HEIGHT = 100;
                const FOOTER_HEIGHT = 180;
                const COPYRIGHT_HEIGHT = 40;
                
                const contentCanvas = canvas;
    
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = contentCanvas.width + PADDING * 2;
                finalCanvas.height = contentCanvas.height + HEADER_HEIGHT + FOOTER_HEIGHT + PADDING + COPYRIGHT_HEIGHT;
                const ctx = finalCanvas.getContext('2d')!;
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
                // Header
                let headerTextX = PADDING;
                if (logoImg) {
                    const logoHeight = 80;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    ctx.drawImage(logoImg, PADDING, PADDING / 2, logoWidth, logoHeight);
                    headerTextX = PADDING + logoWidth + 30;
                }
                ctx.fillStyle = 'hsl(var(--foreground))';
                ctx.font = 'bold 32px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', headerTextX, (PADDING / 2) + 45);
    
                // Title
                ctx.font = 'bold 28px sans-serif';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(docTitle, PADDING, HEADER_HEIGHT + PADDING/2);
                
                // Content
                ctx.drawImage(contentCanvas, PADDING, HEADER_HEIGHT + PADDING);
                
                // Watermark
                if (logoImg) {
                    const wmScale = 0.6;
                    const wmWidth = finalCanvas.width * wmScale;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    ctx.globalAlpha = 0.08;
                    ctx.drawImage(logoImg, (finalCanvas.width - wmWidth) / 2, (finalCanvas.height - wmHeight) / 2, wmWidth, wmHeight);
                    ctx.globalAlpha = 1.0;
                }
                
                // Footer
                const footerY = finalCanvas.height - FOOTER_HEIGHT - COPYRIGHT_HEIGHT;
                if (qrImg) {
                    const qrSize = 150;
                    ctx.drawImage(qrImg, finalCanvas.width - PADDING - qrSize, footerY + 15, qrSize, qrSize);
                }
                ctx.fillStyle = 'hsl(var(--foreground))';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText('For Donations & Contact', PADDING, footerY + 30);
                ctx.font = '18px sans-serif';
                let textY = footerY + 65;
                if (paymentSettings?.upiId) { ctx.fillText(`UPI: ${paymentSettings.upiId}`, PADDING, textY); textY += 28; }
                if (paymentSettings?.contactPhone) { ctx.fillText(`Phone: ${paymentSettings.contactPhone}`, PADDING, textY); textY += 28; }
                if (paymentSettings?.website) { ctx.fillText(`Website: ${paymentSettings.website}`, PADDING, textY); textY += 28; }
                if (paymentSettings?.address) { ctx.fillText(paymentSettings.address, PADDING, textY); }
    
                // Copyright
                ctx.textAlign = 'center';
                ctx.font = '14px sans-serif';
                ctx.fillStyle = 'hsl(var(--muted-foreground))';
                ctx.fillText(paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.', finalCanvas.width / 2, finalCanvas.height - 20);
    
                const link = document.createElement('a');
                link.download = `${docName}.png`;
                link.href = finalCanvas.toDataURL('image/png');
                link.click();
            } else { // pdf
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const margin = 15;
                let position = margin;
    
                // Header
                pdf.setTextColor(19, 106, 51); // Dark green color
                if (logoImg && logoDataUrl) {
                    const logoHeight = 20;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoDataUrl, 'PNG', margin, position, logoWidth, logoHeight);
                    pdf.setFontSize(16);
                    const textY = position + (logoHeight / 2) + 3; // Vertically center text with logo
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', margin + logoWidth + 5, textY);
                    position += logoHeight + 10;
                } else {
                    pdf.setFontSize(16);
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', pdfWidth / 2, position, { align: 'center' });
                    position += 15;
                }
    
                // Title
                pdf.setFontSize(18).text(docTitle, pdfWidth / 2, position, { align: 'center' });
                position += 15;
    
                // Watermark
                if (logoImg && logoDataUrl) {
                    pdf.saveGraphicsState();
                    pdf.setGState(new pdf.GState({ opacity: 0.08 }));
                    const wmWidth = pdfWidth * 0.75;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    pdf.addImage(logoDataUrl, 'PNG', (pdfWidth - wmWidth) / 2, (pdfHeight - wmHeight) / 2, wmWidth, wmHeight);
                    pdf.restoreGraphicsState();
                }
    
                // Content
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const contentWidth = pdfWidth - margin * 2;
                const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
                pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
    
                // Footer
                const footerY = pdfHeight - 65;
                pdf.setLineWidth(0.2);
                pdf.line(margin, footerY, pdfWidth - margin, footerY);
                
                const qrSize = 40;
                const qrX = pdfWidth - margin - qrSize;
                if (qrImg && qrDataUrl) {
                    pdf.addImage(qrDataUrl, 'PNG', qrX, footerY + 5, qrSize, qrSize);
                }
                
                pdf.setFontSize(11);
                pdf.setTextColor(19, 106, 51);
                pdf.text('For Donations & Contact', margin, footerY + 12);
                pdf.setFontSize(9);
                pdf.setTextColor(0, 0, 0);
    
                const textBlockWidth = qrImg ? qrX - margin - 5 : pdfWidth - margin * 2;
                let textY = footerY + 18;
                
                const addFooterLine = (label: string, value: string | undefined) => {
                    if (!value) return;
                    const fullText = `${label}: ${value}`;
                    const lines = pdf.splitTextToSize(fullText, textBlockWidth);
                    pdf.text(lines, margin, textY);
                    textY += lines.length * 4;
                };
    
                addFooterLine('UPI', paymentSettings?.upiId);
                addFooterLine('Phone', paymentSettings?.paymentMobileNumber);
                addFooterLine('Email', paymentSettings?.contactEmail);
                addFooterLine('Website', paymentSettings?.website);
                addFooterLine('PAN', paymentSettings?.pan);
                addFooterLine('Reg. No', paymentSettings?.regNo);
                
                if (paymentSettings?.address) {
                     const lines = pdf.splitTextToSize(paymentSettings.address, textBlockWidth);
                     pdf.text(lines, margin, textY);
                }
    
                // Copyright
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.', pdfWidth / 2, pdfHeight - 10, { align: 'center' });
    
                pdf.save(`${docName}.pdf`);
            }
        } catch (error: any) {
            console.error("Download failed:", error);
            const errorMessage = error.message ? `: ${error.message}` : '. Please check console for details.';
            toast({ title: 'Download Failed', description: `Could not generate the file${errorMessage}. This can happen if images are blocked by browser security.`, variant: 'destructive', duration: 9000});
        }
    };

    const isLoading = isProfileLoading || isBrandingLoading || isPaymentLoading || isCampaignLoading || isDonationLoading || areAllCampaignsLoading || areAllLeadsLoading;

    if (isLoading) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }
    
    if (!donation || !campaign) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">Donation or Campaign not found.</p>
                <Button asChild className="mt-4">
                    <Link href="/campaign-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
                    </Link>
                </Button>
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
                    <Link href={`/campaign-members/${campaignId}/donations`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Donations
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
                                Download Receipt
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDownload('png')}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                As Image (PNG)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')}>
                                <FileText className="mr-2 h-4 w-4" />
                                As PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {!userProfile && (
                 <Alert variant="destructive" className="mb-4">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>You are not logged in</AlertTitle>
                    <AlertDescription>
                        You are viewing this as a public user. Some actions may be unavailable.
                    </AlertDescription>
                </Alert>
            )}
            
            <div ref={summaryRef} className="space-y-6 p-4 bg-background animate-fade-in-zoom">
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Donation Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <DetailItem label="Total Amount" value={`₹${donation.amount.toFixed(2)}`} isMono />
                            <DetailItem label="Donation Date" value={donation.donationDate} />
                            <DetailItem label="Status" value={<Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'secondary'}>{donation.status}</Badge>} />
                            <DetailItem label="Payment Type" value={<Badge variant="outline">{donation.donationType}</Badge>} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Donor &amp; Receiver</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <DetailItem label="Donor Name" value={donation.donorName} />
                            <DetailItem label="Donor Phone" value={donation.donorPhone} isMono />
                            <DetailItem label="Receiver Name" value={donation.receiverName} />
                            <DetailItem label="Referred By" value={donation.referral} />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><CardTitle>Financial Breakdown</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="font-semibold">Category Breakdown</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {typeSplit.map((s) => (
                                            <TableRow key={s.category}><TableCell>{s.category}</TableCell><TableCell className="text-right font-mono">₹{s.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                         {donation.linkSplit && donation.linkSplit.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold">Initiative Allocation</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow><TableHead>Initiative</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.linkSplit.map((link) => (
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
                        <CardHeader><CardTitle>Transaction Details</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Transaction ID</TableHead>
                                        <TableHead>Screenshot</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {donation.transactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="font-mono">₹{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell>{tx.transactionId || 'N/A'}</TableCell>
                                            <TableCell>
                                                {tx.screenshotUrl ? (
                                                     <Button variant="outline" size="sm" asChild>
                                                        <a href={tx.screenshotUrl} target="_blank" rel="noopener noreferrer">
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
                            <CardTitle>Additional Information</CardTitle>
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
                    text: `JazakAllah Khair for your generous donation of ₹${donation.amount.toFixed(2)} towards the "${campaign.name}" campaign. May Allah accept it and bless you abundantly.`,
                    url: `${window.location.origin}/campaign-public/${campaignId}/summary`
                }} 
            />

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Donation</DialogTitle>
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
        </main>
    );
}
