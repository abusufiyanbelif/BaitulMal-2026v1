'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Donor, BankDetail, Donation } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
    ArrowLeft, 
    PlusCircle, 
    Search,
    MoreHorizontal,
    ShieldAlert,
    Trash2,
    Loader2,
    HeartHandshake,
    Download,
    UploadCloud,
    X,
    UserPlus,
    Users,
    TrendingUp,
    Edit,
    Save,
    Plus,
    DatabaseZap,
    AlertCircle,
    Eye,
    CalendarIcon,
    Filter,
    Smartphone,
    Landmark,
    CheckCircle2,
    UserCheck,
    UserX,
    ChevronRight,
    Activity,
    Mail,
    MapPin,
    CreditCard,
    SmartphoneNfc
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { deleteDonorAction, createDonorAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { SectionLoader } from '@/components/section-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UnlinkedDonationResolver } from '@/components/unlinked-donation-resolver';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { BrandedLoader } from '@/components/branded-loader';

function StatCard({ title, count, description, icon: Icon, delay, onClick, colorClass }: { title: string, count: number, description: string, icon: any, delay: string, onClick?: () => void, colorClass?: string }) {
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
    );
}

export default function DonorRegistryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [designationFilter, setDesignationFilter] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isResolverOpen, setIsResolverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);

  const [bankDetails, setBankDetails] = useState<BankDetail[]>([{ bankName: '', accountNumber: '', ifscCode: '' }]);
  const [upiIds, setUpiIds] = useState<string[]>(['']);
  const [phonePrefix, setPhonePrefix] = useState('+91');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const donorsRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'donors') : null, [firestore, user]);
  const { data: donors, isLoading: areDonorsLoading } = useCollection<Donor>(donorsRef);

  const donationsRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'donations') : null, [firestore, user]);
  const { data: allDonations } = useCollection<Donation>(donationsRef);

  const unlinkedDonationsCount = useMemo(() => {
    if (!allDonations) return 0;
    return allDonations.filter(d => !d.donorId).length;
  }, [allDonations]);

  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.delete', false);
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.create', false);

  const filteredDonors = useMemo(() => {
    if (!donors) return [];
    
    return donors.filter(d => {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || (
            (d.name || '').toLowerCase().includes(lowerSearch) || 
            (d.phone || '').includes(searchTerm) ||
            (d.email || '').toLowerCase().includes(lowerSearch) ||
            (d.upiIds || []).some(u => u.toLowerCase().includes(lowerSearch)) ||
            (d.accountNumbers || []).some(a => a.includes(searchTerm))
        );

        const matchesStatus = statusFilter === 'All' || d.status === statusFilter;

        let matchesDesignation = true;
        if (designationFilter !== 'All' && allDonations) {
            const donorDonations = allDonations.filter(don => don.donorId === d.id);
            matchesDesignation = donorDonations.some(don => 
                (don.typeSplit || []).some(s => s.category === designationFilter)
            );
        }

        let matchesDate = true;
        if (dateRange?.from && d.createdAt) {
            const createdAtDate = (d.createdAt as any).toDate ? (d.createdAt as any).toDate() : new Date(d.createdAt as any);
            const from = startOfDay(dateRange.from);
            const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            matchesDate = createdAtDate >= from && createdAtDate <= to;
        }

        return matchesSearch && matchesStatus && matchesDesignation && matchesDate;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [donors, searchTerm, statusFilter, designationFilter, dateRange, allDonations]);

  const stats = useMemo(() => {
      const allData = donors || [];
      return {
          total: allData.length,
          active: allData.filter(d => d.status === 'Active').length,
          inactive: allData.filter(d => d.status === 'Inactive').length,
      };
  }, [donors]);

  const handleSaveDonor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreate || !userProfile) return;
    setIsSubmitting(true);

    try {
        const formData = new FormData(e.currentTarget);
        const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
        const validUpis = upiIds.filter(u => u.trim() !== '');

        const data: Partial<Donor> = {
            name: formData.get('name') as string,
            phone: `${phonePrefix}${formData.get('phone') as string}`,
            email: formData.get('email') as string,
            address: formData.get('address') as string,
            bankDetails: validBanks,
            accountNumbers: validBanks.map(b => b.accountNumber).filter(Boolean),
            upiIds: validUpis,
            status: (formData.get('status') as any) || 'Active',
            notes: formData.get('notes') as string,
        };

        const res = await createDonorAction(data, { id: userProfile.id, name: userProfile.name });
        if (res.success) {
            toast({ title: 'Donor Registered', description: res.message, variant: 'success' });
            setIsFormOpen(false);
            setBankDetails([{ bankName: '', accountNumber: '', ifscCode: '' }]);
            setUpiIds(['']);
        } else {
            toast({ title: 'Registration Failed', description: res.message, variant: 'destructive' });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (donor: Donor) => {
    if (!canDelete) return;
    const confirmMessage = `Permanently Remove Profile For ${donor.name}? Institutional Financial History Will Be Preserved As Unlinked Records.`;
    if (!confirm(confirmMessage)) return;
    
    setIsSubmitting(true);
    try {
        const res = await deleteDonorAction(donor.id);
        if (res.success) {
            toast({ title: 'Profile Removed', variant: 'success' });
        } else {
            toast({ title: 'Removal Failed', description: res.message, variant: 'destructive' });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const isLoading = areDonorsLoading || isProfileLoading;
  
  if (isLoading && !donors) return <SectionLoader label="Syncing Donor Network..." description="Retrieving Institutional Benefactor Data." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8 text-primary font-normal">
        <Alert variant="destructive" className="rounded-3xl border-primary/10 shadow-2xl">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-black tracking-tight">Access Restricted</AlertTitle>
            <AlertDescription className="font-bold opacity-70">Insufficient credentials to view the donor database.</AlertDescription>
        </Alert>
    </main>
  );

  const totalPages = Math.ceil(filteredDonors.length / itemsPerPage);
  const paginatedDonors = filteredDonors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

      {isSubmitting && <BrandedLoader message="Updating Donor Registry..." />}
      
      <div className="flex flex-col gap-4">
        <Button variant="secondary" asChild size="sm" className="w-fit font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-1.5">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Donor Registry</h1>
                <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Centralized database of institutional benefactors, contribution history, and verified payment handles.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                {unlinkedDonationsCount > 0 && (
                    <Button onClick={() => setIsResolverOpen(true)} variant="outline" size="sm" className="font-bold border-amber-500/20 text-amber-600 h-11 rounded-2xl px-5 bg-amber-500/[0.03] hover:bg-amber-500/[0.08] transition-all shadow-sm">
                        <DatabaseZap className="mr-2 h-4 w-4 animate-pulse"/> Resolve {unlinkedDonationsCount} Gaps
                    </Button>
                )}
                {canCreate && (
                    <Button onClick={() => { setEditingDonor(null); setIsFormOpen(true); }} size="sm" className="font-bold h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <UserPlus className="mr-2 h-4 w-4" /> Register New Identity
                    </Button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 animate-fade-in-up">
          <StatCard 
            title="Registry Total" 
            count={stats.total} 
            description="Verified Institutional Donors" 
            icon={Users} 
            delay="100ms" 
            onClick={() => { setStatusFilter('All'); setDesignationFilter('All'); setSearchTerm(''); }}
          />
          <StatCard 
            title="Active Contributors" 
            count={stats.active} 
            description="Operational Financial Support" 
            icon={UserCheck} 
            delay="150ms" 
            onClick={() => { setStatusFilter('Active'); }}
            colorClass="bg-emerald-500/[0.02] border-emerald-500/10"
          />
          <StatCard 
            title="Suspended / Past" 
            count={stats.inactive} 
            description="Historical Donor Profiles" 
            icon={UserX} 
            delay="200ms" 
            onClick={() => { setStatusFilter('Inactive'); }}
            colorClass="bg-destructive/[0.02] border-destructive/10"
          />
      </div>

      <Card className="rounded-[32px] border border-primary/5 bg-white/30 backdrop-blur-md overflow-hidden shadow-none animate-fade-in-zoom" style={{ animationDelay: '300ms' }}>
        <CardHeader className="p-4 sm:p-6 border-b bg-white/80 backdrop-blur-md sticky top-[73px] z-20">
            <ScrollArea className="w-full">
                <div className="flex flex-nowrap items-center gap-4 pb-3">
                    <div className="relative w-[350px] shrink-0">
                        <Input 
                            placeholder="Search identities, handles, contacts..." 
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
                            <Button variant="outline" className={cn("w-[240px] shrink-0 justify-start h-11 text-sm border-primary/10 text-primary font-bold rounded-2xl bg-white shadow-sm transition-all hover:border-primary/30", !dateRange && "opacity-60")}>
                                <CalendarIcon className="mr-3 h-4 w-4 opacity-40" />
                                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd, y")) : "Registration Period"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none overflow-hidden" align="start">
                            <Calendar initialFocus mode="range" selected={dateRange} onSelect={(val) => { setDateRange(val); setCurrentPage(1); }} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[200px] shrink-0 h-11 text-sm border-primary/10 rounded-2xl bg-white font-bold shadow-sm"><SelectValue placeholder="Account State" /></SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                            <SelectItem value="All" className="font-bold text-xs p-3 rounded-xl">All Profiles</SelectItem>
                            <SelectItem value="Active" className="font-bold text-xs p-3 rounded-xl text-emerald-600">Active Contributors</SelectItem>
                            <SelectItem value="Inactive" className="font-bold text-xs p-3 rounded-xl text-destructive">Inactive / Suspended</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
        </CardHeader>

        <CardContent className="p-0">
            <ScrollArea className="w-full">
                <div className="max-h-[65vh]">
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-primary/[0.02] border-b border-primary/5">
                                    <TableHead className="w-[80px] pl-8 text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14"># Index</TableHead>
                                    <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Donor Identity</TableHead>
                                    <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Primary Contact</TableHead>
                                    <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Financial Handles</TableHead>
                                    <TableHead className="text-center text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Registry Status</TableHead>
                                    <TableHead className="text-right pr-8 text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedDonors.map((donor, idx) => (
                                    <TableRow key={donor.id} onClick={() => router.push(`/donors/${donor.id}`)} className="cursor-pointer bg-white/40 border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-colors group">
                                        <TableCell className="pl-8 font-mono text-[11px] font-bold opacity-30">{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                        <TableCell className="py-5">
                                            <div className="font-bold text-sm text-primary tracking-tight group-hover:text-primary transition-colors">{donor.name}</div>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-[250px] font-bold opacity-50 flex items-center gap-1.5 mt-0.5">
                                                <Mail className="h-3 w-3" /> {donor.email || 'No Email Logged'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-2 text-xs font-black text-primary/80 bg-primary/5 w-fit px-2.5 py-1 rounded-full border border-primary/5">
                                                <Smartphone className="h-3.5 w-3.5 opacity-40"/> {donor.phone || 'N/A'}
                                             </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {(donor.upiIds || []).slice(0, 2).map((upi, i) => (
                                                    <Badge key={i} variant="outline" className="text-[9px] font-bold font-mono border-primary/10 bg-white/50 px-2 py-0.5 rounded-lg text-primary/60">{upi}</Badge>
                                                ))}
                                                {donor.upiIds && donor.upiIds.length > 2 && <span className="text-[9px] opacity-30 font-black tracking-widest uppercase">+{donor.upiIds.length - 2} More</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge 
                                                variant={donor.status === 'Active' ? 'active' : 'outline'} 
                                                className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm", donor.status === 'Active' ? "bg-emerald-500 text-white" : "opacity-40")}
                                            >
                                                {donor.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-8" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-90"><MoreHorizontal className="h-5 w-5"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-56">
                                                    <DropdownMenuItem onClick={() => router.push(`/donors/${donor.id}`)} className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer"><Eye className="mr-3 h-4 w-4 opacity-40"/> Full Audit View</DropdownMenuItem>
                                                    {canUpdate && <DropdownMenuItem onClick={() => router.push(`/donors/${donor.id}?edit=true`)} className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer"><Edit className="mr-3 h-4 w-4 opacity-40"/> Modify Profile</DropdownMenuItem>}
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                                            <DropdownMenuItem onClick={() => handleDelete(donor)} className="text-destructive font-black text-xs p-3 rounded-xl hover:bg-destructive/10"><Trash2 className="mr-3 h-4 w-4 opacity-80"/> Hard Delete</DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="md:hidden flex flex-col">
                        {paginatedDonors.map((donor, idx) => (
                            <div key={donor.id} className="p-5 border-b border-primary/5 bg-white/40 space-y-5 group/mobile" onClick={() => router.push(`/donors/${donor.id}`)}>
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1.5">
                                        <h3 className="font-black text-lg text-primary tracking-tighter group-hover/mobile:text-primary transition-colors leading-tight">{donor.name}</h3>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-bold opacity-60">
                                            <Mail className="h-3 w-3" /> {donor.email || 'NO EMAIL REGISTERED'}
                                        </div>
                                    </div>
                                    <Badge 
                                        variant={donor.status === 'Active' ? 'active' : 'outline'} 
                                        className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm", donor.status === 'Active' ? "bg-emerald-500 text-white" : "opacity-40")}
                                    >
                                        {donor.status}
                                    </Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center gap-3 text-xs font-black text-primary/80 bg-primary/[0.03] w-full px-4 py-2.5 rounded-2xl border border-primary/5">
                                        <Smartphone className="h-4 w-4 opacity-40"/> {donor.phone || 'NO CONTACT'}
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2">
                                    {(donor.upiIds || []).map((upi, i) => (
                                        <Badge key={i} variant="outline" className="text-[9px] font-bold font-mono border-primary/10 bg-white/50 px-2 py-1 rounded-lg text-primary/60">{upi}</Badge>
                                    ))}
                                </div>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">#{(currentPage - 1) * itemsPerPage + idx + 1} REGISTRY</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-9 text-[10px] font-black text-primary hover:bg-primary/5 px-4 rounded-xl transition-all group-hover/mobile:translate-x-1">
                                        History View <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {paginatedDonors.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 bg-primary/[0.01] animate-pulse">
                            <Users className="h-12 w-12 text-primary/10 mb-4" />
                            <p className="font-black text-sm text-primary/30 tracking-widest uppercase">No benefactor profiles matched search.</p>
                        </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" className="h-2" />
            </ScrollArea>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-primary/5 shadow-sm">
             <p className="text-xs font-black text-primary tracking-tight">Registry Page <span className="text-primary">{currentPage}</span> <span className="opacity-30">/ {totalPages}</span></p>
          </div>
          <div className="flex gap-3">
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl rounded-[32px] border-primary/10 p-0 flex flex-col max-h-[92vh] overflow-hidden shadow-2xl animate-fade-in-zoom gap-0">
            <DialogHeader className="px-8 py-7 bg-primary/5 border-b shrink-0">
                <DialogTitle className="text-2xl font-black tracking-tighter text-primary">Register Donor Identity</DialogTitle>
                <DialogDescription className="font-bold text-primary opacity-60 mt-1">Authenticate a new benefactor profile for institutional cloud synchronization.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveDonor} className="flex flex-col h-full overflow-hidden bg-white/95 backdrop-blur-sm">
                <ScrollArea className="flex-1">
                    <div className="p-8 space-y-10 pb-24">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-3">
                                <Activity className="h-4 w-4 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Core Identity Matrix</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Full Legal Name *</Label>
                                    <Input name="name" required className="font-bold h-12 rounded-2xl border-primary/10 focus:ring-primary shadow-sm" placeholder="e.g. John Doe"/>
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Primary Contact *</Label>
                                    <div className="flex gap-3">
                                        <div className="w-28 shrink-0">
                                            <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                                                <SelectTrigger className="font-bold h-12 rounded-2xl border-primary/10 shadow-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                                    <SelectItem value="+91" className="font-bold text-xs p-3 rounded-xl">🇮🇳 +91</SelectItem>
                                                    <SelectItem value="+1" className="font-bold text-xs p-3 rounded-xl">🇺🇸 +1</SelectItem>
                                                    <SelectItem value="+44" className="font-bold text-xs p-3 rounded-xl">🇬🇧 +44</SelectItem>
                                                    <SelectItem value="+971" className="font-bold text-xs p-3 rounded-xl">🇦🇪 +971</SelectItem>
                                                    <SelectItem value="+966" className="font-bold text-xs p-3 rounded-xl">🇸🇦 +966</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Input name="phone" required className="font-mono font-bold h-12 rounded-2xl border-primary/10 flex-1 shadow-sm" placeholder="10-digit Mobile"/>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Email Identifier</Label>
                                    <Input name="email" type="email" className="font-bold h-12 rounded-2xl border-primary/10 shadow-sm" placeholder="donor@institution.com"/>
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="font-black text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Residential Vector</Label>
                                    <Input name="address" className="font-bold h-12 rounded-2xl border-primary/10 shadow-sm" placeholder="Primary Address"/>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="h-4 w-4 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Verified Financial Handles</h4>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setBankDetails([...bankDetails, { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 border-primary/10 hover:bg-primary/5 transition-all">
                                    <Plus className="h-3.5 w-3.5 mr-2"/> Add Account
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {bankDetails.map((bank, idx) => (
                                    <div key={idx} className="relative p-6 rounded-[24px] border border-primary/5 bg-primary/[0.01] grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fade-in-up">
                                        {bankDetails.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-4 right-4 h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-full" onClick={() => setBankDetails(bankDetails.filter((_, i) => i !== idx))}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        )}
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest pl-1">Bank Name</Label>
                                            <Input value={bank.bankName} onChange={(e) => { const newB = [...bankDetails]; newB[idx].bankName = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-black rounded-xl border-primary/5 bg-white shadow-sm"/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest pl-1">Account No.</Label>
                                            <Input value={bank.accountNumber} onChange={(e) => { const newB = [...bankDetails]; newB[idx].accountNumber = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-black rounded-xl border-primary/5 bg-white shadow-sm"/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest pl-1">IFSC Vector</Label>
                                            <Input value={bank.ifscCode} onChange={(e) => { const newB = [...bankDetails]; newB[idx].ifscCode = e.target.value; setBankDetails(newB); }} className="h-10 text-xs font-mono font-black rounded-xl border-primary/5 bg-white shadow-sm"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                                <div className="flex items-center gap-3">
                                    <SmartphoneNfc className="h-4 w-4 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">UPI Digital Identities</h4>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setUpiIds([...upiIds, ''])} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 border-primary/10 hover:bg-primary/5 transition-all">
                                    <Plus className="h-3.5 w-3.5 mr-2"/> Add UPI
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {upiIds.map((upi, idx) => (
                                    <div key={idx} className="flex gap-3 items-center group/upi">
                                        <div className="relative flex-1">
                                            <Input value={upi} onChange={(e) => { const newU = [...upiIds]; newU[idx] = e.target.value; setUpiIds(newU); }} placeholder="handle@upi" className="font-mono font-black text-xs h-11 rounded-xl border-primary/10 shadow-sm pl-4 pr-10" />
                                            {upiIds.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setUpiIds(upiIds.filter((_, i) => i !== idx))} className="absolute right-1 top-1 h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-lg opacity-0 group-hover/upi:opacity-100 transition-all">
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-3">
                                <Activity className="h-4 w-4 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Operational Notes</h4>
                            </div>
                            <Textarea name="notes" rows={5} className="font-bold text-sm rounded-3xl border-primary/10 shadow-sm leading-relaxed p-6" placeholder="Document donor preferences, historical context, or team vetting observations..."/>
                        </div>
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
                <div className="px-8 py-6 bg-primary/5 border-t shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto font-black uppercase tracking-widest text-[10px] border-primary/10 px-8 rounded-2xl h-12 shadow-sm transition-all active:scale-95 bg-white">Discard changes</Button>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto font-black uppercase tracking-widest text-[10px] px-10 h-12 rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary/20 bg-primary text-white">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Authorize Profile
                    </Button>
                </div>
            </form>
        </DialogContent>
      </Dialog>

      <UnlinkedDonationResolver open={isResolverOpen} onOpenChange={setIsResolverOpen} />
    </main>
  );
}
