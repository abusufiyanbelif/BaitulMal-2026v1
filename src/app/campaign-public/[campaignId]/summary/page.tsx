

'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
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
import { ArrowLeft, Loader2, LogIn, Share2, Hourglass, Wallet, Users, Gift, Target, FolderKanban } from 'lucide-react';
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

const donationCategoryChartConfig = {
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
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

    // Data fetching
    const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    
    const allDonationsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
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
        if (!allDonations || !campaign) return null;

        const donations = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) {
                return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            }
            return d.campaignId === campaign.id;
        });

        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);

        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find(l => l.linkId === campaign.id && l.linkType === 'campaign');
            
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && d.campaignId === campaign.id) {
                // This is a legacy donation for this campaign
                amountForThisCampaign = d.amount;
            } else {
                return;
            }

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = amountForThisCampaign / totalDonationAmount;

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
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [, amount]) => sum + amount, 0);

        const fundingGoal = campaign.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
        };
    }, [allDonations, campaign]);

    const beneficiaryData = useMemo(() => {
        if (!beneficiaries || !sanitizedRationLists) return null;

        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const members = ben.members || 0;
            const generalCategory = sanitizedRationLists.find(cat => cat.name === 'General Item List');
            const specificCategory = sanitizedRationLists.find(cat => cat.name !== 'General Item List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
            
            const appliedCategory = specificCategory || generalCategory;
            
            let categoryName = 'Uncategorized';
            let categoryKey = 'uncategorized';

            if (appliedCategory) {
              categoryName = appliedCategory.name === 'General Item List'
                  ? 'General'
                  : (appliedCategory.minMembers === undefined || appliedCategory.maxMembers === undefined || appliedCategory.minMembers === appliedCategory.maxMembers)
                      ? `${appliedCategory.name} (${appliedCategory.minMembers})`
                      : `${appliedCategory.name} (${appliedCategory.minMembers}-${appliedCategory.maxMembers})`;
              categoryKey = appliedCategory.id;
            }

            if (!acc[categoryKey]) {
              acc[categoryKey] = { categoryName, beneficiaries: [], totalAmount: 0, kitAmount: 0, minMembers: appliedCategory?.minMembers ?? 0 };
            }
            acc[categoryKey].beneficiaries.push(ben);
            acc[categoryKey].totalAmount += ben.kitAmount || 0;
            acc[categoryKey].kitAmount = ben.kitAmount || 0; // Assuming kitAmount is consistent per category
            return acc;
        }, {} as Record<string, { categoryName: string, beneficiaries: Beneficiary[], totalAmount: number, kitAmount: number, minMembers: number }>);

        const sortedBeneficiaryCategoryKeys = Object.keys(beneficiariesByCategory).sort((a, b) => {
          return beneficiariesByCategory[a].minMembers - beneficiariesByCategory[b].minMembers;
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
        if (!campaign || !fundingData) {
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

Join us for the *${campaign.name}* campaign as we work to provide essential aid to our community.

*Our Goal:*
${campaign.description || 'To support those in need.'}

*Financial Update:*
🎯 Target for Kits: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*

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
                    <FolderKanban className="w-24 h-24 text-muted-foreground" />
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
                                        data={[{ name: 'Progress', value: fundingData?.fundingProgress || 0, fill: 'hsl(var(--primary))' }]}
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
                                        {(fundingData?.fundingProgress || 0).toFixed(0)}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">Funded</span>
                                </div>
                            </div>
                            <div className="space-y-4 text-center md:text-left">
                                <div>
                                    <p className="text-sm text-muted-foreground">Collected for Goal</p>
                                    <p className="text-3xl font-bold">
                                    ₹{(fundingData?.totalCollectedForGoal || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Fundraising Target</p>
                                    <p className="text-3xl font-bold">
                                    ₹{(fundingData?.targetAmount || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
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
                
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Donations by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                <BarChart
                                    data={Object.entries(fundingData?.amountsByCategory || {}).map(([name, value]) => ({ name, value }))}
                                    layout="vertical"
                                    margin={{ right: 20 }}
                                >
                                    <CartesianGrid horizontal={false} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        tick={{ fontSize: 12 }}
                                        width={120}
                                    />
                                    <XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="value" radius={4}>
                                        {Object.entries(fundingData?.amountsByCategory || {}).map(([name,]) => (
                                            <Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    {beneficiaryData && beneficiaryData.sortedBeneficiaryCategoryKeys.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Beneficiaries by Category</CardTitle>
                                <CardDescription>
                                    Summary of beneficiaries grouped by family size.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">Category Name</TableHead>
                                            <TableHead className="text-center whitespace-nowrap">Total Beneficiaries</TableHead>
                                            <TableHead className="text-right whitespace-nowrap">Kit Amount (per kit)</TableHead>
                                            <TableHead className="text-right whitespace-nowrap">Total Kit Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {beneficiaryData.sortedBeneficiaryCategoryKeys.map(key => {
                                            const group = beneficiaryData.beneficiariesByCategory[key];
                                            if (!group) return null;
                                            return (
                                                <TableRow key={key}>
                                                    <TableCell className="font-medium">{group.categoryName}</TableCell>
                                                    <TableCell className="text-center">{group.beneficiaries.length}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{group.kitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-center font-bold">{beneficiaryData.totalBeneficiaries}</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right font-bold font-mono">₹{Object.values(beneficiaryData.beneficiariesByCategory).reduce((sum, group) => sum + group.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
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
