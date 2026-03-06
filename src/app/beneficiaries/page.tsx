'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
    Loader2
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction, updateMasterBeneficiaryAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { SectionLoader } from '@/components/section-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const gridClass = "grid grid-cols-[50px_250px_120px_100px_100px_120px_140px_200px_60px] items-center gap-4 px-4 py-3 min-w-[1200px]";

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const beneficiariesRef = useMemoFirebase(() => firestore ? collection(firestore, 'beneficiaries') : null, [firestore]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (b.phone || '').includes(searchTerm) ||
                             (b.address || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        return matchesSearch && matchesStatus && matchesZakat;
    });
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter]);

  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBeneficiaries.slice(start, start + itemsPerPage);
  }, [filteredBeneficiaries, currentPage]);

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: string) => {
    if (!canUpdate || !userProfile) return;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus as any }, { id: userProfile.id, name: userProfile.name });
    toast({ title: 'Status Updated', variant: res.success ? 'success' : 'destructive' });
  };

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Loading Master List..." description="Retrieving beneficiary records from the database." />;
  
  if (!canRead) return (
    <main className="container mx-auto p-8 text-primary">
        <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-bold">Access Denied</AlertTitle>
            <AlertDescription className="font-normal text-primary/70">Missing permissions to view beneficiaries.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
      <div className="flex items-center justify-between">
        <Button variant="secondary" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link>
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Master Beneficiary List ({beneficiaries?.length || 0})</h1>
        <div className="flex items-center gap-2">
          <Button onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Complete' : 'Sync Failed', description: res.message, variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} disabled={isSyncing} variant="secondary" size="sm" className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
            Sync Master List
          </Button>
          {canCreate && (
            <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-bold active:scale-95 transition-transform shadow-md">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Beneficiary
            </Button>
          )}
        </div>
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex flex-nowrap items-center gap-3 pb-2">
                <div className="relative w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <Input placeholder="Search Name, Phone, Address..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 h-10 text-sm border-primary/20 focus-visible:ring-primary font-normal text-primary" />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All" className="font-bold">All Statuses</SelectItem>
                        <SelectItem value="Verified" className="font-bold">Verified</SelectItem>
                        <SelectItem value="Pending" className="font-bold">Pending</SelectItem>
                        <SelectItem value="Given" className="font-bold">Given</SelectItem>
                        <SelectItem value="Hold" className="font-bold">Hold</SelectItem>
                        <SelectItem value="Need More Details" className="font-bold">Need Details</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Zakat Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All" className="font-bold">All Zakat Status</SelectItem>
                        <SelectItem value="Eligible" className="font-bold">Eligible</SelectItem>
                        <SelectItem value="Not Eligible" className="font-bold">Not Eligible</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="rounded-lg border border-primary/10 bg-white overflow-hidden shadow-sm">
        <ScrollArea className="w-full">
            <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-semibold tracking-wider text-[hsl(var(--table-header-fg))]", gridClass)}>
                <div>Sr. No.</div>
                <div>Name</div>
                <div>Phone</div>
                <div className="text-center">Status</div>
                <div className="text-center">Zakat</div>
                <div className="text-right">Kit Amount (₹)</div>
                <div className="text-right">Zakat Allocation (₹)</div>
                <div className="pl-4">Referred By</div>
                <div className="text-right">Actions</div>
            </div>

            <Accordion type="single" collapsible className="w-full">
            {paginatedBeneficiaries.map((b, idx) => (
                <AccordionItem key={b.id} value={b.id} className="border-b border-primary/10 last:border-0 hover:bg-[hsl(var(--table-row-hover))] transition-colors bg-white">
                <div className={cn("py-3 px-4", gridClass)}>
                    <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                    <div className="font-bold text-sm truncate pr-2 text-primary">{b.name}</div>
                    <div className="font-mono text-xs opacity-60 text-primary">{b.phone || 'N/A'}</div>
                    <div className="text-center"><Badge variant={b.status === 'Given' ? 'given' : 'outline'} className="text-[10px] font-bold uppercase">{b.status}</Badge></div>
                    <div className="text-center"><Badge variant={b.isEligibleForZakat ? 'eligible' : 'outline'} className="text-[10px] font-bold uppercase">{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></div>
                    <div className="text-right font-mono text-sm font-bold text-primary">₹{(b.kitAmount || 0).toFixed(2)}</div>
                    <div className="text-right font-mono text-sm font-bold text-primary">₹{(b.zakatAllocation || 0).toFixed(2)}</div>
                    <div className="pl-4 text-xs font-normal text-primary/70">{b.referralBy || 'N/A'}</div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                    <ChevronDown className="h-4 w-4 text-primary shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                            </AccordionTrigger>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="font-bold text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                    {canUpdate && (
                                        <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="font-bold text-primary">Status</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal><DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                            <DropdownMenuRadioItem value="Pending" className="text-xs font-bold">Pending</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Verified" className="text-xs font-bold">Verified</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Given" className="text-xs font-bold">Given</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Hold" className="text-xs font-bold">Hold</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Need More Details" className="text-xs font-bold">Need Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent></DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    )}
                                    {canDelete && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={async () => { if(confirm('Are you sure?')) { const res = await deleteBeneficiaryAction(b.id); toast({ title: res.success ? 'Deleted' : 'Error', variant: res.success ? 'success' : 'destructive'}); } }} className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
                <AccordionContent className="bg-[hsl(var(--table-expanded-bg))] px-4 pt-0 pb-4 border-t border-primary/5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 px-12 text-primary font-normal">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Address</p>
                        <p className="text-xs leading-relaxed font-normal">{b.address || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Age</p>
                        <p className="text-xs font-normal">{b.age || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Occupation</p>
                        <p className="text-xs font-normal">{b.occupation || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Family Details</p>
                        <p className="text-xs font-normal">Total: {b.members || 0}, Earning: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">ID Proof</p>
                        <p className="text-xs font-normal">{b.idProofType || 'Aadhaar'} - {b.idNumber || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Date Added</p>
                        <p className="text-xs font-normal">{b.addedDate || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Zakat Allocation</p>
                        <p className="text-xs font-bold">₹{(b.zakatAllocation || 0).toFixed(2)}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Notes</p>
                        <p className="text-xs italic opacity-80 font-normal">{b.notes || (b.isEligibleForZakat ? `Eligible for Zakat. Amount: ${b.zakatAllocation}` : 'N/A')}</p>
                    </div>
                    </div>
                </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
            {paginatedBeneficiaries.length === 0 && (
            <div className="text-center py-20 bg-primary/[0.02] opacity-40 italic font-bold">No Beneficiaries Found Matching Criteria.</div>
            )}
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-xs font-bold opacity-60 uppercase">Page {currentPage} Of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/20 h-8">Previous</Button>
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/20 h-8">Next</Button>
          </div>
        </div>
      )}
    </main>
  );
}
