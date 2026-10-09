'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, Calendar as CalendarIcon, X, GraduationCap, HeartPulse, LifeBuoy, Info, Lightbulb, Globe, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowUpCircle, MinusCircle, ArrowDownCircle, FileLock, Loader2, Filter, Check, ChevronDown, Search } from 'lucide-react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc, collection } from 'firebase/firestore';
import type { Lead, Donation } from '@/lib/types';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CopyLeadDialog } from '@/components/copy-lead-dialog';
import { copyLeadAction, deleteLeadAction } from './actions';
import { cn, getNestedValue, getImageSrc, isDonationLinkedToInitiative, getDonationLinkForInitiative } from '@/lib/utils';
import { priorityLevels, donationCategories } from '@/lib/modules';
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';
import { BrandedLoader } from '@/components/branded-loader';
import { getDefaultImage } from '@/lib/default-images';
import { PurposePlaceholder } from '@/components/purpose-placeholder';
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

function LeadCard({ lead, index, router, canUpdate, canCreate, canDelete, handleStatusUpdate, handleCopyClick, handleDeleteClick }: LeadCardProps) {
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
                "flex flex-col overflow-hidden h-full group border-primary/10 bg-white shadow-none animate-fade-in-up transition-all duration-500 hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1 cursor-pointer",
                isUrgent && "animate-urgent-pulse border-red-500/50 hover:border-red-500",
                isHigh && "animate-high-pulse border-orange-500/50 hover:border-orange-500"
            )}
            style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
            onClick={() => router.push(`/leads-members/${lead.id}/summary`)}
        >
          <div className="relative h-32 w-full bg-secondary flex items-center justify-center border-b border-primary/5">
            {lead.showCustomImage !== false && lead.imageUrl ? (
              <Image
                  src={getImageSrc(lead.imageUrl)}
                  alt={lead.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <PurposePlaceholder purpose={lead.purpose} category={lead.category} />
            )}
          </div>
          <CardHeader className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 tracking-tight text-primary leading-tight">{lead.name}</CardTitle>
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
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Appeal Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.status} onValueChange={(value) => handleStatusUpdate(lead, 'status', value)}>
                                                <DropdownMenuRadioItem value="Upcoming" className="font-normal">Upcoming</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Active" className="font-normal text-primary">Active</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Completed" className="font-normal">Completed</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Check Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={lead.authenticityStatus} onValueChange={(value) => handleStatusUpdate(lead, 'authenticityStatus', value as string)}>
                                                <DropdownMenuRadioItem value="Pending Verification" className="font-normal">Pending Verification</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified" className="font-normal text-primary">Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="On Hold" className="font-normal">On Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Rejected" className="text-destructive font-normal">Rejected</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details" className="font-normal">Need Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Show on Website</span></DropdownMenuSubTrigger>
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
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-normal cursor-pointer">
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs border-primary/20 font-bold text-primary tracking-tight px-2.5 py-0.5">{lead.purpose}</Badge>
                        <Badge variant="outline" className="text-xs font-bold tracking-tight border-primary/20 text-primary bg-primary/5 px-2.5 py-0.5">
                            ID: {lead.id}
                        </Badge>
                        {lead.caseId && (
                            <Badge variant="outline" className="text-xs font-bold tracking-tight border-emerald-500/30 text-emerald-800 bg-emerald-50 px-2.5 py-0.5">
                                Case ID: {lead.caseId}
                            </Badge>
                        )}
                    </div>
                    <Badge 
                        variant={lead.status === 'Active' ? 'success' : lead.status === 'Completed' ? 'secondary' : 'outline'}
                        className={cn("text-xs font-bold px-2.5 py-0.5", lead.status === 'Active' && "animate-status-pulse")}
                    >
                        {lead.status}
                    </Badge>
                </div>
                <div className="flex justify-between items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-bold border-primary/20 text-primary flex items-center gap-1 px-2.5 py-0.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {lead.authenticityStatus?.replace('Verification', '')}
                    </Badge>
                    <Badge variant={lead.publicVisibility === 'Published' ? 'eligible' : 'outline'} className="text-xs font-bold flex items-center gap-1 px-2.5 py-0.5">
                        <Globe className="h-3.5 w-3.5" />
                        {lead.publicVisibility || 'Hold'}
                    </Badge>
                </div>
                <div className={cn(
                    "text-xs font-bold tracking-tight flex items-center gap-1.5", 
                    isUrgent ? 'text-red-600' : isHigh ? 'text-orange-600' : 'text-primary'
                )}>
                    {getPriorityIcon(priorityLabel)}
                    {priorityLabel} Priority
                </div>
            </div>
            <CardDescription className="text-xs font-bold tracking-tight text-muted-foreground pt-1">{lead.startDate} To {lead.endDate}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 p-4 pt-0 font-normal text-primary">
            <div className="space-y-2 border-t border-primary/5 pt-3">
                <div className="flex justify-between items-baseline text-[11px] font-bold text-primary tracking-tight">
                    <span className="opacity-60">Collected: ₹{lead.collected.toLocaleString('en-IN')}</span>
                    <span className="text-sm">Target: ₹{(lead.targetAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="relative">
                    <Progress 
                        value={lead.progress} 
                        className={cn(
                            "h-2 bg-primary/10 shadow-inner overflow-hidden",
                            lead.progress >= 100 && "bg-emerald-100"
                        )} 
                    />
                    {lead.progress >= 100 && (
                        <div className="absolute inset-0 bg-emerald-400/20 animate-pulse pointer-events-none" />
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-muted-foreground tracking-tight">Progress</span>
                    <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all duration-300",
                        lead.progress >= 100 
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                            : "bg-primary/5 text-primary border-primary/10"
                    )}>
                        {Math.round(lead.progress)}% {lead.progress >= 100 ? 'Goal Reached' : 'Funded'}
                    </span>
                </div>
            </div>
        </CardContent>
         <CardFooter className="p-2 border-t bg-primary/5">
            <Button asChild className="w-full text-xs font-bold tracking-tight text-primary shadow-none transition-all duration-300 hover:bg-primary/10" size="sm" variant="ghost">
                <Link href={`/leads-members/${lead.id}/summary`}>
                    View Summary
                </Link>
            </Button>
        </CardFooter>
        </Card>
    );
}

function MultiSelectFilter({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (val: string[]) => void }) {
    const handleToggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
        onChange(next);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs border-primary/10 text-primary rounded-[10px] bg-white font-bold transition-all hover:border-primary/30 min-w-[130px] justify-between shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                        <Filter className={cn("h-3 w-3 shrink-0", selected.length > 0 ? "text-primary opacity-100" : "opacity-40")} />
                        <span className="truncate">{selected.length === 0 ? `All ${title}s` : `${selected.length} ${title}${selected.length > 1 ? 's' : ''}`}</span>
                    </div>
                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 rounded-[12px] shadow-dropdown border-primary/10 overflow-hidden" align="start">
                <Command className="w-full">
                    <CommandInput placeholder={`Search ${title}...`} className="h-9 text-xs font-normal px-3 outline-none w-full border-b" />
                    <CommandList className="max-h-[300px] overflow-y-auto p-1 touch-auto">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-normal">No results found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem 
                                value={`all_${title}`}
                                onSelect={() => onChange([])} 
                                onPointerDown={(e) => { e.preventDefault(); onChange([]); }}
                                onClick={(e) => { e.preventDefault(); onChange([]); }}
                                className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-primary/5 cursor-pointer font-bold text-xs mb-1 select-none"
                            >
                                <div className={cn("flex h-4 w-4 items-center justify-center rounded border border-primary transition-colors pointer-events-none", selected.length === 0 ? "bg-primary text-white" : "bg-transparent")}>
                                    {selected.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="flex-1 truncate pointer-events-none">All {title}s</span>
                            </CommandItem>
                            
                            <div className="h-px bg-primary/5 my-1" />

                            {options.map((opt) => (
                                <CommandItem 
                                    key={opt}
                                    value={opt}
                                    onSelect={() => handleToggle(opt)} 
                                    onPointerDown={(e) => { e.preventDefault(); handleToggle(opt); }}
                                    onClick={(e) => { e.preventDefault(); handleToggle(opt); }}
                                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-primary/5 cursor-pointer font-medium text-xs select-none"
                                >
                                    <div className={cn("flex h-4 w-4 items-center justify-center rounded border border-primary transition-colors pointer-events-none", selected.includes(opt) ? "bg-primary text-white" : "bg-transparent")}>
                                        {selected.includes(opt) && <Check className="h-3 w-3 stroke-[3]" />}
                                    </div>
                                    <span className="flex-1 truncate pointer-events-none">{opt}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {selected.length > 0 && (
                        <div className="p-1 border-t bg-primary/[0.02]">
                            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="w-full h-8 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md">
                                Clear All Selections
                            </Button>
                        </div>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function LeadSectionCarousel({ items, router, canUpdate, canCreate, canDelete, handleStatusUpdate, setLeadToCopy, setLeadToDelete }: any) {
  const autoplayPlugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }));
  return (
    <Carousel
      opts={{ align: "start", loop: true }}
      plugins={[autoplayPlugin.current]}
      className="w-full relative"
    >
      <CarouselContent className="-ml-4">
        {items.map((lead: any, idx: number) => (
          <CarouselItem key={lead.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
            <LeadCard lead={lead} index={idx} router={router} canUpdate={canUpdate} canCreate={canCreate} canDelete={canDelete} handleStatusUpdate={handleStatusUpdate} handleCopyClick={setLeadToCopy} handleDeleteClick={setLeadToDelete}/>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex items-center justify-center gap-4 mt-8">
          <CarouselPrevious className="static translate-y-0 h-10 w-10 border-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-500 shadow-sm" />
          <CarouselNext className="static translate-y-0 h-10 w-10 border-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-500 shadow-sm" />
      </div>
    </Carousel>
  );
}

export default function LeadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const targetId = searchParams.get('id') || searchParams.get('highlight');

  useEffect(() => {
    if (targetId) {
      setSearchTerm(targetId);
    }
  }, [targetId]);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [purposeFilter, setPurposeFilter] = useState<string[]>([]);
  const [authenticityFilter, setAuthenticityFilter] = useState<string[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [leadToCopy, setLeadToCopy] = useState<Lead | null>(null);
  
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const allLeadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
  const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);

  const { data: rawLeads, isLoading: areLeadsLoading } = useCollection<Lead>(allLeadsRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsRef);

  const leadsWithProgress = useMemo(() => {
    if (!rawLeads || !donations) return [];
    
    return rawLeads.map(lead => {
        const leadDonations = donations.filter(d => 
            d.status === 'Verified' && 
            isDonationLinkedToInitiative(d, lead.id, lead.caseId, 'lead')
        );

        let collected = 0;
        const allowedTypes = lead.allowedDonationTypes && lead.allowedDonationTypes.length > 0
            ? lead.allowedDonationTypes
            : [...donationCategories];

        leadDonations.forEach(d => {
            let amountForThis = 0;
            const link = getDonationLinkForInitiative(d, lead.id, lead.caseId, 'lead');

            if (link) {
                amountForThis = link.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && ((d as any).leadId === lead.id || d.caseId === lead.caseId)) {
                amountForThis = d.amount;
            }

            if (amountForThis <= 0) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportion = amountForThis / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as any, amount: d.amount, forFundraising: true }] : [{ category: 'Sadaqah', amount: d.amount, forFundraising: true }]);
            
            splits.forEach((split: any) => {
                const rawCategory = (split.category as string || '').trim();
                const normalizedCategory = rawCategory === 'General' || rawCategory === 'Sadqa' ? 'Sadaqah' : rawCategory;
                
                const isAllowed = allowedTypes.some(t => t.toLowerCase() === normalizedCategory.toLowerCase());
                
                if (isAllowed) {
                    const isForFundraising = normalizedCategory.toLowerCase() !== 'zakat' || split.forFundraising !== false;
                    if (isForFundraising) {
                        collected += split.amount * proportion;
                    }
                }
            });
        });

        const docCollected = Number(lead.collectedAmount || (lead as any).collected || (lead as any).raisedAmount || 0);
        const target = Number(lead.targetAmount) || 0;
        const isCompleted = lead.status === 'Completed' || lead.status === 'Closed' || lead.status === 'Archived';

        let finalCollected = Math.max(collected, docCollected);
        if (isCompleted && finalCollected < target && target > 0) {
            finalCollected = target;
        }

        const rawProgress = target > 0 ? (finalCollected / target) * 100 : (isCompleted ? 100 : 0);
        const progress = isCompleted ? Math.max(rawProgress, 100) : rawProgress;
        return { ...lead, collected: finalCollected, progress: Math.min(progress, 100) };
    });
  }, [rawLeads, donations]);

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
    setIsSubmitting(true);
    try {
        const result = await deleteLeadAction(leadToDelete.id);
        toast({ title: result.success ? 'Success' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
    } finally {
        setIsSubmitting(false);
        setLeadToDelete(null);
    }
  };

  const handleStatusUpdate = async (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility' | 'priority', value: string) => {
    if (!firestore || !canUpdate) return;
    setIsSubmitting(true);
    const docRef = doc(firestore, 'leads', leadToUpdate.id);
    const updateData = { [field]: value };
    try {
        await updateDoc(docRef, updateData);
        toast({ title: 'Success', description: `Lead Details Updated.`, variant: 'success' });
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsSubmitting(false);
    }
  };

  const isCompletedStatus = (s?: string) => s === 'Completed' || s === 'Closed' || s === 'Finished' || s === 'Archived' || s === 'completed' || s === 'closed';

  const filteredLeads = useMemo(() => {
    if (!leadsWithProgress) return [];
    let items = [...leadsWithProgress].filter(l => {
        const matchesStatus = statusFilter.length === 0 || statusFilter.some(sf => {
            if (sf === 'Completed' || sf === 'Closed' || sf === 'Archived') return isCompletedStatus(l.status);
            return l.status === sf;
        });
        const matchesPurpose = purposeFilter.length === 0 || purposeFilter.includes(l.purpose);
        const matchesAuth = authenticityFilter.length === 0 || authenticityFilter.includes(l.authenticityStatus || 'Pending Verification');
        const matchesVisibility = visibilityFilter.length === 0 || visibilityFilter.includes(l.publicVisibility || 'Hold');
        const matchesSearch = searchTerm === '' ||
          (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (l.caseId && l.caseId.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (l.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch && matchesStatus && matchesPurpose && matchesAuth && matchesVisibility;
    });

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

  const sections = useMemo(() => {
    const ongoing = filteredLeads.filter(l => !isCompletedStatus(l.status));
    const completed = filteredLeads.filter(l => isCompletedStatus(l.status));

    const ongoingPublished = ongoing.filter(l => l.publicVisibility === 'Published');
    const ongoingInternal = ongoing.filter(l => l.publicVisibility !== 'Published');

    const sortByPriority = (list: any[]) => [...list].sort((a, b) => (priorityWeight[b.priority || 'Medium'] || 0) - (priorityWeight[a.priority || 'Medium'] || 0));

    return [
      { id: 'published', title: 'Live on Website', icon: Globe, items: sortByPriority(ongoingPublished), color: 'text-primary' },
      { id: 'internal', title: 'Working / Not Live', icon: FileLock, items: sortByPriority(ongoingInternal), color: 'text-amber-600' },
      { id: 'completed', title: 'Archived Appeals', icon: CheckCircle2, items: sortByPriority(completed), color: 'text-muted-foreground' }
    ].filter(s => s.items.length > 0);
  }, [filteredLeads]);

  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const isLoading = isProfileLoading || areLeadsLoading || areDonationsLoading;
  
  if (isLoading && !isSubmitting) return <SectionLoader label="Loading Individual Leads..." description="Retrieving support appeals and verifying progress." />;

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
      {(isSubmitting || isLoading) && <BrandedLoader message={isSubmitting ? "Updating Appeal Hub..." : "Syncing Registry Data..."} />}
      <main className="container mx-auto p-4 sm:p-6 space-y-6 text-primary font-normal relative">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 transition-transform active:scale-95 text-primary rounded-xl px-5 h-9"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && <Button asChild size="sm" className="font-bold tracking-tight shadow-none active:scale-95 transition-transform rounded-xl px-5 h-9"><Link href="/leads-members/create"><Plus className="mr-2 h-4 w-4" /> New Appeal</Link></Button>}
        </div>

        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-primary">Manage Help Requests</h1>
          <p className="text-sm font-bold opacity-70 leading-relaxed max-w-2xl">Review community help requests, check details, and manage archives.</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-primary/10 shadow-sm">
          <ScrollArea className="w-full">
              <div className="flex flex-nowrap items-center gap-3 pb-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative w-[180px] sm:w-[220px]">
                          <Input 
                              placeholder="Search appeals..." 
                              value={searchTerm} 
                              onChange={(e) => setSearchTerm(e.target.value)} 
                              className="pl-8 pr-7 h-9 text-xs border-primary/20 focus-visible:ring-primary font-normal text-primary bg-white/50 rounded-xl" 
                              disabled={isLoading}
                          />
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary opacity-40" />
                          {searchTerm && (
                              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary p-0.5">
                                  <X className="h-3 w-3" />
                              </button>
                          )}
                      </div>
                      <Button 
                          type="button" 
                          size="sm" 
                          className="h-9 px-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1 shrink-0"
                          disabled={isLoading}
                      >
                          <Search className="h-3 w-3" />
                          Search
                      </Button>
                  </div>
                  
                  <MultiSelectFilter 
                      title="Status" 
                      options={['Active', 'Completed', 'Upcoming', 'Draft']} 
                      selected={statusFilter} 
                      onChange={setStatusFilter} 
                  />

                  <MultiSelectFilter 
                      title="Purpose" 
                      options={['Education', 'Medical', 'Relief', 'Ration', 'General', 'Zakat']} 
                      selected={purposeFilter} 
                      onChange={setPurposeFilter} 
                  />

                  <MultiSelectFilter 
                      title="Authenticity" 
                      options={['Pending Verification', 'Verified', 'On Hold', 'Rejected', 'Need More Details']} 
                      selected={authenticityFilter} 
                      onChange={setAuthenticityFilter} 
                  />

                  <MultiSelectFilter 
                      title="Visibility" 
                      options={['Hold', 'Ready to Publish', 'Published']} 
                      selected={visibilityFilter} 
                      onChange={setVisibilityFilter} 
                  />
                  <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1 group">
                      <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs text-primary font-bold bg-white/50 border-primary/10 hover:border-primary/30 transition-all rounded-xl"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent className="rounded-xl shadow-dropdown"><SelectItem value="All" className="font-normal text-xs">All Years</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y} className="font-normal text-xs">{y}</SelectItem>)}</SelectContent></Select>
                      <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-4 text-xs font-bold border-primary/10 text-primary bg-white/50 hover:bg-white transition-all rounded-xl", !dateRange ? "opacity-60" : "border-primary/40")} disabled={isLoading}><CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-40" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                      {(selectedYear !== 'All' || dateRange || statusFilter.length > 0 || purposeFilter.length > 0 || authenticityFilter.length > 0 || visibilityFilter.length > 0 || searchTerm) && (
                          <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-9 px-3 text-[10px] font-bold text-destructive hover:bg-destructive/10 rounded-xl" 
                              onClick={() => { 
                                  setSelectedYear('All'); 
                                  setDateRange(undefined); 
                                  setStatusFilter([]);
                                  setPurposeFilter([]);
                                  setAuthenticityFilter([]);
                                  setVisibilityFilter([]);
                                  setSearchTerm('');
                              }}
                          >
                              <X className="h-3.5 w-3.5 mr-1" /> Reset
                          </Button>
                      )}
                  </div>
              </div>
              <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        {(sections && sections.length > 0) ? (
          <Accordion type="multiple" value={expandedSections} onValueChange={setExpandedSections} className="space-y-6">
            {sections.map(section => (
              <AccordionItem key={section.id} value={section.id} className="border border-primary/10 rounded-2xl px-4 sm:px-6 bg-white shadow-sm overflow-hidden transition-all duration-300">
                <AccordionTrigger className="hover:no-underline py-6 group font-bold">
                  <div className="flex items-center gap-4">
                    <div className={cn("h-8 w-1 rounded-full group-data-[state=closed]:opacity-50 transition-all", section.id === 'published' ? 'bg-primary' : section.id === 'internal' ? 'bg-amber-600' : 'bg-muted-foreground')} />
                    <div className="flex items-center gap-2">
                        <section.icon className={cn("h-5 w-5 group-hover:rotate-6 transition-transform", section.color || "text-primary")} />
                        <span className={cn("text-lg font-bold tracking-tight", section.color || "text-primary")}>{section.title}</span>
                    </div>
                    <Badge variant="secondary" className="rounded-full h-5 text-[10px] font-bold bg-primary/10 text-primary">{section.items.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-8 px-2 sm:px-6">
                  <LeadSectionCarousel 
                    items={section.items} 
                    router={router} 
                    canUpdate={canUpdate} 
                    canCreate={canCreate} 
                    canDelete={canDelete} 
                    handleStatusUpdate={handleStatusUpdate} 
                    setLeadToCopy={setLeadToCopy} 
                    setLeadToDelete={setLeadToDelete}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-20 px-6 bg-white rounded-2xl border-2 border-dashed border-primary/15 shadow-sm space-y-4">
              <Lightbulb className="h-16 w-16 mx-auto text-primary/20" />
              <h3 className="text-lg font-bold text-primary">No Appeals Found</h3>
              <p className="text-xs font-bold text-muted-foreground max-w-sm mx-auto">No help requests match your current filters. Try resetting your search filters.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="font-bold border-primary/20 text-primary hover:bg-primary/5 rounded-xl mt-2" 
                onClick={() => { setSelectedYear('All'); setDateRange(undefined); setStatusFilter([]); setPurposeFilter([]); setAuthenticityFilter([]); setVisibilityFilter([]); setSearchTerm(''); }}
              >
                <X className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters
              </Button>
          </div>
        )}
      </main>
      
      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent className="rounded-[24px] border-primary/10 shadow-dropdown"><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive tracking-tight">Delete Appeal?</AlertDialogTitle><AlertDialogDescription className="font-bold opacity-80 text-primary/70">Permanently Erase All Data For '{leadToDelete?.name}'? This Action Cannot Be Undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90 transition-transform active:scale-95 rounded-xl">Confirm Deletion</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
        
      <CopyLeadDialog open={!!leadToCopy} onOpenChange={() => setLeadToCopy(null)} lead={leadToCopy} onCopyConfirm={async (opt) => { setIsSubmitting(true); try { const res = await copyLeadAction({ sourceLeadId: leadToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); } finally { setIsSubmitting(false); setLeadToCopy(null); } }}/>
    </>
  );
}
