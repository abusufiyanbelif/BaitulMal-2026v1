'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X } from 'lucide-react';
import { useCollection, useFirestore, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Lead, Donation, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CopyLeadDialog } from '@/components/copy-lead-dialog';
import { copyLeadAction, deleteLeadAction } from './actions';
import { cn, getNestedValue } from '@/lib/utils';
import { leadPurposesConfig } from '@/lib/modules';
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from '@/components/news-ticker';
import { usePublicData } from '@/hooks/use-public-data';

const LeadCard = ({ lead, index, router, canUpdate, canCreate, canDelete, handleStatusUpdate, handleCopyClick, handleDeleteClick }: { 
    lead: Lead & { collected: number; progress: number; }, 
    index: number,
    router: any,
    canUpdate: boolean,
    canCreate: boolean,
    canDelete: boolean,
    handleStatusUpdate: any,
    handleCopyClick: any,
    handleDeleteClick: any
}) => (
    <Card 
        className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden active:scale-[0.98] h-full" 
        style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
        onClick={() => router.push(`/leads-members/${lead.id}/summary`)}
    >
      <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
        {lead.imageUrl ? (
            <Image
              src={lead.imageUrl}
              alt={lead.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              data-ai-hint="lead background"
            />
        ) : (
            <HandHelping className="h-16 w-16 text-muted-foreground" />
        )}
      </div>
      <CardHeader className="p-4">
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2">{lead.name}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => router.push(`/leads-members/${lead.id}/summary`)} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" />
                        View Details
                    </DropdownMenuItem>
                    {canUpdate && <DropdownMenuSeparator />}
                    {canUpdate && (
                        <>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger><span>Change Status</span></DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={lead.status} onValueChange={(value) => handleStatusUpdate(lead, 'status', value)}>
                                        <DropdownMenuRadioItem value="Upcoming">Upcoming</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Active">Active</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger><span>Verification</span></DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={lead.authenticityStatus} onValueChange={(value) => handleStatusUpdate(lead, 'authenticityStatus', value as string)}>
                                        <DropdownMenuRadioItem value="Pending Verification">Pending Verification</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="On Hold">On Hold</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Rejected">Rejected</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Need More Details">Need More Details</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger><span>Publication</span></DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={lead.publicVisibility} onValueChange={(value) => handleStatusUpdate(lead, 'publicVisibility', value as string)}>
                                        <DropdownMenuRadioItem value="Hold">Hold (Private)</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Ready to Publish">Ready to Publish</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Published">Published</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </>
                    )}
                    <DropdownMenuSeparator />
                    {canCreate && (
                        <DropdownMenuItem onClick={() => handleCopyClick(lead)} className="cursor-pointer">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                        </DropdownMenuItem>
                    )}
                    {canDelete && (
                        <>
                            {canCreate && <DropdownMenuSeparator />}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
        </div>
        <CardDescription className="text-[10px] font-bold uppercase tracking-wider">{lead.startDate} to {lead.endDate}</CardDescription>
    </CardHeader>
    <CardContent className="flex-grow space-y-3 p-4 pt-0">
          <div className="flex justify-between items-center text-xs">
            <Badge variant="secondary" className="text-[10px]">{lead.purpose}</Badge>
            <Badge 
              variant={lead.status === 'Active' ? 'success' : lead.status === 'Completed' ? 'secondary' : 'outline'}
              className={cn("text-[10px]", lead.status === 'Active' && "animate-status-pulse")}
            >
              {lead.status}
            </Badge>
        </div>
          {(lead.targetAmount || 0) > 0 && (
            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>Raised: ₹{lead.collected.toLocaleString('en-IN')}</span>
                    <span>{Math.round(lead.progress)}%</span>
                </div>
                <Progress value={lead.progress} className="h-1.5" />
                <p className="text-center text-[10px] text-muted-foreground/70">Goal: ₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p>
            </div>
        )}
    </CardContent>
     <CardFooter className="p-2 border-t bg-muted/5">
        <Button asChild className="w-full transition-transform active:scale-95 text-xs font-bold" size="sm" variant="ghost">
            <Link href={`/leads-members/${lead.id}/summary`}>
                Manage Lead
            </Link>
        </Button>
    </CardFooter>
    </Card>
);

export default function LeadPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [authenticityFilter, setAuthenticityFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [leadToCopy, setLeadToCopy] = useState<Lead | null>(null);
  
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { leadsWithProgress, campaignsWithProgress, recentDonationsFormatted, areDonationsLoading } = usePublicData();

  const activeTickerItems = useMemo(() => {
    const activeCampaigns = campaignsWithProgress
      .filter(c => c.status === 'Active')
      .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-members/${c.id}/summary` }));
    
    const activeLeads = leadsWithProgress
      .filter(l => l.status === 'Active')
      .map(l => ({ id: l.id, text: `Lead: ${l.name}`, href: `/leads-members/${l.id}/summary` }));

    return [...activeCampaigns, ...activeLeads];
  }, [campaignsWithProgress, leadsWithProgress]);

  const completedTickerItems = useMemo(() => {
    const completedCampaigns = campaignsWithProgress
      .filter(c => c.status === 'Completed')
      .map(c => ({ id: c.id, text: `Campaign: ${c.name}`, href: `/campaign-members/${c.id}/summary` }));
    
    const completedLeads = leadsWithProgress
      .filter(l => l.status === 'Completed')
      .map(l => ({ id: l.id, text: `Lead: ${l.name}`, href: `/leads-members/${l.id}/summary` }));

    return [...completedCampaigns, ...completedLeads];
  }, [campaignsWithProgress, leadsWithProgress]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    leadsWithProgress.forEach(l => l.startDate && years.add(l.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [leadsWithProgress]);

  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.delete', false);
  const canViewLeads = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false);

  const handleDeleteConfirm = async () => {
    if (!leadToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    setIsDeleting(true);
    const result = await deleteLeadAction(leadToDelete.id);
    toast({ title: result.success ? 'Lead Deleted' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
    setIsDeleting(false);
    setLeadToDelete(null);
  };

  const handleStatusUpdate = async (leadToUpdate: Lead, field: string, value: string) => {
    if (!firestore || !canUpdate) return;
    const docRef = doc(firestore, 'leads', leadToUpdate.id);
    updateDoc(docRef, { [field]: value })
        .then(() => toast({ title: 'Success', description: `Lead updated.`, variant: 'success' }))
        .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { [field]: value } })));
  };

  const filteredLeads = useMemo(() => {
    let items = leadsWithProgress.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (purposeFilter === 'All' || c.purpose === purposeFilter) &&
        (authenticityFilter === 'All' || c.authenticityStatus === authenticityFilter) &&
        (visibilityFilter === 'All' || c.publicVisibility === visibilityFilter) &&
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    return items;
  }, [leadsWithProgress, searchTerm, statusFilter, purposeFilter, authenticityFilter, visibilityFilter, dateRange, selectedYear, selectedMonth]);

  const sections = [
    { id: 'active', title: 'Active Leads', items: filteredLeads.filter(c => c.status === 'Active') },
    { id: 'upcoming', title: 'Upcoming Leads', items: filteredLeads.filter(c => c.status === 'Upcoming') },
    { id: 'completed', title: 'Completed Leads', items: filteredLeads.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0);

  const isLoading = isProfileLoading || isDeleting || areDonationsLoading;
  
  if (!isLoading && userProfile && !canViewLeads) {
    return <main className="container mx-auto p-4 md:p-8"><Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>Missing permissions.</AlertDescription></Alert></main>;
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="outline" asChild size="sm"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && <Button asChild size="sm" className="font-bold"><Link href="/leads-members/create"><Plus className="mr-2 h-4 w-4" /> New Lead</Link></Button>}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter">LEADS & INITIATIVES</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">Pipeline for vetting and launching new community support opportunities.</p>
        </div>

        <div className="space-y-2">
          <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
          <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
          <NewsTicker items={completedTickerItems} label="Recently Completed" variant="completed" />
        </div>

        <Card className="animate-fade-in-zoom shadow-md border-primary/5">
          <CardHeader className="p-4 border-b bg-muted/5">
            <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs" disabled={isLoading}/>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent></Select>
                <Select value={purposeFilter} onValueChange={setPurposeFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Purpose" /></SelectTrigger><SelectContent><SelectItem value="All">All Purposes</SelectItem>{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                <div className="flex items-center gap-2 border-l pl-3 ml-1">
                    <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                    <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal", !dateRange && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); setSelectedMonth('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                    {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedYear('All'); setSelectedMonth('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
              </div>
            ) : sections.length > 0 ? (
              <Accordion type="multiple" defaultValue={['active']} className="space-y-4">
                {sections.map(section => (
                  <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4 bg-card/50">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black tracking-tight uppercase">{section.title}</span>
                        <Badge variant="secondary" className="rounded-full h-5 text-[10px]">{section.items.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {section.items.map((lead, idx) => (
                          <LeadCard key={lead.id} lead={lead} index={idx} router={router} canUpdate={canUpdate} canCreate={canCreate} canDelete={canDelete} handleStatusUpdate={handleStatusUpdate} handleCopyClick={setLeadToCopy} handleDeleteClick={setLeadToDelete}/>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                  <HandHelping className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-medium">No leads found.</p>
                  <Button variant="link" onClick={() => { setSearchTerm(''); setStatusFilter('All'); setPurposeFilter('All'); setDateRange(undefined); setSelectedYear('All'); }}>Reset filters</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Lead?</AlertDialogTitle><AlertDialogDescription>Permanently erase '{leadToDelete?.name}'?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white hover:bg-destructive/90">Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
        
      <CopyLeadDialog open={!!leadToCopy} onOpenChange={() => setLeadToCopy(null)} lead={leadToCopy} onCopyConfirm={async (opt) => { const res = await copyLeadAction({ sourceLeadId: leadToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); setLeadToCopy(null); }}/>
    </>
  );
}
