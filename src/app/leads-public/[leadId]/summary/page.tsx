

'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
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

import type { Lead, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, LogIn, Share2, Hourglass, Wallet, Users, Gift, Target } from 'lucide-react';
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


export default function PublicLeadSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.leadId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
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
        
        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
        };
    }, [allDonations, lead]);
    
     const beneficiaryData = useMemo(() => {
        if (!beneficiaries) return null;

        const beneficiariesByCategory = beneficiaries.reduce((acc, ben) => {
            const key = ben.members || 0;
            if (!acc[key]) {
                acc[key] = { beneficiaries: [], totalAmount: 0 };
            }
            acc[key].beneficiaries.push(ben);
            acc[key].totalAmount += ben.kitAmount || 0;
            return acc;
        }, {} as Record<number, { beneficiaries: Beneficiary[], totalAmount: number }>);
        
        const sortedBeneficiaryCategories = Object.keys(beneficiariesByCategory).map(Number).sort((a, b) => b - a);

        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;
        
        return {
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            beneficiariesByCategory,
            sortedBeneficiaryCategories,
        }
    }, [beneficiaries]);

    const isLoading = isLeadLoading || areDonationsLoading || areBeneficiariesLoading || isBrandingLoading || isPaymentLoading;
    
    const handleShare = async () => {
        if (!lead || !fundingData) {
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

Join us for the *${lead.name}* campaign as we work to provide essential aid to our community.

*Our Goal:*
${lead.description || 'To support those in need.'}

*Financial Update:*
🎯 Target for Kits: ₹${fundingData.targetAmount.toLocaleString('en-IN')}
✅ Collected (Verified): ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}
⏳ Remaining: *₹${fundingData.remainingToCollect.toLocaleString('en-IN')}*

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
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6">
                <Image
                    src={lead.imageUrl || placeholderImages.lead_fallback}
                    alt={lead.name}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    data-ai-hint="lead background"
                    priority
                />
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

                    {beneficiaryData && beneficiaryData.sortedBeneficiaryCategories.length > 0 && (
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
                                        {beneficiaryData.sortedBeneficiaryCategories.map(memberCount => {
                                            const group = beneficiaryData.beneficiariesByCategory[memberCount];
                                            const count = group.beneficiaries.length;
                                            const kitAmount = group.beneficiaries[0]?.kitAmount || 0;
                                            return (
                                                <TableRow key={memberCount}>
                                                    <TableCell className="font-medium">{memberCount} Members</TableCell>
                                                    <TableCell className="text-center">{count}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{kitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right font-mono">₹{group.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
