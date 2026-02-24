

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderKanban, HandHelping } from 'lucide-react';
import type { Campaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { usePublicData } from '@/hooks/use-public-data';
import Link from 'next/link';

const CampaignGrid = ({ campaigns }: { campaigns: (Campaign & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    if (campaigns.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">No campaigns found matching your criteria.</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign, index) => (
                <Card 
                    key={campaign.id} 
                    className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden" 
                    style={{ animationDelay: `${100 + index * 50}ms`, animationFillMode: 'backwards' }}
                    onClick={() => router.push(`/campaign-public/${campaign.id}/summary`)}
                >
                    <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
                        {campaign.imageUrl ? (
                            <Image
                              src={campaign.imageUrl}
                              alt={campaign.name}
                              fill
                              sizes="100vw"
                              className="object-cover"
                              data-ai-hint="campaign background"
                            />
                        ) : (
                            <HandHelping className="h-16 w-16 text-muted-foreground" />
                        )}
                    </div>
                    <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                            <CardTitle className="w-full break-words text-base">
                                {campaign.campaignNumber && <span className="text-primary font-bold">#{campaign.campaignNumber} </span>}{campaign.name}
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs">{campaign.startDate} to {campaign.endDate}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <Badge variant="outline">{campaign.category}</Badge>
                            <Badge variant={
                                campaign.status === 'Active' ? 'success' :
                                campaign.status === 'Completed' ? 'secondary' : 'outline'
                            }>{campaign.status}</Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <Badge variant="outline">{campaign.authenticityStatus || 'N/A'}</Badge>
                            <Badge variant="outline">{campaign.publicVisibility || 'N/A'}</Badge>
                        </div>
                        {(campaign.targetAmount || 0) > 0 && (
                            <div className="space-y-1 pt-1">
                                <Progress value={campaign.progress} className="h-2" />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>₹{campaign.collected.toLocaleString('en-IN')} raised</span>
                                    <span>Goal: ₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="p-2">
                        <Button asChild className="w-full" size="sm">
                            <Link href={`/campaign-public/${campaign.id}/summary`}>
                                View Details
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
};

export function PublicCampaignsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const { isLoading, campaignsWithProgress } = usePublicData();

  const filteredCampaigns = useMemo(() => {
    if (!campaignsWithProgress) return [];
    return campaignsWithProgress.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (categoryFilter === 'All' || c.category === categoryFilter) &&
        (c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [campaignsWithProgress, searchTerm, statusFilter, categoryFilter]);

  const activeCampaigns = useMemo(() => filteredCampaigns.filter(c => c.status === 'Active').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredCampaigns]);
  const upcomingCampaigns = useMemo(() => filteredCampaigns.filter(c => c.status === 'Upcoming').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredCampaigns]);
  const completedCampaigns = useMemo(() => filteredCampaigns.filter(c => c.status === 'Completed').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredCampaigns]);


  return (
    <div className="space-y-8">
       <div className="space-y-4">
          <h1 className="text-4xl font-bold">Public Campaigns</h1>
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
      
      {!isLoading && (
          <div className="space-y-8">
            {(statusFilter === 'All' || statusFilter === 'Active') && activeCampaigns.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Active Campaigns ({activeCampaigns.length})</h2>
                    <CampaignGrid campaigns={activeCampaigns} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Upcoming') && upcomingCampaigns.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Upcoming Campaigns ({upcomingCampaigns.length})</h2>
                    <CampaignGrid campaigns={upcomingCampaigns} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Completed') && completedCampaigns.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Completed Campaigns ({completedCampaigns.length})</h2>
                    <CampaignGrid campaigns={completedCampaigns} />
                </section>
            )}
            {filteredCampaigns.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No campaigns found matching your criteria.</p>
                </div>
            )}
          </div>
      )}
    </div>
  );
}
