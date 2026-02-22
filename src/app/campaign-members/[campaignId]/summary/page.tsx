

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, collection, updateDoc, query, where, DocumentReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import Resizer from 'react-image-file-resizer';
import type { Campaign, Beneficiary, Donation, DonationCategory, ItemCategory, CampaignDocument } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Target, Users, Gift, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, ChevronDown, ChevronUp, UploadCloud, Trash2, CheckCircle2, XCircle, File } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { FileUploader } from '@/components/file-uploader';
import { Switch } from '@/components/ui/switch';


const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
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
    const auth = useAuth();
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

    const [newDocuments, setNewDocuments] = useState<File[]>([]);
    const [existingDocuments, setExistingDocuments] = useState<CampaignDocument[]>([]);
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const summaryRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Data fetching
    const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    
    const allDonationsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading, error: campaignError } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading, error: beneficiariesError } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading, error: donationsError } = useCollection<Donation>(allDonationsCollectionRef);
    
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
                imageUrlFilename: campaign.imageUrlFilename || '',
            });
            setExistingDocuments(campaign.documents || []);
            setImagePreview(campaign.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
            setNewDocuments([]);
        } else if (campaign && editMode) {
            setExistingDocuments(campaign.documents || []);
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

    const handleRemoveExistingDocument = (urlToRemove: string) => {
        setExistingDocuments(prev => prev.filter(doc => doc.url !== urlToRemove));
    };

    const handleToggleDocumentPublic = (urlToToggle: string) => {
        setExistingDocuments(prev => prev.map(doc => doc.url === urlToToggle ? { ...doc, isPublic: !doc.isPublic } : doc));
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
        if (!campaignDocRef || !userProfile || !canUpdate || !storage) return;
        
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({
                title: "Authentication Error",
                description: "User not authenticated yet. Please wait.",
                variant: "destructive",
            });
            return;
        }

        let imageUrl = editableCampaign.imageUrl || '';
        let imageUrlFilename = editableCampaign.imageUrlFilename || '';

        if (isImageDeleted && imageUrl) {
            try {
                await deleteObject(storageRef(storage, imageUrl));
            } catch (e: any) { console.warn("Old image deletion failed, it might not exist.", e) }
            imageUrl = '';
            imageUrlFilename = '';
        } else if (imageFile) {
            try {
                if (imageUrl) {
                     await deleteObject(storageRef(storage, imageUrl)).catch(e => console.warn("Old image deletion failed, it might not exist.", e));
                }
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `campaigns/${campaignId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
                const dateStr = new Date().toISOString().split('T')[0];
                imageUrlFilename = `campaign_${editableCampaign.name?.replace(/\s+/g, '_')}_${dateStr}.png`;
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', description: 'Changes were not saved.', variant: 'destructive'});
                return;
            }
        }
        
        // Handle artifact uploads
        const documentUploadPromises = newDocuments.map(async (file) => {
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = storageRef(storage, `campaigns/${campaignId}/documents/${safeFileName}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            return { name: file.name, url, uploadedAt: new Date().toISOString(), isPublic: false };
        });

        const uploadedDocuments = await Promise.all(documentUploadPromises);
        const finalDocuments = [...existingDocuments, ...uploadedDocuments];

        // Handle artifact deletions
        const originalDocuments = campaign?.documents || [];
        const existingUrls = existingDocuments.map(d => d.url);
        const docsToDelete = originalDocuments.filter(d => !existingUrls.includes(d.url));

        for (const docToDelete of docsToDelete) {
            try {
                await deleteObject(storageRef(storage, docToDelete.url));
            } catch (e: any) {
                console.warn(`Could not delete artifact ${docToDelete.url}. It may have already been deleted.`, e);
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
            imageUrlFilename: imageUrlFilename,
            documents: finalDocuments,
        };

        updateDoc(campaignDocRef, saveData)
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: campaignDocRef.path,
                    operation: 'update',
                    requestResourceData: saveData,
                }));
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

            if (amountForThisCampaign === 0) {
                return;
            }

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportionForThisCampaign = amountForThisCampaign / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0
                ? d.typeSplit
                : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;

                const isForFundraising = category !== 'Zakat' || split.forFundraising !== false;

                if (amountsByCategory.hasOwnProperty(category) && isForFundraising) {
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

        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') {
                    return sum + Math.max(0, amount - zakatAllocated);
                }
                return sum + amount;
            }, 0);

        const pendingDonations = donationStatusStats.pending.amount;

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            const generalCategory = sanitizedRationLists.find(cat => cat.name === 'General Item List');
            
            const matchingCategories = sanitizedRationLists.filter(cat => cat.name !== 'General Item List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
            
            let specificCategory: ItemCategory | null = null;
            if (matchingCategories.length > 1) {
                // If multiple categories match, find the most specific one (smallest range)
                matchingCategories.sort((a, b) => {
                    const rangeA = (a.maxMembers ?? 999) - (a.minMembers ?? 0);
                    const rangeB = (b.maxMembers ?? 999) - (b.minMembers ?? 0);
                    if(rangeA !== rangeB) return rangeA - rangeB;
                    return (b.minMembers ?? 0) - (a.minMembers ?? 0);
                });
                specificCategory = matchingCategories[0];
            } else if (matchingCategories.length === 1) {
                specificCategory = matchingCategories[0];
            }

            const appliedCategory = specificCategory || generalCategory;


            let categoryName = 'Uncategorized';
            let categoryKey = 'uncategorized';

            if (appliedCategory) {
              categoryName = appliedCategory.name === 'General Item List'
                  ? 'General'
                  : (appliedCategory.minMembers === undefined || appliedCategory.maxMembers === undefined || appliedCategory.minMembers === appliedCategory.maxMembers)
                      ? `${appliedCategory.name} (${appliedCategory.minMembers})`
                      : `${appliedCategory.name} (${appliedCategory.minMembers}-${appliedCategory.maxMembers})`;
              categoryKey = appliedCategory.id;
            }

            if (!acc[categoryKey]) {
              acc[categoryKey] = { categoryName: categoryName, beneficiaries: [], totalAmount: 0, kitAmount: 0, minMembers: appliedCategory?.minMembers ?? 0 };
            }
            acc[categoryKey].beneficiaries.push(ben);
            acc[categoryKey].totalAmount += ben.kitAmount || 0;
            acc[categoryKey].kitAmount = ben.kitAmount || 0;
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

        const fitraTotal = amountsByCategory['Fitra'] || 0;
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
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
                fitra: fitraTotal,
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

*We Need Your Support!*

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
    
    if (campaignError || beneficiariesError || donationsError) {
        return (
             <main className="container mx-auto p-4 md:p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>
                        <p>There was a problem fetching the required data for this page. This could be due to network issues or insufficient permissions.</p>
                        <pre className="mt-2 text-xs bg-destructive/10 p-2 rounded-md font-mono">
                            {(campaignError || beneficiariesError || donationsError)?.message}
                        </pre>
                    </AlertDescription>
                </Alert>
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
                            onChange={(e: any) => setEditableCampaign(p => ({...p, name: e.target.value}))}
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
                                    <Label>Header Image</Label>
                                    <Input id="imageFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageFileChange} className="hidden" />
                                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                                        {imagePreview ? (
                                            <>
                                                <Image src={imagePreview} alt="Preview" fill sizes="100vw" className="object-cover rounded-lg" />
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
                                                <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP recommended</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            ) : (
                                campaign.imageUrl && <div className="relative w-full h-40 rounded-lg overflow-hidden"><Image src={campaign.imageUrl} alt={campaign.name} fill sizes="100vw" className="object-cover" /></div>
                            )}

                            <div>
                                <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
                                {editMode && canUpdate ? (
                                    <Textarea
                                        id="description"
                                        value={editableCampaign.description}
                                        onChange={(e: any) => setEditableCampaign(p => ({...p, description: e.target.value}))}
                                        className="mt-1"
                                        rows={4}
                                    />
                                ) : (
                                    <p className="mt-1 text-sm">{campaign.description || 'No description provided.'}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Campaign Artifacts</CardTitle>
                            <CardDescription>Photos, receipts, or other documents related to this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {editMode ? (
                                <div className="space-y-4">
                                    <Label>Upload New Artifacts</Label>
                                    <FileUploader onFilesChange={setNewDocuments} multiple acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf" />
                                    <Separator />
                                    <Label>Manage Existing Artifacts</Label>
                                    {existingDocuments.length > 0 ? (
                                        <div className="space-y-2">
                                            {existingDocuments.map((doc) => (
                                                <div key={doc.url} className="flex items-center justify-between p-2 border rounded-md">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline truncate">
                                                        <File className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{doc.name}</span>
                                                    </a>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <Switch checked={doc.isPublic} onCheckedChange={() => handleToggleDocumentPublic(doc.url)} id={`public-${doc.url}`} />
                                                            <Label htmlFor={`public-${doc.url}`} className="text-xs">Public</Label>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveExistingDocument(doc.url)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">No artifacts uploaded yet.</p>}
                                </div>
                            ) : (
                                campaign.documents && campaign.documents.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {campaign.documents.map((doc) => (
                                            <Button key={doc.url} variant="outline" asChild>
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate">
                                                    <File className="mr-2 h-4 w-4 shrink-0" />
                                                    <span className="truncate">{doc.name}</span>
                                                </a>
                                            </Button>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">No artifacts uploaded yet.</p>
                            )}
                        </CardContent>
                    </Card>
                
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-6 w-6 text-primary" />
                                Fundraising Progress
                            </CardTitle>
                            <CardDescription>A real-time look at the collected donations against the goal for this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isClient ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                  <div className="relative h-48 w-full">
                                      <ChartContainer
                                          config={{
                                              progress: {
                                                  label: 'Progress',
                                                  color: 'hsl(var(--primary))',
                                              },
                                          }}
                                          className="mx-auto aspect-square h-full"
                                      >
                                          <RadialBarChart
                                              data={[{ name: 'Progress', value: summaryData?.fundingProgress || 0, fill: 'hsl(var(--primary))' }]}
                                              startAngle={-270}
                                              endAngle={90}
                                              innerRadius="75%"
                                              outerRadius="100%"
                                              barSize={20}
                                          >
                                          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                          <RadialBar
                                              dataKey="value"
                                              background={{ fill: 'hsl(var(--muted))' }}
                                              cornerRadius={10}
                                          />
                                          <ChartTooltip
                                              cursor={false}
                                              content={<ChartTooltipContent hideLabel />}
                                          />
                                          </RadialBarChart>
                                      </ChartContainer>
                                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                                          <span className="text-4xl font-bold text-primary">
                                              {(summaryData?.fundingProgress || 0).toFixed(0)}%
                                          </span>
                                          <span className="text-xs text-muted-foreground">Funded</span>
                                      </div>
                                  </div>
                                  <div className="space-y-4 text-center md:text-left">
                                      <div>
                                          <p className="text-sm text-muted-foreground">Raised for Goal</p>
                                          <p className="text-3xl font-bold">
                                          ₹{(summaryData?.totalCollectedForGoal || 0).toLocaleString('en-IN')}
                                          </p>
                                      </div>
                                      <div>
                                          <p className="text-sm text-muted-foreground">Fundraising Target</p>
                                          <p className="text-3xl font-bold">
                                          ₹{(summaryData?.targetAmount || 0).toLocaleString('en-IN')}
                                          </p>
                                      </div>
                                      <div>
                                          <p className="text-sm text-muted-foreground">Grand Total Received</p>
                                          <p className="text-3xl font-bold">
                                          ₹{(summaryData?.fundTotals.grandTotal || 0).toLocaleString('en-IN')}
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              <Skeleton className="w-full h-48" />
                          )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>
                                Tracking of Zakat funds collected and allocated within this campaign.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Collected for Campaign</span>
                                <span className="font-semibold font-mono">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Zakat Allocated as Cash-in-Hand</span>
                                <span className="font-semibold font-mono">₹{(summaryData?.zakatAllocated || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-base">
                                <span className="font-bold">Zakat Balance for Goal</span>
                                <span className="font-bold text-primary font-mono">₹{((summaryData?.fundTotals.zakat || 0) - (summaryData?.zakatAllocated || 0)).toLocaleString('en-IN')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fitra</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (for disposal)</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between items-center text-base"><span className="font-semibold">Grand Total Received</span><span className="font-bold text-primary font-mono">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span></div>
                        </CardContent>
                      </Card>
                      <Card>
                          <CardHeader>
                              <CardTitle>Donations by Category</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {isClient ? (
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
                            ) : <Skeleton className="h-[250px] w-full" />}
                          </CardContent>
                      </Card>

                      <Card>
                          <CardHeader>
                              <CardTitle>Donations by Payment Type</CardTitle>
                          </CardHeader>
                          <CardContent>
                              {isClient ? (
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
                               ) : <Skeleton className="h-[250px] w-full" />}
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
                                      <TableRow>
                                          <TableHead>Category Name</TableHead>
                                          <TableHead className="text-center">Total Beneficiaries</TableHead>
                                          <TableHead className="text-right">Kit Amount (per kit)</TableHead>
                                          <TableHead className="text-right">Total Kit Amount (per category)</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {summaryData.sortedBeneficiaryCategoryKeys.map(key => {
                                          const group = summaryData.beneficiariesByCategory[key];
                                          return (
                                              <TableRow key={key}>
                                                  <TableCell>{group.categoryName}</TableCell>
                                                  <TableCell className="text-center">{group.beneficiaries.length}</TableCell>
                                                  <TableCell className="text-right font-mono">₹{group.kitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                  <TableCell className="text-right font-mono">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                              </TableRow>
                                          );
                                      })}
                                  </TableBody>
                                   <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-right">Total</TableCell>
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
