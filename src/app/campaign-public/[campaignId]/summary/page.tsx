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

export default function PublicCampaignSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
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
    
    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;

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
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
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
            },
            amountsByCategory
        };
    }, [allDonations, campaign, beneficiaries]);

    const beneficiaryData = useMemo(() => {
        if (!beneficiaries) return null;
        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        return { totalBeneficiaries: beneficiaries.length, beneficiariesGiven, beneficiariesPending };
    }, [beneficiaries]);

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
                <Button asChild className="mt-4 active:scale-95 transition-transform"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Public Campaigns</Link></Button>
            </main>
        );
    }
    
    const publicDocuments = campaign.documents?.filter(d => d.isPublic) || [];
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4"><Button variant="outline" asChild className="active:scale-95 transition-transform"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns</Link></Button></div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                {campaign.imageUrl ? (
                    <Image src={campaign.imageUrl} alt={campaign.name} fill sizes="100vw" className="object-cover" priority />
                ) : ( <HandHelping className="w-24 h-24 text-muted-foreground" /> )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6"><h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{campaign.name}</h1><p className="text-sm text-white/90 shadow-md">{campaign.status}</p></div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                <Button onClick={handleShare} variant="outline" className="active:scale-95 transition-transform"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-zoom">
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
                    <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <CardHeader><CardTitle>Public Artifacts</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {publicDocuments.map((doc) => (
                                    <Button key={doc.url} variant="outline" asChild className="active:scale-95 transition-transform"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate"><File className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{doc.name}</span></a></Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {fundingData ? (
                    <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
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
                    <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.totalBeneficiaries ?? 0}</div></CardContent></Card>
                    <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Provided</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.beneficiariesGiven ?? 0}</div></CardContent></Card>
                    <Card className="animate-fade-in-up" style={{ animationDelay: '500ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{beneficiaryData?.beneficiariesPending ?? 0}</div></CardContent></Card>
                </div>
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />
        </main>
    );
}