
'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, useCollection, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, collection, updateDoc, query, where, DocumentReference } from 'firebase/firestore';
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

import type { Campaign, Beneficiary, Donation, DonationCategory, RationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Target, Users, Gift, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"

import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { get, cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { donationCategories } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';


const donationCategoryChartConfig = {
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-3))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;


export default function CampaignSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();

    // State for edit mode and form fields
    const [editMode, setEditMode] = useState(false);
    const [editableCampaign, setEditableCampaign] = useState<Partial<Campaign>>({});
    
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
    
    // Set editable campaign data when not in edit mode
    useEffect(() => {
        if (campaign && !editMode) {
             setEditableCampaign({
                name: campaign.name || '',
                description: campaign.description || '',
                startDate: campaign.startDate || '',
                endDate: campaign.endDate || '',
                category: campaign.category || 'General',
                status: campaign.status || 'Upcoming',
                targetAmount: campaign.targetAmount || 0,
                authenticityStatus: campaign.authenticityStatus || 'Pending Verification',
                publicVisibility: campaign.publicVisibility || 'Hold',
                allowedDonationTypes: campaign.allowedDonationTypes || [...donationCategories],
            });
        }
    }, [campaign, editMode]);

    const sanitizedRationLists = useMemo(() => {
        if (!campaign?.rationLists) return [];
        if (Array.isArray(campaign.rationLists)) return campaign.rationLists;
        // Hotfix for old object format
        return [
          {
            id: 'general',
            name: 'General Item List',
            minMembers: 0,
            maxMembers: 0,
            items: (campaign.rationLists as any)['General Item List'] || []
          }
        ];
    }, [campaign?.rationLists]);
    
    const canReadSummary = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.summary?.read;
    const canReadRation = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.ration?.read;
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.beneficiaries?.read;
    const canReadDonations = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.donations?.read;
    const canUpdate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.campaigns.update', false) || get(userProfile, 'permissions.campaigns.summary.update', false);

    const handleSave = () => {
        if (!campaignDocRef || !userProfile || !canUpdate) return;
        
        const saveData: Partial<Campaign> = {
            name: editableCampaign.name || '',
            description: editableCampaign.description || '',
            startDate: editableCampaign.startDate || '',
            endDate: editableCampaign.endDate || '',
            category: editableCampaign.category || 'General',
            status: editableCampaign.status || 'Upcoming',
            targetAmount: editableCampaign.targetAmount || 0,
            authenticityStatus: editableCampaign.authenticityStatus || 'Pending Verification',
            publicVisibility: editableCampaign.publicVisibility || 'Hold',
            allowedDonationTypes: editableCampaign.allowedDonationTypes,
        };

        updateDoc(campaignDocRef, saveData)
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: campaignDocRef.path,
                    operation: 'update',
                    requestResourceData: saveData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                toast({ title: 'Success', description: 'Campaign summary updated.', variant: 'success' });
                setEditMode(false);
            });
    };
    
    const handleEditClick = () => {
        if (campaign) {
            setEditableCampaign({
                name: campaign.name || '',
                description: campaign.description || '',
                startDate: campaign.startDate || '',
                endDate: campaign.endDate || '',
                category: campaign.category || 'General',
                status: campaign.status || 'Upcoming',
                targetAmount: campaign.targetAmount || 0,
                authenticityStatus: campaign.authenticityStatus || 'Pending Verification',
                publicVisibility: campaign.publicVisibility || 'Hold',
                allowedDonationTypes: campaign.allowedDonationTypes || [...donationCategories],
            });
        }
        setEditMode(true);
    };

    const handleCancel = () => {
        setEditMode(false);
        // The useEffect will reset the editableCampaign state to match the campaign data
    };

    // Memoized calculations
    const summaryData = useMemo(() => {
        if (!allDonations || !campaign || !beneficiaries || !sanitizedRationLists) return null;
        
        const donations = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) {
                return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            }
            return d.campaignId === campaign.id;
        });

        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find(l => l.linkId === campaign.id && l.linkType === 'campaign');
            
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && d.campaignId === campaign.id) {
                amountForThisCampaign = d.amount;
            } else {
                return; // Skip this donation if not related
            }

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportionForThisCampaign = amountForThisCampaign / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0
                ? d.typeSplit
                : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    amountsByCategory[category as DonationCategory] += split.amount * proportionForThisCampaign;
                }
            });
        });

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const pendingDonations = donations
            .filter(d => d.status === 'Pending')
            .reduce((sum, d) => {
                let amountForThisCampaign = 0;
                const campaignLink = d.linkSplit?.find(l => l.linkId === campaign.id && l.linkType === 'campaign');
                if (campaignLink) {
                    amountForThisCampaign = campaignLink.amount;
                } else if ((!d.linkSplit || d.linkSplit.length === 0) && d.campaignId === campaign.id) {
                    amountForThisCampaign = d.amount;
                }
                return sum + amountForThisCampaign;
            }, 0);

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            const generalCategory = sanitizedRationLists.find(cat => cat.name === 'General Item List');
            const specificCategory = sanitizedRationLists.find(cat => cat.name !== 'General Item List' && members >= cat.minMembers && members <= cat.maxMembers);
            
            const appliedCategory = specificCategory || generalCategory;
            
            let categoryName = 'Uncategorized';
            let categoryKey = 'uncategorized';

            if (appliedCategory) {
              categoryName = appliedCategory.name === 'General Item List'
                  ? 'General'
                  : appliedCategory.minMembers === appliedCategory.maxMembers
                      ? `${appliedCategory.name} (${appliedCategory.minMembers})`
                      : `${appliedCategory.name} (${appliedCategory.minMembers}-${appliedCategory.maxMembers})`;
              categoryKey = appliedCategory.id;
            }

            if (!acc[categoryKey]) {
              acc[categoryKey] = { categoryName, beneficiaries: [], totalAmount: 0, kitAmount: 0, minMembers: appliedCategory?.minMembers ?? 0 };
            }
            acc[categoryKey].beneficiaries.push(ben);
            acc[categoryKey].totalAmount += ben.kitAmount || 0;
            acc[categoryKey].kitAmount = ben.kitAmount || 0; // Assuming kitAmount is consistent per category
            return acc;
        }, {} as Record<string, { categoryName: string, beneficiaries: Beneficiary[], totalAmount: number, kitAmount: number, minMembers: number }>);

        const sortedBeneficiaryCategoryKeys = Object.keys(beneficiariesByCategory).sort((a, b) => {
          return beneficiariesByCategory[a].minMembers - beneficiariesByCategory[b].minMembers;
        });

        const paymentTypeData = donations.reduce((acc, d) => {
            const key = d.donationType || 'Other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);

        return {
            totalCollectedForGoal,
            pendingDonations,
            fundingProgress,
            targetAmount: campaign.targetAmount || 0,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            beneficiariesByCategory,
            sortedBeneficiaryCategoryKeys,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            zakatAllocated,
            fundTotals: {
                zakat: zakatTotal,
                loan: loanTotal,
                interest: interestTotal,
                sadaqah: sadaqahTotal,
                lillah: lillahTotal,
                monthlyContribution: monthlyContributionTotal,
                grandTotal: grandTotal,
            }
        };
    }, [allDonations, campaign, beneficiaries, sanitizedRationLists]);
    
    const isLoading = isCampaignLoading || areDonationsLoading || areBeneficiariesLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!campaign || !summaryData) {
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
🎯 Target for Kits: ₹${summaryData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${summaryData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${summaryData.remainingToCollect.toLocaleString('en-IN')}*

Your contribution, big or small, makes a huge difference.

*Please donate and share this message.*
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Campaign Summary: ${campaign.name}`,
            text: shareText,
            url: `${window.location.origin}/campaign-public/${campaignId}/summary`,
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
            
            const docTitle = `Campaign Summary: ${campaign?.name || 'Summary'}`;
            const docName = `campaign-summary-${campaignId}`;
    
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
            <main className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }

    if (!campaign) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">Campaign not found.</p>
                <Button asChild className="mt-4">
                    <Link href="/campaign-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
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
                    <Link href="/campaign-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    {editMode ? (
                       <Input
                            id="name"
                            value={editableCampaign.name || ''}
                            onChange={(e) => setEditableCampaign(p => ({...p, name: e.target.value}))}
                            className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                        />
                    ) : (
                        <h1 className="text-3xl font-bold">{campaign.name}</h1>
                    )}
                    {editMode ? (
                         <Select
                            value={editableCampaign.status}
                            onValueChange={(value) => setEditableCampaign(p => ({...p, status: value as any}))}
                        >
                            <SelectTrigger className="w-fit border-0 shadow-none focus:ring-0 p-0 h-auto text-muted-foreground [&>svg]:ml-1">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Upcoming">Upcoming</SelectItem>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    ): (
                        <p className="text-muted-foreground">{campaign.status}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    {!editMode && (
                        <>
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
                                <Share2 className="mr-2 h-4 w-4" />
                                Share
                            </Button>
                        </>
                    )}
                    {canUpdate && userProfile && (
                        !editMode ? (
                            <Button onClick={handleEditClick}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Summary
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                                <Button onClick={handleSave}>
                                    <Save className="mr-2 h-4 w-4" /> Save
                                </Button>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        {userProfile && canReadSummary && (
                            <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}/summary` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground")}>
                                Summary
                            </Link>
                        )}
                        {userProfile && canReadRation && (
                            <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground")}>
                                {campaign.category === 'Ration' ? 'Ration Details' : 'Item List'}
                            </Link>
                        )}
                        {userProfile && canReadBeneficiaries && (
                            <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground")}>
                                Beneficiary List
                            </Link>
                        )}
                        {userProfile && canReadDonations && (
                            <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground")}>
                                Donations
                            </Link>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <div className="space-y-6 p-4 bg-background animate-fade-in-zoom" ref={summaryRef}>
                <Card>
                    <CardHeader>
                        <CardTitle>Campaign Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
                            {editMode && canUpdate ? (
                                <Textarea
                                    id="description"
                                    value={editableCampaign.description}
                                    onChange={(e) => setEditableCampaign(p => ({...p, description: e.target.value}))}
                                    className="mt-1"
                                    rows={4}
                                />
                            ) : (
                                <p className="mt-1 text-sm">{campaign.description || 'No description provided.'}</p>
                            )}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="targetAmount" className="text-sm font-medium text-muted-foreground">Fundraising Goal (Target)</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="targetAmount"
                                        type="number"
                                        value={editableCampaign.targetAmount}
                                        onChange={(e) => setEditableCampaign(p => ({...p, targetAmount: Number(e.target.value) || 0}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="category" className="text-sm font-medium text-muted-foreground">Category</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableCampaign.category}
                                        onValueChange={(value) => setEditableCampaign(p => ({...p, category: value as any}))}
                                    >
                                        <SelectTrigger id="category" className="mt-1">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ration">Ration</SelectItem>
                                            <SelectItem value="Relief">Relief</SelectItem>
                                            <SelectItem value="General">General</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{campaign.category}</p>
                                )}
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="startDate" className="text-sm font-medium text-muted-foreground">Start Date</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={editableCampaign.startDate}
                                        onChange={(e) => setEditableCampaign(p => ({...p, startDate: e.target.value}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{campaign.startDate}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endDate" className="text-sm font-medium text-muted-foreground">End Date</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={editableCampaign.endDate}
                                        onChange={(e) => setEditableCampaign(p => ({...p, endDate: e.target.value}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{campaign.endDate}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="authenticityStatus" className="text-sm font-medium text-muted-foreground">Authenticity Status</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableCampaign.authenticityStatus}
                                        onValueChange={(value) => setEditableCampaign(p => ({...p, authenticityStatus: value as any}))}
                                    >
                                        <SelectTrigger id="authenticityStatus" className="mt-1">
                                            <SelectValue placeholder="Select a status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                                            <SelectItem value="Verified">Verified</SelectItem>
                                            <SelectItem value="On Hold">On Hold</SelectItem>
                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                            <SelectItem value="Need More Details">Need More Details</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{campaign.authenticityStatus || 'N/A'}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="publicVisibility" className="text-sm font-medium text-muted-foreground">Public Visibility</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableCampaign.publicVisibility}
                                        onValueChange={(value) => setEditableCampaign(p => ({...p, publicVisibility: value as any}))}
                                    >
                                        <SelectTrigger id="publicVisibility" className="mt-1">
                                            <SelectValue placeholder="Select visibility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Hold">Hold (Private)</SelectItem>
                                            <SelectItem value="Ready to Publish">Ready to Publish</SelectItem>
                                            <SelectItem value="Published">Published</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{campaign.publicVisibility || 'N/A'}</p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2 pt-4">
                            <Label className="text-sm font-medium text-muted-foreground">Allowed Donation Types for Goal</Label>
                            {editMode && canUpdate ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-md">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="select-all"
                                        checked={editableCampaign.allowedDonationTypes?.length === donationCategories.length}
                                        onCheckedChange={(checked) => {
                                            setEditableCampaign(p => ({...p, allowedDonationTypes: checked ? [...donationCategories] : []}));
                                        }}
                                    />
                                    <Label htmlFor="select-all" className="font-bold">Any</Label>
                                </div>
                                {donationCategories.map(type => (
                                    <div key={type} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`type-${type}`}
                                        checked={editableCampaign.allowedDonationTypes?.includes(type)}
                                        onCheckedChange={(checked) => {
                                        const currentTypes = editableCampaign.allowedDonationTypes || [];
                                        const newTypes = checked ? [...currentTypes, type] : currentTypes.filter(t => t !== type);
                                        setEditableCampaign(p => ({...p, allowedDonationTypes: newTypes}));
                                        }}
                                    />
                                    <Label htmlFor={`type-${type}`}>{type}</Label>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {(campaign.allowedDonationTypes && campaign.allowedDonationTypes.length > 0) ? (
                                        campaign.allowedDonationTypes.map(type => (
                                            <Badge key={type} variant="secondary">{type}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Not specified.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Funding Progress</CardTitle>
                        <CardDescription>
                            ₹{summaryData?.totalCollectedForGoal.toLocaleString('en-IN') ?? 0} of ₹{(summaryData?.targetAmount ?? 0).toLocaleString('en-IN')} funded.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Progress value={summaryData?.fundingProgress || 0} />
                         <div className="mt-2 text-xs text-muted-foreground">
                            {summaryData && summaryData.pendingDonations > 0 && <span>(+ ₹{summaryData.pendingDonations.toLocaleString('en-IN')} pending verification)</span>}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryData?.totalBeneficiaries ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Given</CardTitle>
                            <Gift className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryData?.beneficiariesGiven ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Pending</CardTitle>
                            <Hourglass className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryData?.beneficiariesPending ?? 0}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                            <CardDescription>A breakdown of funds collected for this campaign by their purpose.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Zakat</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Sadaqah</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Lillah</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Monthly Contribution</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Interest (for disposal)</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Loan (Qard-e-Hasana)</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Grand Total</span>
                                <span className="font-bold text-primary">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                        </CardContent>
                    </Card>
                
                     <Card>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>Tracking of Zakat funds collected and allocated within this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Collected</span>
                                <span className="font-semibold">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Allocated</span>
                                <span className="font-semibold">₹{summaryData?.zakatAllocated.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-semibold">Zakat Balance</span>
                                <span className="font-bold text-primary">₹{((summaryData?.fundTotals.zakat || 0) - (summaryData?.zakatAllocated || 0)).toLocaleString('en-IN')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {summaryData && summaryData.sortedBeneficiaryCategoryKeys.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Beneficiaries by Category</CardTitle>
                                <CardDescription>
                                    Summary of beneficiaries grouped by family size categories.
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
                                        {summaryData.sortedBeneficiaryCategoryKeys.map(categoryKey => {
                                            const group = summaryData.beneficiariesByCategory[categoryKey];
                                            const count = group.beneficiaries.length;
                                            const kitAmount = group.kitAmount;
                                            return (
                                                <TableRow key={categoryKey}>
                                                    <TableCell className="font-medium">{group.categoryName}</TableCell>
                                                    <TableCell className="text-center">{count}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{kitAmount.toFixed(2)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-center font-bold">{summaryData.totalBeneficiaries}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                <BarChart data={Object.entries(summaryData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))}>
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
                                        {Object.entries(summaryData?.amountsByCategory || {}).map(([name,]) => (
                                            <Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Donations by Payment Type</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                    <Pie data={summaryData?.donationPaymentTypeChartData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={5}>
                                        {summaryData?.donationPaymentTypeChartData?.map((entry) => (
                                            <Cell key={entry.name} fill={`var(--color-${entry.name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Pie>
                                    <ChartLegend content={<ChartLegendContent />} />
                                </PieChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
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

    

    
