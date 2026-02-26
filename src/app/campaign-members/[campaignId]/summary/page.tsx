
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, useStorage, useAuth, collection, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { updateDoc, DocumentReference } from 'firebase/firestore';
import type { Campaign, Beneficiary, Donation, DonationCategory, CampaignDocument, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Target, Users, Gift, Edit, Save, Share2, Hourglass, Download, UploadCloud, Trash2, CheckCircle2, XCircle, File, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { donationCategories } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { FileUploader } from '@/components/file-uploader';
import { Switch } from '@/components/ui/switch';
import { BrandedLoader } from '@/components/branded-loader';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import Resizer from 'react-image-file-resizer';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-8))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
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

    const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading, error: campaignError } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading, error: beneficiariesError } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading, error: donationsError } = useCollection<Donation>(allDonationsCollectionRef);
    
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

    const handleFieldChange = (field: keyof Campaign, value: any) => {
        setEditableCampaign(prev => (prev ? { ...prev, [field]: value } : null));
    };

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
    
    const quickToggleDocumentPublic = async (docToToggle: CampaignDocument) => {
        if (!campaignDocRef || !campaign?.documents || !canUpdate) return;
        const newDocuments = campaign.documents.map(doc => 
            doc.url === docToToggle.url ? { ...doc, isPublic: !doc.isPublic } : doc
        );
        try {
            await updateDoc(campaignDocRef, { documents: newDocuments });
            toast({ title: "Visibility Updated", description: `'${docToToggle.name}' is now ${!docToToggle.isPublic ? 'Public' : 'Private'}.` });
        } catch (serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campaignDocRef.path, operation: 'update', requestResourceData: { documents: newDocuments } }));
        }
    };

    const sanitizedRationLists = useMemo(() => {
        if (!campaign?.itemCategories) return [];
        if (Array.isArray(campaign.itemCategories)) return campaign.itemCategories;
        return [{ id: 'general', name: 'General', minMembers: 0, maxMembers: 0, items: [] }];
    }, [campaign?.itemCategories]);
    
    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
    const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.update', false) || getNestedValue(userProfile, 'permissions.campaigns.summary.update', false);

    const handleSave = async () => {
        if (!campaignDocRef || !userProfile || !canUpdate || !storage) return;
        
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({ title: "Authentication Error", description: "User not authenticated yet.", variant: "destructive" });
            return;
        }

        let imageUrl = editableCampaign.imageUrl || '';
        let imageUrlFilename = editableCampaign.imageUrlFilename || '';

        if (isImageDeleted && imageUrl) {
            try { await deleteObject(storageRef(storage, imageUrl)); } catch (e: any) { console.warn("Old image deletion failed", e) }
            imageUrl = '';
            imageUrlFilename = '';
        } else if (imageFile) {
            try {
                if (imageUrl) {
                     await deleteObject(storageRef(storage, imageUrl)).catch((e: any) => console.warn("Old image deletion failed", e));
                }
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `campaigns/${campaignId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
                imageUrlFilename = `campaign_${editableCampaign.name?.replace(/\s+/g, '_')}.png`;
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', description: 'Changes were not saved.', variant: 'destructive'});
                return;
            }
        }
        
        const documentUploadPromises = newDocuments.map(async (file) => {
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = storageRef(storage, `campaigns/${campaignId}/documents/${safeFileName}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            return { name: file.name, url, uploadedAt: new Date().toISOString(), isPublic: false };
        });

        const uploadedDocuments = await Promise.all(documentUploadPromises);
        const finalDocuments = [...existingDocuments, ...uploadedDocuments];

        const originalDocuments = campaign?.documents || [];
        const existingUrls = existingDocuments.map(d => d.url);
        const docsToDelete = originalDocuments.filter(d => !existingUrls.includes(d.url));

        for (const docToDelete of docsToDelete) {
            try { await deleteObject(storageRef(storage, docToDelete.url)); } catch (e: any) { console.warn(`Could not delete artifact`, e); }
        }

        const saveData: Partial<Campaign> = {
            name: editableCampaign.name || '',
            description: editableCampaign.description || '',
            startDate: editableCampaign.startDate || '',
            endDate: editableCampaign.endDate || '',
            category: editableCampaign.category || 'General',
            status: editableCampaign.status || 'Upcoming',
            targetAmount: Number(editableCampaign.targetAmount) || 0,
            authenticityStatus: editableCampaign.authenticityStatus || 'Pending Verification',
            publicVisibility: editableCampaign.publicVisibility || 'Hold',
            allowedDonationTypes: editableCampaign.allowedDonationTypes,
            imageUrl: imageUrl,
            imageUrlFilename: imageUrlFilename,
            documents: finalDocuments,
        };

        updateDoc(campaignDocRef, saveData)
            .catch(async (serverError: any) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campaignDocRef.path, operation: 'update', requestResourceData: saveData }));
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
            return (d as any).campaignId === campaign.id;
        });

        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        let zakatForGoalAmount = 0;

        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find((l: any) => l.linkId === campaign.id && l.linkType === 'campaign');
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && (d as any).campaignId === campaign.id) {
                amountForThisCampaign = d.amount;
            } else { return; }

            if (amountForThisCampaign === 0) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportionForThisCampaign = amountForThisCampaign / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            
            splits.forEach((split: any) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * proportionForThisCampaign;
                    amountsByCategory[category as DonationCategory] += allocatedAmount;
                    const isForFundraising = category !== 'Zakat' || split.forFundraising !== false;
                    if (category === 'Zakat' && isForFundraising) zakatForGoalAmount += allocatedAmount;
                }
            });
        });
        
        const zakatAllocated = beneficiaries.filter(b => b.isEligibleForZakat && b.zakatAllocation).reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        const zakatGiven = beneficiaries.filter(b => b.isEligibleForZakat && b.zakatAllocation && b.status === 'Given').reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        const zakatPending = zakatAllocated - zakatGiven;
        const zakatAvailableForGoal = Math.max(0, zakatForGoalAmount - zakatAllocated);

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatAvailableForGoal;
                return sum + amount;
            }, 0);

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        const donationStatusStats = donations.reduce((acc, donation) => {
            const status = donation.status || 'Pending';
            let amountForThisCampaign = 0;
            const campaignLink = donation.linkSplit?.find((l: any) => l.linkId === campaign.id && l.linkType === 'campaign');
            if (campaignLink) amountForThisCampaign = campaignLink.amount;
            else if ((!donation.linkSplit || donation.linkSplit.length === 0) && (donation as any).campaignId === campaign.id) amountForThisCampaign = donation.amount;

            if (status === 'Verified') { acc.verified.count++; acc.verified.amount += amountForThisCampaign; }
            else if (status === 'Pending') { acc.pending.count++; acc.pending.amount += amountForThisCampaign; }
            else if (status === 'Canceled') { acc.canceled.count++; acc.canceled.amount += amountForThisCampaign; }
            return acc;
        }, { verified: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 }, canceled: { count: 0, amount: 0 } });

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        const fitraTotal = amountsByCategory['Fitra'] || 0;
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const fidiyaTotal = amountsByCategory['Fidiya'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + sadaqahTotal + fidiyaTotal + interestTotal + lillahTotal + loanTotal + monthlyContributionTotal;

        return { totalCollectedForGoal, fundingProgress, targetAmount: fundingGoal, remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal), totalBeneficiaries: beneficiaries.length, beneficiariesGiven, beneficiariesPending, zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal, zakatForGoalAmount, fundTotals: { fitra: fitraTotal, zakat: zakatTotal, sadaqah: sadaqahTotal, fidiya: fidiyaTotal, interest: interestTotal, lillah: lillahTotal, loan: loanTotal, monthlyContribution: monthlyContributionTotal, grandTotal: grandTotal }, donationStatusStats, amountsByCategory };
    }, [allDonations, campaign, beneficiaries, sanitizedRationLists]);
    
    const isLoading = isCampaignLoading || areDonationsLoading || areBeneficiariesLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!campaign || !summaryData) return;
        const shareText = `Campaign: ${campaign.name}\nTarget: ₹${summaryData.targetAmount.toLocaleString('en-IN')}\nRaised: ₹${summaryData.totalCollectedForGoal.toLocaleString('en-IN')}`;
        setShareDialogData({ title: `Campaign Summary: ${campaign.name}`, text: shareText, url: `${window.location.origin}/campaign-public/${campaignId}/summary` });
        setIsShareDialogOpen(true);
    };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: `Campaign Summary: ${campaign?.name || 'Summary'}`, documentName: `campaign-summary-${campaignId}`, brandingSettings, paymentSettings });
    };

    if (isLoading) return <BrandedLoader />;
    
    if (campaignError || beneficiariesError || donationsError) {
        return ( <main className="container mx-auto p-4 md:p-8"><Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Error Loading Data</AlertTitle><AlertDescription><p>Problem fetching data.</p></AlertDescription></Alert></main> );
    }

    if (!campaign) return <main className="container mx-auto p-4 md:p-8 text-center"><p>Campaign not found.</p></main>;
    
    const itemName = campaign.category === 'Ration' ? 'Kits' : 'Items/Services';
    const givenLabel = `${itemName} Provided`;
    const pendingLabel = `Pending ${itemName}`;

    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns</Link></Button></div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    {editMode ? ( <Input id="name" value={editableCampaign.name || ''} onChange={(e) => setEditableCampaign(p => ({...p, name: e.target.value}))} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0" /> ) : ( <h1 className="text-3xl font-bold">{campaign.name}</h1> )}
                    {editMode ? ( <Select value={editableCampaign.status} onValueChange={(value) => setEditableCampaign(p => ({...p, status: value as any}))}><SelectTrigger className="w-fit border-0 shadow-none focus:ring-0 p-0 h-auto text-muted-foreground [&>svg]:ml-1"><SelectValue placeholder="Select a status" /></SelectTrigger><SelectContent><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent></Select> ): ( <p className="text-muted-foreground">{campaign.status}</p> )}
                </div>
                <div className="flex gap-2">
                    {!editMode && (
                        <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Download className="mr-2 h-4 w-4" /> Download</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => handleDownload('png')}>Download as Image (PNG)</DropdownMenuItem><DropdownMenuItem onClick={() => handleDownload('pdf')}>Download as PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button onClick={handleShare} variant="outline"><Share2 className="mr-2 h-4 w-4" /> Share</Button></>
                    )}
                    {canUpdate && userProfile && ( !editMode ? ( <Button onClick={handleEditClick}><Edit className="mr-2 h-4 w-4" /> Edit Summary</Button> ) : ( <div className="flex gap-2"><Button variant="outline" onClick={handleCancel}>Cancel</Button><Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save</Button></div> ) )}
                </div>
            </div>

             <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}/summary` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Summary</Link> )}
                        {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Item Lists</Link> )}
                        {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Beneficiary List</Link> )}
                         {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Donations</Link> )}
                    </div>
                </ScrollArea>
            </div>

            <div className="space-y-6">
                 <div ref={summaryRef} className="space-y-6 p-4 bg-background">
                    <Card className="animate-fade-in-zoom">
                        <CardHeader><CardTitle>Campaign Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {editMode ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Header Image</Label>
                                        <Input id="imageFile" type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                        <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                                            {imagePreview ? ( <><Image src={imagePreview} alt="Preview" fill sizes="100vw" className="object-cover rounded-lg" /><Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleRemoveImage}><Trash2 className="h-4 w-4" /></Button></> ) : ( <div className="flex flex-col items-center justify-center pt-5 pb-6"><UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" /><p className="mb-2 text-sm text-center text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p></div> )}
                                        </label>
                                    </div>
                                    <div><Label htmlFor="description">Description</Label><Textarea id="description" value={editableCampaign.description} onChange={(e: any) => handleFieldChange('description', e.target.value)} className="mt-1" rows={4} /></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label htmlFor="startDate">Start Date</Label><Input id="startDate" type="date" value={editableCampaign.startDate || ''} onChange={(e) => handleFieldChange('startDate', e.target.value)} /></div>
                                        <div className="space-y-1"><Label htmlFor="endDate">End Date</Label><Input id="endDate" type="date" value={editableCampaign.endDate || ''} onChange={(e) => handleFieldChange('endDate', e.target.value)} /></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {campaign.imageUrl && <div className="relative w-full h-40 rounded-lg overflow-hidden mb-4"><Image src={campaign.imageUrl} alt={campaign.name} fill sizes="100vw" className="object-cover" /></div>}
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground uppercase text-xs font-bold">Description</Label>
                                        <p className="mt-1 text-sm whitespace-pre-wrap">{campaign.description || 'No description provided.'}</p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
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
                                        <div className="space-y-3">
                                            {existingDocuments.map((doc) => {
                                                const isImage = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
                                                return (
                                                <div key={doc.url} className="flex items-center justify-between p-2 border rounded-md gap-4">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                                            {isImage ? (
                                                                <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} width={48} height={48} className="object-cover h-full w-full" />
                                                            ) : (
                                                                <File className="h-6 w-6 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate min-w-0">
                                                            <p className="truncate">{doc.name}</p>
                                                        </a>
                                                    </div>
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
                                                )
                                            })}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">No artifacts uploaded yet.</p>}
                                </div>
                            ) : (
                                campaign.documents && campaign.documents.length > 0 ? (
                                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {campaign.documents.map((doc) => {
                                            const isImage = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
                                            return (
                                                <Card key={doc.url} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="group block flex-grow">
                                                        <CardContent className="p-0">
                                                            <div className="relative aspect-square w-full bg-muted flex items-center justify-center">
                                                                {isImage ? (
                                                                    <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
                                                                ) : (
                                                                    <File className="w-10 h-10 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="p-2 text-center">
                                                                <p className="text-xs font-medium truncate group-hover:underline">{doc.name}</p>
                                                            </div>
                                                        </CardContent>
                                                    </a>
                                                    <CardFooter className="p-2 border-t mt-auto">
                                                        <div className="flex items-center justify-center w-full gap-2">
                                                            {canUpdate ? (
                                                                <>
                                                                    <Switch 
                                                                        id={`quick-toggle-${doc.url}`} 
                                                                        checked={!!doc.isPublic} 
                                                                        onCheckedChange={() => quickToggleDocumentPublic(doc)} 
                                                                    />
                                                                    <Label htmlFor={`quick-toggle-${doc.url}`} className="text-xs cursor-pointer">Public</Label>
                                                                </>
                                                            ) : (
                                                                <Badge variant={doc.isPublic ? "outline" : "secondary"}>{doc.isPublic ? "Public" : "Private"}</Badge>
                                                            )}
                                                        </div>
                                                    </CardFooter>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">No artifacts uploaded yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle>
                            <CardDescription>Verified donations against the goal for this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isClient ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                  <div className="relative h-48 w-full">
                                      <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                          <RadialBarChart data={[{ name: 'Progress', value: summaryData?.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                            <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} />
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                          </RadialBarChart>
                                      </ChartContainer>
                                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-primary">{(summaryData?.fundingProgress || 0).toFixed(0)}%</span><span className="text-xs text-muted-foreground">Funded</span></div>
                                  </div>
                                  <div className="space-y-4 text-center md:text-left">
                                      <div><p className="text-sm text-muted-foreground">Raised for Goal</p><p className="text-3xl font-bold">₹{(summaryData?.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                      <div><p className="text-sm text-muted-foreground">Fundraising Target</p><p className="text-3xl font-bold">₹{(summaryData?.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                      <div><p className="text-sm text-muted-foreground">Grand Total Received</p><p className="text-3xl font-bold">₹{(summaryData?.fundTotals.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                  </div>
                              </div>
                          ) : <Skeleton className="w-full h-48" />}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{summaryData?.totalBeneficiaries ?? 0}</div></CardContent>
                        </Card>
                        <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{givenLabel}</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{summaryData?.beneficiariesGiven ?? 0}</div></CardContent>
                        </Card>
                        <Card className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{pendingLabel}</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{summaryData?.beneficiariesPending ?? 0}</div></CardContent>
                        </Card>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified Donations</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.verified.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.verified.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                        <Card className="animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending Donations</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.pending.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.pending.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                        <Card className="animate-fade-in-up" style={{ animationDelay: '800ms' }}>
                            <CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled Donations</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{summaryData?.donationStatusStats?.canceled.count}</div>
                                <p className="text-xs text-muted-foreground">₹{summaryData?.donationStatusStats?.canceled.amount.toLocaleString('en-IN')}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="animate-fade-in-up" style={{ animationDelay: '900ms' }}>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>Tracking of Zakat funds collected and allocated within this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                           <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Zakat Collected</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator />
                            <div className="pl-4 border-l-2 border-dashed space-y-2 py-2">
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Allocated as Cash-in-Hand</span><span className="font-semibold font-mono">₹{(summaryData?.zakatAllocated || 0).toLocaleString('en-IN')}</span></div>
                                <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground">Given</span><span className="font-mono text-green-600">₹{(summaryData?.zakatGiven || 0).toLocaleString('en-IN')}</span></div>
                                 <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground">Pending</span><span className="font-mono text-amber-600">₹{(summaryData?.zakatPending || 0).toLocaleString('en-IN')}</span></div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-base"><span className="font-bold">Zakat Balance for Goal</span><span className="font-bold text-primary font-mono">₹{(summaryData?.zakatAvailableForGoal || 0).toLocaleString('en-IN')}</span></div>
                             {campaign.allowedDonationTypes?.includes('Zakat') && <p className="text-xs text-muted-foreground pt-1">Because Zakat is allowed for this campaign, the balance is applied to the fundraising goal.</p>}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="animate-fade-in-up" style={{ animationDelay: '1000ms' }}>
                          <CardHeader><CardTitle>Fund Totals by Type</CardTitle></CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fitra</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fidiya</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.fidiya.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (disposal)</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold font-mono">₹{summaryData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                            <Separator className="my-2"/><div className="flex justify-between items-center text-base"><span className="font-semibold">Grand Total Received</span><span className="font-bold text-primary font-mono">₹{summaryData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span></div>
                          </CardContent>
                      </Card>
                      <Card className="animate-fade-in-up" style={{ animationDelay: '1100ms' }}>
                          <CardHeader><CardTitle>Donations by Category</CardTitle></CardHeader>
                          <CardContent>
                            {isClient ? (
                              <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                  <BarChart data={Object.entries(summaryData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ right: 20 }}>
                                      <CartesianGrid horizontal={false} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 12 }} width={120}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4}>{Object.entries(summaryData?.amountsByCategory || {}).map(([name]) => (<Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />))}</Bar>
                                  </BarChart>
                              </ChartContainer>
                            ) : <Skeleton className="h-[250px] w-full" />}
                          </CardContent>
                      </Card>
                    </div>
                 </div>
            </div>
            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />
        </main>
    );
}
