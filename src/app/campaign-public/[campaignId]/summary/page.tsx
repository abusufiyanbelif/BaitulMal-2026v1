
'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, collection, query, where, DocumentReference } from 'firebase/firestore';
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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, LogIn, Share2, Hourglass, Wallet, Users, Gift, Target, HandHelping, File, ChevronDown, ChevronRight } from 'lucide-react';
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
import placeholderImages from '@/app/lib/placeholder-images.json';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';


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
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const summaryRef = useRef<HTMLDivElement>(null);
    
    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

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

    const fundingData = useMemo(() => {
        if (!allDonations || !campaign || !beneficiaries) return null;

        const donations = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) {
                return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            }
            return (d as any).campaignId === campaign.id;
        });

        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find((l: any) => l.linkId === campaign.id && l.linkType === 'campaign');
            
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && (d as any).campaignId === campaign.id) {
                amountForThisCampaign = d.amount;
            } else {
                return;
            }

            if (amountForThisCampaign === 0) {
                return;
            }

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportionForThisCampaign = amountForThisCampaign / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0
                ? d.typeSplit
                : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            
            splits.forEach((split: any) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;

                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * proportionForThisCampaign;
                    amountsByCategory[category as DonationCategory] += allocatedAmount;
                }
            });
        });

        const zakatForGoalAmount = amountsByCategory['Zakat'] || 0;
        
        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);

        const zakatAvailableForGoal = Math.max(0, zakatForGoalAmount - zakatAllocated);

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') {
                    // Only use the available portion of Zakat for the goal.
                    return sum + zakatAvailableForGoal;
                }
                return sum + amount;
            }, 0);

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
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
        const fidiyaTotal = amountsByCategory['Fidiya'] || 0;
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + loanTotal + interestTotal + sadaqahTotal + fidiyaTotal + lillahTotal + monthlyContributionTotal;

        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            zakatAllocated,
            zakatAvailableForGoal,
            fundTotals: { fitra: fitraTotal, zakat: zakatTotal, loan: loanTotal, interest: interestTotal, sadaqah: sadaqahTotal, fidiya: fidiyaTotal, lillah: lillahTotal, monthlyContribution: monthlyContributionTotal, grandTotal: grandTotal, }
        };
    }, [allDonations, campaign, beneficiaries]);

    const beneficiaryData = useMemo(() => {
        if (!beneficiaries || !sanitizedRationLists) return null;

        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            
            const matchingCategories = sanitizedRationLists.filter(
              cat => cat.name !== 'General Item List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999)
            );
            
            let appliedCategory: ItemCategory | null = null;
            if (matchingCategories.length > 1) {
                matchingCategories.sort((a, b) => {
                    const rangeA = (a.maxMembers ?? 999) - (a.minMembers ?? 0);
                    const rangeB = (b.maxMembers ?? 999) - (b.minMembers ?? 0);
                    if(rangeA !== rangeB) return rangeA - rangeB;
                    return (b.minMembers ?? 0) - (a.minMembers ?? 0);
                });
                appliedCategory = matchingCategories[0];
            } else if (matchingCategories.length === 1) {
                appliedCategory = matchingCategories[0];
            }

            const categoryForGroup = appliedCategory || { id: 'uncategorized', name: 'Uncategorized', items: [], minMembers: -1, maxMembers: -1 };
            const categoryKey = categoryForGroup.id;

            if (!acc[categoryKey]) {
              acc[categoryKey] = { 
                category: categoryForGroup, 
                beneficiariesByMemberCount: {} 
              };
            }

            const memberCount = ben.members || 0;
            if (!acc[categoryKey].beneficiariesByMemberCount[memberCount]) {
              acc[categoryKey].beneficiariesByMemberCount[memberCount] = [];
            }
            acc[categoryKey].beneficiariesByMemberCount[memberCount].push(ben);
            
            return acc;
        }, {} as Record<string, { category: ItemCategory, beneficiariesByMemberCount: Record<number, Beneficiary[]> }>);

        const sortedBeneficiaryCategoryKeys = Object.keys(beneficiariesByCategory).sort((a, b) => {
          const catA = beneficiariesByCategory[a].category;
          const catB = beneficiariesByCategory[b].category;
          if (catA.id === 'uncategorized') return 1;
          if (catB.id === 'uncategorized') return -1;
          return (catA.minMembers ?? 0) - (catB.minMembers ?? 0);
        });

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
        return {
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            beneficiariesByCategory,
            sortedBeneficiaryCategoryKeys,
        }
    }, [beneficiaries, sanitizedRationLists]);

    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!campaign) {
            toast({
                title: 'Error',
                description: 'Cannot share, summary data is not available.',
                variant: 'destructive',
            });
            return;
        }
        
        let shareText = `
*Assalamualaikum Warahmatullahi Wabarakatuh*

*We Need Your Support!*

Join us for the *${campaign.name}* campaign as we work to provide essential aid to our community.

*Our Goal:*
${campaign.description || 'To support those in need.'}
        `.trim().replace(/^\s+/gm, '');

        if(fundingData) {
            shareText += `

*Financial Update:*
🎯 Target for Kits: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*
            `
        }
        
        shareText += `

Your contribution, big or small, makes a huge difference.

*Please donate and share this message.*
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Campaign Summary: ${campaign.name}`,
            text: shareText,
            url: window.location.href,
        };
        
        setShareDialogData(dataToShare);
        setIsShareDialogOpen(true);
    };

    if (isLoading) {
        return (
            <main className="flex items-center justify-center min-h-screen p-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </main>
        );
    }

    if (!campaign || campaign.authenticityStatus !== 'Verified' || campaign.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This campaign could not be found or is not publicly available.</p>
                <Button asChild className="mt-4">
                    <Link href="/campaign-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Public Campaigns
                    </Link>
                </Button>
            </main>
        );
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
    const publicDocuments = campaign.documents?.filter(d => d.isPublic) || [];
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/campaign-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
                    </Link>
                </Button>
            </div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                {campaign.imageUrl ? (
                    <Image
                        src={campaign.imageUrl}
                        alt={campaign.name}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        data-ai-hint="campaign background"
                        priority
                    />
                ) : (
                    <HandHelping className="w-24 h-24 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                    <h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{campaign.name}</h1>
                    <p className="text-sm text-white/90 shadow-md">{campaign.status}</p>
                </div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                 <div className="flex gap-2">
                    <Button onClick={handleShare} variant="outline">
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                </div>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card>
                    <CardHeader>
                        <CardTitle>Campaign Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="mt-1 text-sm">{campaign.description || 'No description provided.'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p>
                                <p className="mt-1 text-lg font-semibold">₹{(campaign.targetAmount ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Category</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.category}</p>
                            </div>
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.startDate}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                <p className="mt-1 text-lg font-semibold">{campaign.endDate}</p>
                            </div>
                        </div>
                        {campaign.allowedDonationTypes && campaign.allowedDonationTypes.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <h3 className="text-sm font-medium text-muted-foreground">Accepted Donation Types</h3>
                                <div className="flex flex-wrap gap-2">
                                    {campaign.allowedDonationTypes.map(type => (
                                        <Badge key={type} variant="outline">{type}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {fundingData ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-6 w-6 text-primary" />
                                Fundraising Progress
                            </CardTitle>
                            <CardDescription>A real-time look at our collected donations against the goal for this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                            data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]}
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
                                            {(fundingData.fundingProgress || 0).toFixed(0)}%
                                        </span>
                                        <span className="text-xs text-muted-foreground">Funded</span>
                                    </div>
                                </div>
                                <div className="space-y-4 text-center md:text-left">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Collected for Goal</p>
                                        <p className="text-3xl font-bold">
                                        ₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Fundraising Target</p>
                                        <p className="text-3xl font-bold">
                                        ₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                   <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-6 w-6 text-primary" />
                            Fundraising Progress
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {areDonationsLoading ? <Skeleton className="h-24" /> : <p className="text-muted-foreground">Login to view detailed fundraising progress.</p>}
                      </CardContent>
                   </Card>
                )}


                <div className="grid gap-6 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.totalBeneficiaries ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Given</CardTitle>
                            <Gift className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.beneficiariesGiven ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kits Pending</CardTitle>
                            <Hourglass className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{beneficiaryData?.beneficiariesPending ?? 0}</div>
                        </CardContent>
                    </Card>
                </div>
                
                {publicDocuments.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Public Artifacts</CardTitle>
                            <CardDescription>View photos, receipts, or other public documents related to this campaign.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {publicDocuments.map((doc) => (
                                    <Button key={doc.url} variant="outline" asChild>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate">
                                            <File className="mr-2 h-4 w-4 shrink-0" />
                                            <span className="truncate">{doc.name}</span>
                                        </a>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
                 {fundingData && (
                    <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Zakat Utilization</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Zakat Collected for Campaign</span>
                                <span className="font-semibold font-mono">₹{fundingData.fundTotals.zakat.toLocaleString('en-IN') ?? '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Zakat Allocated as Cash-in-Hand</span>
                                <span className="font-semibold font-mono">₹{(fundingData.zakatAllocated || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-base">
                                <span className="font-bold">Zakat Balance for Goal</span>
                                <span className="font-bold text-primary font-mono">₹{((fundingData.fundTotals.zakat || 0) - (fundingData.zakatAllocated || 0)).toLocaleString('en-IN')}</span>
                            </div>
                             {campaign.allowedDonationTypes?.includes('Zakat') && (
                                <p className="text-xs text-muted-foreground pt-1">
                                    Because Zakat is an allowed donation type for this campaign, the available balance is automatically applied to the fundraising goal.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                       <Card>
                          <CardHeader>
                              <CardTitle>Fund Totals by Type</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fitra</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fidiya</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.fidiya.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (for disposal)</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold font-mono">₹{fundingData?.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                              <Separator className="my-2"/>
                              <div className="flex justify-between items-center text-base"><span className="font-semibold">Grand Total Received</span><span className="font-bold text-primary font-mono">₹{fundingData?.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span></div>
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
                                        <Pie data={fundingData?.donationPaymentTypeChartData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={5}>
                                            {fundingData?.donationPaymentTypeChartData?.map((entry) => (
                                                <Cell key={entry.name} fill={`var(--color-${entry.name.replace(/\s+/g, '')})`} />
                                            ))}
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </PieChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>
                </>
                )}

                {campaign.category === 'Ration' && beneficiaryData && beneficiaryData.sortedBeneficiaryCategoryKeys.length > 0 && (
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
                                      {beneficiaryData.sortedBeneficiaryCategoryKeys.map(categoryId => {
                                          const group = beneficiaryData.beneficiariesByCategory[categoryId];
                                          if (!group) return null;
                                          const { category, beneficiariesByMemberCount } = group;

                                          const categoryIsCollapsed = collapsedGroups[categoryId];
                                          const totalBeneficiariesInCategory = Object.values(beneficiariesByMemberCount).reduce((sum, benList) => sum + benList.length, 0);
                                          
                                          const subGroupTotals = Object.values(beneficiariesByMemberCount).reduce((sum, benList) => {
                                              if (benList.length === 0) return sum;
                                              const kitAmount = benList[0].kitAmount || 0;
                                              return sum + (kitAmount * benList.length);
                                          }, 0);

                                          const categoryName = category.name === 'Uncategorized' 
                                              ? 'Uncategorized'
                                              : (category.minMembers === undefined || category.minMembers === category.maxMembers)
                                                  ? `${category.name} (${category.minMembers ?? 'Any'} Members)`
                                                  : `${category.name} (${category.minMembers}-${category.maxMembers} Members)`;
                                          
                                          const isEffectivelyRanged = category.name !== 'Uncategorized' && category.minMembers !== category.maxMembers && Object.keys(beneficiariesByMemberCount).length > 1;

                                          return (
                                              <React.Fragment key={categoryId}>
                                                  <TableRow className="bg-muted hover:bg-muted cursor-pointer" onClick={() => toggleGroup(categoryId)}>
                                                      <TableCell colSpan={isEffectivelyRanged ? 1 : 4} className="font-bold">
                                                          <div className="flex items-center gap-2">
                                                              {isEffectivelyRanged && (categoryIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                                              {categoryName}
                                                          </div>
                                                      </TableCell>
                                                      {isEffectivelyRanged && <TableCell className="text-center font-bold">{totalBeneficiariesInCategory}</TableCell>}
                                                      {isEffectivelyRanged && <TableCell className="text-right font-bold font-mono"></TableCell>}
                                                      {isEffectivelyRanged && <TableCell className="text-right font-bold font-mono">₹{subGroupTotals.toLocaleString('en-IN')}</TableCell>}
                                                  </TableRow>

                                                  {!categoryIsCollapsed && Object.keys(beneficiariesByMemberCount).sort((a, b) => Number(a) - Number(b)).map(memberCountStr => {
                                                      const memberCount = Number(memberCountStr);
                                                      const subGroupBeneficiaries = beneficiariesByMemberCount[memberCount];
                                                      if (subGroupBeneficiaries.length === 0) return null;
                                                      const subGroupKitAmount = subGroupBeneficiaries[0].kitAmount || 0;
                                                      const subGroupTotalAmount = subGroupKitAmount * subGroupBeneficiaries.length;
                                                      return (
                                                          <TableRow key={`${categoryId}-${memberCount}`} className="bg-muted/20">
                                                              <TableCell className="pl-12">
                                                                  {memberCount} Members
                                                              </TableCell>
                                                              <TableCell className="text-center">{subGroupBeneficiaries.length}</TableCell>
                                                              <TableCell className="text-right font-mono">₹{subGroupKitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                              <TableCell className="text-right font-mono">₹{subGroupTotalAmount.toLocaleString('en-IN')}</TableCell>
                                                          </TableRow>
                                                      )
                                                  })}
                                              </React.Fragment>
                                          )
                                      })}
                                  </TableBody>
                                   <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-right">Total</TableCell>
                                            <TableCell className="text-right font-bold font-mono">₹{Object.values(beneficiaryData.beneficiariesByCategory).reduce((sum, group) => {
                                                const groupTotal = Object.values(group.beneficiariesByMemberCount).reduce((subSum, benList) => {
                                                    if (benList.length === 0) return subSum;
                                                    return subSum + ((benList[0].kitAmount || 0) * benList.length);
                                                }, 0);
                                                return sum + groupTotal;
                                            }, 0).toLocaleString('en-IN')}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                              </Table>
                            </div>
                          </CardContent>
                      </Card>
                  )}
            </div>

            <ShareDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                shareData={shareDialogData} 
            />
        </main>
    );
}
