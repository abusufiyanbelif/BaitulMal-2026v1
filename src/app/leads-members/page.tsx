'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X } from 'lucide-react';
import { useCollection, useFirestore, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Lead, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

export default function LeadPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [authenticityFilter, setAuthenticityFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  
  // Date filtering state
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [leadToCopy, setLeadToCopy] = useState<Lead | null>(null);
  
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const leadData = useMemo(() => {
    if (!leads || !donations) return [];

    const collectedAmounts = new Map<string, number>();
    const leadsById = new Map(leads.map(l => [l.id, l]));

    donations.forEach(donation => {
        const links = donation.linkSplit || [];
        
        links.forEach(link => {
            if (link.linkType !== 'lead') return;

            const lead = leadsById.get(link.linkId);
            if (!lead) return;

            const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
            const proportionForThisLead = link.amount / totalDonationAmount;

            const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
                ? donation.typeSplit
                : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);
            
            const applicableAmount = typeSplits.reduce((acc, split) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (lead.allowedDonationTypes?.includes(category as DonationCategory)) {
                    return acc + split.amount;
                }
                return acc;
            }, 0);

            const currentCollected = collectedAmounts.get(link.linkId) || 0;
            collectedAmounts.set(link.linkId, currentCollected + (applicableAmount * proportionForThisLead));
        });
    });

    return leads.map(lead => {
        const collected = collectedAmounts.get(lead.id) || 0;
        const progress = lead.targetAmount && lead.targetAmount > 0 ? (collected / lead.targetAmount) * 100 : 0;
        
        return {
            ...lead,
            collected,
            progress
        };
    });
  }, [leads, donations]);

  const availableYears = useMemo(() => {
    if (!leadData) return [new Date().getFullYear().toString()];
    const years = new Set<string>();
    leadData.forEach(l => {
        if (l.startDate) {
            try {
                const y = l.startDate.split('-')[0];
                if (y) years.add(y);
            } catch (e) {}
        }
    });
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [leadData]);

  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.delete', false);
  const canViewLeads = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false);


  const handleDeleteClick = (lead: Lead) => {
    if (!canDelete) return;
    setLeadToDelete(lead);
    setIsDeleteDialogOpen(true);
  };

  const handleCopyClick = (lead: Lead) => {
    if (!canCreate) return;
    setLeadToCopy(lead);
    setIsCopyDialogOpen(true);
  };

  const handleCopyConfirm = async (options: { newName: string; copyBeneficiaries: boolean; copyRationLists: boolean; }) => {
    if (!leadToCopy || !canCreate) return;

    setIsCopyDialogOpen(false);
    toast({ title: 'Copying lead...', description: `Please wait while '${leadToCopy.name}' is being copied.`});
    
    const result = await copyLeadAction({
        sourceLeadId: leadToCopy.id,
        ...options
    });

    if (result.success) {
        toast({ title: 'Lead Copied', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Copy Failed', description: result.message, variant: 'destructive' });
    }

    setLeadToCopy(null);
  };

  const handleDeleteConfirm = async () => {
    if (!leadToDelete || !canDelete) {
        toast({ title: 'Error', description: 'Could not delete lead.', variant: 'destructive'});
        return;
    };

    setIsDeleteDialogOpen(false);
    setIsDeleting(true);

    const result = await deleteLeadAction(leadToDelete.id);

    if (result.success) {
        toast({ title: 'Lead Deleted', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
    setIsDeleting(false);
    setLeadToDelete(null);
  };

  const handleStatusUpdate = async (leadToUpdate: Lead, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => {
    if (!firestore || !canUpdate) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to update leads.', variant: 'destructive'});
        return;
    };

    const docRef = doc(firestore, 'leads', leadToUpdate.id);
    const updatedData = { [field]: value };

    updateDoc(docRef, updatedData)
        .then(() => {
            toast({ title: 'Success', description: `Lead '${leadToUpdate.name}' has been updated.`, variant: 'success' });
        })
        .catch(async (serverError: any) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updatedData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  const filteredAndSortedLeads = useMemo(() => {
    if (!leadData) return [];
    let sortableItems = [...leadData];
    
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(c => c.status === statusFilter);
    }
    if (purposeFilter !== 'All') {
        sortableItems = sortableItems.filter(c => c.purpose === purposeFilter);
    }
    if (authenticityFilter !== 'All') {
        sortableItems = sortableItems.filter(c => (c.authenticityStatus || 'Pending Verification') === authenticityFilter);
    }
    if (visibilityFilter !== 'All') {
        sortableItems = sortableItems.filter(c => (c.publicVisibility || 'Hold') === visibilityFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(c => 
            c.name.toLowerCase().includes(lowercasedTerm)
        );
    }

    // Date Filtering
    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        sortableItems = sortableItems.filter(c => {
            if (!c.startDate) return false;
            try {
                const itemDate = parseISO(c.startDate);
                return itemDate >= from && itemDate <= to;
            } catch (e) { return false; }
        });
    } else {
        if (selectedYear !== 'All') {
            sortableItems = sortableItems.filter(c => c.startDate?.startsWith(selectedYear));
            if (selectedMonth !== 'All') {
                sortableItems = sortableItems.filter(c => c.startDate?.split('-')[1] === selectedMonth);
            }
        }
    }

    return sortableItems;
  }, [leadData, searchTerm, statusFilter, purposeFilter, authenticityFilter, visibilityFilter, dateRange, selectedYear, selectedMonth]);

  const activeLeads = useMemo(() => filteredAndSortedLeads.filter(c => c.status === 'Active').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedLeads]);
  const upcomingLeads = useMemo(() => filteredAndSortedLeads.filter(c => c.status === 'Upcoming').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedLeads]);
  const completedLeads = useMemo(() => filteredAndSortedLeads.filter(c => c.status === 'Completed').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedLeads]);
  
  const isLoading = areLeadsLoading || isProfileLoading || isDeleting || areDonationsLoading;

  const LeadCard = ({ lead, index }: { lead: Lead & { collected: number; progress: number; }, index: number }) => (
    <Card 
        className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden" 
        style={{ animationDelay: `${100 + index * 50}ms`, animationFillMode: 'backwards' }}
        onClick={() => router.push(`/leads-members/${lead.id}/summary`)}
    >
      <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
        {lead.imageUrl ? (
            <Image
              src={lead.imageUrl}
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
                        <DropdownMenuItem
                            onClick={() => handleCopyClick(lead)}
                            className="cursor-pointer"
                        >
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
            <Link href={`/leads-members/${lead.id}/summary`}>
                View Details
            </Link>
        </Button>
    </CardFooter>
    </Card>
  );
  
  if (!isLoading && userProfile && !canViewLeads) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to view leads.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      <main className="container mx-auto p-2 sm:p-4">
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
        <Card className="animate-fade-in-zoom">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="flex-1 space-y-2">
                <CardTitle>Leads ({filteredAndSortedLeads.length})</CardTitle>
                 <div className="flex flex-wrap items-center gap-2">
                    <Input 
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); }}
                        className="max-w-xs"
                        disabled={isLoading}
                    />
                     <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={purposeFilter} onValueChange={(value) => { setPurposeFilter(value); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Purpose" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Purposes</SelectItem>
                            {leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={authenticityFilter} onValueChange={(value) => { setAuthenticityFilter(value); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Authenticity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Authenticity</SelectItem>
                            <SelectItem value="Pending Verification">Pending</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={visibilityFilter} onValueChange={(value) => { setVisibilityFilter(value); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Visibility" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Visibilities</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                            <SelectItem value="Ready to Publish">Ready</SelectItem>
                            <SelectItem value="Published">Published</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 border-l pl-2 ml-2">
                        <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}>
                            <SelectTrigger className="w-[100px] text-xs sm:text-sm"><SelectValue placeholder="Year" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Years</SelectItem>
                                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedMonth} onValueChange={(val) => { setSelectedMonth(val); setDateRange(undefined); }} disabled={isLoading || selectedYear === 'All'}>
                            <SelectTrigger className="w-[120px] text-xs sm:text-sm"><SelectValue placeholder="Month" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Months</SelectItem>
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                    <SelectItem key={m} value={(i + 1).toString().padStart(2, '0')}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal h-10 px-3", !dateRange && "text-muted-foreground")} disabled={isLoading}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">
                                        {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd")) : "Custom Range"}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); setSelectedMonth('All'); } }} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>
                        {(selectedYear !== 'All' || dateRange) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedYear('All'); setSelectedMonth('All'); setDateRange(undefined); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {isLoading && <Skeleton className="h-10 w-44" />}
            {!isLoading && canCreate && (
              <Button asChild>
                <Link href="/leads-members/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Lead
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
              </div>
            ) : (
              <>
                {(statusFilter === 'All' || statusFilter === 'Active') && activeLeads.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Active Leads ({activeLeads.length})</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activeLeads.map((lead, index) => <LeadCard key={lead.id} lead={lead} index={index} />)}
                        </div>
                    </section>
                )}
                {(statusFilter === 'All' || statusFilter === 'Upcoming') && upcomingLeads.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Upcoming Leads ({upcomingLeads.length})</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {upcomingLeads.map((lead, index) => <LeadCard key={lead.id} lead={lead} index={index} />)}
                        </div>
                    </section>
                )}
                {(statusFilter === 'All' || statusFilter === 'Completed') && completedLeads.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Completed Leads ({completedLeads.length})</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {completedLeads.map((lead, index) => <LeadCard key={lead.id} lead={lead} index={index} />)}
                        </div>
                    </section>
                )}
                {filteredAndSortedLeads.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-muted-foreground">No leads found matching your criteria.</p>
                        {canCreate && leads?.length === 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                <Link href="/leads-members/create" className="text-primary underline">
                                    Create one now
                                </Link>
                            </p>
                        )}
                    </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the lead '{leadToDelete?.name}' and all of its associated data.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        
      <CopyLeadDialog
            open={isCopyDialogOpen}
            onOpenChange={setIsCopyDialogOpen}
            lead={leadToCopy}
            onCopyConfirm={handleCopyConfirm}
        />

    </>
  );
}
