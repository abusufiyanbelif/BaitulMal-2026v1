
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

import type { Lead, Beneficiary, Donation, DonationCategory, RationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Users, Edit, Save, Wallet, Share2, Hourglass, LogIn, Download, Gift } from 'lucide-react';
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
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
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

    // State for edit mode and form fields
    const [editMode, setEditMode] = useState(false);
    const [editableLead, setEditableLead] = useState<Partial<Lead>>({});
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const summaryRef = useRef<HTMLDivElement>(null);

    // Data fetching
    const leadDocRef = useMemo(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemo(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    
    const allDonationsCollectionRef = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);

    const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    // Set editable lead data when not in edit mode
    useEffect(() => {
        if (lead && !editMode) {
             setEditableLead({
                name: lead.name || '',
                description: lead.description || '',
                startDate: lead.startDate || '',
                endDate: lead.endDate || '',
                category: lead.category || 'General',
                status: lead.status || 'Upcoming',
                targetAmount: lead.targetAmount || 0,
                authenticityStatus: lead.authenticityStatus || 'Pending Verification',
                publicVisibility: lead.publicVisibility || 'Hold',
                allowedDonationTypes: lead.allowedDonationTypes || [...donationCategories],
            });
        }
    }, [lead, editMode]);

    const sanitizedRationLists = useMemo(() => {
        if (!lead?.rationLists) return [];
        if (Array.isArray(lead.rationLists)) return lead.rationLists;
        // Hotfix for old object format
        return [
          {
            id: 'general',
            name: 'General Item List',
            minMembers: 0,
            maxMembers: 0,
            items: (lead.rationLists as any)['General Item List'] || []
          }
        ];
    }, [lead?.rationLists]);
    
    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false) || getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);

    const handleSave = () => {
        if (!leadDocRef || !userProfile || !canUpdate) return;
        
        const saveData: Partial<Lead> = {
            name: editableLead.name || '',
            description: editableLead.description || '',
            startDate: editableLead.startDate || '',
            endDate: editableLead.endDate || '',
            category: editableLead.category || 'General',
            status: editableLead.status || 'Upcoming',
            targetAmount: editableLead.targetAmount || 0,
            authenticityStatus: editableLead.authenticityStatus || 'Pending Verification',
            publicVisibility: editableLead.publicVisibility || 'Hold',
            allowedDonationTypes: editableLead.allowedDonationTypes,
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
    
    const handleEditClick = () => {
        if (lead) {
            setEditableLead({
                name: lead.name || '',
                description: lead.description || '',
                startDate: lead.startDate || '',
                endDate: lead.endDate || '',
                category: lead.category || 'General',
                status: lead.status || 'Upcoming',
                targetAmount: lead.targetAmount || 0,
                authenticityStatus: lead.authenticityStatus || 'Pending Verification',
                publicVisibility: lead.publicVisibility || 'Hold',
                allowedDonationTypes: lead.allowedDonationTypes || [...donationCategories],
            });
        }
        setEditMode(true);
    };

    const handleCancel = () => {
        setEditMode(false);
        // The useEffect will reset the editableLead state to match the lead data
    };

    // Memoized calculations
    const summaryData = useMemo(() => {
        if (!beneficiaries || !allDonations || !lead || !sanitizedRationLists) return null;
        
        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id));

        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;

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
            .filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const fundingGoal = lead.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;

        const pendingDonations = donations
            .filter(d => d.status === 'Pending')
            .reduce((sum, d) => {
                const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
                return sum + (leadAllocation?.amount || 0);
            }, 0);

        const paymentTypeData = donations.reduce((acc, d) => {
            const key = d.donationType || 'Other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
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
            acc[categoryKey].kitAmount = ben.kitAmount || 0;
            return acc;
        }, {} as Record<string, { categoryName: string, beneficiaries: Beneficiary[], totalAmount: number, kitAmount: number, minMembers: number }>);

        const sortedBeneficiaryCategoryKeys = Object.keys(beneficiariesByCategory).sort((a, b) => {
            return beneficiariesByCategory[a].minMembers - beneficiariesByCategory[b].minMembers;
        });

        const zakatTotal = amountsByCategory['Zakat'] || 0;
        const loanTotal = amountsByCategory['Loan'] || 0;
        const interestTotal = amountsByCategory['Interest'] || 0;
        const sadaqahTotal = amountsByCategory['Sadaqah'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;
        
        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;

        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            pendingDonations,
            amountsByCategory,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            beneficiariesByCategory,
            sortedBeneficiaryCategoryKeys,
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
    }, [beneficiaries, allDonations, lead, sanitizedRationLists]);
    
    const isLoading = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!lead || !summaryData) {
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

We are exploring a new initiative: *${lead.name}*.

*Details:*
${lead.description || 'To support those in need.'}

*Financial Update:*
🎯 Target: ₹${summaryData.targetAmount.toLocaleString('en-IN')}
✅ Collected: ₹${summaryData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${summaryData.remainingToCollect.toLocaleString('en-IN')}*

Your support and feedback are valuable.
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Lead: ${lead.name}`,
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
    
    if (isLoading) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }

    if (!lead) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">Lead not found.</p>
                <Button asChild className="mt-4">
                    <Link href="/leads-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
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
                    <Link href="/leads-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <div className="space-y-1">
                    {editMode ? (
                       <Input
                            id="name"
                            value={editableLead.name || ''}
                            onChange={(e) => setEditableLead(p => ({...p, name: e.target.value}))}
                            className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                        />
                    ) : (
                        <h1 className="text-3xl font-bold">{lead.name}</h1>
                    )}
                    {editMode ? (
                         <Select
                            value={editableLead.status}
                            onValueChange={(value) => setEditableLead(p => ({...p, status: value as any}))}
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
                        <p className="text-muted-foreground">{lead.status}</p>
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
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/summary` ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
                                <Link href={`/leads-members/${leadId}/summary`}>Summary</Link>
                            </Button>
                        )}
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}` ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}`}>Item List</Link>
                        </Button>
                        {canReadBeneficiaries && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/beneficiaries` ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
                                <Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link>
                            </Button>
                        )}
                        {canReadDonations && (
                            <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
                                <Link href={`/leads-members/${leadId}/donations`}>Donations</Link>
                            </Button>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <div className="space-y-6 p-4 bg-background" ref={summaryRef}>
                <Card>
                    <CardHeader>
                        <CardTitle>Lead Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
                            {editMode && canUpdate ? (
                                <Textarea
                                    id="description"
                                    value={editableLead.description}
                                    onChange={(e) => setEditableLead(p => ({...p, description: e.target.value}))}
                                    className="mt-1"
                                    rows={4}
                                />
                            ) : (
                                <p className="mt-1 text-sm">{lead.description || 'No description provided.'}</p>
                            )}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="targetAmount" className="text-sm font-medium text-muted-foreground">Fundraising Goal (Target)</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="targetAmount"
                                        type="number"
                                        value={editableLead.targetAmount}
                                        onChange={(e) => setEditableLead(p => ({...p, targetAmount: Number(e.target.value) || 0}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="category" className="text-sm font-medium text-muted-foreground">Category</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableLead.category}
                                        onValueChange={(value) => setEditableLead(p => ({...p, category: value as any}))}
                                    >
                                        <SelectTrigger id="category" className="mt-1">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ration">Ration</SelectItem>
                                            <SelectItem value="Relief">Relief</SelectItem>
                                            <SelectItem value="General">General</SelectItem>
                                            <SelectItem value="Education">Education</SelectItem>
                                            <SelectItem value="Medical">Medical</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{lead.category}</p>
                                )}
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="startDate" className="text-sm font-medium text-muted-foreground">Start Date</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={editableLead.startDate}
                                        onChange={(e) => setEditableLead(p => ({...p, startDate: e.target.value}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{lead.startDate}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endDate" className="text-sm font-medium text-muted-foreground">End Date</Label>
                                {editMode && canUpdate ? (
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={editableLead.endDate}
                                        onChange={(e) => setEditableLead(p => ({...p, endDate: e.target.value}))}
                                        className="mt-1"
                                    />
                                ) : (
                                    <p className="mt-1 text-lg font-semibold">{lead.endDate}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="authenticityStatus" className="text-sm font-medium text-muted-foreground">Authenticity Status</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableLead.authenticityStatus}
                                        onValueChange={(value) => setEditableLead(p => ({...p, authenticityStatus: value as any}))}
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
                                    <p className="mt-1 text-lg font-semibold">{lead.authenticityStatus || 'N/A'}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="publicVisibility" className="text-sm font-medium text-muted-foreground">Public Visibility</Label>
                                {editMode && canUpdate ? (
                                    <Select
                                        value={editableLead.publicVisibility}
                                        onValueChange={(value) => setEditableLead(p => ({...p, publicVisibility: value as any}))}
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
                                    <p className="mt-1 text-lg font-semibold">{lead.publicVisibility || 'N/A'}</p>
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
                                        checked={editableLead.allowedDonationTypes?.length === donationCategories.length}
                                        onCheckedChange={(checked) => {
                                            setEditableLead(p => ({...p, allowedDonationTypes: checked ? [...donationCategories] : []}));
                                        }}
                                    />
                                    <Label htmlFor="select-all" className="font-bold">Any</Label>
                                </div>
                                {donationCategories.map(type => (
                                    <div key={type} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`type-${type}`}
                                        checked={editableLead.allowedDonationTypes?.includes(type)}
                                        onCheckedChange={(checked) => {
                                        const currentTypes = editableLead.allowedDonationTypes || [];
                                        const newTypes = checked ? [...currentTypes, type] : currentTypes.filter(t => t !== type);
                                        setEditableLead(p => ({...p, allowedDonationTypes: newTypes}));
                                        }}
                                    />
                                    <Label htmlFor={`type-${type}`}>{type}</Label>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {(lead.allowedDonationTypes && lead.allowedDonationTypes.length > 0) ? (
                                        lead.allowedDonationTypes.map(type => (
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
                            {summaryData && summaryData.targetAmount === 0 ? (
                                'Set a Target Amount to see progress.'
                            ) : summaryData && summaryData.pendingDonations > 0 ? (
                                <span>(+ ₹{summaryData.pendingDonations.toLocaleString('en-IN')} pending verification)</span>
                            ) : (
                                <span>&nbsp;</span>
                            )}
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
                            <CardDescription>A breakdown of funds collected for this lead by their purpose.</CardDescription>
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
                                            <TableHead>Category Name</TableHead>
                                            <TableHead className="text-center">Total Beneficiaries</TableHead>
                                            <TableHead className="text-right">Kit Amount (per kit)</TableHead>
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
                            <CardTitle>Donations by Category</CardTitle>
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
                            <CardDescription>Count of donations per payment type.</CardDescription>
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

    