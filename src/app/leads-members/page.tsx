'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X, GraduationCap, HeartPulse, LifeBuoy, Info, Lightbulb, Globe, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowUpCircle, MinusCircle, ArrowDownCircle } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc } from 'firebase/firestore';
import type { Lead } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { priorityLevels } from '@/lib/modules';
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from '@/components/news-ticker';
import { usePublicData } from '@/hooks/use-public-data';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';

const getPriorityIcon = (priority?: string) => {
  const p = priority || 'Medium';
  switch (p) {
    case 'Urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'High': return <ArrowUpCircle className="h-4 w-4 text-orange-500" />;
    case 'Medium': return <MinusCircle className="h-4 w-4 text-yellow-500" />;
    case 'Low': return <ArrowDownCircle className="h-4 w-4 text-blue-500" />;
    default: return <MinusCircle className="h-4 w-4 text-yellow-500" />;
  }
};

const priorityWeight: Record<string, number> = {
  'Urgent': 4,
  'High': 3,
  'Medium': 2,
  'Low': 1
};

interface LeadCardProps {
    lead: Lead & { collected: number; progress: number; };
    index: number;
    router: ReturnType<typeof useRouter>;
    canUpdate: boolean;
    canCreate: boolean;
    canDelete: boolean;
    handleStatusUpdate: (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility' | 'priority', value: string) => Promise<void>;
    handleCopyClick: (lead: Lead) => void;
    handleDeleteClick: (lead: Lead) => void;
}

const LeadCard = ({ lead, index, router, canUpdate, canCreate, canDelete, handleStatusUpdate, handleCopyClick, handleDeleteClick }: LeadCardProps) => {
    const FallbackIcon = lead.purpose === 'Education' ? GraduationCap : 
                         lead.purpose === 'Medical' ? HeartPulse : 
                         lead.purpose === 'Relief' ? LifeBuoy : 
                         lead.purpose === 'Other' ? Info : HandHelping;
    const priorityLabel = lead.priority || 'Medium';
    const isCompleted = lead.status === 'Completed';
    const isUrgent = priorityLabel === 'Urgent' && !isCompleted;
    const isHigh = priorityLabel === 'High' && !isCompleted;

    return (
        <Card 
            className={cn(
                "flex flex-col overflow-hidden h-full group border-primary/10 bg-white shadow-none animate-fade-in-up transition-all duration-500",
                isUrgent && "animate-urgent-pulse border-red-500/50",
                isHigh && "animate-high-pulse border-orange-500/50",
                isCompleted && "hover:shadow-none hover:-translate-y-0"
            )}
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
          <CardHeader className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 tracking-tight text-primary">{lead.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-[12px] border-primary/10 shadow-dropdown">
                        <DropdownMenuItem onClick={() => router.push(`/leads-members/${lead.id}/summary`)} className="cursor-pointer text-primary font-normal">
                            <Edit className="mr-2 h-4 w-4" />
                            View Details
                        </DropdownMenuItem>
                        {canUpdate && <DropdownMenuSeparator />}
                        {canUpdate && (
                            <>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Operational Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.status} onValueChange={(value) => handleStatusUpdate(lead, 'status', value)}>
                                                <DropdownMenuRadioItem value="Upcoming" className="font-normal">Upcoming</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Active" className="font-normal">Active</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Completed" className="font-normal">Completed</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Verification Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.authenticityStatus} onValueChange={(value) => handleStatusUpdate(lead, 'authenticityStatus', value as string)}>
                                                <DropdownMenuRadioItem value="Pending Verification" className="font-normal">Pending Verification</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified" className="font-normal">Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="On Hold" className="font-normal">On Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Rejected" className="text-destructive font-normal">Rejected</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details" className="font-normal">Need Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Public Visibility</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.publicVisibility} onValueChange={(value) => handleStatusUpdate(lead, 'publicVisibility', value as string)}>
                                                <DropdownMenuRadioItem value="Hold" className="font-normal">Hold (Private)</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Ready to Publish" className="font-normal">Ready To Publish</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Published" className="text-primary font-normal">Published</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Change Priority</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.priority} onValueChange={(value) => handleStatusUpdate(lead, 'priority', value)}>
                                                {priorityLevels.map(p => (
                                                    <DropdownMenuRadioItem key={p} value={p} className="font-normal">{p} Priority</DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            </>
                        )}
                        <DropdownMenuSeparator />
                        {canCreate && (
                            <DropdownMenuItem onClick={() => handleCopyClick(lead)} className="cursor-pointer text-primary font-normal">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Lead
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
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[10px] border-primary/20 font-bold text-primary tracking-tight">{lead.purpose}</Badge>
                    <Badge 
                        variant={lead.status === 'Active' ? 'success' : lead.status === 'Completed' ? 'secondary' : 'outline'}
                        className={cn("text-[10px] font-bold", lead.status === 'Active' && "animate-status-pulse")}
                    >
                        {lead.status}
                    </Badge>
                </div>
                <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {lead.authenticityStatus?.replace('Verification', '')}
                    </Badge>
                    <Badge variant={lead.publicVisibility === 'Published' ? 'eligible' : 'outline'} className="text-[10px] font-bold flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {lead.publicVisibility || 'Hold'}
                    </Badge>
                </div>
                <div className={cn(
                    "text-[10px] font-bold tracking-tight flex items-center gap-1.5", 
                    isUrgent ? 'text-red-600 animate-in fade-in slide-in-from-left' : isHigh ? 'text-orange-600' : 'text-primary'
                )}>
                    {getPriorityIcon(priorityLabel)}
                    {priorityLabel} Priority
                </div>
            </div>
            <CardDescription className="text-[10px] font-bold tracking-tight text-muted-foreground pt-1">{lead.startDate} To {lead.endDate}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 p-4 pt-0 font-normal text-primary">
              {(lead.targetAmount || 0) > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold opacity-60 tracking-tight">
                        <span>Raised: ₹{lead.collected.toLocaleString('en-IN')}</span>
                        <span>{Math.round(lead.progress)}%</span>
                    </div>
                    <Progress value={lead.progress} className="h-1.5" />
                    <p className="text-center text-[10px] text-muted-foreground font-bold tracking-tight">Goal: ₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</p>
                </div>
            )}
        </CardContent>
         <CardFooter className="p-2 border-t bg-primary/5">
            <Button asChild className="w-full text-xs font-bold tracking-tight hover:bg-primary hover:text-white text-primary shadow-none" size="sm" variant="ghost">
                <Link href={`/leads-members/${lead.id}/summary`}>
                    View Detailed Summary
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
  const [authenticityFilter, setAuthenticityFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
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
    const activeCampaignsList = (campaignsWithProgress || [])
      .filter(c => c.status === 'Active' || c.status === 'Upcoming')
      .map(c => {
          const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
          const isUrgent = c.priority === 'Urgent';
          const isHigh = c.priority === 'High';
          return {
              id: c.id,
              text: `${c.status === 'Active' ? 'Active' : 'Upcoming'} Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              priority: c.priority || 'Medium',
              priorityIcon: getPriorityIcon(c.priority),
              isUrgent,
              isHigh,
              href: `/campaign-members/${c.id}/summary`,
          };
      });
    
    const activeLeadsList = (leadsWithProgress || [])
      .filter(l => l.status === 'Active' || l.status === 'Upcoming')
      .map(l => {
          const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
          const isUrgent = l.priority === 'Urgent';
          const isHigh = l.priority === 'High';
          return {
              id: l.id,
              text: `${l.status === 'Active' ? 'Active' : 'Upcoming'} Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              priority: l.priority || 'Medium',
              priorityIcon: getPriorityIcon(l.priority),
              isUrgent,
              isHigh,
              href: `/leads-members/${l.id}/summary`,
          };
      });

    return [...activeCampaignsList, ...activeLeadsList].sort((a, b) => 
        (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
    );
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

  const handleStatusUpdate = async (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility' | 'priority', value: string) => {
    if (!firestore || !canUpdate) return;
    const docRef = doc(firestore, 'leads', leadToUpdate.id);
    const updateData = { [field]: value };
    updateDoc(docRef, updateData)
        .then(() => toast({ title: 'Success', description: `Lead Details Updated.`, variant: 'success' }))
        .catch((serverError: any) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  const filteredLeads = useMemo(() => {
    if (!leadsWithProgress) return [];
    let items = leadsWithProgress.filter(l => 
        (statusFilter === 'All' || l.status === statusFilter) &&
        (purposeFilter === 'All' || l.purpose === purposeFilter) &&
        (authenticityFilter === 'All' || l.authenticityStatus === authenticityFilter) &&
        (visibilityFilter === 'All' || l.publicVisibility === visibilityFilter) &&
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
    return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leadsWithProgress, searchTerm, statusFilter, purposeFilter, authenticityFilter, visibilityFilter, dateRange, selectedYear]);

  const sections = useMemo(() => [
    { id: 'ongoing_upcoming', title: 'Ongoing & Upcoming Leads', icon: Clock, items: filteredLeads.filter(c => c.status === 'Active' || c.status === 'Upcoming') },
    { id: 'completed', title: 'Closed Appeals', icon: CheckCircle2, items: filteredLeads.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0), [filteredLeads]);

  const isLoading = isProfileLoading || isDeleting || isDataLoading;
  
  if (isLoading) return <SectionLoader label="Loading Individual Leads..." description="Retrieving Support Appeals And Vetting Status." />;

  if (!isLoading && userProfile && !canViewLeads) {
    return (
      <main className="container mx-auto p-4 md:p-8 text-primary font-normal">
        <div className="mb-4"><Button variant="secondary" asChild className="border-primary/20 font-bold text-primary transition-transform active:scale-95"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Home</Link></Button></div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="font-bold">Access Denied</AlertTitle>
          <AlertDescription className="font-normal text-primary/70">Missing Permissions To Manage Leads.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 space-y-6 text-primary font-normal">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="secondary" asChild size="sm" className="interactive-hover font-bold border-primary/20 transition-transform active:scale-95"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && <Button asChild size="sm" className="font-bold tracking-tight interactive-hover shadow-none active:scale-95 transition-transform"><Link href="/leads-members/create"><Plus className="mr-2 h-4 w-4" /> New Appeal</Link></Button>}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Individual Leads</h1>
          <p className="text-sm max-w-2xl font-bold leading-relaxed opacity-70">Vetting And Managing Individual Cases Requiring Organizational Support.</p>
        </div>

        <div className="space-y-2">
          <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
          <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
        </div>

        <Card className="animate-fade-in-zoom shadow-none border-primary/5 bg-white/30 overflow-hidden">
          <CardHeader className="p-4 border-b bg-primary/5">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex flex-nowrap items-center gap-3 pb-2">
                    <Input placeholder="Search appeals..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px] h-9 text-xs border-primary/20 focus-visible:ring-primary font-normal text-primary" disabled={isLoading}/>
                    <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Statuses</SelectItem><SelectItem value="Active" className="font-normal">Active</SelectItem><SelectItem value="Completed" className="font-normal">Completed</SelectItem><SelectItem value="Upcoming" className="font-normal">Upcoming</SelectItem></SelectContent></Select>
                    <Select value={purposeFilter} onValueChange={setPurposeFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs border-primary/20 font-normal text-primary"><SelectValue placeholder="All Purposes" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Purposes</SelectItem>{[...new Set((leadsWithProgress || []).map(l => l.purpose))].map(p => <SelectItem key={p} value={p} className="font-normal">{p}</SelectItem>)}</SelectContent></Select>
                    <Select value={authenticityFilter} onValueChange={setAuthenticityFilter} disabled={isLoading}><SelectTrigger className="w-[150px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Authenticity" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Authenticity</SelectItem><SelectItem value="Pending Verification" className="font-normal">Pending</SelectItem><SelectItem value="Verified" className="font-normal text-primary">Verified</SelectItem><SelectItem value="On Hold" className="font-normal">On Hold</SelectItem><SelectItem value="Rejected" className="font-normal text-destructive">Rejected</SelectItem><SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem></SelectContent></Select>
                    <Select value={visibilityFilter} onValueChange={setVisibilityFilter} disabled={isLoading}><SelectTrigger className="w-[150px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Visibilities" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Visibilities</SelectItem><SelectItem value="Hold" className="font-normal">Hold (Private)</SelectItem><SelectItem value="Ready to Publish" className="font-normal">Ready To Publish</SelectItem><SelectItem value="Published" className="font-normal">Published</SelectItem></SelectContent></Select>
                    <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1">
                        <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y} className="font-normal">{y}</SelectItem>)}</SelectContent></Select>
                        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal border-primary/20 text-primary", !dateRange ? "opacity-60" : "")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Date Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                        {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-card/30">
            {(sections && sections.length > 0) ? (
              <Accordion type="multiple" defaultValue={['ongoing_upcoming']} className="space-y-6">
                {sections.map(section => (
                  <AccordionItem key={section.id} value={section.id} className="border-primary/10 rounded-xl px-4 bg-white shadow-none overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-5 group font-bold">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-1 bg-primary rounded-full group-data-[state=closed]:opacity-50" />
                        <div className="flex items-center gap-2">
                            <section.icon className="h-5 w-5 text-primary" />
                            <span className="text-lg font-bold tracking-tight text-primary">{section.title}</span>
                        </div>
                        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{section.items.length}</span>
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
                  <Lightbulb className="h-12 w-12 mx-auto text-primary/20 mb-4" />
                  <p className="font-bold text-sm opacity-60 text-primary tracking-widest text-center">No Appeals Found Matching Criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive">Delete Appeal?</AlertDialogTitle><AlertDialogDescription className="font-bold opacity-80 text-primary/70">Permanently Erase All Data For '{leadToDelete?.name}'? This Action Cannot Be Undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90 transition-transform active:scale-95">Confirm Deletion</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
        
      <CopyLeadDialog open={!!leadToCopy} onOpenChange={() => setLeadToCopy(null)} lead={leadToCopy} onCopyConfirm={async (opt) => { const res = await copyLeadAction({ sourceLeadId: leadToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); setLeadToCopy(null); }}/>
    </>
  );
}
