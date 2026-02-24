

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, HandHelping } from 'lucide-react';
import type { Lead } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { leadPurposesConfig } from '@/lib/modules';
import Image from 'next/image';
import { usePublicData } from '@/hooks/use-public-data';
import Link from 'next/link';

const LeadGrid = ({ leads }: { leads: (Lead & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    if (leads.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">No leads found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map((lead, index) => (
                <Card 
                    key={lead.id} 
                    className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden" 
                    style={{ animationDelay: `${100 + index * 50}ms`, animationFillMode: 'backwards' }}
                    onClick={() => router.push(`/leads-public/${lead.id}/summary`)}
                >
                    <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
                        {lead.imageUrl ? (
                            <Image
                              src={`/api/image-proxy?url=${encodeURIComponent(lead.imageUrl)}`}
                              alt={lead.name}
                              fill
                              sizes="100vw"
                              className="object-cover"
                              data-ai-hint="lead background"
                            />
                        ) : (
                            <HandHelping className="h-16 w-16 text-muted-foreground" />
                        )}
                    </div>
                    <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                            <CardTitle className="w-full break-words text-base">{lead.name}</CardTitle>
                        </div>
                        <CardDescription className="text-xs">{lead.startDate} to {lead.endDate}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <Badge variant="outline">{lead.purpose}</Badge>
                            <Badge variant={
                                lead.status === 'Active' ? 'success' :
                                lead.status === 'Completed' ? 'secondary' : 'outline'
                            }>{lead.status}</Badge>
                        </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <Badge variant="outline">{lead.authenticityStatus || 'N/A'}</Badge>
                            <Badge variant="outline">{lead.publicVisibility || 'N/A'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">{lead.description || "No description provided."}</p>
                          {(lead.targetAmount || 0) > 0 && (
                            <div className="space-y-1 pt-1">
                                <Progress value={lead.progress} className="h-2" />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>₹{lead.collected.toLocaleString('en-IN')} raised</span>
                                    <span>Goal: ₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                     <CardFooter className="p-2">
                        <Button asChild className="w-full" size="sm">
                            <Link href={`/leads-public/${lead.id}/summary`}>
                                View Details
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
};


export function PublicLeadsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');

  const { isLoading, leadsWithProgress } = usePublicData();
  
  const filteredLeads = useMemo(() => {
    if (!leadsWithProgress) return [];
    return leadsWithProgress.filter(l => 
        (statusFilter === 'All' || l.status === statusFilter) &&
        (purposeFilter === 'All' || l.purpose === purposeFilter) &&
        (l.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leadsWithProgress, searchTerm, statusFilter, purposeFilter]);
  
  const activeLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Active').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  const upcomingLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Upcoming').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  const completedLeads = useMemo(() => filteredLeads.filter(c => c.status === 'Completed').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredLeads]);
  
  return (
    <div className="space-y-8">
      <div className="space-y-4">
          <h1 className="text-4xl font-bold">Public Leads & Initiatives</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      )}
      
      {!isLoading && (
          <div className="space-y-8">
            {(statusFilter === 'All' || statusFilter === 'Active') && activeLeads.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Active Leads ({activeLeads.length})</h2>
                    <LeadGrid leads={activeLeads} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Upcoming') && upcomingLeads.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Upcoming Leads ({upcomingLeads.length})</h2>
                    <LeadGrid leads={upcomingLeads} />
                </section>
            )}
            {(statusFilter === 'All' || statusFilter === 'Completed') && completedLeads.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4">Completed Leads ({completedLeads.length})</h2>
                    <LeadGrid leads={completedLeads} />
                </section>
            )}
            {filteredLeads.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No public leads found matching your criteria.</p>
                </div>
            )}
          </div>
      )}
    </div>
  );
}
