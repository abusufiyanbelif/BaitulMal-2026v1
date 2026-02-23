
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

import type { Lead, Beneficiary, Donation, DonationCategory, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, LogIn, Share2, Hourglass, Wallet, Users, Gift, Target, HandHelping, File } from 'lucide-react';
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
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-3))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-5))" },
    Fitra: { label: "Fitra", color: "hsl(var(--chart-7))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-5))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;


export default function PublicLeadSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { userProfile } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const summaryRef = useRef<HTMLDivElement>(null);

    // Data fetching
    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    
    const allDonationsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'donations');
    }, [firestore]);

    const { data: lead, isLoading: isLeadLoading, error: leadError } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading, error: beneficiariesError } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading, error: donationsError } = useCollection<Donation>(allDonationsCollectionRef);
    
     const sanitizedRationLists = useMemo(() => {
        if (!lead?.itemCategories) return [];
        if (Array.isArray(lead.itemCategories)) return lead.itemCategories;
        // Hotfix for old object format
        return [
          {
            id: 'general',
            name: 'General Item List',
            minMembers: 0,
            maxMembers: 0,
            items: (lead.itemCategories as any)['General Item List'] || []
          }
        ];
    }, [lead?.itemCategories]);

    const fundingData = useMemo(() => {
        if (!allDonations || !lead) return null;

        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id && link.linkType === 'lead'));

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
        const lillahTotal = amountsByCategory['Lillah'] || 0;
        const monthlyContributionTotal = amountsByCategory['Monthly Contribution'] || 0;
        const grandTotal = fitraTotal + zakatTotal + loanTotal + interestTotal + sadaqahTotal + lillahTotal + monthlyContributionTotal;
        
        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
            donationPaymentTypeChartData: Object.entries(paymentTypeData).map(([name, value]) => ({ name, value })),
            fundTotals: { fitra: fitraTotal, zakat: zakatTotal, loan: loanTotal, interest: interestTotal, sadaqah: sadaqahTotal, lillah: lillahTotal, monthlyContribution: monthlyContributionTotal, grandTotal: grandTotal, }
        };
    }, [allDonations, lead]);
    
     const beneficiaryData = useMemo(() => {
        if (!beneficiaries) return null;

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
        return {
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
        }
    }, [beneficiaries]);

    const isLoading = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!lead) {
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

Join us for the *${lead.name}* initiative as we work to provide essential aid to our community.

*Our Goal:*
${lead.description || 'To support those in need.'}
        `.trim().replace(/^\s+/gm, '');

        if(fundingData) {
             shareText += `

*Financial Update:*
🎯 Target: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*
            `
        }

        shareText += `

Your contribution, big or small, makes a huge difference.

*Please donate and share this message.*
        `.trim().replace(/^\s+/gm, '');


        const dataToShare = {
            title: `Lead Summary: ${lead.name}`,
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

    if (!lead || lead.authenticityStatus !== 'Verified' || lead.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This lead could not be found or is not publicly available.</p>
                <Button asChild className="mt-4">
                    <Link href="/leads-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Public Leads
                    </Link>
                </Button>
            </main>
        );
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
    const publicDocuments = lead.documents?.filter(d => d.isPublic) || [];
    
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/leads-public">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
                    </Link>
                </Button>
            </div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                {lead.imageUrl ? (
                    <Image
                        src={lead.imageUrl}
                        alt={lead.name}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        data-ai-hint="lead background"
                        priority
                    />
                ) : (
                    <HandHelping className="w-24 h-24 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                    <h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{lead.name}</h1>
                    <p className="text-sm text-white/90 shadow-md">{lead.status}</p>
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
                        <CardTitle>Lead Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="mt-1 text-sm">{lead.description || 'No description provided.'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Required Amount</p>
                                <p className="mt-1 text-lg font-semibold">₹{(lead.requiredAmount ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p>
                                <p className="mt-1 text-lg font-semibold">₹{(lead.targetAmount ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Category</p>
                                <p className="mt-1 text-lg font-semibold">{lead.category}</p>
                            </div>
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                <p className="mt-1 text-lg font-semibold">{lead.startDate}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                <p className="mt-1 text-lg font-semibold">{lead.endDate}</p>
                            </div>
                        </div>
                        {lead.allowedDonationTypes && lead.allowedDonationTypes.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <h3 className="text-sm font-medium text-muted-foreground">Accepted Donation Types</h3>
                                <div className="flex flex-wrap gap-2">
                                    {lead.allowedDonationTypes.map(type => (
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
                            <CardDescription>A real-time look at our collected donations against the goal for this initiative.</CardDescription>
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
                            <p className="text-muted-foreground">Login to view detailed fundraising progress.</p>
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
                          <CardDescription>View photos, receipts, or other public documents related to this lead.</CardDescription>
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
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fund Totals by Type</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Fitra</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.fitra.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Zakat</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.zakat.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Sadaqah</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.sadaqah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Lillah</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.lillah.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Monthly Contribution</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.monthlyContribution.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Interest (for disposal)</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.interest.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Loan (Qard-e-Hasana)</span><span className="font-semibold font-mono">₹{fundingData.fundTotals?.loan.toLocaleString('en-IN') ?? '0.00'}</span></div>
                                <Separator className="my-2"/>
                                <div className="flex justify-between items-center text-base"><span className="font-semibold">Grand Total Received</span><span className="font-bold text-primary font-mono">₹{fundingData.fundTotals?.grandTotal.toLocaleString('en-IN') ?? '0.00'}</span></div>
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
