'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
    ArrowLeft, 
    PlusCircle, 
    DatabaseZap, 
    Loader2, 
    Eye, 
    Users, 
    UserCheck, 
    Hourglass, 
    CheckCircle2, 
    XCircle, 
    Info, 
    Search,
    MoreHorizontal,
    ShieldAlert,
    Trash2
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
import { useToast } from '@/hooks/use-toast';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction, updateMasterBeneficiaryAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const StatCard = ({ title, count, description, icon: Icon, colorClass }: { title: string, count: number, description: string, icon: any, colorClass?: string }) => (
    <Card className="flex-1 min-w-[150px] interactive-hover border-primary/5">
        <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">{description}</p>
            </div>
            <Icon className={cn("h-4 w-4", colorClass || "text-muted-foreground/40")} />
        </CardContent>
    </Card>
);

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const beneficiariesRef = useMemoFirebase(() => firestore ? collection(firestore, 'beneficiaries') : null, [firestore]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (b.phone || '').includes(searchTerm);
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
  }, [beneficiaries, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    if (!beneficiaries) return { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0 };
    return beneficiaries.reduce((acc, b) => {
        acc.total++;
        if (b.status === 'Pending') acc.pending++;
        else if (b.status === 'Verified') acc.verified++;
        else if (b.status === 'Given') acc.given++;
        else if (b.status === 'Hold') acc.hold++;
        else if (b.status === 'Need More Details') acc.needDetails++;
        return acc;
    }, { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0 });
  }, [beneficiaries]);

  const paginatedBeneficiaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBeneficiaries, currentPage]);

  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: string) => {
    if (!canUpdate || !userProfile) return;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus as any }, { id: userProfile.id, name: userProfile.name });
    toast({ title: res.success ? 'Status Updated' : 'Error', variant: res.success ? 'success' : 'destructive' });
  };
  
  const handleZakatToggle = async (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile) return;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: !beneficiary.isEligibleForZakat }, { id: userProfile.id, name: userProfile.name });
    toast({ title: res.success ? 'Zakat Updated' : 'Error', variant: res.success ? 'success' : 'destructive' });
  };

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  if (isLoading) return <BrandedLoader />;
  if (!canRead) return <main className="container mx-auto p-8"><Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertTitle>Access Denied</AlertTitle><AlertDescription>Missing permissions to view beneficiaries.</AlertDescription></Alert></main>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between"><Button variant="outline" asChild className="interactive-hover font-bold uppercase"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button></div>
      
      <div className="border-b mb-4">
        <div className="flex gap-2 pb-2">
            <Link href="/beneficiaries/summary" className={cn("px-4 py-2 text-sm font-bold uppercase tracking-wide rounded-md transition-all", pathname === '/beneficiaries/summary' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
            <Link href="/beneficiaries" className={cn("px-4 py-2 text-sm font-bold uppercase tracking-wide rounded-md transition-all", pathname === '/beneficiaries' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Master List</Link>
        </div>
      </div>

      <Card className="animate-fade-in-zoom shadow-md border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Master Beneficiary Hub ({stats.total})</CardTitle>
                <CardDescription className="font-bold text-foreground">Global record management for all organizational aid recipients.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Complete' : 'Sync Failed', description: res.message, variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} disabled={isSyncing} variant="outline" size="sm" className="font-bold uppercase interactive-hover"><DatabaseZap className="mr-2 h-4 w-4"/> Sync Hub</Button>
                {canCreate && <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-black uppercase tracking-widest interactive-hover shadow-lg"><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard title="Total" count={stats.total} description="Hub records" icon={Users} />
                <StatCard title="Pending" count={stats.pending} description="Awaiting vetting" icon={Hourglass} colorClass="text-amber-500" />
                <StatCard title="Verified" count={stats.verified} description="Confirmed" icon={CheckCircle2} colorClass="text-blue-500" />
                <StatCard title="Given" count={stats.given} description="Disbursed" icon={UserCheck} colorClass="text-green-600" />
                <StatCard title="Hold" count={stats.hold} description="On hold" icon={XCircle} colorClass="text-destructive" />
                <StatCard title="Need Details" count={stats.needDetails} description="Incomplete" icon={Info} colorClass="text-muted-foreground" />
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search name or phone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 h-9 text-xs" />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Details</SelectItem></SelectContent>
                </Select>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="grid grid-cols-[60px_1fr_100px_100px_120px_120px_120px_60px] bg-muted/50 border-b py-3 px-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <div>#</div>
                    <div>Name & Phone</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Zakat</div>
                    <div className="text-right">Req. Amt (₹)</div>
                    <div className="text-right">Alloc. (₹)</div>
                    <div className="text-right">Referral</div>
                    <div className="text-right">Opt</div>
                </div>
                
                <div className="w-full">
                    {paginatedBeneficiaries.map((b, idx) => (
                        <div key={b.id} className="grid grid-cols-[60px_1fr_100px_100px_120px_120px_120px_60px] items-center py-3 px-4 border-b last:border-0 hover:bg-muted/20 transition-colors text-sm">
                            <div className="text-muted-foreground font-mono text-xs">{((currentPage-1)*itemsPerPage) + idx + 1}</div>
                            <div className="truncate"><div className="font-black text-foreground truncate">{b.name}</div><div className="text-[10px] text-muted-foreground font-mono">{b.phone || 'No Phone'}</div></div>
                            <div className="flex justify-center"><Badge variant={b.status === 'Verified' ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.status}</Badge></div>
                            <div className="flex justify-center"><Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.isEligibleForZakat ? 'YES' : 'NO'}</Badge></div>
                            <div className="text-right font-mono font-bold">₹{(b.kitAmount || 0).toLocaleString()}</div>
                            <div className="text-right font-mono text-muted-foreground">₹{(b.zakatAllocation || 0).toLocaleString()}</div>
                            <div className="text-right text-[10px] font-bold uppercase truncate pl-2">{b.referralBy}</div>
                            <div className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="font-bold"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                        {canUpdate && (
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="font-bold">Status</DropdownMenuSubTrigger>
                                                <DropdownMenuPortal><DropdownMenuSubContent>
                                                    <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                                        <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                        <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                        <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                                        <DropdownMenuRadioItem value="Hold">Hold</DropdownMenuRadioItem>
                                                        <DropdownMenuRadioItem value="Need More Details">Need Details</DropdownMenuRadioItem>
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuSubContent></DropdownMenuPortal>
                                            </DropdownMenuSub>
                                        )}
                                        {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold">{b.isEligibleForZakat ? 'Mark Not Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                        {canDelete && <DropdownMenuSeparator />}
                                        {canDelete && <DropdownMenuItem onClick={async () => { const res = await deleteBeneficiaryAction(b.id); toast({ title: res.success ? 'Deleted' : 'Error', variant: res.success ? 'success' : 'destructive'}); }} className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                    {filteredBeneficiaries.length === 0 && <div className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest bg-muted/5">No beneficiaries found in the hub.</div>}
                </div>
            </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
              <p className="text-xs text-muted-foreground">Showing page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold uppercase h-8">Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold uppercase h-8">Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
    </main>
  );
}
