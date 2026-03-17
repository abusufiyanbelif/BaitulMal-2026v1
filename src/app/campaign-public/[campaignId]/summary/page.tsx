'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { doc, collection, query, where, type DocumentReference } from 'firebase/firestore';
import Link from 'next/link';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    ArrowLeft, 
    Share2, 
    Hourglass, 
    Users, 
    Gift, 
    Target, 
    HandHelping, 
    File, 
    Utensils, 
    LifeBuoy,
    ZoomIn,
    ZoomOut, 
    RotateCw, 
    RefreshCw, 
    ImageIcon,
    ShieldCheck,
    ChevronRight,
    Calendar
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories } from '@/lib/modules';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import Image from 'next/image';
import { BrandedLoader } from '@/components/branded-loader';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-3))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-7))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-5))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-5))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

export default function PublicCampaignSummaryPage() {
    const params = useParams();
    const campaignId = params.campaignId as string;
    const firestore = useFirestore();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<{url: string, name: string} | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const summaryRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => { setIsClient(true); }, []);

    const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, `campaigns/${campaignId}/beneficiaries`) : null, [firestore, campaignId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const visibilityRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_visibility') : null, [firestore]);
    const { data: visibilitySettings } = useDoc<any>(visibilityRef);

    const isRationInitiative = useMemo(() => {
        return campaign?.category === 'Ration';
    }, [campaign]);

    const itemGivenLabel = useMemo(() => isRationInitiative ? 'Kits Given' : 'Assistance Given', [isRationInitiative]);
    const itemPendingLabel = useMemo(() => isRationInitiative ? 'Pending Kits' : 'Pending Support', [isRationInitiative]);

    const beneficiaryGroups = useMemo(() => {
        if (!campaign || !beneficiaries) return [];
        const categories = (campaign.itemCategories || []).filter(c => c.name !== 'Item Price List');
        return categories.map(cat => {
            const count = beneficiaries.filter(b => b.itemCategoryId === cat.id).length;
            const kitAmount = cat.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            
            let displayName = cat.name;
            if (isRationInitiative) {
                if (cat.minMembers === 1 && cat.maxMembers === 1) displayName = `Member (1)`;
                else if (cat.minMembers !== undefined && cat.maxMembers !== undefined) displayName = `Members (${cat.minMembers}-${cat.maxMembers})`;
            }

            return { id: cat.id, name: displayName, count, kitAmount, totalAmount: count * kitAmount };
        });
    }, [campaign, beneficiaries, isRationInitiative]);

    const calculatedRequirementTotal = useMemo(() => {
        return beneficiaryGroups.reduce((sum, g) => sum + g.totalAmount, 0);
    }, [beneficiaryGroups]);

    const fundingData = useMemo(() => {
        if (!allDonations || !campaign || !beneficiaries) return null;
        
        const donationsList = allDonations.filter(d => {
            if (d.linkSplit && d.linkSplit.length > 0) {
                return d.linkSplit.some(link => link.linkId === campaign.id && link.linkType === 'campaign');
            }
            return (d as any).campaignId === campaign.id;
        });

        const verifiedDonationsList = donationsList.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const paymentTypeStats: Record<string, { count: number, amount: number }> = {};
        let zakatForGoalAmount = 0;

        verifiedDonationsList.forEach(d => {
            let amountForThisCampaign = 0;
            const campaignLink = d.linkSplit?.find((l: any) => l.linkId === campaign.id && l.linkType === 'campaign');
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && (d as any).campaignId === campaign.id) {
                amountForThisCampaign = d.amount;
            } else { return; }

            if (amountForThisCampaign === 0) return;

            const paymentType = d.donationType || 'Other';
            if (!paymentTypeStats[paymentType]) {
                paymentTypeStats[paymentType] = { count: 0, amount: 0 };
            }
            paymentTypeStats[paymentType].count += 1;
            paymentTypeStats[paymentType].amount += amountForThisCampaign;

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
        const totalZakatBalance = (amountsByCategory.Zakat || 0) - zakatAllocated;

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatAvailableForGoal;
                return sum + amount;
            }, 0);

        const targetAmount = calculatedRequirementTotal > 0 ? calculatedRequirementTotal : (campaign.targetAmount || 0);

        return { 
            totalCollectedForGoal, 
            fundingProgress: targetAmount > 0 ? (totalCollectedForGoal / targetAmount) * 100 : 0, 
            targetAmount, 
            totalBeneficiaries: beneficiaries.length, 
            beneficiariesGiven: beneficiaries.filter(b => b.status === 'Given').length, 
            beneficiariesPending: beneficiaries.length - beneficiaries.filter(b => b.status === 'Given').length, 
            zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal, totalZakatBalance, amountsByCategory, paymentTypeStats,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, campaign, beneficiaries, calculatedRequirementTotal]);

    const chartDataValues = useMemo(() => {
        return fundingData?.amountsByCategory ? Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ 
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` 
        })) : [];
    }, [fundingData]);

    const paymentTypeChartData = useMemo(() => {
        if (!fundingData?.paymentTypeStats) return [];
        return Object.entries(fundingData.paymentTypeStats).map(([name, stats]) => ({
            name, 
            value: stats.amount, 
            count: stats.count,
            fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));
    }, [fundingData]);

    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;

    if (isLoading) return <BrandedLoader />;

    if (!campaign || campaign.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center text-primary font-normal">
                <p className="text-lg text-primary/70 font-normal">This Campaign Is Not Available For Public View.</p>
                <Button asChild className="mt-4 active:scale-95 transition-transform font-bold border-primary/20 text-primary" variant="outline"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Public Campaigns</Link></Button>
            </main>
        );
    }
    
    const publicDocuments = campaign.documents?.filter(d => d.isPublic) || [];
    const FallbackIcon = campaign.category === 'Ration' ? Utensils : campaign.category === 'Relief' ? LifeBuoy : HandHelping;

    const handleShare = async () => {
        if (!campaign) return;
        const shareText = `Campaign: ${campaign.name}\n${campaign.description}`;
        setShareDialogData({ title: `Campaign Summary: ${campaign.name}`, text: shareText, url: window.location.href });
        setIsShareDialogOpen(true);
    };

    const handleViewImage = (url: string, name: string) => {
        setImageToView({ url, name });
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isVisible = (key: string) => {
        return visibilitySettings?.[`public_${key}`] !== false;
    };

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal overflow-hidden">
             <div className="mb-4"><Button variant="outline" asChild className="active:scale-95 transition-transform font-bold border-primary/20 text-primary"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center cursor-pointer shadow-sm border border-primary/5" onClick={() => campaign.imageUrl && handleViewImage(campaign.imageUrl, campaign.name)}>
                {campaign.imageUrl ? (
                    <Image 
                        src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`} 
                        alt={campaign.name} 
                        fill 
                        sizes="100vw"
                        className="object-cover" 
                        priority 
                    />
                ) : ( <FallbackIcon className="w-24 h-24 text-muted-foreground/30" /> )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6"><h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{campaign.name}</h1><p className="text-sm text-white/90 shadow-md font-bold tracking-tight">{campaign.status}</p></div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                <Button onClick={handleShare} variant="outline" className="active:scale-95 transition-transform font-bold border-primary/20 text-primary h-10 px-6 rounded-xl shadow-sm">
                    <Share2 className="mr-2 h-4 w-4" /> Share Dashboard
                </Button>
            </div>

            <div className="space-y-10" ref={summaryRef}>
                <Card className="animate-fade-in-zoom shadow-md border-primary/10 bg-white overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary tracking-tight uppercase">Campaign Objectives</CardTitle></CardHeader>
                    <CardContent className="space-y-6 pt-6 text-foreground font-normal">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase opacity-60">Impact Description</Label>
                            <p className="mt-1 text-sm font-normal whitespace-pre-wrap leading-relaxed text-muted-foreground">{campaign.description || 'No Detailed Description Provided.'}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-primary/5">
                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Fundraising Goal</p><p className="text-lg font-bold text-primary font-mono">₹{(fundingData?.targetAmount ?? 0).toLocaleString('en-IN')}</p></div>
                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Category</p><Badge variant="secondary" className="font-bold text-xs">{campaign.category}</Badge></div>
                             <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Launch Date</p><p className="text-sm font-bold text-primary">{campaign.startDate}</p></div>
                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Target End Date</p><p className="text-sm font-bold text-primary">{campaign.endDate}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {fundingData && (
                    <div className="grid gap-10 animate-fade-in-up">
                        {isVisible('funding_progress') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="flex items-center gap-2 font-bold text-primary uppercase"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle>
                                    <CardDescription className="font-normal text-primary/70">Verified Donations For This Project.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center font-normal">
                                        <div className="relative h-48 sm:h-64 w-full">
                                            {isClient ? (
                                                <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                                    <ResponsiveContainer>
                                                        <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                                            <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} className="transition-all duration-1000 ease-out" />
                                                        </RadialBarChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            ) : <Skeleton className="w-full h-full rounded-full" />}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in-zoom"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-[10px] text-muted-foreground font-bold tracking-tight uppercase">Funded</span></div>
                                        </div>
                                        <div className="space-y-6 text-center md:text-left text-primary font-bold">
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Raised For Goal</p><p className="text-3xl font-bold text-primary font-mono">₹{(fundingData?.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">
                                                    {calculatedRequirementTotal > 0 ? "Target Goal (Synced)" : "Target Goal"}
                                                </p>
                                                <p className="text-3xl font-bold text-primary opacity-40 font-mono">₹{(fundingData?.targetAmount || 0).toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase opacity-60">Grand Total Received</p><p className="text-3xl font-bold text-primary font-mono">₹{(fundingData?.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isVisible('quick_stats') && (
                            <div className="grid gap-6 sm:grid-cols-3 font-normal">
                                <Card className="bg-white border-primary/10 shadow-sm transition-all hover:shadow-lg"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold text-primary tracking-tight uppercase">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.totalBeneficiaries ?? 0}</div></CardContent></Card>
                                <Card className="bg-white border-primary/10 shadow-sm transition-all hover:shadow-lg"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold text-primary tracking-tight uppercase">{itemGivenLabel}</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.beneficiariesGiven ?? 0}</div></CardContent></Card>
                                <Card className="bg-white border-primary/10 shadow-sm transition-all hover:shadow-lg"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold text-primary tracking-tight uppercase">{itemPendingLabel}</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.beneficiariesPending ?? 0}</div></CardContent></Card>
                            </div>
                        )}

                        {isVisible('beneficiary_groups') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="font-bold text-primary tracking-tight uppercase">
                                        {isRationInitiative ? 'Beneficiary Categories' : 'Required Financial Allocation'}
                                    </CardTitle>
                                    <CardDescription className="font-normal text-primary/70">
                                        {isRationInitiative 
                                            ? 'Breakdown of requirements by family size category.' 
                                            : 'Itemized requirement breakdown for this initiative.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6 font-normal">
                                    <ScrollArea className="w-full">
                                        <div className="border rounded-lg overflow-hidden font-normal text-foreground shadow-sm min-w-[650px] border-primary/10 mx-4 sm:mx-0">
                                            {isRationInitiative ? (
                                                <Table>
                                                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Category Name</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Beneficiaries</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Kit Amount</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Total Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {beneficiaryGroups.map((group) => (
                                                            <TableRow key={group.id} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors bg-white border-b border-primary/5 last:border-none">
                                                                <TableCell className="font-bold text-primary text-xs">{group.name}</TableCell>
                                                                <TableCell className="text-right font-normal text-xs">{group.count}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{group.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    {beneficiaryGroups.length > 0 && (
                                                        <TableFooter className="bg-primary/5 border-t">
                                                            <TableRow><TableCell colSpan={3} className="text-right font-bold text-primary text-[10px] tracking-tight uppercase">Total Requirement</TableCell><TableCell className="text-right font-mono font-bold text-primary text-lg">₹{calculatedRequirementTotal.toLocaleString('en-IN')}</TableCell></TableRow>
                                                        </TableFooter>
                                                    )}
                                                </Table>
                                            ) : (
                                                <Table>
                                                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Requirement Description</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Quantity</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Unit Price</TableHead>
                                                            <TableHead className="text-right font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Total Price</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {campaign?.itemCategories?.[0]?.items.map((item, idx) => (
                                                            <TableRow key={idx} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors bg-white border-b border-primary/5 last:border-none">
                                                                <TableCell className="font-medium text-xs">{item.name}</TableCell>
                                                                <TableCell className="text-right font-normal text-xs">{item.quantity} {item.quantityType}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price / (item.quantity || 1)).toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price || 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    <TableFooter className="bg-primary/5 border-t font-bold">
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="text-right font-bold text-primary text-[10px] tracking-tight uppercase">Single Unit Total</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-primary text-lg">
                                                                ₹{(campaign?.itemCategories?.[0]?.items.reduce((sum, i) => sum + i.price, 0) || 0).toLocaleString('en-IN')}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableFooter>
                                                </Table>
                                            )}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-6 lg:grid-cols-2 font-normal">
                            {isVisible('fund_totals') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-[10px] tracking-tight uppercase opacity-60">Fund Totals By Type</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 pt-6 font-normal">
                                        <ScrollArea className="w-full">
                                            <div className="space-y-2 min-w-[300px] px-2">
                                                {donationCategories.map(cat => (
                                                    <div key={cat} className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded">
                                                        <span className="text-muted-foreground font-normal whitespace-nowrap">{cat === 'Interest' ? 'Interest (For Disposal)' : cat === 'Loan' ? 'Loan (Qard-e-Hasana)' : cat}</span>
                                                        <span className="font-mono">₹{(fundingData?.amountsByCategory[cat] || 0).toLocaleString('en-IN')}</span>
                                                    </div>
                                                ))}
                                                <Separator className="bg-primary/10 my-2" />
                                                <div className="flex justify-between items-center text-lg font-bold text-primary px-2"><span>Grand Total Received</span><span className="font-mono">₹{(fundingData?.grandTotal || 0).toLocaleString('en-IN')}</span></div>
                                            </div>
                                            <ScrollBar orientation="horizontal" className="hidden" />
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('zakat_utilization') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm tracking-tight uppercase">Zakat Fund Utilization</CardTitle><CardDescription className="font-normal text-primary/70">Tracking Of Designated Zakat Resources.</CardDescription></CardHeader>
                                    <CardContent className="space-y-3 pt-6 font-normal text-foreground">
                                        <div className="flex justify-between items-center text-sm font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded">
                                            <span className="text-muted-foreground tracking-tight font-normal">Total Zakat Collected</span>
                                            <span className="font-bold font-mono">₹{fundingData.amountsByCategory.Zakat.toLocaleString('en-IN')}</span>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="pl-4 border-l-2 border-dashed border-primary/20 space-y-2 py-2 font-bold">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="text-muted-foreground tracking-tight font-normal">Allocated As Assistance</span>
                                                <span className="font-bold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="font-normal opacity-60">Disbursed (Given)</span>
                                                <span className="font-mono text-primary font-bold">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="font-normal opacity-60">Reserved (Verified)</span>
                                                <span className="font-mono text-primary font-bold">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded">
                                                <span className="text-muted-foreground tracking-tight font-normal">Net Registry Balance</span>
                                                <span className="font-bold font-mono">₹{fundingData.totalZakatBalance.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded italic opacity-60">
                                                <span>Contribution to Goal</span>
                                                <span className="font-mono">₹{fundingData.zakatAvailableForGoal.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2 font-normal">
                            {isVisible('donations_by_category') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-[10px] tracking-tight uppercase opacity-60">Donations By Category</CardTitle></CardHeader>
                                    <CardContent className="pt-6">
                                        {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartDataValues} layout="vertical" margin={{ right: 20 }}>
                                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'hsl(var(--primary))' }} width={100}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} hide /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4} className="transition-all duration-1000 ease-out">{chartDataValues.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}</Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full"/>}
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('donations_by_payment_type') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold text-primary text-[10px] tracking-tight uppercase opacity-60">Donations By Payment Type</CardTitle></CardHeader>
                                    <CardContent className="pt-6">
                                        {isClient ? (
                                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <ChartTooltip 
                                                            content={
                                                                <ChartTooltipContent 
                                                                    nameKey="name" 
                                                                    formatter={(value, name, item) => (
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold">Total: ₹{Number(value).toLocaleString()}</span>
                                                                            <span className="text-[10px] opacity-70">{(item as any).payload.count} Donations</span>
                                                                        </div>
                                                                    )}
                                                                />
                                                            } 
                                                        />
                                                        <Pie data={paymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5} className="transition-all duration-1000 ease-out focus:outline-none">
                                                            {paymentTypeChartData.map((entry) => (<Cell key={`cell-pay-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />))}
                                                        </Pie>
                                                        <ChartLegend content={<ChartLegendContent />} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full"/>}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {isVisible('documents') && publicDocuments.length > 0 && (
                    <Card className="animate-fade-in-up bg-white border-primary/10 shadow-sm overflow-hidden" style={{ animationDelay: '100ms' }}>
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-[10px] tracking-tight uppercase opacity-60">Public Artifacts</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {publicDocuments.map((doc) => {
                                    const isImg = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                    return (
                                        <Card key={doc.url} className="overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col hover:-translate-y-1 bg-white border-primary/10 cursor-pointer shadow-sm group" onClick={() => isImg ? handleViewImage(doc.url, doc.name) : window.open(doc.url, '_blank')}>
                                            <div className="block h-full">
                                                <div className="relative aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
                                                    {isImg ? <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="100vw" className="object-cover transition-transform duration-500 group-hover:scale-110" /> : <File className="w-10 h-10 text-muted-foreground transition-transform duration-500 group-hover:scale-110" />}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                                </div>
                                                <div className="p-2 text-center text-primary font-bold">
                                                    <p className="text-[10px] font-bold truncate group-hover:underline">{doc.name}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[24px] border-primary/10 shadow-2xl">
                    <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="font-bold text-primary tracking-tight text-sm">{imageToView?.name}</DialogTitle></DialogHeader>
                    <div className="p-4 bg-secondary/20 flex-1 overflow-hidden relative min-h-[70vh]">
                        {imageToView && (
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Viewer" fill sizes="100vw" className="object-contain transition-transform duration-200 ease-out origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        )}
                    </div>
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
