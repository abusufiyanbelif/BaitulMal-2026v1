'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
    ArrowLeft, 
    PlusCircle, 
    DatabaseZap, 
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';

const gridClass = "grid grid-cols-[60px_1fr_100px_100px_120px_120px_120px_60px]";

const StatCard = ({ title, count, description, icon: Icon, colorClass }: { title: string, count: number, description: string, icon: any, colorClass?: string }) => (
    <Card className="flex-1 min-w-[150px] interactive-hover border-primary/10 shadow-sm">
        <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
                <p className="text-2xl font-black text-primary">{count}</p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap font-bold uppercase">{description}</p>
            </div>
            <Icon className={cn("h-4 w-4", colorClass || "text-primary/40")} />
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

  const groupedBeneficiaries = useMemo(() => {
    const groups: Record<string, Beneficiary[]> = {};
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filteredBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
    
    paginated.forEach(b => {
        const referral = b.referralBy || 'Self / General';
        if (!groups[referral]) groups[referral] = [];
        groups[referral].push(b);
    });
    return groups;
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
  if (!canRead) return (
    <main className="container mx-auto p-8">
        <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-black uppercase">Access Denied</AlertTitle>
            <AlertDescription className="font-bold">Missing permissions to view beneficiaries.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between"><Button variant="outline" asChild className="interactive-hover font-bold uppercase border-primary/20 text-primary"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button></div>
      
      <div className="border-b border-primary/10 mb-4">
        <div className="flex gap-2 pb-2">
            <Link href="/beneficiaries/summary" className={cn("px-4 py-2 text-sm font-black uppercase tracking-widest rounded-md transition-all", pathname === '/beneficiaries/summary' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
            <Link href="/beneficiaries" className={cn("px-4 py-2 text-sm font-black uppercase tracking-widest rounded-md transition-all", pathname === '/beneficiaries' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Master Hub</Link>
        </div>
      </div>

      <Card className="animate-fade-in-zoom shadow-md border-primary/10 bg-white">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Master Beneficiary Hub ({stats.total})</CardTitle>
                <CardDescription className="font-bold text-foreground/70 uppercase text-[10px] tracking-widest">Global record management grouped by referral source.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Complete' : 'Sync Failed', description: res.message, variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} disabled={isSyncing} variant="outline" size="sm" className="font-black uppercase tracking-widest text-[10px] border-primary/20 text-primary"><DatabaseZap className="mr-2 h-4 w-4"/> Sync Hub</Button>
                {canCreate && <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-black uppercase tracking-widest interactive-hover shadow-lg bg-[#0B6623] hover:bg-[#0B6623]/90 text-white"><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard title="Total" count={stats.total} description="Hub records" icon={Users} />
                <StatCard title="Pending" count={stats.pending} description="Awaiting vetting" icon={Hourglass} colorClass="text-amber-500" />
                <StatCard title="Verified" count={stats.verified} description="Confirmed" icon={CheckCircle2} colorClass="text-blue-500" />
                <StatCard title="Given" count={stats.given} description="Disbursed" icon={UserCheck} colorClass="text-success" />
                <StatCard title="Hold" count={stats.hold} description="On hold" icon={XCircle} colorClass="text-destructive" />
                <StatCard title="Need Details" count={stats.needDetails} description="Incomplete" icon={Info} colorClass="text-muted-foreground" />
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-3 rounded-lg border border-primary/10">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary/50" />
                    <Input placeholder="Search name or phone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 h-9 text-xs border-primary/20 focus-visible:ring-primary text-foreground font-bold" />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 text-xs font-black uppercase border-primary/20 text-primary"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Details</SelectItem></SelectContent>
                </Select>
            </div>

            <div className="border border-primary/10 rounded-lg overflow-hidden bg-card min-w-[900px]">
                <div className={cn("bg-primary/5 border-b border-primary/10 py-3 px-4 text-[10px] uppercase font-black tracking-widest text-primary/70", gridClass)}>
                    <div>#</div>
                    <div>Name & Phone</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Zakat</div>
                    <div className="text-right">Req. Amt (₹)</div>
                    <div className="text-right">Alloc. (₹)</div>
                    <div className="text-right">Referral</div>
                    <div className="text-right">Opt</div>
                </div>
                
                <Accordion type="multiple" defaultValue={Object.keys(groupedBeneficiaries)} className="w-full">
                    {Object.entries(groupedBeneficiaries).map(([referral, list]) => (
                        <AccordionItem key={referral} value={referral} className="border-none">
                            <AccordionTrigger className="hover:no-underline bg-primary/10 px-4 py-3 border-b border-primary/10 group transition-colors">
                                <div className="flex items-center gap-3"><span className="text-sm font-black text-primary uppercase tracking-tight">{referral} ({list.length})</span></div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                                {list.map((b, idx) => (
                                    <div key={b.id} className={cn("items-center py-3 px-4 border-b border-primary/5 last:border-0 hover:bg-primary/5 transition-colors text-sm font-bold", gridClass)}>
                                        <div className="text-muted-foreground font-mono text-xs">{((currentPage-1)*itemsPerPage) + idx + 1}</div>
                                        <div className="truncate"><div className="font-black text-foreground truncate">{b.name}</div><div className="text-[10px] text-muted-foreground font-mono">{b.phone || 'No Phone'}</div></div>
                                        <div className="flex justify-center"><Badge variant={b.status === 'Verified' ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.status}</Badge></div>
                                        <div className="flex justify-center"><Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.isEligibleForZakat ? 'YES' : 'NO'}</Badge></div>
                                        <div className="text-right font-mono font-black text-primary">₹{(b.kitAmount || 0).toLocaleString()}</div>
                                        <div className="text-right font-mono text-muted-foreground">₹{(b.zakatAllocation || 0).toLocaleString()}</div>
                                        <div className="text-right text-[10px] font-black uppercase truncate pl-2 text-foreground">{b.referralBy}</div>
                                        <div className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}`)} className="font-black uppercase text-[10px] text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                    {canUpdate && (
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger className="font-black uppercase text-[10px]">Status</DropdownMenuSubTrigger>
                                                            <DropdownMenuPortal><DropdownMenuSubContent>
                                                                <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                                                    <DropdownMenuRadioItem value="Pending" className="text-[10px] font-bold">Pending</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Verified" className="text-[10px] font-bold">Verified</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Given" className="text-[10px] font-bold">Given</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Hold" className="text-[10px] font-bold">Hold</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Need More Details" className="text-[10px] font-bold">Need Details</DropdownMenuRadioItem>
                                                                </DropdownMenuRadioGroup>
                                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                                        </DropdownMenuSub>
                                                    )}
                                                    {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-black uppercase text-[10px] text-primary">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                                    {canDelete && <DropdownMenuSeparator />}
                                                    {canDelete && <DropdownMenuItem onClick={async () => { const res = await deleteBeneficiaryAction(b.id); toast({ title: res.success ? 'Deleted' : 'Error', variant: res.success ? 'success' : 'destructive'}); }} className="text-destructive font-black uppercase text-[10px]"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                {filteredBeneficiaries.length === 0 && <div className="text-center py-20 text-primary/40 font-black uppercase tracking-widest bg-primary/5">No beneficiaries found matching filters.</div>}
            </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between border-t border-primary/10 py-4 bg-primary/5">
              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Showing page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-black uppercase tracking-widest text-[10px] h-8 border-primary/20 text-primary">Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-black uppercase tracking-widest text-[10px] h-8 border-primary/20 text-primary">Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
    </main>
  );
}