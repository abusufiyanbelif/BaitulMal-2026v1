'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X, Utensils, LifeBuoy, ChevronDown, Globe, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowUpCircle, MinusCircle, ArrowDownCircle, FileLock } from 'lucide-react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc, collection } from 'firebase/firestore';
import type { Campaign, Donation } from '@/lib/types';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CopyCampaignDialog } from '@/components/copy-campaign-dialog';
import { copyCampaignAction, deleteCampaignAction } from './actions';
import { cn, getNestedValue } from '@/lib/utils';
import { priorityLevels } from '@/lib/modules';
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from '@/components/news-ticker';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';
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

interface CampaignCardProps {
    campaign: Campaign & { collected: number; progress: number; };
    index: number;
    router: ReturnType<typeof useRouter>;
    canUpdate: boolean;
    canCreate: boolean;
    canDelete: boolean;
    handleStatusUpdate: (campaignToUpdate: Campaign, field: 'status' | 'authenticityStatus' | 'publicVisibility' | 'priority', value: string) => Promise<void>;
    handleCopyClick: (campaign: Campaign) => void;
    handleDeleteClick: (campaign: Campaign) => void;
}

function CampaignCard({ campaign, index, router, canUpdate, canCreate, canDelete, handleStatusUpdate, handleCopyClick, handleDeleteClick }: CampaignCardProps) {
    const FallbackIcon = campaign.category === 'Ration' ? Utensils : campaign.category === 'Relief' ? LifeBuoy : HandHelping;
    const priorityLabel = campaign.priority || 'Medium';
    const isCompleted = campaign.status === 'Completed';
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
            onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)}
        >
          <div className="relative h-32 w-full bg-secondary flex items-center justify-center border-b border-primary/5">
            {campaign.imageUrl ? (
                <Image
                  src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`}
                  alt={campaign.name}
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
                <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2 tracking-tight text-primary">
                    {campaign.name}
                </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-[12px] border-primary/10 shadow-dropdown">
                        <DropdownMenuItem onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)} className="cursor-pointer text-primary font-normal">
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
                                            <DropdownMenuRadioGroup value={campaign.status} onValueChange={(value) => handleStatusUpdate(campaign, 'status', value)}>
                                                <DropdownMenuRadioItem value="Upcoming" className="font-normal">Upcoming</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Active" className="font-normal text-primary">Active</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Completed" className="font-normal">Completed</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Verification Status</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={campaign.authenticityStatus} onValueChange={(value) => handleStatusUpdate(campaign, 'authenticityStatus', value as string)}>
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
                                    <DropdownMenuSubTrigger className="text-primary font-normal"><span>Public Visibility</span></DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown">
                                            <DropdownMenuRadioGroup value={campaign.publicVisibility} onValueChange={(value) => handleStatusUpdate(campaign, 'publicVisibility', value as string)}>
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
                                            <DropdownMenuRadioGroup value={campaign.priority} onValueChange={(value) => handleStatusUpdate(campaign, 'priority', value)}>
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
                            <DropdownMenuItem onClick={() => handleCopyClick(campaign)} className="cursor-pointer text-primary font-normal">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Campaign
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(campaign); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-normal cursor-pointer">
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
                    <Badge variant="secondary" className="text-[10px] font-bold tracking-tight">{campaign.category}</Badge>
                    <Badge 
                        variant={campaign.status === 'Active' ? 'success' : 'outline'}
                        className={cn("text-[10px] font-bold", campaign.status === 'Active' && "animate-status-pulse")}
                    >
                        {campaign.status}
                    </Badge>
                </div>
                <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {campaign.authenticityStatus?.replace('Verification', '')}
                    </Badge>
                    <Badge variant={campaign.publicVisibility === 'Published' ? 'eligible' : 'outline'} className="text-[10px] font-bold flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {campaign.publicVisibility || 'Hold'}
                    </Badge>
                </div>
                <div className={cn(
                    "text-[10px] font-bold tracking-tight flex items-center gap-1.5", 
                    isUrgent ? 'text-red-600' : isHigh ? 'text-orange-600' : 'text-primary'
                )}>
                    {getPriorityIcon(priorityLabel)}
                    {priorityLabel} Priority
                </div>
            </div>
            <CardDescription className="text-[10px] font-bold tracking-tight text-muted-foreground pt-1">{campaign.startDate} To {campaign.endDate}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-3 p-4 pt-0 font-normal text-primary">
            <div className="space-y-2 border-t border-primary/5 pt-3">
                <div className="flex justify-between items-baseline text-[11px] font-bold text-primary tracking-tight">
                    <span className="opacity-60">Raised: ₹{campaign.collected.toLocaleString('en-IN')}</span>
                    <span className="text-sm">Goal: ₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <Progress value={campaign.progress} className="h-2 bg-primary/10 shadow-inner" />
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-muted-foreground tracking-tight">Progress</span>
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10">
                        {Math.round(campaign.progress)}% Funded
                    </span>
                </div>
            </div>
          </CardContent>
          <CardFooter className="p-2 border-t bg-primary/5">
            <Button asChild className="w-full text-xs font-bold tracking-tight shadow-none" size="sm" variant="ghost">
                <Link href={`/campaign-members/${campaign.id}/summary`}>
                    View Detailed Summary
                </Link>
            </Button>
          </CardFooter>
        </Card>
    );
}

export default function CampaignPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [authenticityFilter, setAuthenticityFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [campaignToCopy, setCampaignToCopy] = useState<Campaign | null>(null);

  const { userProfile, isLoading: isProfileLoading } = useSession();

  // Full Internal Access: Fetch ALL campaigns for management
  const allCampaignsRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
  const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);

  const { data: rawCampaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(allCampaignsRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsRef);

  const campaignsWithProgress = useMemo(() => {
    if (!rawCampaigns || !donations) return [];
    
    return rawCampaigns.map(campaign => {
        const campaignDonations = donations.filter(d => 
            d.status === 'Verified' && 
            (d.linkSplit?.some(l => l.linkId === campaign.id && l.linkType === 'campaign') || (d as any).campaignId === campaign.id)
        );

        const collected = campaignDonations.reduce((sum, d) => {
            const link = d.linkSplit?.find((l: any) => l.linkId === campaign.id);
            const amountForThis = link ? link.amount : ( (d as any).campaignId === campaign.id ? d.amount : 0 );
            
            const totalDonation = d.amount || 1;
            const proportion = amountForThis / totalDonation;
            const typeSplits = d.typeSplit || [];
            
            const eligibleSum = typeSplits.reduce((acc: number, split: any) => {
                const isAllowed = campaign.allowedDonationTypes?.includes(split.category);
                const isForGoal = split.category !== 'Zakat' || split.forFundraising === true;
                return (isAllowed && isForGoal) ? acc + split.amount : acc;
            }, 0);

            return sum + (eligibleSum * proportion);
        }, 0);

        const progress = campaign.targetAmount ? (collected / campaign.targetAmount) * 100 : 0;
        return { ...campaign, collected, progress };
    });
  }, [rawCampaigns, donations]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    (campaignsWithProgress || []).forEach(c => c.startDate && years.add(c.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [campaignsWithProgress]);
  
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.delete', false);
  const canViewCampaigns = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false);

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    setIsDeleting(true);
    const result = await deleteCampaignAction(campaignToDelete.id);
    toast({ title: result.success ? 'Campaign Deleted' : 'Deletion Failed', description: result.message, variant: result.success ? 'success' : 'destructive' });
    setIsDeleting(false);
    setCampaignToDelete(null);
  };
  
  const handleStatusUpdate = async (campaignToUpdate: Campaign, field: 'status' | 'authenticityStatus' | 'publicVisibility' | 'priority', value: string) => {
    if (!firestore || !canUpdate) return;
    const docRef = doc(firestore, 'campaigns', campaignToUpdate.id);
    const updateData = { [field]: value };
    updateDoc(docRef, updateData)
        .then(() => toast({ title: 'Success', description: `Campaign Details Updated.`, variant: 'success' }))
        .catch((serverError: any) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
            errorEmitter.emit('permission-error', permissionError);
        });
  };
  
  const filteredCampaigns = useMemo(() => {
    if (!campaignsWithProgress) return [];
    let items = campaignsWithProgress.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (categoryFilter === 'All' || c.category === categoryFilter) &&
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
    }
    return items;
  }, [campaignsWithProgress, searchTerm, statusFilter, categoryFilter, authenticityFilter, visibilityFilter, dateRange, selectedYear]);

  const sections = useMemo(() => {
    // 1. Critical Section
    const priorityItems = filteredCampaigns.filter(c => (c.priority === 'Urgent' || c.priority === 'High') && c.status !== 'Completed' && c.authenticityStatus === 'Verified' && c.publicVisibility === 'Published');
    
    // 2. Ongoing Section (Verified & Published)
    const ongoingItems = filteredCampaigns.filter(c => 
        (c.status === 'Active' || c.status === 'Upcoming') && 
        c.authenticityStatus === 'Verified' && 
        c.publicVisibility === 'Published' &&
        !priorityItems.find(p => p.id === c.id)
    );

    // 3. Private & Hold Section (Verified but visibility Hold, or Pending Verification)
    const privateItems = filteredCampaigns.filter(c => 
        c.status !== 'Completed' && 
        (c.publicVisibility !== 'Published' || c.authenticityStatus !== 'Verified') &&
        !priorityItems.find(p => p.id === c.id)
    );

    // 4. Archive
    const completedItems = filteredCampaigns.filter(c => c.status === 'Completed');

    return [
      { id: 'priority', title: 'Critical Initiatives (Urgent & High)', icon: AlertTriangle, items: priorityItems, color: 'text-red-600' },
      { id: 'ongoing', title: 'Public & Ongoing Campaigns', icon: Clock, items: ongoingItems, color: 'text-primary' },
      { id: 'private', title: 'Private & Draft Hub (Internal)', icon: FileLock, items: privateItems, color: 'text-amber-600' },
      { id: 'completed', title: 'Institutional Archive (Completed)', icon: CheckCircle2, items: completedItems, color: 'text-muted-foreground' }
    ].filter(s => s.items.length > 0);
  }, [filteredCampaigns]);

  const isLoading = isProfileLoading || isDeleting || areCampaignsLoading || areDonationsLoading;
  
  if (isLoading) return <SectionLoader label="Loading Campaigns..." description="Fetching institutional records and verifying progress." />;

  if (!isLoading && userProfile && !canViewCampaigns) {
    return (
      <main className="container mx-auto p-4 md:p-8 text-primary font-normal">
        <div className="mb-4"><Button variant="secondary" asChild className="font-bold border-primary/20 transition-transform active:scale-95"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Home</Link></Button></div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="font-bold">Access Denied</AlertTitle>
          <AlertDescription className="font-normal text-primary/70">Missing Permissions To Manage Campaigns.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 space-y-6 text-primary font-normal">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 transition-transform active:scale-95"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && (
            <Button asChild size="sm" className="font-bold active:scale-95 transition-transform shadow-none">
              <Link href="/campaign-members/create"><Plus className="mr-2 h-4 w-4" /> New Campaign</Link>
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Campaign Management</h1>
          <p className="text-sm max-w-2xl font-bold leading-relaxed opacity-70">Monitor fundraising goals, authenticity vetting, and internal drafts.</p>
        </div>

        <Card className="animate-fade-in-zoom shadow-none border-primary/10 bg-white/30 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b bg-primary/5">
            <ScrollArea className="w-full">
                <div className="flex flex-nowrap items-center gap-3 pb-2">
                    <Input placeholder="Search Campaigns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px] h-9 text-xs border-primary/20 focus-visible:ring-primary text-primary font-normal" disabled={isLoading}/>
                    <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Statuses</SelectItem><SelectItem value="Active" className="font-normal">Active</SelectItem><SelectItem value="Completed" className="font-normal">Completed</SelectItem><SelectItem value="Upcoming" className="font-normal">Upcoming</SelectItem></SelectContent></Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs font-normal border-primary/20 text-primary"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Categories</SelectItem><SelectItem value="Ration" className="font-normal">Ration</SelectItem><SelectItem value="Relief" className="font-normal">Relief</SelectItem><SelectItem value="General" className="font-normal">General</SelectItem></SelectContent></Select>
                    <Select value={authenticityFilter} onValueChange={setAuthenticityFilter} disabled={isLoading}><SelectTrigger className="w-[150px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Authenticity" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Authenticity</SelectItem><SelectItem value="Pending Verification" className="font-normal">Pending</SelectItem><SelectItem value="Verified" className="font-normal text-primary">Verified</SelectItem><SelectItem value="On Hold" className="font-normal">On Hold</SelectItem><SelectItem value="Rejected" className="font-normal text-destructive">Rejected</SelectItem><SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem></SelectContent></Select>
                    <Select value={visibilityFilter} onValueChange={setVisibilityFilter} disabled={isLoading}><SelectTrigger className="w-[150px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="All Visibilities" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">All Visibilities</SelectItem><SelectItem value="Hold" className="font-normal">Hold (Private)</SelectItem><SelectItem value="Ready to Publish" className="font-normal">Ready To Publish</SelectItem><SelectItem value="Published" className="font-normal text-primary">Published</SelectItem></SelectContent></Select>
                    <div className="flex items-center gap-2 border-l border-primary/10 pl-3 ml-1">
                        <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs text-primary font-normal"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All" className="font-normal">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y} className="font-normal">{y}</SelectItem>)}</SelectContent></Select>
                        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal border-primary/20 text-primary", !dateRange ? "opacity-60" : "")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Date Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                        {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-card/30">
            {sections.length > 0 ? (
              <Accordion type="multiple" defaultValue={['priority', 'ongoing', 'private']} className="space-y-6">
                {sections.map(section => (
                  <AccordionItem key={section.id} value={section.id} className="border-primary/10 rounded-xl px-4 bg-white shadow-none overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-5 group font-bold">
                      <div className="flex items-center gap-4">
                        <div className={cn("h-8 w-1 rounded-full group-data-[state=closed]:opacity-50", section.id === 'priority' ? 'bg-red-600' : section.id === 'private' ? 'bg-amber-600' : 'bg-primary')} />
                        <div className="flex items-center gap-2">
                            <section.icon className={cn("h-5 w-5", section.color || "text-primary")} />
                            <span className={cn("text-lg font-bold tracking-tight", section.color || "text-primary")}>{section.title}</span>
                        </div>
                        <Badge variant="secondary" className="rounded-full h-5 text-[10px] font-bold bg-primary/10 text-primary">{section.items.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-8 px-2 sm:px-10">
                      <Carousel
                        opts={{ align: "start", loop: true }}
                        plugins={[Autoplay({ delay: 5000, stopOnInteraction: false })]}
                        className="w-full relative"
                      >
                        <CarouselContent className="-ml-4">
                          {section.items.map((campaign, idx) => (
                            <CarouselItem key={campaign.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                              <CampaignCard campaign={campaign} index={idx} router={router} canUpdate={canUpdate} canCreate={canCreate} canDelete={canDelete} handleStatusUpdate={handleStatusUpdate} handleCopyClick={setCampaignToCopy} handleDeleteClick={setCampaignToDelete}/>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <CarouselPrevious className="static translate-y-0 h-10 w-10 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-300" />
                            <CarouselNext className="static translate-y-0 h-10 w-10 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-300" />
                        </div>
                      </Carousel>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-24 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                  <HandHelping className="h-16 w-16 mx-auto text-primary/20 mb-4" />
                  <p className="font-bold tracking-tight text-sm opacity-60 text-primary">No Initiatives Found Matching Filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown"><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive">Delete Initiative?</AlertDialogTitle><AlertDialogDescription className="font-bold opacity-80 text-primary/70">Permanently Erase All Data For '{campaignToDelete?.name}'? This Action Cannot Be Undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90 transition-transform active:scale-95">Confirm Deletion</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <CopyCampaignDialog open={!!campaignToCopy} onOpenChange={() => setCampaignToCopy(null)} campaign={campaignToCopy} onCopyConfirm={async (opt) => { const res = await copyCampaignAction({ sourceCampaignId: campaignToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); setCampaignToCopy(null); }}/>
    </>
  );
}
