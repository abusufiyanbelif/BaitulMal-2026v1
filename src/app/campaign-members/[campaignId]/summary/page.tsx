
'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, useCollection, errorEmitter, FirestorePermissionError, useStorage } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, collection, updateDoc, query, where, DocumentReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Target, Users, Gift, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, ChevronDown, ChevronUp, UploadCloud, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"

import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { donationCategories } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';


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
    Check: { label: "Check", color: "hsl(var(--chart-5))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;


export default function CampaignSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { download } = useDownloadAs();

    // State for edit mode and form fields
    const [editMode, setEditMode] = useState(false);
    const [editableCampaign, setEditableCampaign] = useState<Partial<Campaign>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isImageDeleted, setIsImageDeleted] = useState(false);
    
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
                imageUrl: campaign.imageUrl || '',
            });
            setImagePreview(campaign.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
        }
    }, [campaign, editMode]);

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setIsImageDeleted(false);
        }
    };
    
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setIsImageDeleted(true);
    };

    const sanitizedRationLists = useMemo(() => {
        if (!campaign?.itemCategories) return [];
        if (Array.isArray(campaign.itemCategories)) return campaign.itemCategories;
        // Hotfix for old object format
        return [
          {
            id: 'general',
            name: 'General Item List',
            minMembers: 0,
            maxMembers: 0,
            items: (campaign.itemCategories as any)['General Item List'] || []
          }
        ];
    }, [campaign?.itemCategories]);
    
    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
    const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.update', false) || getNestedValue(userProfile, 'permissions.campaigns.summary.update', false);

    const handleSave = async () => {
        if (!campaignDocRef || !userProfile || !canUpdate) return;
        
        let imageUrl = editableCampaign.imageUrl || '';
        if (isImageDeleted && imageUrl && storage) {
            try {
                await deleteObject(storageRef(storage, imageUrl));
            } catch (e) { console.warn("Old image deletion failed, it might not exist.", e) }
            imageUrl = '';
        } else if (imageFile && storage) {
            try {
                if (imageUrl) { // Delete old image if a new one is uploaded
                     await deleteObject(storageRef(storage, imageUrl)).catch(e => console.warn("Old image deletion failed, it might not exist.", e));
                }
                const { default: Resizer } = await import('react-image-file-resizer');
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    Resizer.imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, blob => resolve(blob as Blob), 'blob');
                });
                const filePath = `campaigns/${campaignId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', description: 'Changes were not saved.', variant: 'destructive'});
                return;
            }
        }

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
            imageUrl: imageUrl,
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
    
    const handleEditClick = () => setEditMode(true);
    const handleCancel = () => setEditMode(false);

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
                // This is a legacy donation for this campaign
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
        
        const donationStatusStats = donations.reduce((acc, donation) => {
            const status = donation.status || 'Pending';
            let amountForThisCampaign = 0;
            const campaignLink = donation.linkSplit?.find(l => l.linkId === campaign.id && l.linkType === 'campaign');
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!donation.linkSplit || donation.linkSplit.length === 0) && donation.campaignId === campaign.id) {
                amountForThisCampaign = donation.amount;
            }

            if (status === 'Verified') {
                acc.verified.count += 1;
                acc.verified.amount += amountForThisCampaign;
            } else if (status === 'Pending') {
                acc.pending.count += 1;
                acc.pending.amount += amountForThisCampaign;
            } else if (status === 'Canceled') {
                acc.canceled.count += 1;
                acc.canceled.amount += amountForThisCampaign;
            }
            return acc;
        }, {
            verified: { count: 0, amount: 0 },
            pending: { count: 0, amount: 0 },
            canceled: { count: 0, amount: 0 },
        });

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const pendingDonations = donationStatusStats.pending.amount;

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            const generalCategory = sanitizedRationLists.find(cat => cat.name === 'General Item List');
            const specificCategory = sanitizedRationLists.find(cat => cat.name !== 'General Item List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
            
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
            },
            donationStatusStats,
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

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, {
            contentRef: summaryRef,
            documentTitle: `Campaign Summary: ${campaign?.name || 'Summary'}`,
            documentName: `campaign-summary-${campaignId}`,
            brandingSettings,
            paymentSettings
        });
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
                        {canReadSummary && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                                <Link href={`/campaign-members/${campaignId}/summary`}>Summary</Link>
                            </Button>
                        )}
                        {canReadRation && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                                <Link href={`/campaign-members/${campaignId}`}>{campaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                            </Button>
                        )}
                        {canReadBeneficiaries && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                                <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                            </Button>
                        )}
                        {canReadDonations && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                                <Link href={`/campaign-members/${campaignId}/donations`}>Donations</Link>
                            </Button>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <div className="space-y-6">
                 <div ref={summaryRef} className="space-y-6 p-4 bg-background">
                    <Card>
                        <CardHeader>
                            <CardTitle>Campaign Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {editMode ? (
                                <div className="space-y-2">
                                    <Label htmlFor="imageFile">Header Image</Label>
                                    <Input id="imageFile" type="file" accept="image/png, image/jpeg" onChange={handleImageFileChange} className="hidden" />
                                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                                        {imagePreview ? (
                                            <>
                                                <Image src={imagePreview} alt="Preview" fill className="object-cover rounded-lg" />
                                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleRemoveImage}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                                <p className="mb-2 text-sm text-center text-muted-foreground">
                                                    <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-muted-foreground">PNG, JPG (1280x400 recommended)</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            ) : (
                                campaign.imageUrl && <div className="relative w-full h-40 rounded-lg overflow-hidden"><Image src={campaign.imageUrl} alt={campaign.name} fill className="object-cover" /></div>
                            )}

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
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input id="startDate" type="date" value={editableCampaign.startDate || ''} onChange={e => setEditableCampaign(p => ({...p, startDate: e.target.value}))} disabled={!editMode}/>
                                </div>
                                <div>
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input id="endDate" type="date" value={editableCampaign.endDate || ''} onChange={e => setEditableCampaign(p => ({...p, endDate: e.target.value}))} disabled={!editMode}/>
                                </div>
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={editableCampaign.category} onValueChange={value => setEditableCampaign(p => ({...p, category: value as any}))} disabled={!editMode}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="Ration">Ration</SelectItem><SelectItem value="Relief">Relief</SelectItem><SelectItem value="General">General</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="targetAmount">Target Amount (₹)</Label>
                                    <Input id="targetAmount" type="number" value={editableCampaign.targetAmount || ''} onChange={e => setEditableCampaign(p => ({...p, targetAmount: Number(e.target.value)}))} disabled={!editMode}/>
                                </div>
                                <div>
                                    <Label htmlFor="authenticityStatus">Authenticity</Label>
                                    <Select value={editableCampaign.authenticityStatus} onValueChange={value => setEditableCampaign(p => ({...p, authenticityStatus: value as any}))} disabled={!editMode}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="Pending Verification">Pending Verification</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="On Hold">On Hold</SelectItem><SelectItem value="Rejected">Rejected</SelectItem><SelectItem value="Need More Details">Need More Details</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="publicVisibility">Visibility</Label>
                                    <Select value={editableCampaign.publicVisibility} onValueChange={value => setEditableCampaign(p => ({...p, publicVisibility: value as any}))} disabled={!editMode}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="Hold">Hold (Private)</SelectItem><SelectItem value="Ready to Publish">Ready to Publish</SelectItem><SelectItem value="Published">Published</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label>Allowed Donation Types</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border rounded-md mt-1">
                                    {donationCategories.map(type => (
                                        <div key={type} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`type-${type}`}
                                                disabled={!editMode}
                                                checked={editableCampaign.allowedDonationTypes?.includes(type)}
                                                onCheckedChange={checked => {
                                                    const currentTypes = editableCampaign.allowedDonationTypes || [];
                                                    const newTypes = checked ? [...currentTypes, type] : currentTypes.filter(t => t !== type);
                                                    setEditableCampaign(p => ({...p, allowedDonationTypes: newTypes as any}));
                                                }}
                                            />
                                            <Label htmlFor={`type-${type}`} className="font-normal text-sm">{type}</Label>
                                        </div>
                                    ))}
                                </div>
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
                                {summaryData && summaryData.targetAmount === 0 ? (
                                    'Set a Target Amount or sync beneficiary kit amounts from the "Item Lists" tab to see progress.'
                                ) : summaryData && summaryData.pendingDonations > 0 ? (
                                    <span>(+ ₹{summaryData.pendingDonations.toLocaleString('en-IN')} pending verification)</span>
                                ) : (
                                    <span>&nbsp;</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Zakat Utilized</CardTitle>
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">₹{(summaryData?.zakatAllocated || 0).toLocaleString('en-IN')}</div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified Donations</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.verified.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.verified.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending Donations</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.pending.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.pending.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled Donations</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.canceled.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.canceled.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (for disposal)</span><span className="font-semibold">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between items-center text-base"><span className="font-semibold">Grand Total Received</span><span className="font-bold text-primary">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span></div>
                        </CardContent>
                      </Card>
                      <Card>
                          <CardHeader>
                              <CardTitle>Donations by Category</CardTitle>
                          </CardHeader>
                          <CardContent>
                              <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                  <BarChart data={Object.entries(summaryData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ right: 20 }}>
                                      <CartesianGrid horizontal={false} />
                                      <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 12 }} width={120}/>
                                      <XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                      <ChartTooltip content={<ChartTooltipContent />} />
                                      <Bar dataKey="value" radius={4}>
                                          {Object.entries(summaryData?.amountsByCategory || {}).map(([name]) => (
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
                  {campaign.category === 'Ration' && summaryData && summaryData.sortedBeneficiaryCategoryKeys.length > 0 && (
                      <Card>
                          <CardHeader><CardTitle>Beneficiary Groups</CardTitle></CardHeader>
                          <CardContent>
                            <div className="w-full overflow-x-auto">
                              <Table>
                                  <TableHeader>
                                      <TableRow><TableHead>Category</TableHead><TableHead className="text-center">Beneficiaries</TableHead><TableHead className="text-right">Total Amount (₹)</TableHead></TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {summaryData.sortedBeneficiaryCategoryKeys.map(key => {
                                          const group = summaryData.beneficiariesByCategory[key];
                                          return (
                                              <TableRow key={key}><TableCell>{group.categoryName}</TableCell><TableCell className="text-center">{group.beneficiaries.length}</TableCell><TableCell className="text-right font-mono">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell></TableRow>
                                          );
                                      })}
                                  </TableBody>
                                   <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-center font-bold">{summaryData.totalBeneficiaries}</TableCell>
                                            <TableCell className="text-right font-bold font-mono">₹{Object.values(summaryData.beneficiariesByCategory).reduce((sum, g) => sum + g.totalAmount, 0).toLocaleString('en-IN')}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                              </Table>
                            </div>
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
