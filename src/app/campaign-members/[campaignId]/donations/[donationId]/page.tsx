
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
                        const { default: Resizer } = await import('react-image-file-resizer');
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

            if (format === 'png') {
                const PADDING = 40;
                const HEADER_HEIGHT = 100;
                const FOOTER_HEIGHT = 180;
                const COPYRIGHT_HEIGHT = 30;
                
                const finalCanvas = document.createElement('canvas');
                const contentWidth = canvas.width;
                const contentHeight = canvas.height;

                finalCanvas.width = 1240;
                finalCanvas.height = contentHeight + HEADER_HEIGHT + FOOTER_HEIGHT + PADDING * 2 + COPYRIGHT_HEIGHT;
                const ctx = finalCanvas.getContext('2d')!;
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                if (logoImg) {
                    const logoHeight = 80;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    ctx.drawImage(logoImg, PADDING, PADDING, logoWidth, logoHeight);
                }
                
                ctx.fillStyle = 'rgb(19, 106, 51)';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', PADDING + (logoImg ? 90 : 0), PADDING + 50);

                ctx.drawImage(canvas, (finalCanvas.width - contentWidth) / 2, PADDING + HEADER_HEIGHT);
                
                const footerY = finalCanvas.height - FOOTER_HEIGHT - PADDING - COPYRIGHT_HEIGHT;
                if (qrImg) {
                    const qrSize = 200;
                    ctx.drawImage(qrImg, finalCanvas.width - PADDING - qrSize, footerY, qrSize, qrSize);
                }
                ctx.fillStyle = 'rgb(19, 106, 51)';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText('For Donations & Contact', PADDING, footerY + 25);
                ctx.font = '16px sans-serif';
                let textY = footerY + 50;
                if (paymentSettings?.upiId) { ctx.fillText(`UPI: ${paymentSettings.upiId}`, PADDING, textY); textY += 24; }
                if (paymentSettings?.paymentMobileNumber) { ctx.fillText(`Phone: ${paymentSettings.paymentMobileNumber}`, PADDING, textY); textY += 24; }
                if (paymentSettings?.contactEmail) { ctx.fillText(`Email: ${paymentSettings.contactEmail}`, PADDING, textY); textY += 24; }
                if (paymentSettings?.website) { ctx.fillText(`Website: ${paymentSettings.website}`, PADDING, textY); textY += 24; }
                if (paymentSettings?.address) { ctx.fillText(paymentSettings.address, PADDING, textY); }

                if (logoImg) {
                    const wmScale = 0.8;
                    const wmWidth = finalCanvas.width * wmScale;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    ctx.globalAlpha = 0.1;
                    ctx.drawImage(logoImg, (finalCanvas.width - wmWidth) / 2, (finalCanvas.height - wmHeight) / 2, wmWidth, wmHeight);
                    ctx.globalAlpha = 1.0;
                }
                
                ctx.textAlign = 'center';
                ctx.font = '14px sans-serif';
                ctx.fillStyle = 'hsl(var(--muted-foreground))';
                ctx.fillText(paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.', finalCanvas.width / 2, finalCanvas.height - 15);

                const link = document.createElement('a');
                link.download = `donation-receipt-${donationId}.png`;
                link.href = finalCanvas.toDataURL('image/png');
                link.click();
            } else { // PDF
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const pageCenter = pdfWidth / 2;
                let position = 15;

                pdf.setTextColor(19, 106, 51);

                if (logoImg && logoDataUrl) {
                    const logoHeight = 20;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoDataUrl, 'PNG', 15, position, logoWidth, logoHeight);
                    pdf.setFontSize(14);
                    const textY = position + (logoHeight / 2) + 3;
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', 15 + logoWidth + 5, textY);
                    position += logoHeight + 10;
                } else {
                    pdf.setFontSize(14);
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', pageCenter, position, { align: 'center' });
                    position += 15;
                }
                
                pdf.setFontSize(16).text('Donation Receipt', pageCenter, position, { align: 'center' });
                position += 15;

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);

                const footerHeight = 75;
                const availableHeight = pageHeight - position - footerHeight;

                let imgWidth = pdfWidth - 30;
                let imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                if (imgHeight > availableHeight) {
                    imgHeight = availableHeight;
                    imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                }

                const xOffset = (pdfWidth - imgWidth) / 2;
                pdf.addImage(imgData, 'PNG', xOffset, position, imgWidth, imgHeight);
                
                if (logoImg && logoDataUrl) {
                    pdf.saveGraphicsState();
                    pdf.setGState(new pdf.GState({ opacity: 0.1 }));
                    const wmWidth = pdfWidth * 0.75;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    pdf.addImage(logoDataUrl, 'PNG', (pdfWidth - wmWidth) / 2, (pageHeight - wmHeight) / 2, wmWidth, wmHeight);
                    pdf.restoreGraphicsState();
                }

                position = pageHeight - footerHeight;
                
                pdf.setLineWidth(0.2);
                pdf.line(15, position, pdfWidth - 15, position);
                position += 8;
                
                pdf.setFontSize(12);
                pdf.text('For Donations & Contact', 15, position);
                let textY = position + 8;
                pdf.setFontSize(10);

                if (qrImg && qrDataUrl) {
                    const qrSize = 40;
                    const qrX = pdfWidth - 15 - qrSize;
                    pdf.addImage(qrDataUrl!, 'PNG', qrX, position, qrSize, qrSize);
                }
                
                if (paymentSettings?.upiId) { pdf.text(`UPI: ${paymentSettings.upiId}`, 15, textY); textY += 6; }
                if (paymentSettings?.paymentMobileNumber) { pdf.text(`Phone: ${paymentSettings.paymentMobileNumber}`, 15, textY); textY += 6; }
                if (paymentSettings?.contactEmail) { pdf.text(`Email: ${paymentSettings.contactEmail}`, 15, textY); textY += 6; }
                if (paymentSettings?.website) { pdf.text(`Website: ${paymentSettings.website}`, 15, textY); textY += 6; }
                if (paymentSettings?.address) {
                    const addressLines = pdf.splitTextToSize(paymentSettings.address, pdfWidth / 2 - 30);
                    pdf.text(addressLines, 15, textY);
                }
                
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128); // a gray color
                pdf.text(
                    paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.',
                    pageCenter,
                    pageHeight - 10,
                    { align: 'center' }
                );

                pdf.save(`donation-receipt-${donationId}.pdf`);
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
            
            <div ref={summaryRef} className="space-y-6 animate-fade-in-zoom">
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
                                <DetailItem icon={<MessageSquare/>} label="Comments" value={donation.comments} />
                            )}
                            {donation.suggestions && (
                                <DetailItem icon={<StickyNote/>} label="Suggestions" value={donation.suggestions} />
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
