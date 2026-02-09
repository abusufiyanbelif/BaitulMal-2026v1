

'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, collection, query, where, DocumentReference } from 'firebase/firestore';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import type { Lead, Donation, DonationCategory, Beneficiary } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, LogIn, Share2, Download, Users, Gift, Hourglass } from 'lucide-react';
import { ShareDialog } from '@/components/share-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';


const donationCategoryChartConfig = {
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;


export default function PublicLeadSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });
    const summaryRef = useRef<HTMLDivElement>(null);

    const leadDocRef = useMemo(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);

    const allDonationsCollectionRef = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

    const fundingData = useMemo(() => {
        if (!allDonations || !lead) return null;
        
        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id));
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0
                ? d.typeSplit
                : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    amountsByCategory[category as DonationCategory] += split.amount * allocationProportion;
                }
            });
        });

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const fundingGoal = lead.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
        };
    }, [allDonations, lead]);
    
    const isLoading = isLeadLoading || isBrandingLoading || isPaymentLoading || areDonationsLoading;

    const handleShare = async () => {
        if (!lead || !fundingData) return;
        
        const shareText = `
*Assalamualaikum Warahmatullahi Wabarakatuh*

🙏 *We Need Your Support!* 🙏

We are exploring a new initiative: *${lead.name}*.

*Details:*
${lead.description || 'To support those in need.'}

*Financial Update:*
🎯 Target: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected: ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*

Your support and feedback are valuable.
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Lead: ${lead.name}`,
            text: shareText,
            url: window.location.href,
        };
        
        setShareDialogData(dataToShare);
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
            
            const docTitle = `Lead Summary: ${lead?.name || 'Summary'}`;
            const docName = `lead-summary-${leadId}`;
    
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


    if (isLoading) {
        return (
            <main className="flex items-center justify-center min-h-screen p-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }

    if (!lead || lead.authenticityStatus !== 'Verified' || lead.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This lead could not be found or is not publicly available.</p>
                <Button asChild className="mt-4">
                    <Link href="/leads-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Public Leads
                    </Link>
                </Button>
            </main>
        );
    }
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/leads-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    <h1 className="text-3xl font-bold">{lead.name}</h1>
                    <p className="text-muted-foreground">{lead.status}</p>
                </div>
                 <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDownload('png')}>Download as Image (PNG)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')}>Download as PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={handleShare} variant="outline">
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                </div>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card>
                    <CardHeader>
                        <CardTitle>Lead Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="mt-1 text-sm">{lead.description || 'No description provided.'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p>
                                <p className="mt-1 text-lg font-semibold">₹{(lead.targetAmount ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Category</p>
                                <p className="mt-1 text-lg font-semibold">{lead.category}</p>
                            </div>
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                <p className="mt-1 text-lg font-semibold">{lead.startDate}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                <p className="mt-1 text-lg font-semibold">{lead.endDate}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Funding Progress (for Kits)</CardTitle>
                        <CardDescription>
                            ₹{fundingData?.totalCollectedForGoal.toLocaleString('en-IN') ?? 0} of ₹{(fundingData?.targetAmount ?? 0).toLocaleString('en-IN')} funded from selected donation types.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Progress value={fundingData?.fundingProgress || 0} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>All Donations by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                            <BarChart data={Object.entries(fundingData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                />
                                <YAxis tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="value" radius={4}>
                                    {Object.entries(fundingData?.amountsByCategory || {}).map(([name,]) => (
                                        <Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
             <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={shareDialogData} 
            />
        </main>
    );
}
