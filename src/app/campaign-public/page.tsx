

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import type { Campaign, Donation, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, query, where } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

export default function PublicCampaignPage() {
  const firestore = useFirestore();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const campaignsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'campaigns'), 
        where('authenticityStatus', '==', 'Verified'),
        where('publicVisibility', '==', 'Published')
    );
  }, [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const donationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignData = useMemo(() => {
    if (!campaigns || !donations) return [];

    return campaigns.map(campaign => {
      const relevantDonations = donations.filter(d => {
        if (d.linkSplit && d.linkSplit.length > 0) {
            return d.linkSplit.some(link => link.linkId === campaign.id);
        }
        return d.campaignId === campaign.id;
      });

      const collected = relevantDonations.reduce((sum, donation) => {
        let amountForThisCampaign = 0;
        if (donation.linkSplit && donation.linkSplit.length > 0) {
            const campaignLink = donation.linkSplit.find(l => l.linkId === campaign.id);
            amountForThisCampaign = campaignLink?.amount || 0;
        } else {
            amountForThisCampaign = donation.amount;
        }
        
        if (amountForThisCampaign === 0) return sum;

        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const proportionForThisCampaign = amountForThisCampaign / totalDonationAmount;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
            ? donation.typeSplit
            : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);
        
        const totalApplicableAmountInDonation = typeSplits.reduce((acc, split) => {
            const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
            if (campaign.allowedDonationTypes?.includes(category)) {
                return acc + split.amount;
            }
            return acc;
        }, 0);

        return sum + (totalApplicableAmountInDonation * proportionForThisCampaign);
      }, 0);

      const progress = campaign.targetAmount && campaign.targetAmount > 0 ? (collected / campaign.targetAmount) * 100 : 0;
      
      return {
        ...campaign,
        collected,
        progress
      };
    });
  }, [campaigns, donations]);


  const filteredCampaigns = useMemo(() => {
    if (!campaignData) return [];
    return campaignData.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (categoryFilter === 'All' || c.category === categoryFilter) &&
        (c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [campaignData, searchTerm, statusFilter, categoryFilter]);
  
  const isLoading = areCampaignsLoading || areDonationsLoading;

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      <div className="space-y-4 mb-8">
          <h1 className="text-4xl font-bold">Our Campaigns</h1>
          <p className="text-muted-foreground text-lg">Browse our ongoing and past initiatives to support the community.</p>
          <div className="flex flex-wrap items-center gap-2 pt-4">
              <Input 
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                  disabled={isLoading}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                  <SelectTrigger className="w-auto md:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                  </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}>
                  <SelectTrigger className="w-auto md:w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="All">All Categories</SelectItem>
                      <SelectItem value="Ration">Ration</SelectItem>
                      <SelectItem value="Relief">Relief</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                  </SelectContent>
              </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      )}
      
      {!isLoading && filteredCampaigns.length > 0 && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map(campaign => (
                  <Card key={campaign.id} className="flex flex-col hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 cursor-pointer" onClick={() => router.push(`/campaign-public/${campaign.id}/summary`)}>
                      <CardHeader>
                          <div className="flex justify-between items-start gap-2">
                              <CardTitle>{campaign.name}</CardTitle>
                              <Badge variant={
                                  campaign.status === 'Active' ? 'success' :
                                  campaign.status === 'Completed' ? 'secondary' : 'outline'
                              }>{campaign.status}</Badge>
                          </div>
                          <CardDescription>{campaign.startDate} to {campaign.endDate}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-grow space-y-4">
                          <p className="text-sm text-muted-foreground line-clamp-3 flex-grow">{campaign.description || "No description provided."}</p>
                           {campaign.targetAmount && campaign.targetAmount > 0 && (
                            <div className="space-y-2 pt-2">
                                <Progress value={campaign.progress} />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>₹{campaign.collected.toLocaleString('en-IN')} raised</span>
                                    <span>Goal: ₹{campaign.targetAmount.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                           )}
                      </CardContent>
                      <CardFooter>
                          <Button className="w-full" tabIndex={-1}>
                              View Details
                          </Button>
                      </CardFooter>
                  </Card>
              ))}
        </div>
      )}
    
     {!isLoading && filteredCampaigns.length === 0 && (
        <div className="text-center py-16">
            <p className="text-muted-foreground">No campaigns found matching your criteria.</p>
        </div>
    )}
    </main>
  );
}
