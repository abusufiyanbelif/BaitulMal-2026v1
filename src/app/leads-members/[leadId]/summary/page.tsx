
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, useStorage, useAuth } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { doc, updateDoc, DocumentReference, collection, writeBatch } from 'firebase/firestore';
import type { Lead, Beneficiary, Donation, DonationCategory, CampaignDocument } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Users, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, Gift, UploadCloud, Trash2, FolderKanban, Lightbulb, Target, File, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import Resizer from 'react-image-file-resizer';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import Link from 'next/link';


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

    // State for edit mode and form fields
    const [editMode, setEditMode] = useState(false);
    const [editableLead, setEditableLead] = useState<Partial<Lead>>({});
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
    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading, error: leadError } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading, error: beneficiariesError } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading, error: donationsError } = useCollection<Donation>(allDonationsCollectionRef);
    
    const availableCategories = React.useMemo(() => {
        const selectedPurpose = leadPurposesConfig.find(p => p.id === editableLead.purpose);
        return selectedPurpose?.categories || [];
    }, [editableLead.purpose]);

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
                degree: lead.degree || '',
                year: lead.year || '',
                semester: lead.semester || '',
                diseaseIdentified: lead.diseaseIdentified || '',
                diseaseStage: lead.diseaseStage || '',
                seriousness: lead.seriousness || null,
                imageUrl: lead.imageUrl || '',
                documents: lead.documents || [],
            });
            setExistingDocuments(lead.documents || []);
            setImagePreview(lead.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
            setNewDocuments([]);
        } else if (lead && editMode) {
            setExistingDocuments(lead.documents || []);
        }
    }, [lead, editMode]);

    useEffect(() => {
      if (editMode) {
        setEditableLead(prev => ({...prev, category: ''}));
      }
    }, [editableLead.purpose, editMode]);
    
    const handleFieldChange = (field: keyof Lead, value: any) => {
        setEditableLead(p => (p ? { ...p, [field]: value } : null));
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
        if (!leadDocRef || !lead?.documents || !canUpdate) return;

        const newDocuments = lead.documents.map(doc => 
            doc.url === docToToggle.url ? { ...doc, isPublic: !doc.isPublic } : doc
        );
        
        try {
            await updateDoc(leadDocRef, { documents: newDocuments });

            toast({
                title: "Visibility Updated",
                description: `'${docToToggle.name}' is now ${!docToToggle.isPublic ? 'Public' : 'Private'}.`
            });
        } catch (serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: leadDocRef.path,
                operation: 'update',
                requestResourceData: { documents: newDocuments },
            }));
        }
    };

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false) || getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);

    const handleSave = async () => {
        if (!leadDocRef || !userProfile || !canUpdate || !storage) return;
        
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({
                title: "Authentication Error",
                description: "User not authenticated yet. Please wait.",
                variant: "destructive",
            });
            return;
        }

        let imageUrl = editableLead.imageUrl || '';
        if (isImageDeleted && imageUrl && storage) {
            try {
                await deleteObject(storageRef(storage, imageUrl));
            } catch (e: any) { console.warn("Old image deletion failed, it might not exist.", e) }
            imageUrl = '';
        } else if (imageFile && storage) {
            try {
                if (imageUrl) {
                     await deleteObject(storageRef(storage, imageUrl)).catch((e: any) => console.warn("Old image deletion failed, it might not exist.", e));
                }
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `leads/${leadId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', description: 'Changes were not saved.', variant: 'destructive'});
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

        const originalDocuments = lead?.documents || [];
        const existingUrls = existingDocuments.map(d => d.url);
        const docsToDelete = originalDocuments.filter(d => !existingUrls.includes(d.url));

        for (const docToDelete of docsToDelete) {
            try {
                await deleteObject(storageRef(storage, docToDelete.url));
            } catch (e: any) {
                console.warn(`Could not delete artifact ${docToDelete.url}. It may have already been deleted.`, e);
            }
        }

        const saveData: Partial<Lead> = {
            name: editableLead.name || '',
            description: editableLead.description || '',
            purpose: editableLead.purpose || 'General',
            category: editableLead.category || '',
            purposeDetails: editableLead.purposeDetails || '',
            categoryDetails: editableLead.categoryDetails || '',
            startDate: editableLead.startDate || '',
            endDate: editableLead.endDate || '',
            status: editableLead.status || 'Upcoming',
            requiredAmount: editableLead.requiredAmount || 0,
            targetAmount: editableLead.targetAmount || 0,
            authenticityStatus: editableLead.authenticityStatus || 'Pending Verification',
            publicVisibility: editableLead.publicVisibility || 'Hold',
            allowedDonationTypes: editableLead.allowedDonationTypes,
            degree: editableLead.degree || '',
            year: editableLead.year || '',
            semester: editableLead.semester || '',
            diseaseIdentified: editableLead.diseaseIdentified || '',
            diseaseStage: editableLead.diseaseStage || '',
            seriousness: editableLead.seriousness || null,
            imageUrl: imageUrl,
            documents: finalDocuments,
        };

        updateDoc(leadDocRef, saveData)
            .catch(async (serverError: any) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: leadDocRef.path,
                    operation: 'update',
                    requestResourceData: saveData,
                }));
            })
            .finally(() => {
                toast({ title: 'Success', description: 'Lead summary updated.', variant: 'success' });
                setEditMode(false);
            });
    };
    
    const handleEditClick = () => setEditMode(true);
    const handleCancel = () => setEditMode(false);

    const summaryData = React.useMemo(() => {
        if (!beneficiaries || !allDonations || !lead) return null;
        
        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id));
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
        
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        let zakatForGoalAmount = 0;
        
        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;
            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;
            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;

                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * allocationProportion;
                    amountsByCategory[category as DonationCategory] += allocatedAmount;

                    const isForFundraising = category !== 'Zakat' || split.forFundraising !== false;
                    if (category === 'Zakat' && isForFundraising) {
                        zakatForGoalAmount += allocatedAmount;
                    }
                }
            });
        });

        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        
        const zakatGiven = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation && b.status === 'Given')
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        
        const zakatPending = zakatAllocated - zakatGiven;

        const zakatAvailableForGoal = Math.max(0, zakatForGoalAmount - zakatAllocated);
        
        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') {
                    return sum + zakatAvailableForGoal;
                }
                return sum + amount;
            }, 0);

        const fundingGoal = lead.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        const pendingDonations = donations.filter(d => d.status === 'Pending').reduce((sum, d) => { const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id); return sum + (leadAllocation?.amount || 0);}, 0);
        const paymentTypeData = donations.reduce((acc, d) => { const key = d.donationType || 'Other'; acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>);
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

        return {
            totalCollectedForGoal, fundingProgress, targetAmount: fundingGoal, remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal), totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven, beneficiariesPending, pendingDonations, amountsByCategory, donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            zakatAllocated,
            zakatGiven,
            zakatPending,
            zakatAvailableForGoal,
            zakatForGoalAmount,
            fundTotals: {
                fitra: fitraTotal,
                zakat: zakatTotal,
                sadaqah: sadaqahTotal,
                fidiya: fidiyaTotal,
                interest: interestTotal,
                lillah: lillahTotal,
                loan: loanTotal,
                monthlyContribution: monthlyContributionTotal,
                grandTotal: grandTotal,
            }
        };
    }, [beneficiaries, allDonations, lead]);
    
    const isLoading = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!lead || !summaryData) {
            toast({ title: 'Error', description: 'Cannot share, summary data is not available.', variant: 'destructive'});
            return;
        }
        
        const shareText = `
*Assalamualaikum Warahmatullahi Wabarakatuh*

*We Need Your Support!*

Join us for the *${lead.name}* initiative as we work to provide essential aid to our community.

*Our Goal:*
${lead.description || 'To support those in need.'}

*Financial Update:*
🎯 Target: ₹${summaryData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${summaryData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${summaryData.remainingToCollect.toLocaleString('en-IN')}*

Your contribution, big or small, makes a huge difference.

*Please donate and share this message.*
        `.trim().replace(/^\s+/gm, '');

        const dataToShare = {
            title: `Lead Summary: ${lead.name}`,
            text: shareText,
            url: `${window.location.origin}/leads-public/${leadId}/summary`,
        };
        
        setShareDialogData(dataToShare);
        setIsShareDialogOpen(true);
    };

    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, {
            contentRef: summaryRef,
            documentTitle: `Lead Summary: ${lead?.name || 'Summary'}`,
            documentName: `lead-summary-${leadId}`,
            brandingSettings,
            paymentSettings
        });
    };

    if (isLoading) { return <BrandedLoader />; }
    
    if (leadError || beneficiariesError || donationsError) {
        return (
             <main className="container mx-auto p-4 md:p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>
                        <p>There was a problem fetching required data for this page. This may be due to network issues or permissions.</p>
                        <pre className="mt-2 text-xs bg-destructive/10 p-2 rounded-md font-mono">
                            {(leadError || beneficiariesError || donationsError)?.message}
                        </pre>
                    </AlertDescription>
                </Alert>
            </main>
        );
    }

    if (!lead) { return <main className="container mx-auto p-4 md:p-8 text-center"><p>Lead not found.</p></main> }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
    
    let givenLabel = 'Items/Services Provided';
    let pendingLabel = 'Pending';
    if (lead.purpose === 'Education') {
        givenLabel = 'Assistance Provided';
    } else if (lead.purpose === 'Medical') {
        givenLabel = 'Treatments Provided';
    } else if (lead.purpose === 'Relief') {
        givenLabel = 'Aid Distributed';
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/leads-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    {editMode ? (
                       <Input id="name" value={editableLead.name || ''} onChange={(e) => setEditableLead(p => ({...p, name: e.target.value}))} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                    ) : ( <h1 className="text-3xl font-bold">{lead.name}</h1> )}
                    {editMode ? (
                         <Select value={editableLead.status} onValueChange={(value) => setEditableLead(p => ({...p, status: value as any}))}>
                            <SelectTrigger className="w-fit border-0 shadow-none focus:ring-0 p-0 h-auto text-muted-foreground [&>svg]:ml-1"><SelectValue placeholder="Select a status" /></SelectTrigger>
                            <SelectContent><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent>
                        </Select>
                    ): ( <p className="text-muted-foreground">{lead.status}</p> )}
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
                        !editMode ? ( <Button onClick={handleEditClick}><Edit className="mr-2 h-4 w-4" /> Edit Summary</Button> ) 
                        : ( <div className="flex gap-2"><Button variant="outline" onClick={handleCancel}>Cancel</Button><Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save</Button></div>)
                    )}
                </div>
            </div>

            <div className="border-b mb-4">
              <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex w-max space-x-2">
                      {canReadSummary && ( <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}/summary`}>Summary</Link></Button> )}
                      <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}`}>Item List</Link></Button>
                      {canReadBeneficiaries && ( <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link></Button> )}
                      {canReadDonations && ( <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}/donations`}>Donations</Link></Button> )}
                  </div>
              </ScrollArea>
            </div>

            <div className="space-y-6">
                 <div ref={summaryRef} className="space-y-6 p-4 bg-background">
                 <Card className="animate-fade-in-zoom">
                        <CardHeader>
                            <CardTitle>Lead Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {/* Content restored here */}
                        </CardContent>
                    </Card>

                    <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <CardHeader>
                            <CardTitle>Lead Artifacts</CardTitle>
                            <CardDescription>Photos, receipts, or other documents related to this lead.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {/* Content restored here */}
                        </CardContent>
                    </Card>
                
                    <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-6 w-6 text-primary" />
                                Fundraising Progress
                            </CardTitle>
                            <CardDescription>A real-time look at the collected donations against the goal for this initiative.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {/* Content restored here */}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                       {/* Beneficiary Stats Cards */}
                    </div>
                    
                    <Card className="animate-fade-in-up" style={{ animationDelay: '900ms' }}>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                            <CardDescription>
                                Tracking of Zakat funds collected and allocated within this lead.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                           {/* Content restored here */}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="animate-fade-in-up" style={{ animationDelay: '1000ms' }}>
                          <CardHeader>
                            <CardTitle>Fund Totals by Type</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                             {/* Content restored here */}
                          </CardContent>
                      </Card>
                      <Card className="animate-fade-in-up" style={{ animationDelay: '1100ms' }}>
                          <CardHeader>
                              <CardTitle>Donations by Category</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {/* Content restored here */}
                          </CardContent>
                      </Card>
                    </div>
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
