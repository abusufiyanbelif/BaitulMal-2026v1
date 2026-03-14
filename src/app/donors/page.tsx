'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Donor, BankDetail, Donation } from '@/lib/types';
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
    Eye
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
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isResolverOpen, setIsResolverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);

  const [bankDetails, setBankDetails] = useState<BankDetail[]>([{ bankName: '', accountNumber: '', ifscCode: '' }]);
  const [upiIds, setUpiIds] = useState<string[]>(['']);

  const donorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donors') : null, [firestore]);
  const { data: donors, isLoading: areDonorsLoading } = useCollection<Donor>(donorsRef);

  const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
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
        const matchesSearch = (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (d.phone || '').includes(searchTerm) ||
                             (d.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [donors, searchTerm, statusFilter]);

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
    if (!canDelete) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to delete profiles.', variant: 'destructive' });
        return;
    }
    
    const confirmMessage = `Permanently Remove Profile For ${donor.name}? Institutional financial history will be preserved as unlinked "dummy" records. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    setIsSubmitting(true);
    try {
        const res = await deleteDonorAction(donor.id);
        if (res.success) {
            toast({ title: 'Profile Removed', description: res.message, variant: 'success' });
        } else {
            toast({ title: 'Removal Failed', description: res.message, variant: 'destructive' });
        }
    } catch (e: any) {
        toast({ title: 'System Error', description: e.message || 'An unexpected error occurred during the purge.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const isLoading = areDonorsLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Loading Donor Registry..." description="Synchronizing Institutional Contacts." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8">
        <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-bold">Access Denied</AlertTitle>
            <AlertDescription className="font-normal text-primary/70">Missing Permissions To View Donor Profiles.</AlertDescription>
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
                <h1 className="text-3xl font-bold tracking-tight text-primary">Donor Registry</h1>
                <p className="text-sm font-medium text-muted-foreground opacity-70">Total Registered Profiles: {donors?.length || 0}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {unlinkedDonationsCount > 0 && (
                    <Button onClick={() => setIsResolverOpen(true)} variant="secondary" size="sm" className="font-bold bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 active:scale-95 transition-transform animate-pulse">
                        <DatabaseZap className="mr-2 h-4 w-4"/> Resolve {unlinkedDonationsCount} Unlinked
                    </Button>
                )}
                <Button variant="outline" size="sm" asChild className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                    <Link href="/donors/summary"><TrendingUp className="mr-2 h-4 w-4"/> Impact Summary</Link>
                </Button>
                {canCreate && (
                    <Button onClick={() => { setEditingDonor(null); setIsFormOpen(true); }} size="sm" className="font-bold active:scale-95 transition-transform shadow-none rounded-[12px]">
                        <UserPlus className="mr-2 h-4 w-4" /> Add Donor Profile
                    </Button>
                )}
            </div>
        </div>
      </div>

      {unlinkedDonationsCount > 0 && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 animate-fade-in-down">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-bold">Fragmented Identities Detected</AlertTitle>
              <AlertDescription className="font-normal text-xs flex items-center justify-between gap-4">
                  There are {unlinkedDonationsCount} contributions that are not yet mapped to a verified Donor Profile.
                  <Button onClick={() => setIsResolverOpen(true)} size="sm" variant="link" className="font-bold text-amber-800 p-0 underline h-auto uppercase tracking-tighter">Start Resolver Hub</Button>
              </AlertDescription>
          </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Profiles" count={stats.total} description="All Registered Donors" icon={Users} delay="100ms" />
          <StatCard title="Active Status" count={stats.active} description="Regular Contributors" icon={HeartHandshake} delay="150ms" />
          <StatCard title="Inactive" count={stats.inactive} description="Suspended Profiles" icon={X} delay="200ms" />
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input 
                    placeholder="Search Name, Phone, Email..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-10 h-10 text-sm border-primary/10 focus-visible:ring-primary font-normal text-primary rounded-[12px]" 
                />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-10 text-sm border-primary/10 text-primary font-normal rounded-[12px] bg-white">
                    <SelectValue placeholder="Account Status" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                    <SelectItem value="All" className="font-normal">All Statuses</SelectItem>
                    <SelectItem value="Active" className="font-normal text-primary">Active</SelectItem>
                    <SelectItem value="Inactive" className="font-normal text-destructive">Inactive</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm">
        <ScrollArea className="w-full">
            <div className="min-w-[900px]">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-primary/10">
                            <TableHead className="w-[60px] pl-6 text-[10px] uppercase font-bold tracking-tight">#</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Donor Name</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Phone Number</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-tight">Email Address</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-bold tracking-tight">Status</TableHead>
                            <TableHead className="text-right pr-6 text-[10px] uppercase font-bold tracking-tight">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDonors.map((donor, idx) => (
                            <TableRow key={donor.id} onClick={() => router.push(`/donors/${donor.id}`)} className="cursor-pointer hover:bg-primary/[0.02] transition-colors border-b border-primary/5 last:border-0 bg-white">
                                <TableCell className="pl-6 font-mono text-xs opacity-60">{idx + 1}</TableCell>
                                <TableCell className="font-bold text-sm text-primary">{donor.name}</TableCell>
                                <TableCell className="font-mono text-xs opacity-70">{donor.phone || '---'}</TableCell>
                                <TableCell className="text-xs font-normal text-muted-foreground">{donor.email || '---'}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={donor.status === 'Active' ? 'active' : 'outline'} className="text-[10px] font-bold">
                                        {donor.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4"/></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push(`/donors/${donor.id}`); }} className="text-primary font-normal cursor-pointer">
                                                    <Eye className="mr-2 h-4 w-4 opacity-60"/> View Profile
                                                </DropdownMenuItem>
                                                {canUpdate && (
                                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push(`/donors/${donor.id}?edit=true`); }} className="text-primary font-normal cursor-pointer">
                                                        <Edit className="mr-2 h-4 w-4 opacity-60"/> Edit Profile
                                                    </DropdownMenuItem>
                                                )}
                                                {canDelete && (
                                                    <>
                                                        <DropdownMenuSeparator className="bg-primary/10" />
                                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDelete(donor); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-normal cursor-pointer">
                                                            <Trash2 className="mr-2 h-4 w-4"/> Remove Profile
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredDonors.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-24 text-primary/40 font-bold italic bg-primary/[0.01]">No Donor Profiles Found Matching Criteria.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl rounded-[16px] border-primary/10 p-0 overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader className="px-6 py-4 bg-primary/5 border-b">
                <DialogTitle className="text-xl font-bold text-primary tracking-tight">Register Institutional Donor Profile</DialogTitle>
                <DialogDescription className="font-normal text-primary/70">Establish a verifiable record for institutional contributors.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveDonor} className="flex flex-col h-full overflow-hidden">
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Core Identity</h4>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Full Name *</Label>
                                <Input name="name" required placeholder="e.g. Abdullah Khan" className="font-bold h-10" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Phone Number *</Label>
                                    <Input name="phone" required placeholder="10-digit mobile" className="font-mono h-10" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Email Address</Label>
                                    <Input name="email" type="email" placeholder="donor@example.com" className="font-normal h-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Residential Address</Label>
                                <Input name="address" placeholder="Full Address" className="font-normal h-10" />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bank Records</h4>
                                <Button type="button" variant="outline" size="sm" onClick={() => setBankDetails([...bankDetails, { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-7 text-[10px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add Account</Button>
                            </div>
                            {bankDetails.map((bank, idx) => (
                                <div key={idx} className="relative p-4 rounded-xl border border-dashed border-primary/20 bg-primary/[0.01] grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {bankDetails.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 text-destructive" onClick={() => setBankDetails(bankDetails.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3"/></Button>
                                    )}
                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Bank Name</Label><Input value={bank.bankName} onChange={(e) => { const newB = [...bankDetails]; newB[idx].bankName = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-bold"/></div>
                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Account No.</Label><Input value={bank.accountNumber} onChange={(e) => { const newB = [...bankDetails]; newB[idx].accountNumber = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-mono"/></div>
                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">IFSC Code</Label><Input value={bank.ifscCode} onChange={(e) => { const newB = [...bankDetails]; newB[idx].ifscCode = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-mono"/></div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">UPI Identifiers</h4>
                                <Button type="button" variant="outline" size="sm" onClick={() => setUpiIds([...upiIds, ''])} className="h-7 text-[10px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add UPI</Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {upiIds.map((upi, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input value={upi} onChange={(e) => { const newU = [...upiIds]; newU[idx] = e.target.value; setUpiIds(newU); }} placeholder="name@upi" className="font-mono text-xs h-9" />
                                        {upiIds.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setUpiIds(upiIds.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Administrative Control</h4>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Account Status</Label>
                                <Select name="status" defaultValue="Active">
                                    <SelectTrigger className="font-bold h-10"><SelectValue/></SelectTrigger>
                                    <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                        <SelectItem value="Active" className="font-normal text-primary">Active</SelectItem>
                                        <SelectItem value="Inactive" className="font-normal text-destructive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs uppercase text-muted-foreground tracking-widest">Institutional Notes</Label>
                                <Textarea name="notes" placeholder="Donor preferences, historical context, etc." rows={3} className="font-normal" />
                            </div>
                        </div>
                    </div>
                    <ScrollBar />
                </ScrollArea>
                <DialogFooter className="px-6 py-4 bg-primary/5 border-t">
                    <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto font-bold shadow-md transition-transform active:scale-95 px-8">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Register Profile
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <UnlinkedDonationResolver open={isResolverOpen} onOpenChange={setIsResolverOpen} />
    </main>
  );
}
