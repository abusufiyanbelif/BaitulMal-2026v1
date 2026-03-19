'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderKanban, HandHelping, CalendarIcon, X, Utensils, LifeBuoy, Clock, CheckCircle2, ShieldCheck, AlertTriangle, ArrowUpCircle, MinusCircle, ArrowDownCircle } from 'lucide-react';
import type { Campaign, Donation } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const getPriorityIcon = (priority?: string) => {
  const p = priority || 'Medium';
  switch (p) {
    case 'Urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'High': return <ArrowUpCircle className="h-4 w-4 text-orange-500" />;
    case 'Medium': return <MinusCircle className="h-4 w-4 text-yellow-500" />;
    case 'Low': return <ArrowDownCircle className="h-4 w-4 text-blue-500" />;
    default: return null;
  }
};

const priorityWeight: Record<string, number> = {
  'Urgent': 4,
  'High': 3,
  'Medium': 2,
  'Low': 1
};

const CampaignGrid = ({ campaigns }: { campaigns: (Campaign & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    return (
        <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[Autoplay({ delay: 5000, stopOnInteraction: false })]}
            className="w-full relative"
        >
            <CarouselContent className="-ml-4">
                {campaigns.map((campaign, index) => {
                    const FallbackIcon = campaign.category === 'Ration' ? Utensils : campaign.category === 'Relief' ? LifeBuoy : HandHelping;
                    const priorityLabel = campaign.priority || 'Medium';
                    const isCompleted = campaign.status === 'Completed';
                    const isUrgent = priorityLabel === 'Urgent' && !isCompleted;
                    const isHigh = priorityLabel === 'High' && !isCompleted;
                    
                    return (
                        <CarouselItem key={campaign.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                            <Card 
                                className={cn(
                                    "flex flex-col hover:shadow-xl transition-all duration-500 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden active:scale-[0.98] h-full border-primary/20 bg-white shadow-sm",
                                    isUrgent && "animate-urgent-pulse border-red-500/50",
                                    isHigh && "animate-high-pulse border-orange-500/50",
                                    isCompleted && "hover:shadow-none hover:-translate-y-0"
                                )}
                                style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
                                onClick={() => router.push(`/campaign-public/${campaign.id}/summary`)}
                            >
                                <div className="relative h-32 w-full bg-secondary flex items-center justify-center border-b border-primary/5">
                                    {campaign.imageUrl ? (
                                        <Image
                                          src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`}
                                          alt={campaign.name}
                                          fill
                                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                          className="object-cover"
                                        />
                                    ) : (
                                        <FallbackIcon className="h-16 w-16 text-primary/10" />
                                    )}
                                </div>
                                <CardHeader className="p-4">
                                    <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 text-primary">
                                        {campaign.name}
                                    </CardTitle>
                                    <CardDescription className="text-[10px] font-bold tracking-tight text-muted-foreground uppercase">{campaign.startDate} To {campaign.endDate}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-3 p-4 pt-0">
                                    <div className="flex flex-wrap gap-2 items-center text-xs">
                                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary font-bold uppercase">{campaign.category}</Badge>
                                        <Badge 
                                          variant={campaign.status === 'Active' ? 'success' : 'outline'}
                                          className={cn("text-[10px] font-bold uppercase", campaign.status === 'Active' && "animate-status-pulse")}
                                        >
                                          {campaign.status}
                                        </Badge>
                                        <Badge variant="eligible" className="text-[10px] font-bold flex items-center gap-1 uppercase">
                                            <ShieldCheck className="h-3 w-3" />
                                            {campaign.authenticityStatus === 'Verified' ? 'Verified' : campaign.authenticityStatus}
                                        </Badge>
                                    </div>
                                    <div className={cn(
                                        "text-[10px] font-bold tracking-tight flex items-center gap-1.5 uppercase", 
                                        isUrgent ? 'text-red-600 animate-in fade-in slide-in-from-left' : isHigh ? 'text-orange-600' : 'text-primary'
                                    )}>
                                        {getPriorityIcon(priorityLabel)}
                                        {priorityLabel} Priority
                                    </div>
                                    {(campaign.targetAmount || 0) > 0 && (
                                        <div className="space-y-2 border-t border-primary/5 pt-3">
                                            <div className="flex justify-between items-baseline text-[11px] font-bold text-primary tracking-tight uppercase">
                                                <span className="opacity-60">Raised: ₹{campaign.collected.toLocaleString('en-IN')}</span>
                                                <span className="text-sm">Goal: ₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                            <Progress value={campaign.progress} className="h-2 bg-primary/10 shadow-inner" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-muted-foreground tracking-tight uppercase">Progress</span>
                                                <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 uppercase">
                                                    {Math.round(campaign.progress)}% Funded
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="p-2 border-t bg-primary/5">
                                    <Button asChild className="w-full transition-transform active:scale-95 text-xs font-bold tracking-tight hover:bg-primary hover:text-white text-primary uppercase shadow-none" size="sm" variant="ghost">
                                        <Link href={`/campaign-public/${campaign.id}/summary`}>
                                            View Detailed Summary
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </CarouselItem>
                    );
                })}
            </CarouselContent>
            <div className="flex items-center justify-center gap-4 mt-8">
                <CarouselPrevious className="static translate-y-0 h-10 w-10 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-300" />
                <CarouselNext className="static translate-y-0 h-10 w-10 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-300" />
            </div>
        </Carousel>
    );
};

export function PublicCampaignsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { isLoading, campaignsWithProgress, leadsWithProgress, recentDonationsFormatted } = usePublicData();

  const activeTickerItems = useMemo(() => {
    const activeCampaigns = (campaignsWithProgress || [])
      .filter(c => c.status === 'Active' || c.status === 'Upcoming')
      .map(c => {
          const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
          const isUrgent = c.priority === 'Urgent';
          const isHigh = c.priority === 'High';
          return {
              id: c.id,
              text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/campaign-public/${c.id}/summary`,
              priority: c.priority || 'Medium',
              priorityIcon: getPriorityIcon(c.priority),
              isUrgent,
              isHigh
          };
      });
    
    const activeLeads = (leadsWithProgress || [])
      .filter(l => l.status === 'Active' || l.status === 'Upcoming')
      .map(l => {
          const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
          const isUrgent = l.priority === 'Urgent';
          const isHigh = l.priority === 'High';
          return {
              id: l.id,
              text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/leads-public/${l.id}/summary`,
              priority: l.priority || 'Medium',
              priorityIcon: getPriorityIcon(l.priority),
              isUrgent,
              isHigh
          };
      });

    return [...activeCampaigns, ...activeLeads].sort((a, b) => 
        (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
    );
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
    (campaignsWithProgress || []).forEach(c => c.startDate && years.add(c.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [campaignsWithProgress]);

  const filteredCampaigns = useMemo(() => {
    if (!campaignsWithProgress) return [];
    let items = campaignsWithProgress.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (categoryFilter === 'All' || c.category === categoryFilter) &&
        (c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        items = items.filter(c => {
            const d = parseISO(c.startDate);
            return d >= from && d <= to;
        });
    } else if (selectedYear !== 'All') {
        items = items.filter(c => c.startDate?.startsWith(selectedYear));
    }
    return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [campaignsWithProgress, searchTerm, statusFilter, categoryFilter, dateRange, selectedYear]);

  const sections = useMemo(() => {
    const priorityItems = filteredCampaigns.filter(c => (c.priority === 'Urgent' || c.priority === 'High') && c.status !== 'Completed');
    const ongoingItems = filteredCampaigns.filter(c => (c.status === 'Active' || c.status === 'Upcoming') && !priorityItems.find(p => p.id === c.id));
    const completedItems = filteredCampaigns.filter(c => c.status === 'Completed');

    return [
      { id: 'priority', title: 'Critical Initiatives', icon: AlertTriangle, items: priorityItems, color: 'text-red-600' },
      { id: 'ongoing_upcoming', title: 'Ongoing Campaigns', icon: Clock, items: ongoingItems, color: 'text-primary' },
      { id: 'completed', title: 'Project Archive', icon: CheckCircle2, items: completedItems, color: 'text-muted-foreground' }
    ].filter(s => s.items.length > 0);
  }, [filteredCampaigns]);

  return (
    <div className="space-y-8">
       <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter text-primary uppercase">Our Campaigns</h1>
          <p className="text-primary text-lg font-bold">Transparent Tracking Of Our Community Support Projects.</p>
          
          <div className="space-y-2">
            <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
            <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
            <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-4 bg-primary/5 p-4 rounded-xl border border-primary/20">
              <Input placeholder="Search Campaigns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs border-primary/20 focus-visible:ring-primary text-primary font-normal" disabled={isLoading}/>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs font-normal border-primary/20 text-primary uppercase"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="All" className="font-normal uppercase">All Statuses</SelectItem><SelectItem value="Active" className="font-normal uppercase">Active</SelectItem><SelectItem value="Completed" className="font-normal uppercase">Completed</SelectItem><SelectItem value="Upcoming" className="font-normal uppercase">Upcoming</SelectItem></SelectContent></Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs font-normal border-primary/20 text-primary uppercase"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="All" className="font-normal uppercase">All Categories</SelectItem><SelectItem value="Ration" className="font-normal uppercase">Ration</SelectItem><SelectItem value="Relief" className="font-normal uppercase">Relief</SelectItem><SelectItem value="General" className="font-normal uppercase">General</SelectItem></SelectContent></Select>
              <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1">
                  <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="All" className="font-normal">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y} className="font-normal">{y}</SelectItem>)}</SelectContent></Select>
                  <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal border-primary/20", !dateRange ? "text-muted-foreground" : "text-primary")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end" sideOffset={12} className="rounded-[16px] shadow-dropdown border-primary/10"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                  {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
              </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : sections.length > 0 ? (
        <Accordion type="multiple" defaultValue={['priority', 'ongoing_upcoming', 'completed']} className="space-y-6">
          {sections.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border-none">
              <AccordionTrigger className="hover:no-underline group font-bold">
                <div className="flex items-center gap-4">
                  <div className={cn("h-8 w-1 rounded-full group-data-[state=closed]:opacity-50", section.id === 'priority' ? 'bg-red-600' : 'bg-primary')} />
                  <div className="flex items-center gap-2">
                    <section.icon className={cn("h-6 w-6", section.color || "text-primary")} />
                    <span className={cn("text-2xl font-bold tracking-tight uppercase", section.color || "text-primary")}>{section.title}</span>
                  </div>
                  <Badge variant="secondary" className="rounded-full h-6 px-3 bg-primary/10 text-primary border-primary/20 font-bold">{section.items.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-6 px-2 sm:px-10">
                <CampaignGrid campaigns={section.items} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-20 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
            <FolderKanban className="h-12 w-12 mx-auto text-primary/20 mb-4" />
            <p className="text-primary/60 font-bold tracking-widest text-sm uppercase">No Campaigns Found Matching Criteria.</p>
        </div>
      )}
    </div>
  );
}
