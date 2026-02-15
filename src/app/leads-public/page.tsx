

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lightbulb } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Lead, Donation, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, query, where } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import { leadPurposesConfig } from '@/lib/modules';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';

const LeadGrid = ({ leads }: { leads: (Lead & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    if (leads.length === 0) {
        return <p className="text-muted-foreground">No leads in this category.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map(lead => (
                <Card key={lead.id} className="flex flex-col hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 cursor-pointer overflow-hidden" onClick={() => router.push(`/leads-public/${lead.id}/summary`)}>
                    <div className="relative h-40 w-full bg-secondary flex items-center justify-center">
                        {lead.imageUrl ? (
                            <Image
                              src={lead.imageUrl}
                              alt={lead.name}
                              fill
                              sizes="100vw"
                              className="object-cover"
                              data-ai-hint="lead background"
                            />
                        ) : (
                            <Lightbulb className="h-16 w-16 text-muted-foreground" />
                        )}
                    </div>
                    <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                            <CardTitle>{lead.name}</CardTitle>
                            <Badge variant={
                                lead.status === 'Active' ? 'success' :
                                lead.status === 'Completed' ? 'secondary' : 'outline'
                            }>{lead.status}</Badge>
                        </div>
                        <CardDescription>{lead.startDate} to {lead.endDate}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-3 flex-grow">{lead.description || "No description provided."}</p>
                        
                        {lead.allowedDonationTypes && lead.allowedDonationTypes.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <h4 className="text-xs font-semibold text-muted-foreground">Accepting</h4>
                                <div className="flex flex-wrap gap-1">
                                    {lead.allowedDonationTypes.map(type => (
                                        <Badge key={type} variant="secondary">{type}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                         <div className="flex justify-between text-sm text-muted-foreground pt-2">
                            <Badge variant="outline">{lead.authenticityStatus}</Badge>
                            <Badge variant="outline">{lead.publicVisibility}</Badge>
                        </div>
                        {lead.targetAmount && lead.targetAmount > 0 && (
                          <div className="space-y-2 pt-2">
                              <Progress value={lead.progress} />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>₹{lead.collected.toLocaleString('en-IN')} raised</span>
                                  <span>Goal: ₹{lead.targetAmount.toLocaleString('en-IN')}</span>
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
    );
};


export default function PublicLeadPage() {
  const firestore = useFirestore();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'leads'),
        where('authenticityStatus', '==', 'Verified'),
        where('publicVisibility', '==', 'Published')
    );
  }, [firestore]);

  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  
  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);
  
  const leadData = useMemo(() => {
    if (!leads || !donations) return [];
    const leadsById = new Map(leads.map(l => [l.id, l]));

    return leads.map(lead => {
        const relevantDonations = donations.filter(d => d.linkSplit?.some(link => link.linkId === lead.id));
        const collected = relevantDonations.reduce((sum, donation) => {
            const leadLink = donation.linkSplit?.find(l => l.linkId === lead.id);
            if (!leadLink) return sum;

            const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
            const proportionForThisLead = leadLink.amount / totalDonationAmount;

            const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
                ? donation.typeSplit
                : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);

            const totalApplicableAmountInDonation = typeSplits.reduce((acc, split) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (lead.allowedDonationTypes?.includes(category as DonationCategory)) {
                    return acc + split.amount;
                }
                return acc;
            }, 0);
            
            return sum + (totalApplicableAmountInDonation * proportionForThisLead);
        }, 0);

        const progress = lead.targetAmount && lead.targetAmount > 0 ? (collected / lead.targetAmount) * 100 : 0;
        
        return {
            ...lead,
            collected,
            progress
        };
    });
  }, [leads, donations]);
  
  const filteredLeads = useMemo(() => {
    if (!leadData) return [];
    return leadData.filter(l => 
        (statusFilter === 'All' || l.status === statusFilter) &&
        (purposeFilter === 'All' || l.purpose === purposeFilter) &&
        (l.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leadData, searchTerm, statusFilter, purposeFilter]);
  
  const activeLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Active').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  const upcomingLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Upcoming').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  const completedLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Completed').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  
  const isLoading = areLeadsLoading || areDonationsLoading;

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
          <h1 className="text-4xl font-bold">Our Initiatives</h1>
          <p className="text-muted-foreground text-lg">Browse our verified and published leads for community support.</p>
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
             <Select value={purposeFilter} onValueChange={setPurposeFilter} disabled={isLoading}>
                <SelectTrigger className="w-auto md:w-[180px]">
                    <SelectValue placeholder="Filter by purpose" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="All">All Purposes</SelectItem>
                    {leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-8">
            <Skeleton className="h-8 w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
             <Skeleton className="h-8 w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
      )}
      
      {!isLoading && filteredLeads.length > 0 && (
          <div className="space-y-8">
            {(statusFilter === 'All' || statusFilter === 'Active') && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Active Leads ({activeLeads.length})</h2>
                    <LeadGrid leads={activeLeads} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Upcoming') && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Upcoming Leads ({upcomingLeads.length})</h2>
                    <LeadGrid leads={upcomingLeads} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Completed') && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Completed Leads ({completedLeads.length})</h2>
                    <LeadGrid leads={completedLeads} />
                </section>
            )}
          </div>
      )}
    
     {!isLoading && filteredLeads.length === 0 && (
        <div className="text-center py-16">
            <p className="text-muted-foreground">No public leads found matching your criteria.</p>
        </div>
    )}
    </main>
  );
}
