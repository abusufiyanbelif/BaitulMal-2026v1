
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
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Lead, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Users, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, Gift } from 'lucide-react';
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

// ... (Chart configs remain the same)
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

export default function LeadSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { download } = useDownloadAs();

    const [editMode, setEditMode] = useState(false);
    const [editableLead, setEditableLead] = useState<Partial<Lead>>({});
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });
    const summaryRef = useRef<HTMLDivElement>(null);

    const leadDocRef = useMemo(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemo(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    const allDonationsCollectionRef = useMemo(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

    const availableCategories = useMemo(() => {
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
                seriousness: lead.seriousness || undefined,
            });
        }
    }, [lead, editMode]);

    useEffect(() => {
      if (editMode) {
        setEditableLead(prev => ({...prev, category: ''}));
      }
    }, [editableLead.purpose, editMode])

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false) || getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);

    const handleSave = () => {
        if (!leadDocRef || !userProfile || !canUpdate) return;
        
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
            seriousness: editableLead.seriousness || undefined,
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

    // ... (summaryData, handleShare, handleDownload calculations remain the same)
    const summaryData = useMemo(() => {
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
        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;

        return {
            totalCollectedForGoal, fundingProgress, targetAmount: fundingGoal, remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal), totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven, beneficiariesPending, pendingDonations, amountsByCategory, donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            fundTotals: { zakat: zakatTotal, loan: loanTotal, interest: interestTotal, sadaqah: sadaqahTotal, lillah: lillahTotal, monthlyContribution: monthlyContributionTotal, grandTotal: grandTotal, }
        };
    }, [beneficiaries, allDonations, lead]);
    
    const isLoading = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;
    
    // ... (rest of the component logic for handleShare, handleDownload, etc.)
    
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
                    {/* ... Share/Download Buttons */}
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

            <div className="space-y-6 p-4 bg-background" ref={summaryRef}>
                <Card>
                    <CardHeader><CardTitle>Lead Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
                            {editMode && canUpdate ? (
                                <Textarea id="description" value={editableLead.description} onChange={(e) => setEditableLead(p => ({...p, description: e.target.value}))} className="mt-1" rows={4} />
                            ) : ( <p className="mt-1 text-sm">{lead.description || 'No description provided.'}</p> )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="purpose" className="text-sm font-medium text-muted-foreground">Purpose</Label>
                                {editMode && canUpdate ? (
                                    <Select value={editableLead.purpose} onValueChange={(value) => setEditableLead(p => ({...p, purpose: value as any}))}>
                                        <SelectTrigger id="purpose" className="mt-1"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                                        <SelectContent>{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : ( <p className="mt-1 text-lg font-semibold">{lead.purpose}</p> )}
                            </div>
                            {availableCategories.length > 0 && (
                              <div className="space-y-1">
                                <Label htmlFor="category" className="text-sm font-medium text-muted-foreground">Category</Label>
                                {editMode && canUpdate ? (
                                  <Select value={editableLead.category} onValueChange={(value) => setEditableLead(p => ({...p, category: value}))}>
                                    <SelectTrigger id="category" className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                  </Select>
                                ) : ( <p className="mt-1 text-lg font-semibold">{lead.category}</p> )}
                              </div>
                            )}
                            {editableLead.purpose === 'Other' && editMode ? (
                                <div className="space-y-1"><Label>Purpose Details</Label><Input value={editableLead.purposeDetails} onChange={e => setEditableLead(p => ({...p, purposeDetails: e.target.value}))}/></div>
                            ) : lead.purpose === 'Other' ? (
                                <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Purpose Details</p><p className="font-semibold">{lead.purposeDetails}</p></div>
                            ) : null}
                            {editableLead.category === 'Other' && editMode ? (
                                <div className="space-y-1"><Label>Category Details</Label><Input value={editableLead.categoryDetails} onChange={e => setEditableLead(p => ({...p, categoryDetails: e.target.value}))}/></div>
                            ) : lead.category === 'Other' ? (
                                <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Category Details</p><p className="font-semibold">{lead.categoryDetails}</p></div>
                            ) : null}

                             <div className="space-y-1">
                                <Label htmlFor="requiredAmount" className="text-sm font-medium text-muted-foreground">Required Amount (₹)</Label>
                                {editMode && canUpdate ? (
                                    <Input id="requiredAmount" type="number" value={editableLead.requiredAmount} onChange={(e) => setEditableLead(p => ({...p, requiredAmount: Number(e.target.value) || 0}))} className="mt-1"/>
                                ) : ( <p className="mt-1 text-lg font-semibold">₹{(lead.requiredAmount || 0).toLocaleString('en-IN')}</p> )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="targetAmount" className="text-sm font-medium text-muted-foreground">Fundraising Goal (Target)</Label>
                                {editMode && canUpdate ? (
                                    <Input id="targetAmount" type="number" value={editableLead.targetAmount} onChange={(e) => setEditableLead(p => ({...p, targetAmount: Number(e.target.value) || 0}))} className="mt-1"/>
                                ) : ( <p className="mt-1 text-lg font-semibold">₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p> )}
                            </div>
                            {/* ... Other fields like dates, status, etc. */}
                        </div>

                        {/* Education Details */}
                        {(editMode ? editableLead.purpose === 'Education' : lead.purpose === 'Education') && (
                            <div className="pt-4">
                                <Separator className="my-4" />
                                <h3 className="text-base font-semibold mb-2">Education Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1"><Label>Degree/Class</Label>
                                        {editMode && canUpdate ? (
                                            <Select value={editableLead.degree} onValueChange={(value) => setEditableLead(p => ({...p, degree: value as any}))}>
                                                <SelectTrigger><SelectValue placeholder="Select Degree..."/></SelectTrigger>
                                                <SelectContent>{educationDegrees.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                            </Select>
                                        ) : <p className="font-semibold">{lead.degree || 'N/A'}</p>}
                                    </div>
                                    <div className="space-y-1"><Label>Year</Label>
                                        {editMode && canUpdate ? (
                                            <Select value={editableLead.year} onValueChange={(value) => setEditableLead(p => ({...p, year: value as any}))}>
                                                <SelectTrigger><SelectValue placeholder="Select Year..."/></SelectTrigger>
                                                <SelectContent>{educationYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                            </Select>
                                        ) : <p className="font-semibold">{lead.year || 'N/A'}</p>}
                                    </div>
                                    <div className="space-y-1"><Label>Semester</Label>
                                        {editMode && canUpdate ? (
                                            <Select value={editableLead.semester} onValueChange={(value) => setEditableLead(p => ({...p, semester: value as any}))}>
                                                <SelectTrigger><SelectValue placeholder="Select Semester..."/></SelectTrigger>
                                                <SelectContent>{educationSemesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                            </Select>
                                        ) : <p className="font-semibold">{lead.semester || 'N/A'}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Medical Details */}
                        {(editMode ? editableLead.purpose === 'Medical' : lead.purpose === 'Medical') && (
                             <div className="pt-4">
                                <Separator className="my-4" />
                                <h3 className="text-base font-semibold mb-2">Medical Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1"><Label>Disease Identified</Label>{editMode && canUpdate ? <Input value={editableLead.diseaseIdentified || ''} onChange={(e) => setEditableLead(p => ({...p, diseaseIdentified: e.target.value}))} /> : <p className="font-semibold">{lead.diseaseIdentified || 'N/A'}</p>}</div>
                                    <div className="space-y-1"><Label>Disease Stage</Label>{editMode && canUpdate ? <Input value={editableLead.diseaseStage || ''} onChange={(e) => setEditableLead(p => ({...p, diseaseStage: e.target.value}))} /> : <p className="font-semibold">{lead.diseaseStage || 'N/A'}</p>}</div>
                                    <div className="space-y-1">
                                      <Label>Seriousness</Label>
                                      {editMode && canUpdate ? (
                                        <Select value={editableLead.seriousness} onValueChange={(value) => setEditableLead(p => ({...p, seriousness: value as any}))}>
                                          <SelectTrigger><SelectValue placeholder="Select level..."/></SelectTrigger>
                                          <SelectContent>{leadSeriousnessLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                                        </Select>
                                      ) : <p className="font-semibold">{lead.seriousness || 'N/A'}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* ... AllowedDonationTypes, etc. */}
                    </CardContent>
                </Card>
                {/* ... Other cards */}
            </div>
            {/* ... ShareDialog */}
        </main>
    );
}
