

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, useCollection, errorEmitter, FirestorePermissionError, useStorage, useMemoFirebase } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, collection, updateDoc, query, where, DocumentReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { Lead, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Users, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, Gift, UploadCloud, Trash2, FolderKanban, Lightbulb, Target, File } from 'lucide-react';
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
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';


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

export default function LeadSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const storage = useStorage();
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
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });
    const summaryRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
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
            setImagePreview(lead.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
        }
    }, [lead, editMode]);

    useEffect(() => {
      if (editMode) {
        setEditableLead(prev => ({...prev, category: ''}));
      }
    }, [editableLead.purpose, editMode]);
    
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

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false) || getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);

    const handleSave = async () => {
        if (!leadDocRef || !userProfile || !canUpdate) return;
        
        let imageUrl = editableLead.imageUrl || '';
        if (isImageDeleted && imageUrl && storage) {
            try {
                await deleteObject(storageRef(storage, imageUrl));
            } catch (e: any) { console.warn("Old image deletion failed, it might not exist.", e) }
            imageUrl = '';
        } else if (imageFile && storage) {
            try {
                if (imageUrl) {
                     await deleteObject(storageRef(storage, imageUrl)).catch(e => console.warn("Old image deletion failed, it might not exist.", e));
                }
                const { default: Resizer } = await import('react-image-file-resizer');
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    Resizer.imageFileResizer(imageFile, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
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
        };

        updateDoc(leadDocRef, saveData)
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: leadDocRef.path,
                    operation: 'update',
                    requestResourceData: saveData,
                });
                errorEmitter.emit('permission-error', permissionError);
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
        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;
            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;
            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    amountsByCategory[category as DonationCategory] += split.amount * allocationProportion;
                }
            });
        });
        const totalCollectedForGoal = Object.entries(amountsByCategory).filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory)).reduce((sum, [, amount]) => sum + amount, 0);
        const fundingGoal = lead.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        const pendingDonations = donations.filter(d => d.status === 'Pending').reduce((sum, d) => { const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id); return sum + (leadAllocation?.amount || 0);}, 0);
        const paymentTypeData = donations.reduce((acc, d) => { const key = d.donationType || 'Other'; acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>);
        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        const fitraTotal = amountsByCategory['Fitra'] || 0;
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

        return {
            totalCollectedForGoal, fundingProgress, targetAmount: fundingGoal, remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal), totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven, beneficiariesPending, pendingDonations, amountsByCategory, donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            zakatAllocated,
            fundTotals: { fitra: fitraTotal, zakat: zakatTotal, loan: loanTotal, interest: interestTotal, sadaqah: sadaqahTotal, lillah: lillahTotal, monthlyContribution: monthlyContributionTotal, grandTotal: grandTotal, }
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

🙏 *We Need Your Support!* 🙏

Join us for the *${lead.name}* campaign as we work to provide essential aid to our community.

*Our Goal:*
${lead.description || 'To support those in need.'}

*Financial Update:*
🎯 Target for Kits: ₹${summaryData.targetAmount.toLocaleString('en-IN')}
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
    
    if (isLoading) { return <main className="container mx-auto p-4 md:p-8"><Loader2 className="h-8 w-8 animate-spin" /></main> }
    if (!lead) { return <main className="container mx-auto p-4 md:p-8 text-center"><p>Lead not found.</p></main> }

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
                      {canReadBeneficiaries && ( <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link></Button> )}
                      {canReadDonations && ( <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}><Link href={`/leads-members/${leadId}/donations`}>Donations</Link></Button> )}
                  </div>
                  <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card>
                    <CardHeader><CardTitle>Lead Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         {editMode ? (
                            <div className="space-y-2">
                                <Label>Header Image</Label>
                                <Input id="imageFile" type="file" accept="image/png, image/jpeg" onChange={handleImageFileChange} className="hidden" />
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
                                            <p className="text-xs text-muted-foreground">PNG, JPG (1280x400 recommended)</p>
                                        </div>
                                    )}
                                </label>
                            </div>
                        ) : (
                            lead.imageUrl && <div className="relative w-full h-40 rounded-lg overflow-hidden"><Image src={lead.imageUrl} alt={lead.name} fill sizes="100vw" className="object-cover" /></div>
                        )}
                        <div>
                            <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
                            {editMode && canUpdate ? (
                                <Textarea id="description" value={editableLead.description} onChange={(e) => setEditableLead(p => ({...p, description: e.target.value}))} className="mt-1" rows={4} />
                            ) : ( <p className="mt-1 text-sm">{lead.description || 'No description provided.'}</p> )}
                        </div>

                         {lead.documents && lead.documents.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Attached Documents</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {lead.documents.map((doc) => (
                                            <Button key={doc.url} variant="outline" asChild>
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate">
                                                    <File className="mr-2 h-4 w-4 shrink-0" />
                                                    <span className="truncate">{doc.name}</span>
                                                </a>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           <div className="space-y-1">
                                <Label>Purpose</Label>
                                {editMode ? (
                                    <Select value={editableLead.purpose} onValueChange={value => setEditableLead(p => ({...p, purpose: value as any}))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : <p className="font-medium">{lead.purpose}</p>}
                            </div>
                            {availableCategories.length > 0 && <div className="space-y-1">
                                <Label>Category</Label>
                                {editMode ? (
                                    <Select value={editableLead.category} onValueChange={value => setEditableLead(p => ({...p, category: value as any}))}>
                                        <SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger>
                                        <SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : <p className="font-medium">{lead.category}</p>}
                            </div>}
                             {editableLead.purpose === 'Other' && editMode && <div className="space-y-1"><Label>Purpose Details</Label><Input value={editableLead.purposeDetails} onChange={e => setEditableLead(p => ({...p, purposeDetails: e.target.value}))} /></div>}
                             {editableLead.category === 'Other' && editMode && <div className="space-y-1"><Label>Category Details</Label><Input value={editableLead.categoryDetails} onChange={e => setEditableLead(p => ({...p, categoryDetails: e.target.value}))} /></div>}

                        </div>

                        {editableLead.purpose === 'Education' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                                <div className="space-y-1"><Label>Degree/Class</Label>{editMode ? <Select value={editableLead.degree} onValueChange={v => setEditableLead(p => ({...p, degree: v}))}><SelectTrigger><SelectValue placeholder="Degree..." /></SelectTrigger><SelectContent>{educationDegrees.map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select> : <p className="font-medium">{lead.degree || 'N/A'}</p>}</div>
                                <div className="space-y-1"><Label>Year</Label>{editMode ? <Select value={editableLead.year} onValueChange={v => setEditableLead(p => ({...p, year: v}))}><SelectTrigger><SelectValue placeholder="Year..." /></SelectTrigger><SelectContent>{educationYears.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select> : <p className="font-medium">{lead.year || 'N/A'}</p>}</div>
                                <div className="space-y-1"><Label>Semester</Label>{editMode ? <Select value={editableLead.semester} onValueChange={v => setEditableLead(p => ({...p, semester: v}))}><SelectTrigger><SelectValue placeholder="Semester..." /></SelectTrigger><SelectContent>{educationSemesters.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select> : <p className="font-medium">{lead.semester || 'N/A'}</p>}</div>
                            </div>
                        )}
                        {editableLead.purpose === 'Medical' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                                <div className="space-y-1"><Label>Disease Identified</Label>{editMode ? <Input value={editableLead.diseaseIdentified} onChange={e => setEditableLead(p => ({...p, diseaseIdentified: e.target.value}))} /> : <p className="font-medium">{lead.diseaseIdentified || 'N/A'}</p>}</div>
                                <div className="space-y-1"><Label>Disease Stage</Label>{editMode ? <Input value={editableLead.diseaseStage} onChange={e => setEditableLead(p => ({...p, diseaseStage: e.target.value}))} /> : <p className="font-medium">{lead.diseaseStage || 'N/A'}</p>}</div>
                                <div className="space-y-1"><Label>Seriousness</Label>{editMode ? <Select value={editableLead.seriousness || ''} onValueChange={v => setEditableLead(p => ({...p, seriousness: v as any}))}><SelectTrigger><SelectValue placeholder="Seriousness..." /></SelectTrigger><SelectContent>{leadSeriousnessLevels.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select> : <p className="font-medium">{lead.seriousness || 'N/A'}</p>}</div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Financials &amp; Status</CardTitle></CardHeader>
                     <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="space-y-1"><Label>Start Date</Label>{editMode ? <Input type="date" value={editableLead.startDate || ''} onChange={e => setEditableLead(p => ({...p, startDate: e.target.value}))} /> : <p className="font-medium">{lead.startDate}</p>}</div>
                         <div className="space-y-1"><Label>End Date</Label>{editMode ? <Input type="date" value={editableLead.endDate || ''} onChange={e => setEditableLead(p => ({...p, endDate: e.target.value}))} /> : <p className="font-medium">{lead.endDate}</p>}</div>
                         <div className="space-y-1"><Label>Required Amount (₹)</Label>{editMode ? <Input type="number" value={editableLead.requiredAmount || ''} onChange={e => setEditableLead(p => ({...p, requiredAmount: Number(e.target.value)}))} /> : <p className="font-medium">₹{lead.requiredAmount?.toLocaleString('en-IN') || 0}</p>}</div>
                         <div className="space-y-1"><Label>Target Amount (₹)</Label>{editMode ? <Input type="number" value={editableLead.targetAmount || ''} onChange={e => setEditableLead(p => ({...p, targetAmount: Number(e.target.value)}))} /> : <p className="font-medium">₹{lead.targetAmount?.toLocaleString('en-IN') || 0}</p>}</div>
                         <div className="space-y-1"><Label>Authenticity</Label>{editMode ? <Select value={editableLead.authenticityStatus} onValueChange={value => setEditableLead(p => ({...p, authenticityStatus: value as any}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Pending Verification">Pending</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="On Hold">On Hold</SelectItem><SelectItem value="Rejected">Rejected</SelectItem><SelectItem value="Need More Details">Need More Details</SelectItem></SelectContent></Select> : <Badge variant="outline">{lead.authenticityStatus}</Badge>}</div>
                         <div className="space-y-1"><Label>Visibility</Label>{editMode ? <Select value={editableLead.publicVisibility} onValueChange={value => setEditableLead(p => ({...p, publicVisibility: value as any}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Hold">Hold (Private)</SelectItem><SelectItem value="Ready to Publish">Ready</SelectItem><SelectItem value="Published">Published</SelectItem></SelectContent></Select> : <Badge variant="outline">{lead.publicVisibility}</Badge>}</div>
                         <div className="col-span-full space-y-2 pt-2"><Label>Allowed Donation Types</Label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border rounded-md">{donationCategories.map(type => (<div key={type} className="flex items-center space-x-2"><Checkbox id={`type-${type}`} disabled={!editMode} checked={editableLead.allowedDonationTypes?.includes(type)} onCheckedChange={checked => { const currentTypes = editableLead.allowedDonationTypes || []; const newTypes = checked ? [...currentTypes, type] : currentTypes.filter(t => t !== type); setEditableLead(p => ({...p, allowedDonationTypes: newTypes as any})); }} /><Label htmlFor={`type-${type}`} className="font-normal text-sm">{type}</Label></div>))}</div></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-6 w-6 text-primary" />
                            Fundraising Progress
                        </CardTitle>
                        <CardDescription>A real-time look at the collected donations against the goal for this initiative.</CardDescription>
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
                      ) : <Skeleton className="h-48 w-full" />}
                    </CardContent>
                </Card>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{summaryData?.totalBeneficiaries ?? 0}</div></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Collected</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold">₹{(summaryData?.fundTotals?.grandTotal || 0).toLocaleString('en-IN')}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Items Distributed</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{summaryData?.beneficiariesGiven ?? 0}</div></CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Zakat Utilization</CardTitle>
                        <CardDescription>
                            Tracking of Zakat funds collected and allocated within this lead.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Zakat Collected</span>
                            <span className="font-semibold font-mono">₹{summaryData?.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Zakat Allocated</span>
                            <span className="font-semibold font-mono">₹{(summaryData?.zakatAllocated || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center text-base">
                            <span className="font-bold">Zakat Balance</span>
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
                </div>
            </div>
            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />
        </main>
    );
}


