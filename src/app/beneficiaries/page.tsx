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
    CalendarIcon,
    ChevronDown,
    Plus,
    Activity,
    ChevronRight,
    UserPlus
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

const gridClass = "grid grid-cols-[40px_40px_50px_200px_120px_140px_140px_100px_200px_60px] items-center gap-4 px-6 py-4 min-w-[1200px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay, onClick }: { title: string, count: number, description: string, icon: any, colorClass?: string, delay: string, onClick?: () => void }) {
    return (
        <Card 
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-5 bg-white border-primary/5 shadow-sm animate-fade-in-up transition-all duration-500 hover:shadow-xl hover:-translate-y-1 overflow-hidden", 
                onClick && "cursor-pointer active:scale-95",
                colorClass
            )} 
            style={{ animationDelay: delay, animationFillMode: 'backwards' }}
        >
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                <Icon className="h-24 w-24" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 rounded-2xl bg-primary/[0.03] text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-40 mb-1">{title}</p>
                    <p className="text-3xl font-black text-primary tracking-tighter">{count}</p>
                </div>
            </div>
            <div className="relative z-10 mt-auto">
                <p className="text-[10px] font-bold text-muted-foreground/60 leading-tight">{description}</p>
            </div>
        </Card>
    )
}

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: any, children: React.ReactNode, className?: string, sortConfig: any, handleSort: (key: any) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:text-primary transition-colors flex items-center gap-2 font-black text-[10px] text-muted-foreground tracking-[0.1em] uppercase", className)} onClick={() => handleSort(sortKey)}>
            {children}
            <div className="flex flex-col opacity-30">
                <ArrowUp className={cn("h-2.5 w-2.5 -mb-0.5 transition-all", isSorted && sortConfig.direction === 'ascending' && "text-primary opacity-100 scale-125")} />
                <ArrowDown className={cn("h-2.5 w-2.5 transition-all", isSorted && sortConfig.direction === 'descending' && "text-primary opacity-100 scale-125")} />
            </div>
        </div>
    );
};

function MultiSelectFilter({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (val: string[]) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 text-xs border-primary/10 text-primary rounded-xl bg-white font-bold transition-all hover:border-primary/30 min-w-[140px] justify-between shadow-sm group">
                    <div className="flex items-center gap-2 truncate">
                        <Filter className={cn("h-3.5 w-3.5 shrink-0 transition-transform group-hover:rotate-12", selected.length > 0 ? "text-primary opacity-100" : "opacity-40")} />
                        <span className="truncate">{selected.length === 0 ? `All ${title}s` : `${selected.length} ${title}${selected.length > 1 ? 's' : ''}`}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0 rounded-2xl shadow-dropdown border-primary/10 overflow-hidden" align="start">
                <Command className="w-full">
                    <CommandInput placeholder={`Search ${title}...`} className="h-10 text-xs font-normal px-4 outline-none w-full border-b" />
                    <CommandList className="max-h-[300px] overflow-y-auto p-1.5">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-normal">No results found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem onSelect={() => onChange([])} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 cursor-pointer font-bold text-xs mb-1">
                                <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selected.length === 0 ? "bg-primary text-white" : "bg-transparent")}>
                                    {selected.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="flex-1 truncate">All {title}s</span>
                            </CommandItem>
                            
                            <div className="h-px bg-primary/5 my-1.5" />

                            {options.map((opt) => (
                                <CommandItem 
                                    key={opt} 
                                    onSelect={() => {
                                        const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                                        onChange(next);
                                    }} 
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 cursor-pointer font-bold text-xs"
                                >
                                    <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selected.includes(opt) ? "bg-primary text-white" : "bg-transparent")}>
                                        {selected.includes(opt) && <Check className="h-3 w-3 stroke-[3]" />}
                                    </div>
                                    <span className="flex-1 truncate">{opt}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {selected.length > 0 && (
                        <div className="p-1.5 border-t bg-primary/[0.02]">
                            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="w-full h-9 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-xl">
                                Clear Selections
                            </Button>
                        </div>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [zakatFilter, setZakatFilter] = useState<string[]>([]);
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

  const toggleReferral = (referral: string) => {
    setSelectedReferrals(prev => 
        prev.includes(referral) ? prev.filter(r => r !== referral) : [...prev, referral]
    );
    setCurrentPage(1);
  };

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    
    let items = beneficiaries.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (b.phone || '').includes(searchTerm) ||
                             (b.address || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter.length === 0 || statusFilter.includes(b.status || 'Pending');
        const matchesZakat = zakatFilter.length === 0 || (zakatFilter.includes('Eligible') ? b.isEligibleForZakat : !b.isEligibleForZakat);
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
      const allData = beneficiaries || [];
      return {
          total: allData.length,
          pending: allData.filter(b => b.status === 'Pending').length,
          verified: allData.filter(b => b.status === 'Verified').length,
          hold: allData.filter(b => b.status === 'Hold').length,
          needDetails: allData.filter(b => b.status === 'Need More Details').length,
          zakat: allData.filter(b => b.isEligibleForZakat).length
      }
  }, [beneficiaries]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBeneficiaries.slice(start, start + itemsPerPage);
  }, [filteredAndSortedBeneficiaries, currentPage, itemsPerPage]);

  const handleSort = (key: any) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const toggleSelectAll = (checked: boolean | string) => {
    if (checked === true) {
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
        toast({ title: "Failed", description: res?.message || "Failed To Update Records.", variant: "destructive" });
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
        toast({ title: "Failed", description: res?.message || "Failed To Update Records.", variant: "destructive" });
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
        toast({ title: 'Import Failed', description: res?.message || "Operation Failed.", variant: 'destructive' });
    }
  };

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Syncing Cloud Registry..." description="Retrieving Institutional Beneficiary Data." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8 text-primary font-normal">
        <Alert variant="destructive" className="rounded-3xl border-primary/10 shadow-2xl">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-black tracking-tight">Security Restriction</AlertTitle>
            <AlertDescription className="font-bold opacity-70">Insufficient credentials to access the master beneficiary registry.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

      <div className="flex flex-col gap-4">
        <Button variant="secondary" asChild size="sm" className="w-fit font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-1.5">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Beneficiary Registry</h1>
                <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Centralized oversight of all supported individuals, eligibility authentication, and historical tracking.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-primary/5 shadow-sm">
                    <Button onClick={handleExport} variant="ghost" size="sm" className="font-bold text-primary rounded-xl h-10 px-4 hover:bg-primary/5">
                        <Download className="mr-2 h-4 w-4 opacity-40"/> Export
                    </Button>
                    <div className="w-px h-6 bg-primary/10 my-2" />
                    <Button onClick={() => setIsImportOpen(true)} variant="ghost" size="sm" className="font-bold text-primary rounded-xl h-10 px-4 hover:bg-primary/5">
                        <UploadCloud className="mr-2 h-4 w-4 opacity-40"/> Import
                    </Button>
                </div>
                
                <Button 
                    onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Success' : 'Sync Failed', variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} 
                    disabled={isSyncing} 
                    variant="outline" 
                    size="sm" 
                    className="font-bold border-primary/10 text-primary h-11 rounded-2xl px-5 bg-white/50 hover:bg-white shadow-sm transition-all"
                >
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4 opacity-40"/>}
                    Refresh Cloud
                </Button>
                
                {canCreate && (
                    <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-bold h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <UserPlus className="mr-2 h-4 w-4" /> New Profile
                    </Button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 animate-fade-in-up">
          <StatCard title="Global Total" count={stats.total} description="Authorized System Records" icon={Users} delay="100ms" onClick={() => { setStatusFilter([]); setZakatFilter([]); setSelectedReferrals([]); setSearchTerm(''); }} />
          <StatCard title="Pending Review" count={stats.pending} description="Awaiting Authentication" icon={Hourglass} delay="150ms" onClick={() => setStatusFilter(['Pending'])} />
          <StatCard title="Verified" count={stats.verified} description="Confirmed Identity State" icon={CheckCircle2} delay="200ms" onClick={() => setStatusFilter(['Verified'])} />
          <StatCard title="Registry Hold" count={stats.hold} description="Temporarily Suspended" icon={XCircle} delay="250ms" onClick={() => setStatusFilter(['Hold'])} />
          <StatCard title="Deficiency" count={stats.needDetails} description="Incomplete Profiles" icon={Info} delay="300ms" onClick={() => setStatusFilter(['Need More Details'])} />
          <StatCard title="Zakat Quota" count={stats.zakat} description="Eligible Fund Recipients" icon={Coins} delay="350ms" onClick={() => setZakatFilter(['Eligible'])} />
      </div>

      <Card className="rounded-[32px] border border-primary/5 bg-white/30 backdrop-blur-md overflow-hidden shadow-none animate-fade-in-zoom" style={{ animationDelay: '400ms' }}>
        <CardHeader className="p-4 sm:p-6 border-b bg-white/80 backdrop-blur-md sticky top-[73px] z-20">
            <ScrollArea className="w-full">
                <div className="flex flex-nowrap items-center gap-4 pb-3">
                    <div className="relative w-[300px] shrink-0">
                        <Input 
                            placeholder="Search identities..." 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                            className="pl-11 h-11 text-sm border-primary/10 focus-visible:ring-primary font-bold text-primary rounded-2xl bg-white shadow-sm" 
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30">
                            <Search className="h-4 w-4" />
                        </div>
                    </div>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-[240px] shrink-0 justify-start h-11 text-sm border-primary/10 text-primary font-bold rounded-2xl bg-white shadow-sm transition-all hover:border-primary/30", !dateRange && "opacity-60")}>
                                <CalendarIcon className="mr-3 h-4 w-4 opacity-40" />
                                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd, y")) : "Registry Range"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none overflow-hidden" align="start">
                            <Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); setCurrentPage(1); }} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    {dateRange && <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive hover:bg-destructive/5 shrink-0 rounded-2xl" onClick={() => { setDateRange(undefined); setCurrentPage(1); }}><X className="h-5 w-5"/></Button>}

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[240px] shrink-0 justify-between h-11 text-sm border-primary/10 text-primary font-bold rounded-2xl bg-white shadow-sm transition-all hover:border-primary/30">
                                <div className="flex items-center gap-2 truncate">
                                    <Activity className="h-4 w-4 opacity-40 shrink-0" />
                                    <span className="truncate">
                                        {selectedReferrals.length === 0 ? "Referral Sources" : `${selectedReferrals.length} Sources`}
                                    </span>
                                </div>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0 rounded-3xl shadow-dropdown border-primary/10 overflow-hidden" align="start">
                            <Command className="w-full">
                                <CommandInput placeholder="Search sources..." className="h-11 font-normal px-4 py-3 w-full outline-none border-b" />
                                <CommandList className="max-h-[350px] overflow-y-auto p-2">
                                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-bold opacity-60">No sources found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => setSelectedReferrals([])} className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-primary/5 cursor-pointer font-black text-xs mb-2">
                                            <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selectedReferrals.length === 0 ? "bg-primary text-white" : "opacity-30")}>
                                                {selectedReferrals.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
                                            </div>
                                            <span>Full Registry (Global)</span>
                                        </CommandItem>
                                        {uniqueReferrals.map((source) => (
                                            <CommandItem key={source} onSelect={() => toggleReferral(source)} className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-primary/5 cursor-pointer font-bold text-xs">
                                                <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selectedReferrals.includes(source) ? "bg-primary text-white" : "opacity-30")}>
                                                    {selectedReferrals.includes(source) && <Check className="h-3 w-3 stroke-[3]" />}
                                                </div>
                                                <span className="truncate">{source}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <MultiSelectFilter title="Status" options={['Pending', 'Verified', 'Hold', 'Need More Details']} selected={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} />
                    <MultiSelectFilter title="Zakat" options={['Eligible', 'Not Eligible']} selected={zakatFilter} onChange={(v) => { setZakatFilter(v); setCurrentPage(1); }} />
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>

            {selectedIds.length > 0 && (
                <div className="mt-4 animate-fade-in-up w-full">
                    <div className="flex items-center justify-between gap-4 px-6 py-3 bg-primary/10 border border-primary/20 backdrop-blur-xl rounded-[20px] shadow-xl">
                        <div className="flex items-center gap-4 pr-6 border-r border-primary/10">
                            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg">
                                {selectedIds.length}
                            </div>
                            <span className="text-xs font-black tracking-tight uppercase text-primary">Selected for Batch Action</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="sm" className="bg-white/80 hover:bg-white text-primary font-black h-10 text-[10px] px-5 rounded-xl uppercase tracking-widest shadow-sm" disabled={isBulkUpdating}>
                                        Set Verification
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56 rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                    <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-bold text-xs p-3 rounded-xl">Verify Selected</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-bold text-xs p-3 rounded-xl">Revert to Pending</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatusChange('Hold')} className="font-bold text-xs p-3 rounded-xl">Apply Audit Hold</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatusChange('Need More Details')} className="font-bold text-xs p-3 rounded-xl">Flag Incomplete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="sm" className="bg-white/80 hover:bg-white text-primary font-black h-10 text-[10px] px-5 rounded-xl uppercase tracking-widest shadow-sm" disabled={isBulkUpdating}>
                                        Zakat Status
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56 rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                    <DropdownMenuItem onClick={() => handleBulkZakatChange(true)} className="font-bold text-xs p-3 rounded-xl">Authorize Eligibility</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkZakatChange(false)} className="font-bold text-xs p-3 rounded-xl">Revoke Eligibility</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="ml-auto">
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary/40 hover:text-primary hover:bg-white/50 rounded-xl transition-all" onClick={() => setSelectedIds([])}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </CardHeader>

        <CardContent className="p-0">
            <ScrollArea className="w-full">
                <div className="max-h-[65vh]">
                    <div className={cn("hidden md:grid bg-primary/[0.02] border-b border-primary/5 text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase", gridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={paginatedBeneficiaries.length > 0 && selectedIds.length === paginatedBeneficiaries.length}
                                onCheckedChange={toggleSelectAll}
                                className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <div></div>
                        <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}># Index</SortableHeader>
                        <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Identity Name</SortableHeader>
                        <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Contact</SortableHeader>
                        <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Verification</SortableHeader>
                        <div className="text-center font-black tracking-[0.1em] text-[10px]">Disbursement</div>
                        <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Zakat</SortableHeader>
                        <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort} className="pl-6">Referral</SortableHeader>
                        <div className="text-right pr-6 font-black tracking-[0.1em] text-[10px]">Audit</div>
                    </div>

                    <div className="flex flex-col">
                    {paginatedBeneficiaries.map((b, idx) => (
                        <div key={b.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-colors group/row bg-white/40">
                            {/* Desktop Row */}
                            <div className={cn("hidden md:grid py-4 px-6", gridClass)}>
                                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox 
                                        checked={selectedIds.includes(b.id)}
                                        onCheckedChange={() => toggleSelect(b.id)}
                                        className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                    />
                                </div>
                                <div className="flex justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 text-primary" onClick={() => router.push(`/beneficiaries/${b.id}`)}>
                                        <Eye className="h-4.5 w-4.5" />
                                    </Button>
                                </div>
                                <div className="font-mono text-[11px] font-bold opacity-30">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                <div className="font-bold text-sm truncate pr-4 text-primary tracking-tight">{b.name}</div>
                                <div className="font-mono text-[11px] font-bold opacity-50 text-primary">{b.phone || '—'}</div>
                                <div className="text-center">
                                    <Badge variant={b.status === 'Verified' ? 'eligible' : 'outline'} className="text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm">
                                        {b.status || 'Pending'}
                                    </Badge>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black text-muted-foreground opacity-30 tracking-tight uppercase">Operational</p>
                                </div>
                                <div className="text-center">
                                    <Badge 
                                        variant={b.isEligibleForZakat ? 'eligible' : 'outline'} 
                                        className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm", b.isEligibleForZakat ? "bg-emerald-500 text-white" : "opacity-40")}
                                    >
                                        {b.isEligibleForZakat ? 'Eligible' : 'Hold'}
                                    </Badge>
                                </div>
                                <div className="pl-6 text-xs font-bold text-primary/60 truncate italic">{b.referralBy || '—'}</div>
                                <div className="text-right pr-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-90">
                                                <MoreHorizontal className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-56">
                                            <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="text-primary font-bold text-xs p-3 rounded-xl"><Eye className="mr-3 h-4 w-4 opacity-40" /> Full Audit View</DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                            {canUpdate && (
                                                <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="text-primary font-bold text-xs p-3 rounded-xl">
                                                    {b.isEligibleForZakat ? <XCircle className="mr-3 h-4 w-4 text-destructive opacity-80" /> : <Coins className="mr-3 h-4 w-4 text-primary opacity-80" />}
                                                    {b.isEligibleForZakat ? 'Revoke Zakat Status' : 'Authorize Zakat Use'}
                                                </DropdownMenuItem>
                                            )}
                                            {canUpdate && (
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="text-primary font-bold text-xs p-3 rounded-xl"><ChevronsUpDown className="mr-3 h-4 w-4 opacity-40" /> Verification State</DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-52">
                                                            <DropdownMenuRadioGroup value={b.status || 'Pending'} onValueChange={(s) => handleStatusChange(b, s)}>
                                                                <DropdownMenuRadioItem value="Pending" className="text-xs font-bold p-3 rounded-xl">Pending</DropdownMenuRadioItem>
                                                                <DropdownMenuRadioItem value="Verified" className="text-xs font-bold p-3 rounded-xl">Verified</DropdownMenuRadioItem>
                                                                <DropdownMenuRadioItem value="Hold" className="text-xs font-bold p-3 rounded-xl">Hold</DropdownMenuRadioItem>
                                                                <DropdownMenuRadioItem value="Need More Details" className="text-xs font-bold p-3 rounded-xl">Incomplete</DropdownMenuRadioItem>
                                                            </DropdownMenuRadioGroup>
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                            )}
                                            {canDelete && (
                                                <>
                                                    <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                                    <DropdownMenuItem onClick={async () => { if(confirm('Permanently erase record?')) { const res = await deleteBeneficiaryAction(b.id); toast({ title: res.success ? 'Earsed' : 'Error', variant: res.success ? 'success' : 'destructive'}); } }} className="text-destructive font-black text-xs p-3 rounded-xl hover:bg-destructive/10"><Trash2 className="mr-3 h-4 w-4" /> Hard Delete</DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Mobile Registry Card */}
                            <div className="md:hidden p-5 space-y-5 group/mobile" onClick={() => router.push(`/beneficiaries/${b.id}`)}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-4">
                                        <Checkbox 
                                            checked={selectedIds.includes(b.id)}
                                            onCheckedChange={() => toggleSelect(b.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-6 w-6 rounded-lg border-primary/20 data-[state=checked]:bg-primary mt-1"
                                        />
                                        <div className="space-y-1">
                                            <h3 className="font-black text-lg text-primary tracking-tighter group-hover/mobile:text-primary transition-colors">{b.name}</h3>
                                            <p className="font-mono text-[11px] font-bold text-muted-foreground tracking-tight">{b.phone || 'NO CONTACT LOGGED'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/5 bg-primary/5 rounded-2xl"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-52">
                                                <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="font-bold text-xs p-3 rounded-xl">View Profile</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold text-xs p-3 rounded-xl">Toggle Zakat</DropdownMenuItem>
                                                <DropdownMenuItem onClick={async () => { if(confirm('Delete?')) await deleteBeneficiaryAction(b.id); }} className="text-destructive font-bold text-xs p-3 rounded-xl">Hard Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3.5 rounded-[20px] bg-primary/[0.03] border border-primary/5 group-hover/mobile:bg-white group-hover/mobile:shadow-sm transition-all">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-50">Verification</p>
                                        <Badge variant={b.status === 'Verified' ? 'eligible' : 'outline'} className="text-[10px] font-black w-full justify-center py-1.5 h-7 rounded-full border-0 shadow-sm">{b.status || 'Pending'}</Badge>
                                    </div>
                                    <div className="p-3.5 rounded-[20px] bg-primary/[0.03] border border-primary/5 group-hover/mobile:bg-white group-hover/mobile:shadow-sm transition-all">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-50">Zakat State</p>
                                        <Badge 
                                            variant={b.isEligibleForZakat ? 'eligible' : 'outline'} 
                                            className={cn("text-[10px] font-black w-full justify-center py-1.5 h-7 rounded-full border-0 shadow-sm", b.isEligibleForZakat ? "bg-emerald-500 text-white" : "opacity-40")}
                                        >
                                            {b.isEligibleForZakat ? 'Eligible' : 'Ineligible'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">SR-{(currentPage - 1) * itemsPerPage + idx + 1}</p>
                                        <p className="text-xs font-bold text-primary/60 italic truncate max-w-[150px]">{b.referralBy || 'Self Reported'}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-9 text-[10px] font-black text-primary hover:bg-primary/5 px-4 rounded-xl transition-all group-hover/mobile:translate-x-1">
                                        Audit Profile <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                    {paginatedBeneficiaries.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 bg-primary/[0.01] animate-pulse">
                            <Users className="h-12 w-12 text-primary/10 mb-4" />
                            <p className="font-black text-sm text-primary/30 tracking-widest uppercase">No identities matched query parameters.</p>
                        </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" className="h-2" />
            </ScrollArea>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-primary/5 shadow-sm">
             <p className="text-xs font-black text-primary tracking-tight">Registry Page <span className="text-primary">{currentPage}</span> <span className="opacity-30">/ {totalPages}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                disabled={currentPage === 1} 
                className="font-black text-[10px] uppercase tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm"
            >
                Prev
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                disabled={currentPage === totalPages} 
                className="font-black text-[10px] uppercase tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm"
            >
                Next
            </Button>
          </div>
        </div>
      )}

      <BeneficiaryImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />
    </main>
  );
}
