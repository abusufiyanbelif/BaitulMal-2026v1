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
import type { Lead, Beneficiary, Donation, CampaignDocument, DonationCategory } from '@/lib/types';
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
    ShieldAlert, 
    GraduationCap, 
    HeartPulse, 
    LifeBuoy, 
    Info, 
    HandHelping,
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
    ImageIcon
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters } from '@/lib/modules';
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
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

export default function LeadSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const storage = useStorage();
    const auth = useAuth();
    const { toast } = useToast();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { download } = useDownloadAs();

    const [editMode, setEditMode] = useState(false);
    const [editableLead, setEditableLead] = useState<Partial<Lead>>({});
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

    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const visibilityRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_visibility') : null, [firestore]);
    const { data: visibilitySettings } = useDoc<any>(visibilityRef);

    useEffect(() => { setIsClient(true); }, []);

    useEffect(() => {
        if (lead && !editMode) {
             setEditableLead({
                name: lead.name || '',
                description: lead.description || '',
                purpose: lead.purpose || 'General',
                category: lead.category || '',
                purposeDetails: lead.purposeDetails || '',
                categoryDetails: lead.categoryDetails || '',
                startDate: lead.startDate || '',
                endDate: lead.endDate || '',
                status: lead.status || 'Upcoming',
                requiredAmount: lead.requiredAmount || 0,
                targetAmount: lead.targetAmount || 0,
                authenticityStatus: lead.authenticityStatus || 'Pending Verification',
                publicVisibility: lead.publicVisibility || 'Hold',
                allowedDonationTypes: lead.allowedDonationTypes || [...donationCategories],
                imageUrl: lead.imageUrl || '',
                documents: lead.documents || [],
                degree: lead.degree || '',
                year: lead.year || '',
                semester: lead.semester || '',
                diseaseIdentified: lead.diseaseIdentified || '',
                diseaseStage: lead.diseaseStage || '',
                seriousness: lead.seriousness || null,
            });
            setExistingDocuments(lead.documents || []);
            setImagePreview(lead.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
            setNewDocuments([]);
        }
    }, [lead, editMode]);

    const isRationInitiative = useMemo(() => {
        return lead?.purpose === 'Relief' && lead?.category === 'Ration Kit';
    }, [lead]);

    const availableCategories = useMemo(() => {
        const selectedPurpose = leadPurposesConfig.find(p => p.id === editableLead.purpose);
        return selectedPurpose?.categories || [];
    }, [editableLead.purpose]);

    const beneficiaryGroups = useMemo(() => {
        if (!lead || !beneficiaries) return [];
        const categories = (lead.itemCategories || []).filter(c => c.name !== 'Item Price List');
        return categories.map(cat => {
            const count = beneficiaries.filter(b => b.itemCategoryId === cat.id).length;
            const kitAmount = cat.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            return { id: cat.id, name: cat.name, count, kitAmount, totalAmount: count * kitAmount };
        });
    }, [lead, beneficiaries]);

    const fundingData = useMemo(() => {
        if (!allDonations || !lead || !beneficiaries) return null;

        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id && link.linkType === 'lead'));
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const amountsByPaymentType: Record<string, number> = {};
        let zakatForGoalAmount = 0;

        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;

            const paymentType = d.donationType || 'Other';
            amountsByPaymentType[paymentType] = (amountsByPaymentType[paymentType] || 0) + 1;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;
            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * allocationProportion;
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
            .filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatAvailableForGoal;
                return sum + amount;
            }, 0);

        return {
            totalCollectedForGoal,
            fundingProgress: (lead.targetAmount || 0) > 0 ? (totalCollectedForGoal / lead.targetAmount!) * 100 : 0,
            targetAmount: lead.targetAmount || 0,
            amountsByCategory,
            amountsByPaymentType,
            zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal,
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven: beneficiaries.filter(b => b.status === 'Given').length,
            beneficiariesPending: beneficiaries.length - beneficiaries.filter(b => b.status === 'Given').length,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, lead, beneficiaries]);

    const paymentTypeChartData = useMemo(() => {
        if (!fundingData?.amountsByPaymentType) return [];
        return Object.entries(fundingData.amountsByPaymentType).map(([name, value]) => ({
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));
    }, [fundingData]);

    const handleFieldChange = (field: keyof Lead, value: any) => {
        setEditableLead(p => (p ? { ...p, [field]: value } : null));
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
        if (!leadDocRef || !lead?.documents || !canUpdate) return;
        const newDocs = lead.documents.map(doc => doc.url === docToToggle.url ? { ...doc, isPublic: !doc.isPublic } : doc);
        try {
            await updateDoc(leadDocRef, { documents: newDocs, updatedAt: serverTimestamp() });
            toast({ title: "Visibility updated" });
        } catch (serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadDocRef.path, operation: 'update', requestResourceData: { documents: newDocs } }));
        }
    };

    const isVisible = (key: string) => {
        return visibilitySettings?.[`member_${key}`] !== false;
    };

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.update', false) || !!getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);

    const handleSave = async () => {
        if (!leadDocRef || !userProfile || !canUpdate || !storage) return;
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({ title: "Authentication error", description: "User not authenticated yet.", variant: "destructive" });
            return;
        }
        let imageUrl = editableLead.imageUrl || '';
        if (isImageDeleted && imageUrl) {
            imageUrl = '';
        } else if (imageFile) {
            try {
                const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
                const filePath = `leads/${leadId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
            } catch (uploadError) {
                toast({ title: 'Image upload failed', variant: 'destructive'});
                return;
            }
        }
        const documentUploadPromises = newDocuments.map(async (file) => {
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = storageRef(storage, `leads/${leadId}/documents/${safeFileName}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            return { name: file.name, url, uploadedAt: new Date().toISOString(), isPublic: false };
        });
        const uploadedDocuments = await Promise.all(documentUploadPromises);
        const finalDocuments = [...existingDocuments, ...uploadedDocuments];
        const saveData: Partial<Lead> = {
            ...editableLead,
            requiredAmount: Number(editableLead.requiredAmount) || 0,
            targetAmount: Number(editableLead.targetAmount) || 0,
            imageUrl: imageUrl,
            documents: finalDocuments,
            updatedAt: serverTimestamp(),
        };
        updateDoc(leadDocRef, saveData)
            .catch(async (serverError: any) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadDocRef.path, operation: 'update', requestResourceData: saveData })); })
            .finally(() => { toast({ title: 'Success', description: 'Lead summary updated.', variant: 'success' }); setEditMode(false); });
    };
    
    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: `Lead Summary: ${lead?.name}`, documentName: `lead-summary-${leadId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string, name: string) => {
        setImageToView({ url, name });
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isLoading = isLeadLoading || areDonationsLoading || areBeneficiariesLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;

    if (isLoading) return <BrandedLoader />;
    if (!lead) return <main className="container mx-auto p-4 md:p-8 text-center font-bold"><p>Lead not found.</p></main>;
    
    const FallbackIcon = lead.purpose === 'Education' ? GraduationCap : lead.purpose === 'Medical' ? HeartPulse : lead.purpose === 'Relief' ? LifeBuoy : lead.purpose === 'Other' ? Info : HandHelping;
    const chartData = fundingData?.amountsByCategory ? Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ name, value })) : [];

    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20"><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to leads</Link></Button></div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    {editMode ? ( <Input id="name" value={editableLead.name || ''} onChange={(e) => setEditableLead(p => ({...p, name: e.target.value}))} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 text-primary" /> ) : ( <h1 className="text-3xl font-bold text-primary">{lead.name}</h1> )}
                    {editMode ? (
                         <Select value={editableLead.status} onValueChange={(value) => setEditableLead(p => ({...p, status: value as any}))}><SelectTrigger className="w-fit border-0 shadow-none focus:ring-0 p-0 h-auto text-muted-foreground [&>svg]:ml-1 font-bold"><SelectValue placeholder="Select a status" /></SelectTrigger><SelectContent><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent></Select>
                    ): ( <p className="text-muted-foreground font-bold">{lead.status}</p> )}
                </div>
                <div className="flex gap-2">
                    {!editMode && (
                        <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="font-bold"><Download className="mr-2 h-4 w-4" /> Download</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => handleDownload('png')}>Download as image (PNG)</DropdownMenuItem><DropdownMenuItem onClick={() => handleDownload('pdf')}>Download as PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button onClick={() => { setShareDialogData({ title: `Lead: ${lead.name}`, text: lead.description || '', url: window.location.origin + `/leads-public/${leadId}/summary` }); setIsShareDialogOpen(true); }} variant="outline" className="font-bold"><Share2 className="mr-2 h-4 w-4" /> Share</Button></>
                    )}
                    {canUpdate && userProfile && ( !editMode ? ( <Button onClick={() => setEditMode(true)} className="bg-primary hover:bg-primary/90 text-white font-bold"><Edit className="mr-2 h-4 w-4" /> Edit summary</Button> ) : ( <div className="flex gap-2"><Button variant="outline" onClick={() => setEditMode(false)} className="font-bold">Cancel</Button><Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white font-bold"><Save className="mr-2 h-4 w-4" /> Save</Button></div>) )}
                </div>
            </div>

            <div className="border-b mb-4">
              <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex w-max space-x-2 pb-2">
                      {canReadSummary && ( <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/leads-members/${leadId}/summary` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold")}>Summary</Link> )}
                      <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/leads-members/${leadId}` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold")}>Item list</Link>
                      {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold")}>Beneficiary list</Link> )}
                      {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold")}>Donations</Link> )}
                  </div>
                  <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-zoom shadow-md border-primary/10 bg-white">
                        <CardHeader className="bg-primary/5"><CardTitle className="font-bold text-primary">Lead details</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6 text-primary">
                            {editMode ? (
                                <div className="space-y-6 font-normal">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs uppercase text-muted-foreground">Header image</Label>
                                        <Input id="imageFile" type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                        <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary">
                                            {imagePreview ? ( <><Image src={imagePreview} alt="Preview" fill sizes="100vw" className="object-cover rounded-lg" /><Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleRemoveImage}><Trash2 className="h-4 w-4" /></Button></> ) : ( <div className="flex flex-col items-center justify-center pt-5 pb-6"><UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" /><p className="mb-2 text-sm text-center text-muted-foreground font-bold"><span className="text-primary">Click to upload</span></p></div> )}
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs uppercase text-muted-foreground">Purpose</Label>
                                            <Select value={editableLead.purpose} onValueChange={(val) => handleFieldChange('purpose', val)}>
                                                <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                                                <SelectContent>{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        {availableCategories.length > 0 && (
                                            <div className="space-y-1">
                                                <Label className="font-bold text-xs uppercase text-muted-foreground">Category</Label>
                                                <Select value={editableLead.category} onValueChange={(val) => handleFieldChange('category', val)}>
                                                    <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                                                    <SelectContent>{availableCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {editableLead.purpose === 'Education' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-primary/5">
                                            <div className="space-y-1"><Label className="font-bold text-xs">Degree</Label><Select value={editableLead.degree} onValueChange={(val) => handleFieldChange('degree', val)}><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger><SelectContent>{educationDegrees.map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs">Year</Label><Select value={editableLead.year} onValueChange={(val) => handleFieldChange('year', val)}><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger><SelectContent>{educationYears.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs">Semester</Label><Select value={editableLead.semester} onValueChange={(val) => handleFieldChange('semester', val)}><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger><SelectContent>{educationSemesters.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                    )}

                                    {editableLead.purpose === 'Medical' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-primary/5">
                                            <div className="space-y-1"><Label className="font-bold text-xs">Disease</Label><Input value={editableLead.diseaseIdentified || ''} onChange={(e) => handleFieldChange('diseaseIdentified', e.target.value)} className="font-bold"/></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs">Stage</Label><Input value={editableLead.diseaseStage || ''} onChange={(e) => handleFieldChange('diseaseStage', e.target.value)} className="font-bold"/></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs">Seriousness</Label><Select value={editableLead.seriousness || ''} onValueChange={(val) => handleFieldChange('seriousness', val)}><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger><SelectContent>{leadSeriousnessLevels.map(l=><SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                    )}

                                    <div><Label className="font-bold text-xs uppercase text-muted-foreground">Description</Label><Textarea id="description" value={editableLead.description || ''} onChange={(e: any) => handleFieldChange('description', e.target.value)} rows={4} className="text-primary font-normal" /></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground">Required amount (₹)</Label><Input type="number" value={editableLead.requiredAmount || 0} onChange={(e) => handleFieldChange('requiredAmount', e.target.value)} className="text-primary font-bold" /></div>
                                        <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground">Fundraising goal (₹)</Label><Input type="number" value={editableLead.targetAmount || 0} onChange={(e) => handleFieldChange('targetAmount', e.target.value)} className="text-primary font-bold" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground">Start date</Label><Input type="date" value={editableLead.startDate || ''} onChange={(e) => handleFieldChange('startDate', e.target.value)} className="font-bold" /></div>
                                        <div className="space-y-1"><Label className="font-bold text-xs uppercase text-muted-foreground">End date</Label><Input type="date" value={editableLead.endDate || ''} onChange={(e) => handleFieldChange('endDate', e.target.value)} className="font-bold" /></div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs uppercase text-muted-foreground">Allowed donation types for goal</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded-md p-3">
                                            {donationCategories.map(type => (
                                                <div key={type} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`edit-type-${type}`}
                                                        checked={editableLead.allowedDonationTypes?.includes(type)}
                                                        onCheckedChange={(checked) => {
                                                            const current = editableLead.allowedDonationTypes || [];
                                                            const updated = checked ? [...current, type] : current.filter(t => t !== type);
                                                            handleFieldChange('allowedDonationTypes', updated);
                                                        }}
                                                    />
                                                    <Label htmlFor={`edit-type-${type}`} className="text-xs font-bold">{type}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="relative w-full h-40 rounded-lg overflow-hidden mb-4 bg-secondary flex items-center justify-center cursor-pointer" onClick={() => lead.imageUrl && handleViewImage(lead.imageUrl, lead.name)}>
                                        {lead.imageUrl ? ( <Image src={lead.imageUrl} alt={lead.name} fill sizes="100vw" className="object-cover" /> ) : ( <FallbackIcon className="h-20 w-20 text-primary/10" /> )}
                                    </div>
                                    <div className="space-y-2 font-normal text-foreground">
                                        <Label className="text-muted-foreground uppercase text-xs font-bold">Description</Label>
                                        <p className="mt-1 text-sm font-normal whitespace-pre-wrap leading-relaxed">{lead.description || 'No description provided.'}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                        <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Purpose</p><p className="font-bold uppercase text-primary text-sm">{lead.purpose} {lead.category && `(${lead.category})`}</p></div>
                                        <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target goal</p><p className="font-bold font-mono text-primary text-sm">₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                        <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Start date</p><p className="font-bold text-primary text-sm">{lead.startDate || 'N/A'}</p></div>
                                        <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">End date</p><p className="font-bold text-primary text-sm">{lead.endDate || 'N/A'}</p></div>
                                    </div>
                                    {(lead.purpose === 'Education' || lead.purpose === 'Medical') && (
                                        <div className="mt-4 p-4 rounded-md border border-primary/10 bg-primary/5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {lead.purpose === 'Education' ? (
                                                <>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Degree/Class</p><p className="text-sm font-bold">{lead.degree || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Year</p><p className="text-sm font-bold">{lead.year || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Semester</p><p className="text-sm font-bold">{lead.semester || 'N/A'}</p></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Disease identified</p><p className="text-sm font-bold">{lead.diseaseIdentified || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Disease stage</p><p className="text-sm font-bold">{lead.diseaseStage || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Seriousness</p><p className="text-sm font-bold">{lead.seriousness || 'N/A'}</p></div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                {fundingData && (
                    <div className="grid gap-6 animate-fade-in-up">
                        {isVisible('funding_progress') && (
                            <Card className="shadow-sm border-primary/5 bg-white">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-bold text-primary"><Target className="h-6 w-6 text-primary" /> Fundraising progress</CardTitle>
                                    <CardDescription className="font-normal">Verified donations for this initiative.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        <div className="relative h-48 w-full">
                                            {isClient ? (
                                                <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                                    <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                                        <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} />
                                                    </RadialBarChart>
                                                </ChartContainer>
                                            ) : <Skeleton className="w-full h-full rounded-full" />}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-[10px] text-muted-foreground font-bold uppercase">Funded</span></div>
                                        </div>
                                        <div className="space-y-4 text-center md:text-left text-primary font-bold">
                                            <div><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Raised for goal</p><p className="text-3xl font-bold text-primary">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target goal</p><p className="text-3xl font-bold text-primary opacity-60">₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Grand total received</p><p className="text-2xl font-bold text-primary">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isVisible('quick_stats') && (
                            <div className="grid gap-6 sm:grid-cols-3">
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.totalBeneficiaries}</div></CardContent></Card>
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Assistance given</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.beneficiariesGiven}</div></CardContent></Card>
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData.beneficiariesPending}</div></CardContent></Card>
                            </div>
                        )}

                        {isVisible('beneficiary_groups') && (
                            <Card className="shadow-sm border-primary/5 bg-white">
                                <CardHeader>
                                    <CardTitle className="font-bold text-primary">
                                        {isRationInitiative ? 'Beneficiary groups' : 'Breakdown of requirements'}
                                    </CardTitle>
                                    <CardDescription className="font-normal">
                                        {isRationInitiative 
                                            ? 'Breakdown of requirements by family size category.' 
                                            : 'Itemized requirement breakdown for this initiative.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="w-full">
                                        <div className="border rounded-lg overflow-hidden font-normal text-foreground">
                                            {isRationInitiative ? (
                                                <Table>
                                                    <TableHeader className="bg-primary/5">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-primary text-[10px] uppercase">Category name</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Beneficiaries</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Kit amount</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Total amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {beneficiaryGroups.map((group) => (
                                                            <TableRow key={group.id} className="hover:bg-primary/5 transition-colors">
                                                                <TableCell className="font-bold text-primary">{group.name}</TableCell>
                                                                <TableCell className="text-right">{group.count}</TableCell>
                                                                <TableCell className="text-right font-mono">₹{group.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    {beneficiaryGroups.length > 0 && (
                                                        <tfoot className="bg-primary/5 border-t">
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-xs">Total requirement</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-primary text-lg">₹{beneficiaryGroups.reduce((sum, g) => sum + g.totalAmount, 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        </tfoot>
                                                    )}
                                                </Table>
                                            ) : (
                                                <Table>
                                                    <TableHeader className="bg-primary/5">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-primary text-[10px] uppercase">Requirement description</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Quantity</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Unit price</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Total cost</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {lead.itemCategories?.[0]?.items.map((item, idx) => (
                                                            <TableRow key={idx} className="hover:bg-primary/5 transition-colors">
                                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                                <TableCell className="text-right">{item.quantity} {item.quantityType}</TableCell>
                                                                <TableCell className="text-right font-mono">₹{(item.price / (item.quantity || 1)).toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono">₹{(item.price || 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    <tfoot className="bg-primary/5 border-t">
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-xs">Single beneficiary total</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-primary text-lg">
                                                                ₹{(lead.itemCategories?.[0]?.items.reduce((sum, i) => sum + i.price, 0) || 0).toLocaleString('en-IN')}
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

                        <div className="grid gap-6 lg:grid-cols-2">
                            {isVisible('fund_totals') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Fund totals by type</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 font-normal text-foreground">
                                        {donationCategories.map(cat => (
                                            <div key={cat} className="flex justify-between items-center text-sm font-bold text-primary">
                                                <span className="text-muted-foreground font-normal">{cat === 'Interest' ? 'Interest (for disposal)' : cat === 'Loan' ? 'Loan (Qard-e-Hasana)' : cat}</span>
                                                <span className="font-mono">₹{(fundingData.amountsByCategory[cat] || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <Separator className="my-2" />
                                        <div className="flex justify-between items-center text-lg font-bold text-primary"><span>Grand total received</span><span className="font-mono">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('zakat_utilization') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Zakat utilization</CardTitle><CardDescription className="font-normal">Tracking of Zakat funds collected and allocated.</CardDescription></CardHeader>
                                    <CardContent className="space-y-3 font-normal text-foreground">
                                        <div className="flex justify-between items-center text-sm font-bold text-primary"><span className="text-muted-foreground uppercase tracking-tight font-normal">Total Zakat collected</span><span className="font-bold font-mono">₹{fundingData.amountsByCategory.Zakat.toLocaleString('en-IN')}</span></div>
                                        <Separator />
                                        <div className="pl-4 border-l-2 border-dashed space-y-2 py-2">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary"><span className="text-muted-foreground uppercase tracking-tight font-normal">Allocated as Cash-in-hand</span><span className="font-bold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary"><span className="text-muted-foreground uppercase tracking-tight font-normal">Paid out</span><span className="font-mono text-primary font-bold">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span></div>
                                             <div className="flex justify-between items-center text-xs font-bold text-primary"><span className="text-muted-foreground uppercase tracking-tight font-normal">Remaining to pay</span><span className="font-mono text-primary font-bold">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span></div>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between items-center text-base font-bold text-primary"><span>Zakat balance for goal</span><span className="font-bold text-primary font-mono">₹{fundingData.zakatAvailableForGoal.toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            {isVisible('donations_by_category') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="flex items-center gap-2 font-bold text-primary text-sm uppercase tracking-wider"><TrendingUp className="h-5 w-5"/> Donations by category</CardTitle></CardHeader>
                                    <CardContent>
                                        {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                            <BarChart data={chartData} layout="vertical" margin={{ right: 20 }}>
                                                <CartesianGrid horizontal={false} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={100}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4}>{chartData.map((entry) => (<Cell key={entry.name} fill={`var(--color-${entry.name.replace(/\s+/g, '')})`} />))}</Bar>
                                            </BarChart>
                                        </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full" />}
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('donations_by_payment_type') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="flex items-center gap-2 font-bold text-primary text-sm uppercase tracking-wider"><PieChartIcon className="h-5 w-5"/> Donations by payment type</CardTitle></CardHeader>
                                    <CardContent>
                                        {isClient ? (
                                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                                <PieChart>
                                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                    <Pie data={paymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80}>
                                                        {paymentTypeChartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} />))}
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
                    < Card className="animate-fade-in-up bg-white shadow-sm" style={{ animationDelay: '100ms' }}>
                        <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Lead artifacts</CardTitle></CardHeader>
                        <CardContent>
                        {editMode ? (
                                <div className="space-y-4">
                                    <Label className="font-bold text-[10px] uppercase text-muted-foreground">Upload new artifacts</Label>
                                    <FileUploader onFilesChange={setNewDocuments} multiple acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf" />
                                    <Separator />
                                    <Label className="font-bold text-[10px] uppercase text-muted-foreground">Manage existing artifacts</Label>
                                    {existingDocuments.length > 0 ? (
                                        <div className="space-y-3 font-normal text-foreground">
                                            {existingDocuments.map((doc) => (
                                                <div key={doc.url} className="flex items-center justify-between p-2 border rounded-md gap-4">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Button variant="link" className="p-0 h-auto font-bold truncate text-primary" onClick={() => doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? handleViewImage(doc.url, doc.name) : window.open(doc.url, '_blank')}><p className="truncate">{doc.name}</p></Button>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2"><Switch checked={doc.isPublic} onCheckedChange={() => handleToggleDocumentPublic(doc.url)} /><Label className="text-xs text-foreground font-bold">Public</Label></div>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveExistingDocument(doc.url)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-muted-foreground font-bold uppercase">None.</p>}
                                </div>
                            ) : (
                                lead.documents && lead.documents.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {lead.documents.map((doc) => {
                                            const isImg = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                            return (
                                                <Card key={doc.url} className="overflow-hidden hover:shadow-lg transition-all flex flex-col active:scale-95 bg-white border-primary/10 cursor-pointer shadow-sm" onClick={() => isImg ? handleViewImage(doc.url, doc.name) : window.open(doc.url, '_blank')}>
                                                    <div className="group block flex-grow">
                                                        <div className="relative aspect-square w-full bg-muted flex items-center justify-center">
                                                            {isImg ? <Image src={doc.url} alt={doc.name} fill sizes="100vw" className="object-cover" /> : <File className="w-10 h-10 text-muted-foreground" />}
                                                        </div>
                                                        <div className="p-2 text-center text-[10px] font-bold text-primary uppercase truncate">{doc.name}</div>
                                                    </div>
                                                    <CardFooter className="p-2 border-t mt-auto flex justify-center w-full gap-2" onClick={e => e.stopPropagation()}>
                                                        {canUpdate ? ( <><Switch checked={!!doc.isPublic} onCheckedChange={() => quickToggleDocumentPublic(doc)} /><Label className="text-xs text-foreground font-bold">Public</Label></> ) : ( <Badge variant={doc.isPublic ? "outline" : "secondary"} className="font-bold uppercase text-[10px]">{doc.isPublic ? "Public" : "Private"}</Badge> )}
                                                    </CardFooter>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground font-bold uppercase">None.</p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader><DialogTitle className="font-bold text-primary">{imageToView?.name}</DialogTitle></DialogHeader>
                    {imageToView && (
                        <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Viewer" fill sizes="100vw" className="object-contain transition-transform duration-200 ease-out origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        </div>
                    )}
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setZoom(zoom => zoom * 1.2)} className="font-bold"><ZoomIn className="mr-2 h-4 w-4"/> Zoom In</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(zoom => zoom / 1.2)} className="font-bold"><ZoomOut className="mr-2 h-4 w-4"/> Zoom Out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold"><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold"><RefreshCw className="mr-2 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}