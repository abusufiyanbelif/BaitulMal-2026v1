
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderKanban, HandHelping, CalendarIcon, X } from 'lucide-react';
import type { Campaign } from '@/lib/types';
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

const CampaignGrid = ({ campaigns }: { campaigns: (Campaign & { collected: number; progress: number; })[] }) => {
    const router = useRouter();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign, index) => (
                <Card 
                    key={campaign.id} 
                    className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden active:scale-[0.98] h-full" 
                    style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
                    onClick={() => router.push(`/campaign-public/${campaign.id}/summary`)}
                >
                    <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
                        {campaign.imageUrl ? (
                            <Image
                              src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`}
                              alt={campaign.name}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              className="object-cover"
                              data-ai-hint="campaign background"
                            />
                        ) : (
                            <HandHelping className="h-16 w-16 text-muted-foreground" />
                        )}
                    </div>
                    <CardHeader className="p-4">
                        <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2">
                            {campaign.campaignNumber && <span className="text-primary">#{campaign.campaignNumber} </span>}{campaign.name}
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">{campaign.startDate} to {campaign.endDate}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3 p-4 pt-0">
                        <div className="flex justify-between items-center text-xs">
                            <Badge variant="outline" className="text-[10px]">{campaign.category}</Badge>
                            <Badge 
                              variant={campaign.status === 'Active' ? 'success' : 'outline'}
                              className={cn("text-[10px]", campaign.status === 'Active' && "animate-status-pulse")}
                            >
                              {campaign.status}
                            </Badge>
                        </div>
                        {(campaign.targetAmount || 0) > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                    <span>Collected: ₹{campaign.collected.toLocaleString('en-IN')}</span>
                                    <span>{Math.round(campaign.progress)}%</span>
                                </div>
                                <Progress value={campaign.progress} className="h-1.5" />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="p-2 border-t bg-muted/5">
                        <Button asChild className="w-full transition-transform active:scale-95 text-xs font-bold" size="sm" variant="ghost">
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
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { isLoading, campaignsWithProgress } = usePublicData();

  const tickerItems = useMemo(() => {
    return campaignsWithProgress
      .filter(c => c.status === 'Active')
      .map(c => ({ id: c.id, text: c.name, href: `/campaign-public/${c.id}/summary` }));
  }, [campaignsWithProgress]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    campaignsWithProgress.forEach(c => c.startDate && years.add(c.startDate.split('-')[0]));
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
        if (selectedMonth !== 'All') items = items.filter(c => c.startDate?.split('-')[1] === selectedMonth);
    }
    return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [campaignsWithProgress, searchTerm, statusFilter, categoryFilter, dateRange, selectedYear, selectedMonth]);

  const sections = [
    { id: 'active', title: 'Ongoing Campaigns', items: filteredCampaigns.filter(c => c.status === 'Active') },
    { id: 'upcoming', title: 'Upcoming Initiatives', items: filteredCampaigns.filter(c => c.status === 'Upcoming') },
    { id: 'completed', title: 'Past Achievements', items: filteredCampaigns.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0);

  return (
    <div className="space-y-8">
       <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tighter">OUR CAMPAIGNS</h1>
          <p className="text-muted-foreground text-lg">Transparent tracking of our community support projects.</p>
          
          <NewsTicker items={tickerItems} />

          <div className="flex flex-wrap items-center gap-2 pt-4 bg-muted/10 p-4 rounded-xl border">
              <Input placeholder="Search campaigns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs" disabled={isLoading}/>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem></SelectContent></Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="All">All Categories</SelectItem><SelectItem value="Ration">Ration</SelectItem><SelectItem value="Relief">Relief</SelectItem><SelectItem value="General">General</SelectItem></SelectContent></Select>
              <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                  <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal", !dateRange && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Date Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); setSelectedMonth('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                  {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedYear('All'); setSelectedMonth('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
              </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : sections.length > 0 ? (
        <Accordion type="multiple" defaultValue={['active']} className="space-y-6">
          {sections.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border-none">
              <AccordionTrigger className="hover:no-underline group">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-1 bg-primary rounded-full group-data-[state=closed]:opacity-50" />
                  <span className="text-2xl font-black tracking-tight uppercase">{section.title}</span>
                  <Badge variant="secondary" className="rounded-full h-6 px-3">{section.items.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-6">
                <CampaignGrid campaigns={section.items} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No campaigns found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
