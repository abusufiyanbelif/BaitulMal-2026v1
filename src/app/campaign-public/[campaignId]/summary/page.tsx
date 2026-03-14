'use client';

import React, { useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, doc, useCollection, query, collection, where } from '@/firebase';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useDownloadAs } from '@/hooks/use-download-as';
import { usePageHit } from '@/hooks/use-page-hit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, Share2, Info, Users, HeartHandshake, IndianRupee, ArrowLeft, Loader2 } from 'lucide-react';
import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import Image from 'next/image';

export default function PublicCampaignSummaryPage() {
  const { campaignId } = useParams() as { campaignId: string };
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const { download } = useDownloadAs();
  const { brandingSettings } = useBranding();
  const { paymentSettings } = usePaymentSettings();
  const firestore = useFirestore();

  usePageHit(`campaign-summary-${campaignId}`);

  // Fetch Campaign Data
  const campaignRef = useMemo(() => (firestore ? doc(firestore, 'campaigns', campaignId) : null), [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignRef as any);

  // Fetch Verified Donations for this Campaign
  const donationsQuery = useMemo(() => {
    if (!firestore || !campaignId) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore, campaignId]);
  const { data: allDonations, isLoading: isDonationsLoading } = useCollection<Donation>(donationsQuery);

  // Fetch Public Beneficiaries for this Campaign
  const beneficiariesRef = useMemo(() => {
    if (!firestore || !campaignId) return null;
    return collection(firestore, 'campaigns', campaignId, 'beneficiaries');
  }, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: isBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

  // Financial Calculations
  const stats = useMemo(() => {
    if (!campaign || !allDonations) return { raised: 0, progress: 0, byCategory: [] };

    const raised = allDonations.reduce((total, donation) => {
      // Find contribution to this specific campaign
      const linkContribution = donation.linkSplit?.find(l => l.linkId === campaignId)?.amount || 0;
      
      // If legacy or single link
      const legacyContribution = (donation as any).campaignId === campaignId ? donation.amount : 0;
      
      return total + (linkContribution || legacyContribution);
    }, 0);

    const progress = campaign.targetAmount ? Math.min((raised / campaign.targetAmount) * 100, 100) : 0;

    const amountsByCategory = allDonations.reduce((acc, d) => {
      const linkAmount = d.linkSplit?.find(l => l.linkId === campaignId)?.amount || ((d as any).campaignId === campaignId ? d.amount : 0);
      if (linkAmount <= 0) return acc;

      const splits = d.typeSplit || (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
      const totalDonationAmount = d.amount || 1;
      const proportion = linkAmount / totalDonationAmount;

      splits.forEach(split => {
        const cat = split.category;
        acc[cat] = (acc[cat] || 0) + (split.amount * proportion);
      });
      return acc;
    }, {} as Record<string, number>);

    const byCategory = Object.entries(amountsByCategory).map(([name, value]) => ({
      name,
      value,
      fill: `var(--chart-${(donationCategories.indexOf(name as any) % 5) + 1})`
    }));

    return { raised, progress, byCategory };
  }, [campaign, allDonations, campaignId]);

  const beneficiarySummary = useMemo(() => {
    if (!beneficiaries) return [];
    const groups: Record<string, { count: number; amount: number }> = {};
    beneficiaries.forEach(b => {
      const cat = b.itemCategoryName || 'General';
      if (!groups[cat]) groups[cat] = { count: 0, amount: 0 };
      groups[cat].count++;
      groups[cat].amount += b.kitAmount || 0;
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data }));
  }, [beneficiaries]);

  if (isCampaignLoading) {
    return (
      <div className="container py-10 space-y-8 animate-pulse">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!campaign || campaign.publicVisibility !== 'Published') {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Initiative Not Found</h1>
        <p className="text-muted-foreground mb-8">This campaign is either private or does not exist.</p>
        <Button onClick={() => router.push('/campaign-public')}>View All Campaigns</Button>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download('png', { 
            contentRef, 
            documentTitle: `${campaign.name} Summary`, 
            documentName: `Summary_${campaignId}`,
            brandingSettings,
            paymentSettings
          })}>
            <Download className="mr-2 h-4 w-4" /> Save PNG
          </Button>
          <Button size="sm" onClick={() => router.push('/donations/summary')}>
            <HeartHandshake className="mr-2 h-4 w-4" /> Contribute Now
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="space-y-8 bg-background p-4 md:p-8 rounded-2xl border shadow-sm">
        {/* Header Section */}
        <div className="relative h-48 md:h-80 w-full rounded-2xl overflow-hidden group">
          <Image 
            src={campaign.imageUrl || `https://picsum.photos/seed/${campaignId}/1200/400`}
            alt={campaign.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            data-ai-hint="campaign background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 md:p-10">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="bg-primary text-primary-foreground border-none">Campaign #{campaign.campaignNumber}</Badge>
              <Badge variant="outline" className="bg-white/10 text-white backdrop-blur-md border-white/20">
                {campaign.status}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{campaign.name}</h1>
            <p className="text-white/80 max-w-3xl line-clamp-2">{campaign.description}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Raised Amount</span>
              </div>
              <div className="text-2xl font-bold">₹{stats.raised.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground mt-1">Goal: ₹{campaign.targetAmount?.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-success/20 rounded-lg text-success">
                  <HeartHandshake className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Impact Progress</span>
              </div>
              <div className="text-2xl font-bold">{Math.round(stats.progress)}%</div>
              <Progress value={stats.progress} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-info/5 border-info/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-info/20 rounded-lg text-info">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Target Households</span>
              </div>
              <div className="text-2xl font-bold">{beneficiaries?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Verified Beneficiaries</p>
            </CardContent>
          </Card>

          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-warning/20 rounded-lg text-warning">
                  <Info className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Initiative Status</span>
              </div>
              <div className="text-2xl font-bold">{campaign.status}</div>
              <p className="text-xs text-muted-foreground mt-1">Updated recently</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <Tabs defaultValue="funding" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="funding">Funding Analysis</TabsTrigger>
            <TabsTrigger value="beneficiaries">Impact Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="funding" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Designation Distribution</CardTitle>
                  <CardDescription>Visualizing how funds are categorized</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.byCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Designation Summary</CardTitle>
                  <CardDescription>Breakdown of funds by religious and social categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Allocated Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.byCategory.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">₹{item.value.toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="beneficiaries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Target Group Distribution</CardTitle>
                <CardDescription>Detailed allocation across different beneficiary tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="min-w-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Beneficiary Group</TableHead>
                          <TableHead className="text-center">Member Households</TableHead>
                          <TableHead className="text-right">Allocated Inventory Cost</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {beneficiarySummary.length > 0 ? (
                          beneficiarySummary.map((group) => (
                            <TableRow key={group.name}>
                              <TableCell className="font-medium">{group.name}</TableCell>
                              <TableCell className="text-center">{group.count}</TableCell>
                              <TableCell className="text-right font-semibold">₹{group.amount.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-success border-success/20 bg-success/5">Ready</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              No beneficiary groups linked to this initiative yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
