'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, HandHelping, CalendarIcon, X, GraduationCap, HeartPulse, LifeBuoy, Info, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Lead, Campaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Image from 'next/image';
import { usePublicData } from '@/hooks/use-public-data';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from './news-ticker';

const LeadGrid = ({ leads }: { leads: (Lead & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map((lead, index) => {
                const FallbackIcon = lead.purpose === 'Education' ? GraduationCap : 
                                     lead.purpose === 'Medical' ? HeartPulse : 
                                     lead.purpose === 'Relief' ? LifeBuoy : 
                                     lead.purpose === 'Other' ? Info : HandHelping;

                return (
                    <Card 
                        key={lead.id} 
                        className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden active:scale-[0.98] h-full border-primary/20 bg-white shadow-sm" 
                        style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
                        onClick={() => router.push(`/leads-public/${lead.id}/summary`)}
                    >
                        <div className="relative h-32 w-full bg-secondary flex items-center justify-center border-b border-primary/5">
                            {lead.imageUrl ? (
                                <Image
                                  src={`/api/image-proxy?url=${encodeURIComponent(lead.imageUrl)}`}
                                  alt={lead.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  className="object-cover"
                                />
                            ) : (
                                <FallbackIcon className="h-16 w-16 text-primary/10" />
                            )}
                        </div>
                        <CardHeader className="p-4">
                            <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 tracking-tight text-primary">{lead.name}</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-muted-foreground">{lead.startDate} To {lead.endDate}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3 p-4 pt-0">
                            <div className="flex flex-wrap gap-2 items-center text-xs">
                                <Badge variant="outline" className="text-[10px] border-primary/20 font-bold text-primary uppercase">{lead.purpose}</Badge>
                                <Badge 
                                  variant={lead.status === 'Active' ? 'success' : lead.status === 'Completed' ? 'secondary' : 'outline'}
                                  className={cn("text-[10px] font-bold", lead.status === 'Active' && "animate-status-pulse")}
                                >
                                  {lead.status}
                                </Badge>
                                <Badge variant="eligible" className="text-[10px] font-bold flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    {lead.authenticityStatus === 'Verified' ? 'Verified' : lead.authenticityStatus}
                                </Badge>
                            </div>
                            {(lead.targetAmount || 0) > 0 && (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                        <span>Raised: ₹{lead.collected.toLocaleString('en-IN')}</span>
                                        <span>{Math.round(lead.progress)}%</span>
                                    </div>
                                    <Progress value={lead.progress} className="h-1.5" />
                                </div>
                            )}
                        </CardContent>
                         <CardFooter className="p-2 border-t bg-primary/5">
                            <Button asChild className="w-full transition-transform active:scale-95 text-xs font-bold tracking-tight hover:bg-primary hover:text-white text-primary" size="sm" variant="ghost">
                                <Link href={`/leads-public/${lead.id}/summary`}>
                                    View Detailed Summary
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
};


export function PublicLeadsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { isLoading, leadsWithProgress, campaignsWithProgress, recentDonationsFormatted } = usePublicData();

  const activeTickerItems = useMemo(() => {
    const activeCampaignsList = (campaignsWithProgress || [])
      .filter(c => c.status === 'Active' || c.status === 'Upcoming')
      .map(c => {
          const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
          return {
              id: c.id,
              text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/campaign-public/${c.id}/summary`
          };
      });
    
    const activeLeadsList = (leadsWithProgress || [])
      .filter(l => l.status === 'Active' || l.status === 'Upcoming')
      .map(l => {
          const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
          return {
              id: l.id,
              text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/leads-public/${l.id}/summary`
          };
      });

    return [...activeCampaignsList, ...activeLeadsList];
  }, [campaignsWithProgress, leadsWithProgress]);

  const completedTickerItems = useMemo(() => {
    const completedCampaigns = (campaignsWithProgress || [])
      .filter(c => c.status === 'Completed')
      .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-public/${c.id}/summary` }));
    
    const completedLeads = (leadsWithProgress || [])
      .filter(l => l.status === 'Completed')
      .map(l => ({ id: l.id, text: `Lead: ${l.name}`, href: `/leads-public/${l.id}/summary` }));

    return [...completedCampaigns, ...completedLeads];
  }, [campaignsWithProgress, leadsWithProgress]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    (leadsWithProgress || []).forEach(l => l.startDate && years.add(l.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [leadsWithProgress]);
  
  const filteredLeads = useMemo(() => {
    if (!leadsWithProgress) return [];
    let items = leadsWithProgress.filter(l => 
        (statusFilter === 'All' || l.status === statusFilter) &&
        (purposeFilter === 'All' || l.purpose === purposeFilter) &&
        (l.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        items = items.filter(l => {
            const d = parseISO(l.startDate);
            return d >= from && d <= to;
        });
    } else if (selectedYear !== 'All') {
        items = items.filter(l => l.startDate?.startsWith(selectedYear));
    }
    return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leadsWithProgress, searchTerm, statusFilter, purposeFilter, dateRange, selectedYear]);

  const sections = useMemo(() => [
    { id: 'ongoing_upcoming', title: 'Ongoing & Upcoming Leads', icon: Clock, items: filteredLeads.filter(c => c.status === 'Active' || c.status === 'Upcoming') },
    { id: 'completed', title: 'Closed Appeals', icon: CheckCircle2, items: filteredLeads.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0), [filteredLeads]);
  
  return (
    <div className="space-y-8">
      <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-primary">Public Leads</h1>
          <p className="text-lg font-bold text-primary">Verified Community Appeals Requiring Your Support.</p>
          
          <div className="space-y-2">
            <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
            <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
            <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-4 bg-primary/5 p-4 rounded-xl border border-primary/20">
              <Input placeholder="Search Appeals..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm h-9 text-xs border-primary/20 focus-visible:ring-primary font-bold text-primary" disabled={isLoading}/>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs border-primary/20 font-bold text-primary"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-bold">All Statuses</SelectItem><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Completed" className="font-bold">Completed</SelectItem><SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem></SelectContent></Select>
              <Select value={purposeFilter} onValueChange={setPurposeFilter} disabled={isLoading}><SelectTrigger className="w-[180px] h-9 text-xs border-primary/20 font-bold text-primary"><SelectValue placeholder="All Purposes" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-bold">All Purposes</SelectItem>{[...new Set((leadsWithProgress || []).map(l => l.purpose))].map(p => <SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>)}</SelectContent></Select>
              <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1">
                  <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs font-bold border-primary/20 text-primary"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-bold">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y} className="font-bold">{y}</SelectItem>)}</SelectContent></Select>
                  <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-bold border-primary/20", !dateRange ? "text-muted-foreground" : "text-primary")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                  {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
              </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : (sections && sections.length > 0) ? (
        <Accordion type="multiple" defaultValue={['ongoing_upcoming']} className="space-y-6">
          {sections.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border-none">
              <AccordionTrigger className="hover:no-underline group font-bold">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-1 bg-primary rounded-full group-data-[state=closed]:opacity-50" />
                  <div className="flex items-center gap-2">
                    <section.icon className="h-6 w-6 text-primary" />
                    <span className="text-2xl font-bold tracking-tight text-primary">{section.title}</span>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{section.items.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-6">
                <LeadGrid leads={section.items} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-20 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
            <Lightbulb className="h-12 w-12 mx-auto text-primary/20 mb-4" />
            <p className="font-bold text-sm opacity-60 text-primary uppercase tracking-widest text-center">No Appeals Found Matching Criteria.</p>
        </div>
      )}
    </div>
  );
}
