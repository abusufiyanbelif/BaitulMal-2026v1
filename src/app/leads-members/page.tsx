'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X, GraduationCap, HeartPulse, LifeBuoy, Info } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc } from 'firebase/firestore';
import type { Lead } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
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
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from '@/components/news-ticker';
import { usePublicData } from '@/hooks/use-public-data';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface LeadCardProps {
    lead: Lead & { collected: number; progress: number; };
    index: number;
    router: ReturnType<typeof useRouter>;
    canUpdate: boolean;
    canCreate: boolean;
    canDelete: boolean;
    handleStatusUpdate: (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => Promise<void>;
    handleCopyClick: (lead: Lead) => void;
    handleDeleteClick: (lead: Lead) => void;
}

const LeadCard = ({ lead, index, router, canUpdate, canCreate, canDelete, handleStatusUpdate, handleCopyClick, handleDeleteClick }: LeadCardProps) => {
    const FallbackIcon = lead.purpose === 'Education' ? GraduationCap : 
                         lead.purpose === 'Medical' ? HeartPulse : 
                         lead.purpose === 'Relief' ? LifeBuoy : 
                         lead.purpose === 'Other' ? Info : HandHelping;

    return (
        <Card 
            className="flex flex-col interactive-hover overflow-hidden h-full group border-primary/10 bg-white/50 shadow-sm" 
            style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
            onClick={() => router.push(`/leads-members/${lead.id}/summary`)}
        >
          <div className="relative h-32 w-full bg-secondary flex items-center justify-center border-b border-primary/5">
            {lead.imageUrl ? (
                <Image
                  src={`/api/image-proxy?url=${encodeURIComponent(lead.imageUrl)}`}
                  alt={lead.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
            ) : (
                <FallbackIcon className="h-16 w-16 text-primary/10" />
            )}
          </div>
          <CardHeader className="p-4">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 tracking-tight">{lead.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => router.push(`/leads-members/${lead.id}/summary`)} className="cursor-pointer font-normal">
                            <Edit className="mr-2 h-4 w-4" />
                            View Details
                        </DropdownMenuItem>
                        {canUpdate && <DropdownMenuSeparator />}
                        {canUpdate && (
                            <>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="font-normal"><span>Change Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup value={lead.status} onValueChange={(value) => handleStatusUpdate(lead, 'status', value)}>
                                                <DropdownMenuRadioItem value="Upcoming" className="font-normal">Upcoming</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Active" className="font-normal">Active</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Completed" className="font-normal">Completed</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="font-normal"><span>Verification</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup value={lead.authenticityStatus} onValueChange={(value) => handleStatusUpdate(lead, 'authenticityStatus', value as string)}>
                                                <DropdownMenuRadioItem value="Pending Verification" className="font-normal">Pending</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified" className="font-normal">Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="On Hold" className="font-normal">On Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Rejected" className="font-normal">Rejected</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details" className="font-normal">Need Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            </>
                        )}
                        <DropdownMenuSeparator />
                        {canCreate && (
                            <DropdownMenuItem onClick={() => handleCopyClick(lead)} className="cursor-pointer font-normal">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Appeal
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer font-normal">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
            </div>
            <CardDescription className="text-[10px] font-normal tracking-normal">{lead.startDate} to {lead.endDate}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 p-4 pt-0">
              <div className="flex justify-between items-center text-xs">
                <Badge variant="outline" className="text-[10px] border-primary/20 font-normal">{lead.purpose}</Badge>
                <Badge 
                  variant={lead.status === 'Active' ? 'success' : lead.status === 'Completed' ? 'secondary' : 'outline'}
                  className={cn("text-[10px] font-normal", lead.status === 'Active' && "animate-status-pulse")}
                >
                  {lead.status}
                </Badge>
            </div>
              {(lead.targetAmount || 0) > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-normal opacity-60 tracking-tight">
                        <span>Raised: ₹{lead.collected.toLocaleString('en-IN')}</span>
                        <span>{Math.round(lead.progress)}%</span>
                    </div>
                    <Progress value={lead.progress} className="h-1.5" />
                    <p className="text-center text-[10px] text-muted-foreground font-normal">Goal: ₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p>
                </div>
            )}
        </CardContent>
         <CardFooter className="p-2 border-t bg-primary/5">
            <Button asChild className="w-full text-xs font-bold tracking-tight hover:bg-primary hover:text-white" size="sm" variant="ghost">
                <Link href={`/leads-members/${lead.id}/summary`}>
                    Manage Appeal
                </Link>
            </Button>
        </CardFooter>
        </Card>
    );
};

export default function LeadPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [leadToCopy, setLeadToCopy] = useState<Lead | null>(null);
  
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { leadsWithProgress, campaignsWithProgress, recentDonationsFormatted, isLoading: isDataLoading } = usePublicData();

  const activeTickerItems = useMemo(() => {
    const activeCampaigns = (campaignsWithProgress || [])
      .filter(c => c.status === 'Active')
      .map(c => {
          const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
          return {
              id: c.id,
              text: `Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')} | Ends: ${c.endDate})`,
              href: `/campaign-members/${c.id}/summary`
          };
      });
    
    const activeLeads = (leadsWithProgress || [])
      .filter(l => l.status === 'Active')
      .map(l => {
          const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
          return {
              id: l.id,
              text: `Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')} | Ends: ${l.endDate})`,
              href: `/leads-members/${l.id}/summary`
          };
      });

    return [...activeCampaigns, ...activeLeads];
  }, [campaignsWithProgress, leadsWithProgress]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    (leadsWithProgress || []).forEach(l => l.startDate && years.add(l.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [leadsWithProgress]);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.delete', false);
  const canViewLeads = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false);

  const handleDeleteConfirm = async () => {
    if (!leadToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    setIsDeleting(true);
    const result = await deleteLeadAction(leadToDelete.id);
    toast({ title: result.success ? 'Success' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
    setIsDeleting(false);
    setLeadToDelete(null);
  };

  const handleStatusUpdate = async (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => {
    if (!firestore || !canUpdate) return;
    const docRef = doc(firestore, 'leads', leadToUpdate.id);
    const updateData = { [field]: value };
    updateDoc(docRef, updateData)
        .then(() => toast({ title: 'Success', description: `Lead Updated.`, variant: 'success' }))
        .catch(err => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  const filteredLeads = useMemo(() => {
    if (!leadsWithProgress) return [];
    let items = leadsWithProgress.filter(l => 
        (statusFilter === 'All' || l.status === statusFilter) &&
        (purposeFilter === 'All' || l.purpose === purposeFilter) &&
        l.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    return items;
  }, [leadsWithProgress, searchTerm, statusFilter, purposeFilter, dateRange, selectedYear]);

  const sections = useMemo(() => [
    { id: 'active', title: 'Live Initiatives', items: filteredLeads.filter(c => c.status === 'Active') },
    { id: 'upcoming', title: 'Upcoming Support', items: filteredLeads.filter(c => c.status === 'Upcoming') },
    { id: 'completed', title: 'Closed Appeals', items: filteredLeads.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0), [filteredLeads]);

  const isLoading = isProfileLoading || isDeleting || isDataLoading;
  
  if (!isLoading && userProfile && !canViewLeads) {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4"><Button variant="outline" asChild className="border-primary/20 font-bold"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link></Button></div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="font-bold">Access Denied</AlertTitle>
          <AlertDescription className="font-normal">Missing permissions to manage leads.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="outline" asChild size="sm" className="interactive-hover font-bold border-primary/20 hover:bg-primary/10"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && <Button asChild size="sm" className="font-bold tracking-tight interactive-hover shadow-lg"><Link href="/leads-members/create"><Plus className="mr-2 h-4 w-4" /> New Appeal</Link></Button>}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Leads Hub</h1>
          <p className="text-sm max-w-2xl font-normal leading-relaxed opacity-70">Vetting and managing individual cases requiring organizational support.</p>
        </div>

        <div className="space-y-2">
          <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
          <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
        </div>

        <Card className="animate-fade-in-zoom shadow-md border-primary/5 bg-white/30">
          <CardHeader className="p-4 border-b bg-primary/5">
            <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search appeals..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs border-primary/20 focus-visible:ring-primary font-normal" disabled={isLoading}/>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs border-primary/20 font-bold"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem></SelectContent></Select>
                <Select value={purposeFilter} onValueChange={setPurposeFilter} disabled={isLoading}><SelectTrigger className="w-[180px] h-9 text-xs border-primary/20 font-bold"><SelectValue placeholder="Purpose" /></SelectTrigger><SelectContent><SelectItem value="All">All Purposes</SelectItem>{[...new Set((leadsWithProgress || []).map(l => l.purpose))].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1">
                    <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs font-bold border-primary/20"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                    <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-bold border-primary/20", !dateRange ? "opacity-60" : "")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                    {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-card/30">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
              </div>
            ) : sections.length > 0 ? (
              <Accordion type="multiple" defaultValue={['active']} className="space-y-6">
                {sections.map(section => (
                  <AccordionItem key={section.id} value={section.id} className="border-primary/10 rounded-xl px-4 bg-white/50 shadow-sm overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-5 group font-bold">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-1 bg-primary rounded-full group-data-[state=closed]:opacity-50" />
                        <span className="text-lg font-bold tracking-tight">{section.title}</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold">{section.items.length}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-8">
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
              <div className="text-center py-24 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                  <Lightbulb className="h-16 w-16 mx-auto text-primary/20 mb-4" />
                  <p className="font-bold text-sm opacity-60">No Appeals Found Matching Criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive">Delete Appeal?</AlertDialogTitle><AlertDialogDescription className="font-normal opacity-80">Permanently erase all data for '{leadToDelete?.name}'? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90">Confirm Deletion</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
        
      <CopyLeadDialog open={!!leadToCopy} onOpenChange={() => setLeadToCopy(null)} lead={leadToCopy} onCopyConfirm={async (opt) => { const res = await copyLeadAction({ sourceLeadId: leadToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); setLeadToCopy(null); }}/>
    </>
  );
}