'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
    useFirestore, 
    useDoc, 
    errorEmitter, 
    FirestorePermissionError, 
    useCollection, 
    useMemoFirebase, 
    useStorage, 
    useAuth, 
    collection, 
    doc,
    type DocumentReference,
    updateDoc,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL
} from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import type { Campaign, Beneficiary, Donation, CampaignDocument, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
    ArrowLeft, 
    Edit, 
    Save, 
    Share2, 
    Download, 
    UploadCloud, 
    Trash2, 
    File, 
    Target,
    Users,
    Gift,
    Hourglass,
    TrendingUp,
    PieChart as PieChartIcon,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    ImageIcon,
    Utensils,
    LifeBuoy,
    HandHelping
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileUploader } from '@/components/file-uploader';
import { Switch } from '@/components/ui/switch';
import { BrandedLoader } from '@/components/branded-loader';
import Resizer from 'react-image-file-resizer';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartConfig } from '@/components/ui/chart';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-3))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-7))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-5))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-8))" },
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

    const [editMode, setEditMode] = useState(false);
    const [editableCampaign, setEditableCampaign] = useState<Partial<Campaign>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isImageDeleted, setIsImageDeleted] = useState(false);
    const [isClient, setIsClient] = useState(false);

    const [newDocuments, setNewDocuments] = useState<File[]>([]);
    const [existingDocuments, setExistingDocuments] = useState<CampaignDocument[]>([]);
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<{url: string, name: string} | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const summaryRef = useRef<HTMLDivElement>(null);

    const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const visibilityRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_visibility') : null, [firestore]);
    const { data: visibilitySettings } = useDoc<any>(visibilityRef);

    useEffect(() => { setIsClient(true); }, []);

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
        }
    }, [campaign, editMode]);

    const isRationInitiative = useMemo(() => {
        return campaign?.category === 'Ration';
    }, [campaign]);

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
    const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
    const canUpdateSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.update', false) || !!getNestedValue(userProfile, 'permissions.campaigns.summary.update', false);

    const beneficiaryGroups = useMemo(() => {
        if (!campaign || !beneficiaries) return [];
        const categories = (campaign.itemCategories || []).filter(c => c.name !== 'Item Price List');
        return categories.map(cat => {
            const count = beneficiaries.filter(b => b.itemCategoryId === cat.id).length;
            const kitAmount = cat.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            
            let displayName = cat.name;
            if (isRationInitiative) {
                if (cat.minMembers === 1 && cat.maxMembers === 1) displayName = `Member (1)`;
                else if (cat.minMembers !== undefined && cat.maxMembers !== undefined) displayName = `Members (${cat.minMembers}-${cat.maxMembers})`;
            }

            return { id: cat.id, name: displayName, count, kitAmount, totalAmount: count * kitAmount };
        });
    }, [campaign, beneficiaries, isRationInitiative]);

    const fundingData = useMemo(() => {
        if (!allDonations || !campaign || !beneficiaries) return null;
        
        const donationsList = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) {
                return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            }
            return (d as any).campaignId === campaign.id;
        });

        const verifiedDonationsList = donationsList.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const amountsByPaymentType: Record<string, number> = {};
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

            const paymentType = d.donationType || 'Other';
            amountsByPaymentType[paymentType] = (amountsByPaymentType[paymentType] || 0) + 1;

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

        return { 
            totalCollectedForGoal, 
            fundingProgress: (campaign.targetAmount || 0) > 0 ? (totalCollectedForGoal / campaign.targetAmount!) * 100 : 0, 
            targetAmount: campaign.targetAmount || 0, 
            totalBeneficiaries: beneficiaries.length, 
            beneficiariesGiven: beneficiaries.filter(b => b.status === 'Given').length, 
            beneficiariesPending: beneficiaries.length - beneficiaries.filter(b => b.status === 'Given').length, 
            zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal, amountsByCategory, amountsByPaymentType,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, campaign, beneficiaries]);

    const paymentTypeChartData = useMemo(() => {
        if (!fundingData?.amountsByPaymentType) return [];
        return Object.entries(fundingData.amountsByPaymentType).map(([name, value]) => ({
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));
    }, [fundingData]);

    const handleFieldChange = (field: keyof Campaign, value: any) => {
        setEditableCampaign(p => ({...p, [field]: value}));
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => { setImagePreview(reader.result as string); };
            reader.readAsDataURL(file);
            setIsImageDeleted(false);
        }
    };
    
    const handleRemoveImage = () => { setImageFile(null); setImagePreview(null); setIsImageDeleted(true); };

    const handleRemoveExistingDocument = (urlToRemove: string) => {
        setExistingDocuments(prev => prev.filter(doc => doc.url !== urlToRemove));
    };

    const handleToggleDocumentPublic = (urlToToggle: string) => {
        setExistingDocuments(prev => prev.map(doc => doc.url === urlToToggle ? { ...doc, isPublic: !doc.isPublic } : doc));
    };

    const quickToggleDocumentPublic = async (docToToggle: CampaignDocument) => {
        if (!leadDocRef || !campaign?.documents || !canUpdateSummary) return;
        const newDocs = campaign.documents.map(doc => doc.url === docToToggle.url ? { ...doc, isPublic: !doc.isPublic } : doc);
        try {
            await updateDoc(campaignDocRef!, { documents: newDocs, updatedAt: serverTimestamp() });
            toast({ title: "Visibility Updated", variant: "success" });
        } catch (serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campaignDocRef!.path, operation: 'update', requestResourceData: { documents: newDocs } }));
        }
    };

    const isVisible = (key: string) => {
        return visibilitySettings?.[`member_${key}`] !== false;
    };

    const handleSave = async () => {
        if (!campaignDocRef || !userProfile || !canUpdateSummary || !storage) return;
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({ title: "Authentication Error", description: "User Not Authenticated Yet.", variant: "destructive" });
            return;
        }
        let imageUrl = editableCampaign.imageUrl || '';
        let imageUrlFilename = editableCampaign.imageUrlFilename || '';
        if (isImageDeleted && imageUrl) {
            imageUrl = '';
            imageUrlFilename = '';
        } else if (imageFile) {
            try {
                const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
                const filePath = `campaigns/${campaignId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
                const dateStr = new Date().toISOString().split('T')[0];
                imageUrlFilename = `campaign_${editableCampaign.name?.replace(/\s+/g, '_')}_${dateStr}.png`;
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', variant: 'destructive'});
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
        const saveData: Partial<Campaign> = {
            ...editableCampaign,
            targetAmount: Number(editableCampaign.targetAmount) || 0,
            imageUrl: imageUrl,
            imageUrlFilename: imageUrlFilename,
            documents: finalDocuments,
            updatedAt: serverTimestamp(),
        };
        updateDoc(campaignDocRef, saveData)
            .catch(async (serverError: any) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campaignDocRef.path, operation: 'update', requestResourceData: saveData })); })
            .finally(() => { toast({ title: 'Success', description: 'Campaign Updated.', variant: 'success' }); setEditMode(false); });
    };
    
    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: `Campaign Summary: ${campaign?.name}`, documentName: `campaign-summary-${campaignId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string, name: string) => {
        setImageToView({ url, name });
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const chartDataValues = useMemo(() => {
        return fundingData?.amountsByCategory ? Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ 
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` 
        })) : [];
    }, [fundingData]);

    const FallbackIcon = campaign?.category === 'Ration' ? Utensils : campaign?.category === 'Relief' ? LifeBuoy : HandHelping;

    const isLoadingPage = isCampaignLoading || isProfileLoading || areBeneficiariesLoading;

    if (isLoadingPage) return <BrandedLoader />;

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal">
             <div className="mb-4 transition-all duration-300 hover:-translate-x-1"><Button variant="secondary" asChild className="font-bold border-primary/20 transition-transform active:scale-95"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 animate-fade-in-up">
                 <div className="space-y-1">
                    {editMode ? ( <Input id="name" value={editableCampaign.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 text-primary" /> ) : ( <h1 className="text-3xl font-bold text-primary tracking-tight">{campaign?.name}</h1> )}
                    {editMode ? ( <Select value={editableCampaign.status} onValueChange={(value) => setEditableCampaign(p => ({...p, status: value as any}))}><SelectTrigger className="w-fit border-0 shadow-none focus:ring-0 p-0 h-auto text-muted-foreground [&>svg]:ml-1 font-bold"><SelectValue placeholder="Select Status" /></SelectTrigger><SelectContent className="animate-fade-in-zoom"><SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Completed" className="font-bold">Completed</SelectItem></SelectContent></Select> ): ( <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">{campaign?.status}</p> )}
                </div>
                <div className="flex gap-2">
                    {!editMode && (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="secondary" className="font-bold active:scale-95 transition-all duration-300 hover:shadow-md"><Download className="mr-2 h-4 w-4" /> Download</Button></DropdownMenuTrigger>
                                <DropdownMenuContent className="animate-fade-in-zoom"><DropdownMenuItem onClick={() => handleDownload('png')} className="font-bold text-primary">Download As Image (PNG)</DropdownMenuItem><DropdownMenuItem onClick={() => handleDownload('pdf')} className="font-bold text-primary">Download As PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                            <Button onClick={() => { if(campaign) setShareDialogData({ title: `Campaign: ${campaign.name}`, text: campaign.description || '', url: window.location.origin + `/campaign-public/${campaignId}/summary` }); setIsShareDialogOpen(true); }} variant="secondary" className="font-bold active:scale-95 transition-all duration-300 hover:shadow-md"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                        </>
                    )}
                    {canUpdateSummary && userProfile && ( !editMode ? ( <Button onClick={() => setEditMode(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-md active:scale-95 transition-all duration-300 hover:shadow-xl"><Edit className="mr-2 h-4 w-4" /> Edit Summary</Button> ) : ( <div className="flex gap-2"><Button variant="outline" onClick={() => setEditMode(false)} className="font-bold border-primary/20 text-primary transition-transform">Cancel</Button><Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-md active:scale-95 transition-all duration-300 hover:shadow-xl"><Save className="mr-2 h-4 w-4" /> Save Changes</Button></div> ) )}
                </div>
            </div>

             <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <ScrollArea className="w-full">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full bg-transparent p-0 border-b border-primary/10 pb-4">
                        <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}/summary` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                        {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item Lists</Link> )}
                        {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link> )}
                         {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link> )}
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-up shadow-md border-primary/10 bg-white transition-all duration-300 hover:shadow-xl">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="font-bold text-primary tracking-tight">Campaign Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {editMode ? (
                            <div className="space-y-6 font-normal animate-fade-in-zoom">
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Header Image</Label>
                                    <Input id="imageFile" type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-all duration-300 group">
                                        {imagePreview ? ( <><Image src={imagePreview} alt="Preview" fill sizes="100vw" className="object-cover rounded-lg" /><Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 transition-all duration-300 hover:scale-110 active:scale-90 shadow-lg" onClick={handleRemoveImage}><Trash2 className="h-4 w-4" /></Button></> ) : ( <div className="flex flex-col items-center justify-center pt-5 pb-6 transition-transform group-hover:scale-105"><UploadCloud className="w-8 h-8 mb-2 text-muted-foreground group-hover:text-primary" /><p className="mb-2 text-sm text-center text-muted-foreground font-bold"><span className="text-primary">Click To Upload</span></p></div> )}
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Category</Label>
                                        <Select value={editableCampaign.category} onValueChange={(val) => handleFieldChange('category', val)}>
                                            <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                                            <SelectContent className="animate-fade-in-zoom">
                                                <SelectItem value="Ration" className="font-bold">Ration</SelectItem>
                                                <SelectItem value="Relief" className="font-bold">Relief</SelectItem>
                                                <SelectItem value="General" className="font-bold">General</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Fundraising Goal (₹)</Label><Input type="number" value={editableCampaign.targetAmount || 0} onChange={(e) => handleFieldChange('targetAmount', e.target.value)} className="text-primary font-bold transition-all duration-300 focus:shadow-md" /></div>
                                </div>
                                <div><Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Description</Label><Textarea id="description" value={editableCampaign.description || ''} onChange={(e: any) => handleFieldChange('description', e.target.value)} className="mt-1 text-foreground font-normal transition-all duration-300 focus:shadow-md" rows={4} /></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Start Date</Label><Input id="startDate" type="date" value={editableCampaign.startDate || ''} onChange={(e) => handleFieldChange('startDate', e.target.value)} className="text-foreground font-bold" /></div>
                                    <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">End Date</Label><Input id="endDate" type="date" value={editableCampaign.endDate || ''} onChange={(e) => handleFieldChange('endDate', e.target.value)} className="text-foreground font-bold" /></div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Allowed Donation Types For Goal</Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded-md p-3 bg-white">
                                        {donationCategories.map(type => (
                                            <div key={type} className="flex items-center space-x-2 transition-all duration-300 hover:translate-x-1">
                                                <Checkbox 
                                                    id={`edit-type-camp-${type}`}
                                                    checked={editableCampaign.allowedDonationTypes?.includes(type)}
                                                    onCheckedChange={(checked) => {
                                                        const current = editableCampaign.allowedDonationTypes || [];
                                                        const updated = checked ? [...current, type] : current.filter(t => t !== type);
                                                        handleFieldChange('allowedDonationTypes', updated);
                                                    }}
                                                />
                                                <Label htmlFor={`edit-type-camp-${type}`} className="text-xs font-bold cursor-pointer">{type}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative w-full h-40 rounded-lg overflow-hidden mb-4 bg-secondary flex items-center justify-center cursor-pointer transition-all duration-500 hover:shadow-lg group" onClick={() => { if(campaign?.imageUrl) handleViewImage(campaign.imageUrl, campaign.name); }}>
                                    {campaign?.imageUrl ? (
                                        <Image src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`} alt={campaign.name} fill sizes="100vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                    ) : (
                                        <FallbackIcon className="h-20 w-20 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110" />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                </div>
                                <div className="space-y-2 font-normal text-foreground">
                                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Campaign Description</Label>
                                    <p className="mt-1 text-sm font-normal whitespace-pre-wrap leading-relaxed">{campaign?.description || 'No description provided.'}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {fundingData && (
                    <div className="grid gap-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        {isVisible('funding_progress') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="flex items-center gap-2 font-bold text-primary"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle>
                                    <CardDescription className="font-normal text-primary/70">Verified donations for this campaign.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center font-normal">
                                        <div className="relative h-48 w-full transition-transform duration-500 hover:scale-105">
                                            {isClient ? (
                                                <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                                    <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                                        <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} className="transition-all duration-1000 ease-out" />
                                                    </RadialBarChart>
                                                </ChartContainer>
                                            ) : <Skeleton className="w-full h-full rounded-full" />}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in-zoom"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Funded</span></div>
                                        </div>
                                        <div className="space-y-4 text-center md:text-left text-primary font-bold animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                                            <div className="transition-transform hover:translate-x-1 duration-300"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Raised For Goal</p><p className="text-3xl font-bold text-primary font-mono">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                            <div className="transition-transform hover:translate-x-1 duration-300"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Goal</p><p className="text-3xl font-bold text-primary opacity-60 font-mono">₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                            <div className="transition-transform hover:translate-x-1 duration-300"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Grand Total Received</p><p className="text-2xl font-bold text-primary font-mono">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isVisible('quick_stats') && (
                            <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 font-normal">
                                <Card className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.totalBeneficiaries}</div></CardContent></Card>
                                <Card className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Kits Given</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.beneficiariesGiven}</div></CardContent></Card>
                                <Card className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.beneficiariesPending}</div></CardContent></Card>
                            </div>
                        )}

                        {isVisible('beneficiary_groups') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="font-bold text-primary uppercase tracking-tight">
                                        {isRationInitiative ? 'Beneficiary Categories' : 'Required Financial Allocation'}
                                    </CardTitle>
                                    <CardDescription className="font-normal text-primary/70">
                                        {isRationInitiative 
                                            ? 'Breakdown of requirements by family size category.' 
                                            : 'Itemized requirement breakdown for this initiative.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6 font-normal">
                                    <ScrollArea className="w-full">
                                        <div className="border rounded-lg overflow-hidden font-normal text-foreground shadow-sm">
                                            {isRationInitiative ? (
                                                <Table>
                                                    <TableHeader className="bg-[#ECFDF5]">
                                                        <TableRow>
                                                            <TableHead className="font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Category Name</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Beneficiaries</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Kit Amount</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Total Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {beneficiaryGroups.map((group) => (
                                                            <TableRow key={group.id} className="hover:bg-[#F0FDF4] transition-colors group bg-white">
                                                                <TableCell className="font-bold text-primary text-xs transition-transform group-hover:translate-x-1">{group.name}</TableCell>
                                                                <TableCell className="text-right font-normal text-xs">{group.count}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{group.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    {beneficiaryGroups.length > 0 && (
                                                        <tfoot className="bg-primary/5 border-t font-bold">
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-[10px] tracking-widest">Total Initiative Requirement</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-primary text-base">₹{beneficiaryGroups.reduce((sum, g) => sum + g.totalAmount, 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        </tfoot>
                                                    )}
                                                </Table>
                                            ) : (
                                                <Table>
                                                    <TableHeader className="bg-[#ECFDF5]">
                                                        <TableRow>
                                                            <TableHead className="font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Requirement Description</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Quantity</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Unit Price</TableHead>
                                                            <TableHead className="text-right font-semibold text-[#14532D] text-[10px] uppercase tracking-widest">Total Cost</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {campaign?.itemCategories?.[0]?.items.map((item, idx) => (
                                                            <TableRow key={idx} className="hover:bg-[#F0FDF4] transition-colors group bg-white">
                                                                <TableCell className="font-medium text-xs transition-transform group-hover:translate-x-1">{item.name}</TableCell>
                                                                <TableCell className="text-right text-xs">{item.quantity} {item.quantityType}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price / (item.quantity || 1)).toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price || 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    <tfoot className="bg-primary/5 border-t font-bold">
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-[10px] tracking-widest">Single Unit Total</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-primary text-base">
                                                                ₹{(campaign?.itemCategories?.[0]?.items.reduce((sum, i) => sum + i.price, 0) || 0).toLocaleString('en-IN')}
                                                            </TableCell>
                                                        </TableRow>
                                                    </tfoot>
                                                </Table>
                                            )}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-6 lg:grid-cols-2 font-normal">
                            {isVisible('fund_totals') && (
                                <Card className="shadow-sm border-primary/5 bg-white transition-all duration-300 hover:shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm uppercase tracking-widest">Fund Totals By Designation</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 pt-6 font-normal text-foreground">
                                        {donationCategories.map(cat => (
                                            <div key={cat} className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded">
                                                <span className="text-muted-foreground font-normal">{cat === 'Interest' ? 'Interest (For Disposal)' : cat === 'Loan' ? 'Loan (Qard-e-Hasana)' : cat}</span>
                                                <span className="font-mono font-bold">₹{(fundingData.amountsByCategory[cat] || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <Separator className="my-2" />
                                        <div className="flex justify-between items-center text-lg font-bold text-primary px-2">
                                            <span>Grand Total Received</span>
                                            <span className="font-mono font-bold">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('zakat_utilization') && (
                                <Card className="shadow-sm border-primary/5 bg-white transition-all duration-300 hover:shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm uppercase tracking-widest">Zakat Fund Utilization</CardTitle><CardDescription className="font-normal text-primary/70">Tracking of designated Zakat resources.</CardDescription></CardHeader>
                                    <CardContent className="space-y-3 pt-6 font-normal text-foreground">
                                        <div className="flex justify-between items-center text-sm font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded"><span className="text-muted-foreground uppercase tracking-tighter font-normal">Total Zakat Collected</span><span className="font-bold font-mono">₹{fundingData.amountsByCategory.Zakat.toLocaleString('en-IN')}</span></div>
                                        <Separator />
                                        <div className="pl-4 border-l-2 border-dashed border-primary/20 space-y-2 py-2 font-bold">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded"><span className="text-muted-foreground uppercase tracking-tighter font-normal">Allocated As Assistance</span><span className="font-bold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded"><span className="text-muted-foreground uppercase tracking-tighter font-normal">Disbursed Funds</span><span className="font-bold font-mono">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded"><span className="text-muted-foreground uppercase tracking-tighter font-normal">Support Outstanding</span><span className="font-bold font-mono">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span></div>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between items-center text-base font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded"><span>Net Zakat Balance</span><span className="font-bold text-primary font-mono">₹{fundingData.zakatAvailableForGoal.toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 font-normal text-primary">
                            {isVisible('donations_by_category') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm uppercase tracking-widest">Donations By Designation</CardTitle></CardHeader>
                                    <CardContent className="p-0 sm:p-6">
                                        {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                            <BarChart data={chartDataValues} layout="vertical" margin={{ right: 20 }}>
                                                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'hsl(var(--primary))' }} width={100}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} hide /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4} className="transition-all duration-1000 ease-out">{chartDataValues.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}</Bar>
                                            </BarChart>
                                        </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full" />}
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('donations_by_payment_type') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold text-primary text-sm uppercase tracking-widest">Verified Payment Channels</CardTitle></CardHeader>
                                    <CardContent className="p-0 sm:p-6">
                                        {isClient ? (
                                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                                <PieChart>
                                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                    <Pie data={paymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5} className="transition-all duration-1000 ease-out focus:outline-none">
                                                        {paymentTypeChartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />))}
                                                    </Pie>
                                                    <ChartLegend content={<ChartLegendContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full" />}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {isVisible('documents') && (
                    <Card className="animate-fade-in-up bg-white shadow-sm border-primary/10 transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '400ms' }}>
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm uppercase tracking-widest">Verified Institutional Artifacts</CardTitle></CardHeader>
                        <CardContent className="font-normal text-primary pt-6">
                        {editMode ? (
                                <div className="space-y-4 animate-fade-in-zoom">
                                    <Label className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">Upload New Verifiable Evidence</Label>
                                    <FileUploader onFilesChange={setNewDocuments} multiple acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf" />
                                    <Separator className="my-6" />
                                    <Label className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">Manage Existing Artifacts</Label>
                                    {existingDocuments.length > 0 ? (
                                        <div className="space-y-3 font-normal text-foreground">
                                            {existingDocuments.map((doc) => (
                                                <div key={doc.url} className="flex items-center justify-between p-2 border rounded-md gap-4 bg-primary/5 transition-all hover:bg-primary/10">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Button variant="link" className="p-0 h-auto font-bold truncate text-primary active:scale-95" onClick={() => { if (doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i)) handleViewImage(doc.url, doc.name); else window.open(doc.url, '_blank'); }}><p className="truncate text-xs">{doc.name}</p></Button>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2"><Switch checked={doc.isPublic} onCheckedChange={() => handleToggleDocumentPublic(doc.url)} /><Label className="text-[10px] text-foreground font-bold uppercase tracking-tighter opacity-60">Public</Label></div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-transform hover:scale-110 active:scale-90" onClick={() => handleRemoveExistingDocument(doc.url)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic opacity-60">No documents attached.</p>}
                                </div>
                            ) : (
                                campaign?.documents && campaign?.documents.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {campaign.documents.map((doc, idx) => {
                                            const isImg = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                            return (
                                                <Card key={doc.url} className="overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col active:scale-95 bg-white border-primary/10 cursor-pointer shadow-sm group animate-fade-in-up" style={{ animationDelay: `${50 + idx * 50}ms` }} onClick={() => { if (isImg) handleViewImage(doc.url, doc.name); else window.open(doc.url, '_blank'); }}>
                                                    <div className="block flex-grow">
                                                        <div className="relative aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
                                                            {isImg ? <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="100vw" className="object-cover transition-transform duration-500 group-hover:scale-110" /> : <File className="w-10 h-10 text-muted-foreground transition-transform duration-500 group-hover:scale-110" />}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                                                        </div>
                                                        <div className="p-2 text-center text-[10px] font-bold text-primary uppercase tracking-tighter truncate transition-colors group-hover:text-primary/80">{doc.name}</div>
                                                    </div>
                                                    <CardFooter className="p-2 border-t mt-auto flex justify-center w-full gap-2 bg-muted/5" onClick={e => e.stopPropagation()}>
                                                        {canUpdateSummary ? ( <><Switch checked={!!doc.isPublic} onCheckedChange={() => quickToggleDocumentPublic(doc)} /><Label className="text-[9px] text-foreground font-bold uppercase tracking-tighter">Public</Label></> ) : ( <Badge variant={doc.isPublic ? "eligible" : "secondary"} className="font-bold uppercase text-[9px] tracking-tighter">{doc.isPublic ? "Public" : "Private"}</Badge> )}
                                                    </CardFooter>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic opacity-60">No verifiable evidence available.</p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden animate-fade-in-zoom">
                    <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="font-bold text-primary uppercase tracking-widest text-sm">{imageToView?.name}</DialogTitle></DialogHeader>
                    <ScrollArea className="flex-1 bg-secondary/20">
                        <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                            {imageToView && (
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Verification Evidence" fill sizes="100vw" className="object-contain transition-all duration-300 origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                            )}
                        </div>
                        <ScrollBar orientation="both" />
                    </ScrollArea>
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
