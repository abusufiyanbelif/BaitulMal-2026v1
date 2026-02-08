

'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, collection, query, where, DocumentReference } from 'firebase/firestore';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, LogIn, Share2, Download, Hourglass, Wallet, Users, Gift } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories } from '@/lib/modules';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
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


export default function PublicCampaignSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const summaryRef = useRef<HTMLDivElement>(null);

    // Data fetching
    const campaignDocRef = useMemo(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemo(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    
    const allDonationsCollectionRef = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const fundingData = useMemo(() => {
        if (!allDonations || !campaign) return null;

        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === campaign.id));
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            const campaignAllocation = d.linkSplit?.find(link => link.linkId === campaign.id);
            if (!campaignAllocation) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = campaignAllocation.amount / totalDonationAmount;

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
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: campaign.targetAmount || 0,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
        };
    }, [allDonations, campaign]);

    const beneficiaryData = useMemo(() => {
        if (!beneficiaries) return null;

        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const key = ben.members || 0;
            if (!acc[key]) {
                acc[key] = { beneficiaries: [], totalAmount: 0 };
            }
            acc[key].beneficiaries.push(ben);
            acc[key].totalAmount += ben.kitAmount || 0;
            return acc;
        }, {} as Record<number, { beneficiaries: Beneficiary[], totalAmount: number }>);
        
        const sortedBeneficiaryCategories = Object.keys(beneficiariesByCategory).map(Number).sort((a, b) => b - a);

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
        return {
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            beneficiariesByCategory,
            sortedBeneficiaryCategories,
        }
    }, [beneficiaries]);

    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!campaign || !fundingData) {
            toast({
                title: 'Error',
                description: 'Cannot share, summary data is not available.',
                variant: 'destructive',
            });
            return;
        }

        const shareText = `
*Assalamualaikum Warahmatullahi Wabarakatuh*

🙏 *We Need Your Support!* 🙏

Join us for the *${campaign.name}* campaign as we work to provide essential aid to our community.

*Our Goal:*
${campaign.description || 'To support those in need.'}

*Financial Update:*
🎯 Target for Kits: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*

Your contribution, big or small, makes a huge difference.

*Please donate and share this message.*
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Campaign Summary: ${campaign.name}`,
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
                backgroundColor: null
            });

            const fetchAsDataURL = async (url: string | null): Promise<string | null> => {
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
                fetchAsDataURL(brandingSettings?.logoUrl || null),
                fetchAsDataURL(paymentSettings?.qrCodeUrl || null)
            ]);

            const logoImg = logoDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = logoDataUrl; }) : null;
            const qrImg = qrDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = qrDataUrl; }) : null;
            
            if (format === 'png') {
                const PADDING = 40;
                const HEADER_HEIGHT = 100;
                const FOOTER_HEIGHT = 180;
                
                const contentCanvas = canvas;

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = contentCanvas.width + PADDING * 2;
                finalCanvas.height = contentCanvas.height + HEADER_HEIGHT + FOOTER_HEIGHT + PADDING;
                const ctx = finalCanvas.getContext('2d')!;
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                let headerTextX = PADDING;
                if (logoImg) {
                    const logoHeight = 80;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    ctx.drawImage(logoImg, PADDING, PADDING / 2, logoWidth, logoHeight);
                    headerTextX = PADDING + logoWidth + 20;
                }

                ctx.fillStyle = 'rgb(19, 106, 51)';
                ctx.font = 'bold 22px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', headerTextX, (PADDING / 2) + 40);

                ctx.font = 'bold 20px sans-serif';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(campaign?.name || 'Campaign Summary', PADDING, HEADER_HEIGHT);
                
                ctx.drawImage(contentCanvas, PADDING, HEADER_HEIGHT + (PADDING/2));
                
                const footerY = finalCanvas.height - FOOTER_HEIGHT;
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
                if (paymentSettings?.contactPhone) { ctx.fillText(`Phone: ${paymentSettings.contactPhone}`, PADDING, textY); textY += 24; }
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

                const link = document.createElement('a');
                link.download = `campaign-summary-${campaignId}.png`;
                link.href = finalCanvas.toDataURL('image/png');
                link.click();
            } else { // pdf
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const pageCenter = pdfWidth / 2;
                const footerHeight = 60;
                let position = 15;

                pdf.setTextColor(19, 106, 51);

                // Header with Logo and Org Name
                if (logoImg && logoDataUrl) {
                    const logoHeight = 15;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoDataUrl, 'PNG', 15, position, logoWidth, logoHeight);
                    pdf.setFontSize(18);
                    const textY = position + (logoHeight / 2) + 3;
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', 15 + logoWidth + 5, textY);
                    position += logoHeight + 10;
                } else {
                    pdf.setFontSize(18);
                    pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', pageCenter, position, { align: 'center' });
                    position += 15;
                }
                
                // Document Title
                pdf.setFontSize(22).text(campaign?.name || 'Campaign Summary', pageCenter, position, { align: 'center' });
                position += 15;

                const imgData = canvas.toDataURL('image/png');
                const contentHeight = (canvas.height * (pdfWidth - 20)) / canvas.width;
                
                if (position + contentHeight > pageHeight - footerHeight) {
                     pdf.addPage();
                     position = 15;
                }
                
                pdf.addImage(imgData, 'PNG', 10, position, pdfWidth - 20, contentHeight);

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
                let textY = position + 6;
                pdf.setFontSize(9);
                
                if (qrImg && qrDataUrl) {
                    const qrSize = 30;
                    const qrX = pdfWidth - 15 - qrSize;
                    pdf.addImage(qrDataUrl!, 'PNG', qrX, position - 2, qrSize, qrSize);
                }
                
                if (paymentSettings?.upiId) { pdf.text(`UPI: ${paymentSettings.upiId}`, 15, textY); textY += 5; }
                if (paymentSettings?.paymentMobileNumber) { pdf.text(`Phone: ${paymentSettings.paymentMobileNumber}`, 15, textY); textY += 5; }
                if (paymentSettings?.contactEmail) { pdf.text(`Email: ${paymentSettings.contactEmail}`, 15, textY); textY += 5; }
                if (paymentSettings?.website) { pdf.text(`Website: ${paymentSettings.website}`, 15, textY); textY += 5; }
                if (paymentSettings?.pan) { pdf.text(`PAN: ${paymentSettings.pan}`, 15, textY); textY += 5; }
                if (paymentSettings?.regNo) { pdf.text(`Reg No: ${paymentSettings.regNo}`, 15, textY); textY += 5; }
                if (paymentSettings?.address) {
                    const addressLines = pdf.splitTextToSize(paymentSettings.address, pdfWidth - 30 - 40);
                    pdf.text(addressLines, 15, textY);
                }
                
                pdf.save(`campaign-summary-${campaignId}.pdf`);
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

    if (!campaign || campaign.authenticityStatus !== 'Verified' || campaign.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This campaign could not be found or is not publicly available.</p>
                <Button asChild className="mt-4">
                    <Link href="/campaign-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Public Campaigns
                    </Link>
                </Button>
            </main>
        );
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/campaign-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    <h1 className="text-3xl font-bold">{campaign.name}</h1>
                    <p className="text-muted-foreground">{campaign.status}</p>
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
                        <CardTitle>Campaign Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="mt-1 text-sm">{campaign.description || 'No description provided.'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p>
                                <p className="mt-1 text-lg font-semibold">₹{(campaign.targetAmount ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Category</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.category}</p>
                            </div>
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.startDate}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.endDate}</p>
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

                <div className="grid gap-6 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.totalBeneficiaries ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Given</CardTitle>
                            <Gift className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.beneficiariesGiven ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Pending</CardTitle>
                            <Hourglass className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.beneficiariesPending ?? 0}</div>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid gap-6 lg:grid-cols-2">
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

                    {beneficiaryData && beneficiaryData.sortedBeneficiaryCategories.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Beneficiaries by Category</CardTitle>
                                <CardDescription>
                                    Summary of beneficiaries grouped by family size.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">Category Name</TableHead>
                                            <TableHead className="text-center whitespace-nowrap">Total Beneficiaries</TableHead>
                                            <TableHead className="text-right whitespace-nowrap">Kit Amount (per kit)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {beneficiaryData.sortedBeneficiaryCategories.map(memberCount => {
                                            const group = beneficiaryData.beneficiariesByCategory[memberCount];
                                            const count = group.beneficiaries.length;
                                            const kitAmount = group.beneficiaries[0]?.kitAmount || 0;
                                            return (
                                                <TableRow key={memberCount}>
                                                    <TableCell className="font-medium">{memberCount} Members</TableCell>
                                                    <TableCell className="text-center">{count}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{kitAmount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-center font-bold">{beneficiaryData.totalBeneficiaries}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={shareDialogData} 
            />
        </main>
    );
}
