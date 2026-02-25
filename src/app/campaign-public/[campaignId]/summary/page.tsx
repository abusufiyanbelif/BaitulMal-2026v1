
'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, collection, DocumentReference } from 'firebase/firestore';
import Link from 'next/link';
import {
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Share2, Hourglass, Users, Gift, Target, HandHelping, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories } from '@/lib/modules';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { BrandedLoader } from '@/components/branded-loader';
import { Label } from '@/components/ui/label';


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


export default function PublicCampaignSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { userProfile } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
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
    
     const sanitizedRationLists = useMemo(() => {
        if (!campaign?.itemCategories) return [];
        if (Array.isArray(campaign.itemCategories)) return campaign.itemCategories;
        return [{ id: 'general', name: 'General', minMembers: 0, maxMembers: 0, items: [] }];
    }, [campaign?.itemCategories]);

    const fundingData = useMemo(() => {
        if (!allDonations || !campaign || !beneficiaries) return null;
        const donations = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            return (d as any).campaignId === campaign.id;
        });
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        let zakatForGoalAmount = 0;
        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find((l: any) => l.linkId === campaign.id && l.linkType === 'campaign');
            if (campaignLink) amountForThisCampaign = campaignLink.amount;
            else if ((!d.linkSplit || d.linkSplit.length === 0) && d.campaignId === campaign.id) amountForThisCampaign = d.amount;
            else return;
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
        const totalCollectedForGoal = Object.entries(amountsByCategory).filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory)).reduce((sum, [category, amount]) => category === 'Zakat' ? sum + zakatAvailableForGoal : sum + amount, 0);
        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        return { totalCollectedForGoal, fundingProgress, targetAmount: fundingGoal, remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal), fundTotals: { zakat: zakatTotal, grandTotal: grandTotal }, zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal };
    }, [allDonations, campaign, beneficiaries]);

    const beneficiaryData = useMemo(() => {
        if (!beneficiaries || !sanitizedRationLists) return null;
        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            const matchingCategories = sanitizedRationLists.filter(cat => members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
            let appliedCategory: ItemCategory | null = matchingCategories.length > 0 ? matchingCategories[0] : (sanitizedRationLists[0] || null);
            const categoryForGroup = appliedCategory || { id: 'uncategorized', name: 'Uncategorized', items: [], minMembers: -1, maxMembers: -1 };
            const categoryKey = categoryForGroup.id;
            if (!acc[categoryKey]) acc[categoryKey] = { categoryName: categoryForGroup.name, beneficiaries: [], totalAmount: 0, kitAmount: 0, minMembers: categoryForGroup.minMembers ?? 0 };
            acc[categoryKey].beneficiaries.push(ben);
            acc[categoryKey].totalAmount += ben.kitAmount || 0;
            acc[categoryKey].kitAmount = ben.kitAmount || 0;
            return acc;
        }, {} as Record<string, { categoryName: string, beneficiaries: Beneficiary[], totalAmount: number, kitAmount: number, minMembers: number }>);
        const sortedBeneficiaryCategoryKeys = Object.keys(beneficiariesByCategory).sort((a, b) => beneficiariesByCategory[a].minMembers - beneficiariesByCategory[b].minMembers);
        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        return { totalBeneficiaries: beneficiaries.length, beneficiariesGiven, beneficiariesPending, beneficiariesByCategory, sortedBeneficiaryCategoryKeys };
    }, [beneficiaries, sanitizedRationLists]);

    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!campaign) return;
        const shareText = `Campaign: ${campaign.name}\n${campaign.description}`;
        setShareDialogData({ title: `Campaign Summary: ${campaign.name}`, text: shareText, url: window.location.href });
        setIsShareDialogOpen(true);
    };

    if (isLoading) return <BrandedLoader />;

    if (!campaign || campaign.authenticityStatus !== 'Verified' || campaign.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This campaign is not publicly available.</p>
                <Button asChild className="mt-4"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Public Campaigns</Link></Button>
            </main>
        );
    }
    
    const publicDocuments = campaign.documents?.filter(d => d.isPublic) || [];
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns</Link></Button></div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                {campaign.imageUrl ? (
                    <Image src={campaign.imageUrl} alt={campaign.name} fill sizes="100vw" className="object-cover" priority />
                ) : ( <HandHelping className="w-24 h-24 text-muted-foreground" /> )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6"><h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{campaign.name}</h1><p className="text-sm text-white/90 shadow-md">{campaign.status}</p></div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                <Button onClick={handleShare} variant="outline"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card>
                    <CardHeader><CardTitle>Campaign Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground uppercase text-xs font-bold">Description</Label>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{campaign.description || 'No description provided.'}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p><p className="mt-1 text-lg font-semibold">₹{(campaign.targetAmount ?? 0).toLocaleString('en-IN')}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Category</p><p className="mt-1 text-lg font-semibold">{campaign.category}</p></div>
                             <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Start Date</p><p className="mt-1 text-lg font-semibold">{campaign.startDate}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">End Date</p><p className="mt-1 text-lg font-semibold">{campaign.endDate}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {publicDocuments.length > 0 && (
                    <Card>
                        <CardHeader><CardTitle>Public Artifacts</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {publicDocuments.map((doc) => (
                                    <Button key={doc.url} variant="outline" asChild><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate"><File className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{doc.name}</span></a></Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {fundingData ? (
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div className="relative h-48 w-full">
                                    <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                        <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                            <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} />
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                        </RadialBarChart>
                                    </ChartContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-xs text-muted-foreground">Funded</span></div>
                                </div>
                                <div className="space-y-4 text-center md:text-left">
                                    <div><p className="text-sm text-muted-foreground">Collected for Goal</p><p className="text-3xl font-bold">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                    <div><p className="text-sm font-medium text-muted-foreground">Fundraising Target</p><p className="text-3xl font-bold">₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="grid gap-6 sm:grid-cols-3">
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.totalBeneficiaries ?? 0}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Kits Given</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.beneficiariesGiven ?? 0}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Kits Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.beneficiariesPending ?? 0}</div></CardContent></Card>
                </div>
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />
        </main>
    );
}
