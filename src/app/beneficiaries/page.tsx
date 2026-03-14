
'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    ArrowLeft, 
    PlusCircle, 
    DatabaseZap, 
    Eye, 
    Search,
    MoreHorizontal,
    ShieldAlert,
    Trash2,
    ChevronDown,
    Loader2,
    ArrowUp,
    ArrowDown,
    Coins,
    XCircle,
    Check,
    Filter,
    UploadCloud,
    Download,
    Users,
    Hourglass,
    CheckCircle2,
    Info,
    CheckSquare,
    X,
    ChevronsUpDown,
    CalendarIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction, updateMasterBeneficiaryAction, bulkImportBeneficiariesAction, bulkUpdateMasterBeneficiaryStatusAction, bulkUpdateMasterZakatAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { SectionLoader } from '@/components/section-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BeneficiaryImportDialog } from '@/components/beneficiary-import-dialog';
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

const gridClass = "grid grid-cols-[40px_40px_50px_200px_120px_140px_140px_100px_200px_60px] items-center gap-4 px-4 py-3 min-w-[1150px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay }: { title: string, count: number, description: string, icon: any, colorClass?: string, delay: string }) {
    return (
        <Card className={cn("flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all hover:shadow-md", colorClass)} style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight">{title}</p>
                    <p className="text-2xl font-black text-primary tracking-tight">{count}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="text-[9px] font-medium text-muted-foreground mt-auto">{description}</p>
        </Card>
    )
}

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: any, children: React.ReactNode, className?: string, sortConfig: any, handleSort: (key: any) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2 font-bold text-[10px] text-[hsl(var(--table-header-fg))] tracking-tight", className)} onClick={() => handleSort(sortKey)}>
            {children}
            <div className="flex flex-col opacity-40">
                <ArrowUp className={cn("h-2.5 w-2.5 -mb-1", isSorted && sortConfig.direction === 'ascending' && "text-primary opacity-100")} />
                <ArrowDown className={cn("h-2.5 w-2.5", isSorted && sortConfig.direction === 'descending' && "text-primary opacity-100")} />
            </div>
        </div>
    );
};

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const itemsPerPage = 15;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const beneficiariesRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'beneficiaries') : null, [firestore, user]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    const sources = new Set<string>();
    beneficiaries.forEach(b => {
        if (b.referralBy?.trim()) sources.add(b.referralBy.trim());
    });
    return Array.from(sources).sort();
  }, [beneficiaries]);

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    
    let items = beneficiaries.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (b.phone || '').includes(searchTerm) ||
                             (b.address || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || (b.status || 'Pending') === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        const matchesReferral = selectedReferrals.length === 0 || (b.referralBy && selectedReferrals.includes(b.referralBy.trim()));
        
        let matchesDate = true;
        if (dateRange?.from) {
            const from = startOfDay(dateRange.from);
            const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            if (!b.addedDate) matchesDate = false;
            else {
                try {
                    const bDate = parseISO(b.addedDate);
                    matchesDate = bDate >= from && bDate <= to;
                } catch(e) { matchesDate = false; }
            }
        }

        return matchesSearch && matchesStatus && matchesZakat && matchesReferral && matchesDate;
    });

    if (sortConfig !== null) {
        items.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = (a as any)[sortConfig.key];
            const bVal = (b as any)[sortConfig.key];
            if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();
            if (aStr < bStr) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aStr > bStr) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }

    return items;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, selectedReferrals, dateRange, sortConfig]);

  const stats = useMemo(() => {
      const data = filteredAndSortedBeneficiaries;
      return {
          total: data.length,
          pending: data.filter(b => b.status === 'Pending').length,
          verified: data.filter(b => b.status === 'Verified').length,
          hold: data.filter(b => b.status === 'Hold').length,
          needDetails: data.filter(b => b.status === 'Need More Details').length,
          zakat: data.filter(b => b.isEligibleForZakat).length
      }
  }, [filteredAndSortedBeneficiaries]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBeneficiaries.slice(start, start + itemsPerPage);
  }, [filteredAndSortedBeneficiaries, currentPage]);

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const toggleReferral = (referral: string) => {
    setSelectedReferrals(prev => 
        prev.includes(referral) ? prev.filter(r => r !== referral) : [...prev, referral]
    );
    setCurrentPage(1);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(paginatedBeneficiaries.map(b => b.id));
    } else {
        setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatusChange = async (newStatus: Beneficiary['status']) => {
    if (!userProfile || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateMasterBeneficiaryStatusAction(selectedIds, newStatus, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: "Status Updated", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Failed", description: res?.message || "Failed to update records.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleBulkZakatChange = async (isEligible: boolean) => {
    if (!userProfile || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateMasterZakatAction(selectedIds, isEligible, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: "Zakat Eligibility Updated", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Failed", description: res?.message || "Failed to update records.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: string) => {
    if (!canUpdate || !userProfile) return;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus as any }, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: 'Verification Status Synchronized', variant: 'success' });
    }
  };

  const handleZakatToggle = async (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile) return;
    const newStatus = !beneficiary.isEligibleForZakat;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newStatus }, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: newStatus ? 'Marked Zakat Eligible' : 'Marked Not Eligible', variant: 'success' });
    }
  };

  const handleExport = () => {
    if (!filteredAndSortedBeneficiaries.length) return;
    const headers = ['ID', 'Name', 'Phone', 'Address', 'Age', 'Occupation', 'Total Members', 'Earning Members', 'Male', 'Female', 'ID Type', 'ID Number', 'Referral By', 'Zakat Eligible', 'Zakat Allocation', 'Verification Status', 'Notes'];
    const rows = filteredAndSortedBeneficiaries.map(b => [
        b.id,
        `"${b.name || ''}"`,
        b.phone || '',
        `"${(b.address || '').replace(/"/g, '""')}"`,
        b.age || '',
        b.occupation || '',
        b.members || '',
        b.earningMembers || '',
        b.male || '',
        b.female || '',
        b.idProofType || '',
        b.idNumber || '',
        `"${b.referralBy || ''}"`,
        b.isEligibleForZakat ? 'Yes' : 'No',
        b.zakatAllocation || 0,
        b.status || 'Pending',
        `"${(b.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "master_beneficiary_full_registry.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (records: Partial<Beneficiary>[]) => {
    if (!userProfile) return;
    const res = await bulkImportBeneficiariesAction(records, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: 'Import Complete', description: res.message, variant: 'success' });
    } else {
        toast({ title: 'Import Failed', description: res?.message || "Operation failed.", variant: 'destructive' });
    }
  };

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Loading Master Registry..." description="Retrieving Organizational Records." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8 text-primary font-normal">
        <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-bold">Access Denied</AlertTitle>
            <AlertDescription className="font-normal text-primary/70">Missing Permissions To View Beneficiary Records.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative">
      <div className="flex flex-col gap-2">
        <Button variant="outline" asChild className="w-fit font-bold border-primary/10 text-primary transition-transform active:scale-95">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link>
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Master Beneficiary Registry</h1>
                <p className="text-sm font-medium text-muted-foreground opacity-70">Total Verified Profiles: {beneficiaries?.length || 0}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                <Download className="mr-2 h-4 w-4"/> Export Full CSV
            </Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" size="sm" className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                <UploadCloud className="mr-2 h-4 w-4"/> Import Data
            </Button>
            <Button onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Complete' : 'Sync Failed', description: res.message, variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} disabled={isSyncing} variant="secondary" size="sm" className="font-bold border-primary/10 text-primary active:scale-95 transition-transform">
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                Refresh Records
            </Button>
            {canCreate && (
                <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-bold active:scale-95 transition-transform shadow-none rounded-[12px]">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Beneficiary
                </Button>
            )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total" count={stats.total} description="All Registry Records" icon={Users} delay="100ms" />
          <StatCard title="Pending" count={stats.pending} description="Awaiting Verification" icon={Hourglass} delay="150ms" />
          <StatCard title="Verified" count={stats.verified} description="Confirmed Profiles" icon={CheckCircle2} delay="200ms" />
          <StatCard title="On Hold" count={stats.hold} description="Suspended Profiles" icon={XCircle} delay="150ms" />
          <StatCard title="Need Details" count={stats.needDetails} description="Incomplete Profiles" icon={Info} delay="300ms" />
          <StatCard title="Zakat" count={stats.zakat} description="Eligible For Support" icon={Coins} delay="350ms" />
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <ScrollArea className="w-full">
            <div className="flex flex-nowrap items-center gap-3 pb-2">
                <div className="relative w-[250px] shrink-0">
                    <Input 
                        placeholder="Search Name, Phone..." 
                        value={searchTerm} 
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        className="pl-10 h-10 text-sm border-primary/10 focus-visible:ring-primary font-normal text-primary rounded-[12px]" 
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50">
                        <Search className="h-4 w-4" />
                    </div>
                </div>
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[220px] shrink-0 justify-start h-10 text-sm border-primary/10 text-primary font-bold rounded-[12px] bg-white transition-all hover:border-primary/30", !dateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-40" />
                            {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd, y")) : "Select Date Range"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); setCurrentPage(1); }} numberOfMonths={2} />
                    </PopoverContent>
                </Popover>
                {dateRange && <Button variant="ghost" size="icon" className="h-10 w-10 text-primary/40 hover:text-primary shrink-0" onClick={() => { setDateRange(undefined); setCurrentPage(1); }}><X className="h-4 w-4"/></Button>}

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[220px] shrink-0 justify-between h-10 text-sm border-primary/10 text-primary font-normal rounded-[12px] bg-white">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="h-3.5 w-3.5 opacity-40 shrink-0" />
                                <span className="truncate">
                                    {selectedReferrals.length === 0 ? "All Referral Sources" : `${selectedReferrals.length} Selected`}
                                </span>
                            </div>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0 rounded-[12px] shadow-dropdown border-primary/10" align="start">
                        <Command className="w-full">
                            <CommandInput placeholder="Search Referrals..." className="h-9 font-normal px-3 py-2 w-full outline-none" />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                                <CommandEmpty className="py-2 text-center text-xs text-muted-foreground font-normal">No source found.</CommandEmpty>
                                <CommandGroup className="p-1">
                                    <CommandItem onSelect={() => setSelectedReferrals([])} className="flex items-center px-2 py-1.5 rounded-md hover:bg-primary/5 cursor-pointer font-bold text-xs">
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedReferrals.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                            {selectedReferrals.length === 0 && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>Show All Sources</span>
                                    </CommandItem>
                                    {uniqueReferrals.map((source) => (
                                        <CommandItem key={source} onSelect={() => toggleReferral(source)} className="flex items-center px-2 py-1.5 rounded-md hover:bg-primary/5 cursor-pointer font-normal text-xs">
                                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedReferrals.includes(source) ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                                {selectedReferrals.includes(source) && <Check className="h-3 w-3" />}
                                            </div>
                                            <span className="truncate">{source}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[180px] shrink-0 h-10 text-sm border-primary/10 text-primary font-normal rounded-[12px] bg-white"><SelectValue placeholder="Verification Status" /></SelectTrigger>
                    <SelectContent className="rounded-[12px] border-primary/10 shadow-dropdown">
                        <SelectItem value="All" className="font-normal">All Verification</SelectItem>
                        <SelectItem value="Verified" className="font-normal">Verified</SelectItem>
                        <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
                        <SelectItem value="Hold" className="font-normal">Hold</SelectItem>
                        <SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[180px] shrink-0 h-10 text-sm border-primary/10 text-primary font-normal rounded-[12px] bg-white"><SelectValue placeholder="Zakat Eligibility" /></SelectTrigger>
                    <SelectContent className="rounded-[12px] border-primary/10 shadow-dropdown">
                        <SelectItem value="All" className="font-normal">All Zakat Status</SelectItem>
                        <SelectItem value="Eligible" className="font-normal">Eligible</SelectItem>
                        <SelectItem value="Not Eligible" className="font-normal">Not Eligible</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-[73px] z-40 animate-fade-in-up w-full">
            <div className="flex items-center justify-start gap-4 px-4 py-2 bg-primary/5 border border-primary/20 backdrop-blur-md rounded-xl shadow-sm mb-4">
                <div className="flex items-center gap-2 pr-4 border-r border-primary/10">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold tracking-tight whitespace-nowrap text-primary">{selectedIds.length} Selected</span>
                </div>
                
                <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                Verification
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-dropdown border-primary/10">
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-normal">Mark Verified</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-normal">Mark Pending</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Hold')} className="font-normal">Mark Hold</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Need More Details')} className="font-normal">More Details</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                Zakat
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-dropdown border-primary/10">
                            <DropdownMenuItem onClick={() => handleBulkZakatChange(true)} className="font-normal">Mark Eligible</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkZakatChange(false)} className="font-normal">Mark Ineligible</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="ml-auto">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/40 hover:text-primary rounded-full" onClick={() => setSelectedIds([])}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
      )}

      <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm transition-all hover:shadow-lg">
        <ScrollArea className="w-full">
            <div className="max-h-[70vh]">
                <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold tracking-tight text-[hsl(var(--table-header-fg))]", gridClass)}>
                    <div className="flex justify-center">
                        <Checkbox 
                            checked={paginatedBeneficiaries.length > 0 && selectedIds.length === paginatedBeneficiaries.length}
                            onCheckedChange={toggleSelectAll}
                            className="border-primary/40 data-[state=checked]:bg-primary"
                        />
                    </div>
                    <div></div>
                    <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>Sr. No.</SortableHeader>
                    <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                    <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Phone</SortableHeader>
                    <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Verification Status</SortableHeader>
                    <div className="text-center font-bold tracking-tight text-[10px]">Disbursement Status</div>
                    <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Zakat</SortableHeader>
                    <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort} className="pl-4">Referred By</SortableHeader>
                    <div className="text-right pr-4">Actions</div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                {paginatedBeneficiaries.map((b, idx) => (
                    <AccordionItem key={b.id} value={b.id} className="border-b border-primary/10 last:border-0 hover:bg-[hsl(var(--table-row-hover))] transition-colors bg-white">
                    <div className={cn("py-3 px-4", gridClass)}>
                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                                checked={selectedIds.includes(b.id)}
                                onCheckedChange={() => toggleSelect(b.id)}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <div className="flex justify-center">
                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                    <ChevronDown className="h-4 w-4 text-primary shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                            </AccordionTrigger>
                        </div>
                        <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                        <div className="font-bold text-sm truncate pr-2 text-primary">{b.name}</div>
                        <div className="font-mono text-xs opacity-60 text-primary">{b.phone || 'N/A'}</div>
                        <div className="text-center"><Badge variant={b.status === 'Verified' ? 'eligible' : 'outline'} className="text-[10px] font-bold">{b.status || 'Pending'}</Badge></div>
                        <div className="text-center"><p className="text-[9px] font-bold text-muted-foreground opacity-40 tracking-tight">Project Specific</p></div>
                        <div className="text-center"><Badge variant={b.isEligibleForZakat ? 'eligible' : 'outline'} className="text-[10px] font-bold">{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></div>
                        <div className="pl-4 text-xs font-normal text-primary/70">{b.referralBy || 'N/A'}</div>
                        <div className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="text-primary font-normal"><Eye className="mr-2 h-4 w-4 opacity-60" /> View Details</DropdownMenuItem>
                                        
                                        {canUpdate && (
                                            <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="text-primary font-normal">
                                                {b.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4 text-destructive" /> : <Coins className="mr-2 h-4 w-4 text-primary" />}
                                                {b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}
                                            </DropdownMenuItem>
                                        )}

                                        {canUpdate && (
                                            <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="text-primary font-normal"><ChevronsUpDown className="mr-2 h-4 w-4 opacity-60" /> Change Verification</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal><DropdownMenuSubContent className="rounded-[12px] border-primary/10 shadow-dropdown border-primary/10">
                                                <DropdownMenuRadioGroup value={b.status || 'Pending'} onValueChange={(s) => handleStatusChange(b, s)}>
                                                <DropdownMenuRadioItem value="Pending" className="text-xs font-normal">Pending</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified" className="text-xs font-normal">Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Hold" className="text-xs font-normal">Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details" className="text-xs font-normal">Need Details</DropdownMenuRadioItem></DropdownMenuRadioGroup>
                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                            </DropdownMenuSub>
                                        )}
                                        {canDelete && (
                                            <>
                                            <DropdownMenuSeparator className="bg-primary/10" />
                                            <DropdownMenuItem onClick={async () => { if(confirm('Are You Certain?')) { const res = await deleteBeneficiaryAction(b.id); toast({ title: res.success ? 'Deleted' : 'Error', variant: res.success ? 'success' : 'destructive'}); } }} className="text-destructive font-normal"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                    <AccordionContent className="bg-primary/[0.02] px-6 py-4 border-t border-primary/10 animate-fade-in-up">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3 text-primary font-normal">
                        <div className="space-y-1 col-span-2">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Address</p>
                            <p className="text-sm leading-tight font-normal">{b.address || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Age</p>
                            <p className="text-sm font-normal">{b.age || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Occupation</p>
                            <p className="text-sm font-normal">{b.occupation || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Family Details</p>
                            <p className="text-sm font-normal">T: {b.members || 0}, E: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">ID Artifact</p>
                            <p className="text-sm font-normal">{b.idProofType || 'Aadhaar'} - {b.idNumber || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Date Added</p>
                            <p className="text-sm font-normal">{b.addedDate || 'N/A'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-[10px] font-bold opacity-60 tracking-tight uppercase">Notes</p>
                            <p className="text-sm italic opacity-80 font-normal line-clamp-2">{b.notes || (b.isEligibleForZakat ? 'Eligible For Zakat Support.' : 'N/A')}</p>
                        </div>
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
                {paginatedBeneficiaries.length === 0 && (
                <div className="text-center py-20 bg-primary/[0.02] opacity-40 italic font-bold">No Beneficiaries Found Matching Criteria.</div>
                )}
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
        </ScrollArea>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-[10px] font-bold opacity-60 uppercase">Registry Page {currentPage} Of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/10 h-8 rounded-[10px] transition-transform active:scale-95">Previous</Button>
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/10 h-8 rounded-[10px] transition-transform active:scale-95">Next</Button>
          </div>
        </div>
      )}

      <BeneficiaryImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />
    </main>
  );
}
