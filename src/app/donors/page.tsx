'use client';

import React, { useState, useMemo } from 'react';
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
    CheckCircle2
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
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Separator } from '@/components/ui/separator';

function StatCard({ title, count, description, icon: Icon, delay }: { title: string, count: number, description: string, icon: any, delay: string }) {
    return (
        <Card className="flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all hover:shadow-md" style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
                    <p className="text-2xl font-black text-primary tracking-tight">{count}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="text-[9px] font-medium text-muted-foreground mt-auto">{description}</p>
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
      const data = filteredDonors;
      return {
          total: data.length,
          active: data.filter(d => d.status === 'Active').length,
          inactive: data.filter(d => d.status === 'Inactive').length,
      };
  }, [filteredDonors]);

  const handleSaveDonor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreate || !userProfile) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
    const validUpis = upiIds.filter(u => u.trim() !== '');

    const data: Partial<Donor> = {
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
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
    setIsSubmitting(false);
  };

  const handleDelete = async (donor: Donor) => {
    if (!canDelete) return;
    const confirmMessage = `Permanently remove profile for ${donor.name}? Institutional financial history will be preserved as unlinked records.`;
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
  
  if (isLoading) return <SectionLoader label="Loading Donor Registry..." description="Synchronizing Institutional Contacts." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8">
        <Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertTitle className="font-bold">Access Denied</AlertTitle><AlertDescription className="font-normal text-primary/70">Missing Permissions.</AlertDescription></Alert>
    </main>
  );

  const totalPages = Math.ceil(filteredDonors.length / itemsPerPage);
  const paginatedDonors = filteredDonors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative">
      <div className="flex flex-col gap-2">
        <Button variant="outline" asChild className="w-fit font-bold border-primary/10 text-primary transition-transform active:scale-95">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link>
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Donor Registry</h1>
                <p className="text-sm font-medium text-muted-foreground opacity-70">Profiles: {donors?.length || 0}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {unlinkedDonationsCount > 0 && (
                    <Button onClick={() => setIsResolverOpen(true)} variant="secondary" size="sm" className="font-bold bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
                        <DatabaseZap className="mr-2 h-4 w-4"/> Resolve {unlinkedDonationsCount} Unlinked
                    </Button>
                )}
                {canCreate && (
                    <Button onClick={() => { setEditingDonor(null); setIsFormOpen(true); }} size="sm" className="font-bold active:scale-95 transition-transform rounded-[12px]">
                        <UserPlus className="mr-2 h-4 w-4" /> Add Donor
                    </Button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Profiles" count={stats.total} description="All Registered Donors" icon={Users} delay="100ms" />
          <StatCard title="Active Status" count={stats.active} description="Regular Contributors" icon={HeartHandshake} delay="150ms" />
          <StatCard title="Inactive" count={stats.inactive} description="Suspended Profiles" icon={X} delay="200ms" />
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <ScrollArea className="w-full">
            <div className="flex flex-nowrap items-center gap-3 pb-2">
                <div className="relative w-[300px] shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <Input 
                        placeholder="Search Name, Phone, UPI, Acc..." 
                        value={searchTerm} 
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                        className="pl-10 h-10 text-sm border-primary/10 focus-visible:ring-primary rounded-[12px] bg-white" 
                    />
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[220px] shrink-0 justify-start h-10 text-sm border-primary/10 text-primary font-bold rounded-[12px] bg-white transition-all hover:border-primary/30", !dateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-40" />
                            {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd, y")) : "Filter Registration Date"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" selected={dateRange} onSelect={(val) => { setDateRange(val); setCurrentPage(1); }} numberOfMonths={2} />
                    </PopoverContent>
                </Popover>
                
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[180px] shrink-0 h-10 text-sm border-primary/10 rounded-[12px] bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent className="rounded-[12px] shadow-dropdown">
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden">
        <ScrollArea className="w-full">
            <div className="min-w-[1000px]">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-primary/5">
                            <TableHead className="w-[60px] pl-4 text-[10px] uppercase font-bold tracking-tight">#</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Donor Identity</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Primary Contact</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Financial Handles</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-bold tracking-tight">Registry Status</TableHead>
                            <TableHead className="text-right pr-6 text-[10px] uppercase font-bold tracking-tight">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedDonors.map((donor, idx) => (
                            <TableRow key={donor.id} onClick={() => router.push(`/donors/${donor.id}`)} className="cursor-pointer hover:bg-primary/[0.02] border-b border-primary/5 last:border-0 bg-white">
                                <TableCell className="pl-4 font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                <TableCell className="py-4">
                                    <div className="font-bold text-sm text-primary">{donor.name}</div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{donor.email || 'No email'}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-primary"><Smartphone className="h-3 w-3 opacity-40"/> {donor.phone}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {(donor.upiIds || []).slice(0, 2).map((upi, i) => (
                                            <Badge key={i} variant="outline" className="text-[8px] font-mono border-primary/10">{upi}</Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center"><Badge variant={donor.status === 'Active' ? 'eligible' : 'outline'} className="text-[10px] font-bold">{donor.status}</Badge></TableCell>
                                <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                            <DropdownMenuItem onSelect={() => router.push(`/donors/${donor.id}`)} className="text-primary font-normal cursor-pointer"><Eye className="mr-2 h-4 w-4 opacity-60"/> View Details</DropdownMenuItem>
                                            {canUpdate && <DropdownMenuItem onSelect={() => router.push(`/donors/${donor.id}?edit=true`)} className="text-primary font-normal cursor-pointer"><Edit className="mr-2 h-4 w-4 opacity-60"/> Edit Profile</DropdownMenuItem>}
                                            {canDelete && (
                                                <DropdownMenuItem onSelect={() => handleDelete(donor)} className="text-destructive font-normal cursor-pointer"><Trash2 className="mr-2 h-4 w-4"/> Delete Profile</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} Of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl rounded-[16px] border-primary/10 p-0 flex flex-col max-h-[90vh]">
            <DialogHeader className="px-6 py-4 bg-primary/5 border-b"><DialogTitle className="text-xl font-bold">Register Donor Profile</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveDonor} className="flex flex-col h-full overflow-hidden">
                <ScrollArea className="flex-1"><div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="font-bold text-xs uppercase">Full Name *</Label><Input name="name" required className="font-bold h-10" /></div>
                        <div className="space-y-2"><Label className="font-bold text-xs uppercase">Phone Number *</Label><Input name="phone" required className="font-mono h-10" /></div>
                    </div>
                    <div className="space-y-2"><Label className="font-bold text-xs uppercase">Email</Label><Input name="email" type="email" className="font-normal h-10" /></div>
                    <div className="space-y-2"><Label className="font-bold text-xs uppercase">Address</Label><Input name="address" className="font-normal h-10" /></div>
                    <div className="space-y-2"><Label className="font-bold text-xs uppercase">Notes</Label><Textarea name="notes" rows={3} className="font-normal" /></div>
                </div></ScrollArea>
                <DialogFooter className="px-6 py-4 bg-primary/5 border-t"><Button type="submit" disabled={isSubmitting} className="font-bold">{isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2"/>} Secure Profile</Button></DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <UnlinkedDonationResolver open={isResolverOpen} onOpenChange={setIsResolverOpen} />
    </main>
  );
}
