'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
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
} from 'recharts';

import type { Lead, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Share2, Hourglass, Users, Gift, Target, HandHelping, File, CheckCircle2, XCircle, GraduationCap, HeartPulse, LifeBuoy, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories } from '@/lib/modules';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BrandedLoader } from '@/components/branded-loader';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

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
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading, error: leadError } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    
    const isLoading = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isBrandingLoading || isPaymentLoading;

    const fundingData = useMemo(() => {
        if (!allDonations || !lead || !beneficiaries) return null;

        const donations = allDonations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id && link.linkType === 'lead'));
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        let zakatForGoalAmount = 0;

        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id);
            if (!leadAllocation) return;
            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;
            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * allocationProportion;
                    amountsByCategory[category as DonationCategory] += allocatedAmount;

                    const isForFundraising = category !== 'Zakat' || split.forFundraising !== false;
                    if (category === 'Zakat' && isForFundraising) {
                        zakatForGoalAmount += allocatedAmount;
                    }
                }
            });
        });
        
        const zakatAllocated = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation)
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        
        const zakatGiven = beneficiaries
            .filter(b => b.isEligibleForZakat && b.zakatAllocation && b.status === 'Given')
            .reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        
        const zakatPending = zakatAllocated - zakatGiven;
        const zakatAvailableForGoal = Math.max(0, zakatForGoalAmount - zakatAllocated);
        
        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => lead.allowedDonationTypes?.includes(category as DonationCategory))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatAvailableForGoal;
                return sum + amount;
            }, 0);

        const fundingGoal = lead.targetAmount || 0;
        const fundingProgress = fundingGoal > 0 ? (totalCollectedForGoal / fundingGoal) * 100 : 0;
        
        const beneficiariesGiven = beneficiaries.filter(b => b.status === 'Given').length;
        const beneficiariesPending = beneficiaries.length - beneficiariesGiven;

        return {
            totalCollectedForGoal,
            fundingProgress,
            targetAmount: fundingGoal,
            remainingToCollect: Math.max(0, fundingGoal - totalCollectedForGoal),
            amountsByCategory,
            zakatAllocated,
            zakatGiven,
            zakatPending,
            zakatAvailableForGoal,
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven,
            beneficiariesPending,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, lead, beneficiaries]);

    const handleShare = async () => {
        if (!lead || !fundingData) return;
        const shareText = `Join us for the *${lead.name}* initiative. Goal: ₹${fundingData.targetAmount.toLocaleString('en-IN')}. Collected: ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}.`;
        setShareDialogData({ title: `Lead Summary: ${lead.name}`, text: shareText, url: window.location.href });
        setIsShareDialogOpen(true);
    };

    if (isLoading) return <BrandedLoader />;

    if (!lead || lead.publicVisibility !== 'Published') {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <p className="text-lg text-muted-foreground">This lead is not available for public view.</p>
                <Button asChild className="mt-4 active:scale-95 transition-transform"><Link href="/leads-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Public Leads</Link></Button>
            </main>
        );
    }
    
    const publicDocuments = lead.documents?.filter(d => d.isPublic) || [];
    const FallbackIcon = lead.purpose === 'Education' ? GraduationCap : 
                         lead.purpose === 'Medical' ? HeartPulse : 
                         lead.purpose === 'Relief' ? LifeBuoy : 
                         lead.purpose === 'Other' ? Info : HandHelping;

    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4"><Button variant="outline" asChild className="active:scale-95 transition-transform"><Link href="/leads-public"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads</Link></Button></div>
            
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                {lead.imageUrl ? (
                    <Image src={`/api/image-proxy?url=${encodeURIComponent(lead.imageUrl)}`} alt={lead.name} fill sizes="100vw" className="object-cover" priority />
                ) : ( <FallbackIcon className="w-24 h-24 text-muted-foreground/30" /> )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6"><h1 className="text-3xl lg:text-4xl font-bold text-white shadow-lg">{lead.name}</h1><p className="text-sm text-white/90 shadow-md">{lead.status}</p></div>
            </div>

            <div className="flex justify-end items-center mb-4 flex-wrap gap-2">
                <Button onClick={handleShare} variant="outline" className="active:scale-95 transition-transform"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-zoom shadow-md border-primary/10">
                    <CardHeader className="bg-primary/5"><CardTitle>Lead Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground uppercase text-xs font-bold">Description</Label>
                            <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">{lead.description || 'No description provided.'}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Required Amount</p><p className="mt-1 text-lg font-semibold">₹{(lead.requiredAmount ?? 0).toLocaleString('en-IN')}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Fundraising Goal</p><p className="mt-1 text-lg font-semibold">₹{(lead.targetAmount ?? 0).toLocaleString('en-IN')}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Category</p><p className="mt-1 text-lg font-semibold">{lead.category}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Start Date</p><p className="mt-1 text-lg font-semibold">{lead.startDate}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {publicDocuments.length > 0 && (
                    <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <CardHeader><CardTitle>Public Artifacts</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {publicDocuments.map((doc) => {
                                    const isImage = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
                                    return (
                                        <Card key={doc.url} className="overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col hover:-translate-y-1">
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="group block h-full">
                                                <div className="relative aspect-square w-full bg-muted flex items-center justify-center">
                                                    {isImage ? (
                                                        <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="100vw" className="object-cover" />
                                                    ) : (
                                                        <File className="w-10 h-10 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="p-2 text-center">
                                                    <p className="text-[10px] font-medium truncate group-hover:underline">{doc.name}</p>
                                                </div>
                                            </a>
                                        </Card>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {fundingData && (
                    <Card className="animate-fade-in-up shadow-sm border-primary/5" style={{ animationDelay: '200ms' }}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Fundraising Progress</CardTitle>
                            <CardDescription>A real-time look at collected donations against the goal.</CardDescription>
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
                                    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-xs text-muted-foreground">Funded</span></div>
                                </div>
                                <div className="space-y-4 text-center md:text-left">
                                    <div><p className="text-sm text-muted-foreground">Raised for Goal</p><p className="text-3xl font-bold">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Fundraising Target</p><p className="text-3xl font-bold">₹{(fundingData.targetAmount || 0).toLocaleString('en-IN')}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Grand Total Received</p><p className="text-3xl font-bold">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</p></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 sm:grid-cols-3">
                    <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{fundingData?.totalBeneficiaries ?? 0}</div></CardContent></Card>
                    <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Assistance Provided</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{fundingData?.beneficiariesGiven ?? 0}</div></CardContent></Card>
                    <Card className="animate-fade-in-up" style={{ animationDelay: '500ms' }}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{fundingData?.beneficiariesPending ?? 0}</div></CardContent></Card>
                </div>

                {fundingData && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="animate-fade-in-up shadow-sm border-primary/5" style={{ animationDelay: '600ms' }}>
                            <CardHeader>
                                <CardTitle>Zakat Utilization</CardTitle>
                                <CardDescription>Tracking of Zakat funds collected and allocated within this initiative.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                               <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Zakat Collected</span><span className="font-semibold font-mono">₹{fundingData.amountsByCategory.Zakat.toLocaleString('en-IN')}</span></div>
                                <Separator />
                                <div className="pl-4 border-l-2 border-dashed space-y-2 py-2">
                                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Allocated as Cash-in-Hand</span><span className="font-semibold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span></div>
                                    <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground">Given</span><span className="font-mono text-green-600">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span></div>
                                     <div className="flex justify-between items-center text-xs pl-4"><span className="text-muted-foreground">Pending</span><span className="font-mono text-amber-600">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span></div>
                                </div>
                                <Separator />
                                <div className="flex justify-between items-center text-base"><span className="font-bold">Zakat Balance for Goal</span><span className="font-bold text-primary font-mono">₹{fundingData.zakatAvailableForGoal.toLocaleString('en-IN')}</span></div>
                            </CardContent>
                        </Card>

                        <Card className="animate-fade-in-up shadow-sm border-primary/5" style={{ animationDelay: '700ms' }}>
                            <CardHeader><CardTitle>Donations by Category</CardTitle></CardHeader>
                            <CardContent>
                                {isClient ? (
                                  <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                      <BarChart data={Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ right: 20 }}>
                                          <CartesianGrid horizontal={false} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 12 }} width={120}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4}>{Object.entries(fundingData.amountsByCategory).map(([name]) => (<Cell key={name} fill={`var(--color-${name.replace(/\s+/g, '')})`} />))}</Bar>
                                      </BarChart>
                                  </ChartContainer>
                                ) : <Skeleton className="h-[250px] w-full" />}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />
        </main>
    );
}