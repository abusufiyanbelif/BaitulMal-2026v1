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
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie
} from 'recharts';

import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    ArrowLeft, 
    Loader2, 
    Share2, 
    Hourglass, 
    Users, 
    Gift, 
    Target, 
    HandHelping, 
    File, 
    Utensils, 
    LifeBuoy,
    TrendingUp,
    PieChart as PieChartIcon,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    ImageIcon
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const visibilityRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_visibility') : null, [firestore]);
    const { data: visibilitySettings } = useDoc<any>(visibilityRef);

    const isLoading = isCampaignLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;

    const isRationInitiative = useMemo(() => {
        return campaign?.category === 'Ration';
    }, [campaign]);

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
        const amountsByPaymentType: Record<string, number> = {};
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
            amountsByPaymentType[paymentType] = (amountsByPaymentType[paymentType] || 0) + 1;

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

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => campaign.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatAvailableForGoal;
                return sum + amount;
            }, 0);

        return { 
            totalCollectedForGoal, 
            fundingProgress: (campaign.targetAmount || 0) > 0 ? (totalCollectedForGoal / campaign.targetAmount!) * 100 : 0, 
            targetAmount: campaign.targetAmount || 0, 
            totalBeneficiaries: beneficiaries.length, 
            beneficiariesGiven: beneficiaries.filter(b => b.status === 'Given').length, 
            beneficiariesPending: beneficiaries.length - beneficiaries.filter(b => b.status === 'Given').length, 
            zakatAllocated, zakatGiven, zakatPending, zakatAvailableForGoal, amountsByCategory, amountsByPaymentType,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, campaign, beneficiaries]);

    const paymentTypeChartData = useMemo(() => {
        if (!fundingData?.amountsByPaymentType) return [];
        return Object.entries(fundingData.amountsByPaymentType).map(([name, value]) => ({
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));
    }, [fundingData]);

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

    if (isLoading) return <BrandedLoader />;

    if (!campaign || campaign.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center text-primary font-bold">
                <p className="text-lg text-primary/70 font-normal">This Campaign Is Not Publicly Available.</p>
                <Button asChild className="mt-4 active:scale-95 transition-transform font-bold"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button>
            </main>
        );
    }
    
    const publicDocuments = campaign.documents?.filter(d => d.isPublic) || [];
    const FallbackIcon = campaign.category === 'Ration' ? Utensils : campaign.category === 'Relief' ? LifeBuoy : HandHelping;
    const chartData = fundingData?.amountsByCategory ? Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ name, value })) : [];

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal">
             <div className="mb-4"><Button variant="outline" asChild className="active:scale-95 transition-transform font-bold border-primary/20"><Link href="/campaign-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center cursor-pointer" onClick={() => campaign.imageUrl && handleViewImage(campaign.imageUrl, campaign.name)}>
                {campaign.imageUrl ? (
                    <Image src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`} alt={campaign.name} fill sizes="100vw" className="object-cover" priority />
                ) : ( <FallbackIcon className="w-24 h-24 text-muted-foreground/30" /> )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6"><h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{campaign.name}</h1><p className="text-sm text-white/90 shadow-md font-bold uppercase">{campaign.status}</p></div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                <Button onClick={handleShare} variant="outline" className="active:scale-95 transition-transform font-bold"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-zoom shadow-md border-primary/10 bg-white">
                    <CardHeader className="bg-primary/5"><CardTitle className="font-bold text-primary">Campaign Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4 pt-6 text-foreground">
                        <div className="space-y-2 text-primary">
                            <Label className="text-muted-foreground uppercase text-xs font-bold">Description</Label>
                            <p className="mt-1 text-sm font-normal whitespace-pre-wrap leading-relaxed">{campaign.description || 'No description provided.'}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-primary">
                            <div className="space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Fundraising Goal</p><p className="mt-1 text-lg font-bold text-primary">₹{(campaign.targetAmount ?? 0).toLocaleString('en-IN')}</p></div>
                            <div className="space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Category</p><p className="mt-1 text-lg font-bold text-primary">{campaign.category}</p></div>
                             <div className="space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Start Date</p><p className="mt-1 text-lg font-bold text-primary">{campaign.startDate}</p></div>
                            <div className="space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">End Date</p><p className="mt-1 text-lg font-bold text-primary">{campaign.endDate}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {fundingData && (
                    <div className="grid gap-6 animate-fade-in-up">
                        {isVisible('funding_progress') && (
                            <Card className="shadow-sm border-primary/5 bg-white">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-bold text-primary"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle>
                                    <CardDescription className="font-normal">Verified donations for this campaign.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        <div className="relative h-48 w-full">
                                            {isClient ? (
                                                <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                                    <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                                        <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} />
                                                    </RadialBarChart>
                                                </ChartContainer>
                                            ) : <Skeleton className="w-full h-full rounded-full" />}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-[10px] text-muted-foreground font-bold uppercase">Funded</span></div>
                                        </div>
                                        <div className="space-y-4 text-center md:text-left text-primary font-bold">
                                            <div><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Raised For Goal</p><p className="text-3xl font-bold text-primary">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Target Goal</p><p className="text-3xl font-bold text-primary opacity-60">₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                            <div><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Grand Total Received</p><p className="text-3xl font-bold text-primary">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isVisible('quick_stats') && (
                            <div className="grid gap-6 sm:grid-cols-3">
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.totalBeneficiaries ?? 0}</div></CardContent></Card>
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Kits Provided</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.beneficiariesGiven ?? 0}</div></CardContent></Card>
                                <Card className="bg-white"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Pending Kits</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fundingData?.beneficiariesPending ?? 0}</div></CardContent></Card>
                            </div>
                        )}

                        {isVisible('beneficiary_groups') && (
                            <Card className="shadow-sm border-primary/5 bg-white">
                                <CardHeader>
                                    <CardTitle className="font-bold text-primary">
                                        {isRationInitiative ? 'Beneficiary Groups' : 'Breakdown Of Requirements'}
                                    </CardTitle>
                                    <CardDescription className="font-normal">
                                        {isRationInitiative 
                                            ? 'Breakdown of requirements by family size category.' 
                                            : 'Itemized requirement breakdown for this initiative.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="w-full">
                                        <div className="border rounded-lg overflow-hidden font-normal text-foreground">
                                            {isRationInitiative ? (
                                                <Table>
                                                    <TableHeader className="bg-primary/5">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-primary text-[10px] uppercase">Category Name</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Beneficiaries</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Kit Amount</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Total Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {beneficiaryGroups.map((group) => (
                                                            <TableRow key={group.id} className="hover:bg-primary/5 transition-colors">
                                                                <TableCell className="font-bold text-primary">{group.name}</TableCell>
                                                                <TableCell className="text-right font-normal">{group.count}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold">₹{group.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    {beneficiaryGroups.length > 0 && (
                                                        <tfoot className="bg-primary/5 border-t">
                                                            <TableRow><TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-xs">Total Requirement</TableCell><TableCell className="text-right font-mono font-bold text-primary text-lg">₹{beneficiaryGroups.reduce((sum, g) => sum + g.totalAmount, 0).toLocaleString('en-IN')}</TableCell></TableRow>
                                                        </tfoot>
                                                    )}
                                                </Table>
                                            ) : (
                                                <Table>
                                                    <TableHeader className="bg-primary/5">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-primary text-[10px] uppercase">Requirement Description</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Quantity</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Unit Price</TableHead>
                                                            <TableHead className="text-right font-bold text-primary text-[10px] uppercase">Total Price</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {campaign.itemCategories?.[0]?.items.map((item, idx) => (
                                                            <TableRow key={idx} className="hover:bg-primary/5 transition-colors">
                                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                                <TableCell className="text-right">{item.quantity} {item.quantityType}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold">₹{(item.price / (item.quantity || 1)).toLocaleString('en-IN')}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold">₹{(item.price || 0).toLocaleString('en-IN')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                    <tfoot className="bg-primary/5 border-t">
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="text-right font-bold text-primary uppercase text-xs">Single Unit Total</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-primary text-lg">
                                                                ₹{(campaign.itemCategories?.[0]?.items.reduce((sum, i) => sum + i.price, 0) || 0).toLocaleString('en-IN')}
                                                            </TableCell>
                                                        </TableRow>
                                                    </tfoot>
                                                </Table>
                                            )}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-6 lg:grid-cols-2">
                            {isVisible('fund_totals') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Fund Totals By Type</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        {donationCategories.map(cat => (
                                            <div key={cat} className="flex justify-between items-center text-sm font-bold text-primary">
                                                <span className="text-muted-foreground font-normal">{cat === 'Interest' ? 'Interest (For Disposal)' : cat === 'Loan' ? 'Loan (Qard-e-Hasana)' : cat}</span>
                                                <span className="font-mono">₹{(fundingData.amountsByCategory[cat] || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <Separator className="my-2" />
                                        <div className="flex justify-between items-center text-lg font-bold text-primary"><span>Grand Total Received</span><span className="font-mono">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('zakat_utilization') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Zakat Utilization</CardTitle><CardDescription className="font-normal">Tracking of Zakat funds collected across all initiatives.</CardDescription></CardHeader>
                                    <CardContent className="space-y-3 font-bold text-primary">
                                    <div className="flex justify-between items-center text-sm font-bold text-primary"><span className="text-muted-foreground font-normal uppercase tracking-tight">Total Zakat Collected</span><span className="font-bold font-mono">₹{(fundingData.amountsByCategory.Zakat || 0).toLocaleString('en-IN')}</span></div>
                                        <Separator />
                                        <div className="pl-4 border-l-2 border-dashed space-y-2 py-2">
                                            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground font-normal uppercase tracking-tight">Allocated As Cash-In-Hand</span><span className="font-bold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground font-normal uppercase tracking-tight">Given</span><span className="font-mono text-green-600 font-bold">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground font-normal uppercase tracking-tight">Pending</span><span className="font-mono text-amber-600 font-bold">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span></div>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between items-center text-base font-bold text-primary"><span>Zakat Balance For Goal</span><span className="text-primary font-mono font-bold">₹{fundingData.zakatAvailableForGoal.toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            {isVisible('donations_by_category') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Donations By Category</CardTitle></CardHeader>
                                    <CardContent>
                                        {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                            <BarChart data={chartData} layout="vertical" margin={{ right: 20 }}>
                                                <CartesianGrid horizontal={false} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={100}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4}>{chartData.map((entry) => (<Cell key={entry.name} fill={`var(--color-${entry.name.replace(/\s+/g, '')})`} />))}</Bar>
                                            </BarChart>
                                        </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full" />}
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('donations_by_payment_type') && (
                                <Card className="shadow-sm border-primary/5 bg-white">
                                    <CardHeader><CardTitle className="flex items-center gap-2 font-bold text-primary text-sm uppercase tracking-wider"><PieChartIcon className="h-5 w-5"/> Donations By Payment Type</CardTitle></CardHeader>
                                    <CardContent>
                                        {isClient ? (
                                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                                <PieChart>
                                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                    <Pie data={paymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80}>
                                                        {paymentTypeChartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} />))}
                                                    </Pie>
                                                    <ChartLegend content={<ChartLegendContent />} />
                                                </PieChart>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full" />}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {isVisible('documents') && publicDocuments.length > 0 && (
                    <Card className="animate-fade-in-up bg-white border-primary/10" style={{ animationDelay: '100ms' }}>
                        <CardHeader><CardTitle className="font-bold text-primary text-sm uppercase tracking-wider">Public Artifacts</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {publicDocuments.map((doc) => {
                                    const isImg = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                    return (
                                        <Card key={doc.url} className="overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col hover:-translate-y-1 bg-white border-primary/10 cursor-pointer shadow-sm" onClick={() => isImg ? handleViewImage(doc.url, doc.name) : window.open(doc.url, '_blank')}>
                                            <div className="group block h-full">
                                                <div className="relative aspect-square w-full bg-muted flex items-center justify-center">
                                                    {isImg ? <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="100vw" className="object-cover" /> : <File className="w-10 h-10 text-muted-foreground" />}
                                                </div>
                                                <div className="p-2 text-center text-primary">
                                                    <p className="text-[10px] font-bold uppercase truncate group-hover:underline">{doc.name}</p>
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
                <DialogContent className="max-w-4xl">
                    <DialogHeader><DialogTitle className="font-bold text-primary">{imageToView?.name}</DialogTitle></DialogHeader>
                    {imageToView && (
                        <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Viewer" fill sizes="100vw" className="object-contain transition-transform duration-200 ease-out origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        </div>
                    )}
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold"><ZoomIn className="mr-2 h-4 w-4"/> Zoom In</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z / 1.2)} className="font-bold"><ZoomOut className="mr-2 h-4 w-4"/> Zoom Out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold"><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold"><RefreshCw className="mr-2 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}