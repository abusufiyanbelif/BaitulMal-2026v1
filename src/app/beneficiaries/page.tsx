
'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection, doc, updateDoc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, ArrowUp, ArrowDown, DatabaseZap, Loader2, Eye, CheckCircle2, XCircle, ShieldAlert, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
  DropdownMenuSubContent,
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
import { useToast } from '@/hooks/use-toast';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction, updateMasterBeneficiaryAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50 transition-colors", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2 whitespace-nowrap">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
}

function BeneficiaryRow({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle }: {
    beneficiary: Beneficiary;
    index: number;
    canUpdate?: boolean;
    canDelete?: boolean;
    onView: (beneficiary: Beneficiary) => void;
    onEdit: (beneficiary: Beneficiary) => void;
    onDelete: (id: string) => void;
    onStatusChange: (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => void;
    onZakatToggle: (beneficiary: Beneficiary) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
            <div className="text-xs font-bold text-foreground">{value || 'N/A'}</div>
        </div>
    );
    
    return (
        <React.Fragment>
            <TableRow className="bg-background hover:bg-accent/50 cursor-pointer transition-colors group" onClick={() => setIsOpen(!isOpen)}>
                <TableCell className="w-[80px]">
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 transition-transform group-hover:scale-110">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="font-mono text-xs text-muted-foreground">{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-bold text-sm">{beneficiary.name}</TableCell>
                <TableCell className="font-mono text-xs">{beneficiary.phone}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{beneficiary.address}</TableCell>
                <TableCell className="text-center">
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'} className="text-[9px] uppercase font-black px-2">{beneficiary.isEligibleForZakat ? 'Eligible' : 'No'}</Badge>
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant={beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'outline' : 'secondary'} className="text-[9px] uppercase font-black px-2">{beneficiary.status}</Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)} className="font-bold"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)} className="font-bold"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="font-bold"><ChevronsUpDown className="mr-2 h-4 w-4" /> Status</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal><DropdownMenuSubContent>
                                        <DropdownMenuRadioGroup value={beneficiary.status} onValueChange={(s) => onStatusChange(beneficiary, s as BeneficiaryStatus)}>
                                            <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Hold">Hold</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="Need More Details">Need Details</DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent></DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                            {canUpdate && <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)} className="font-bold">{beneficiary.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
             {isOpen && (
                 <TableRow className="bg-muted/20 animate-fade-in-up">
                    <TableCell colSpan={7} className="p-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 border-l-4 border-primary">
                            <DetailItem label="Full Address" value={beneficiary.address} />
                            <DetailItem label="Family Stats" value={`Total: ${beneficiary.members || 0} | Earners: ${beneficiary.earningMembers || 0}`} />
                            <DetailItem label="Gender Split" value={`M: ${beneficiary.male || 0} | F: ${beneficiary.female || 0}`} />
                            <DetailItem label="ID Identification" value={`${beneficiary.idProofType || 'N/A'}: ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Occupation & Age" value={`${beneficiary.occupation || 'N/A'} | Age: ${beneficiary.age || 'N/A'}`} />
                            <DetailItem label="Referral Source" value={beneficiary.referralBy} />
                            {beneficiary.notes && <div className="col-span-full"><DetailItem label="Internal Notes" value={<div className="whitespace-pre-wrap leading-relaxed">{beneficiary.notes}</div>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
}

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const beneficiariesRef = useMemoFirebase(() => firestore ? collection(firestore, 'beneficiaries') : null, [firestore]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let items = beneficiaries.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (b.phone || '').includes(searchTerm);
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        return matchesSearch && matchesStatus && matchesZakat;
    });
    if (sortConfig) {
        items.sort((a, b) => {
            const aVal = String((a as any)[sortConfig.key] || '').toLowerCase();
            const bVal = String((b as any)[sortConfig.key] || '').toLowerCase();
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }
    return items;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedList = filteredAndSortedBeneficiaries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!canUpdate || !userProfile) return;
    const res = await updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus }, { id: userProfile.id, name: userProfile.name });
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
      <div className="flex items-center justify-between"><Button variant="outline" asChild className="interactive-hover"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link></Button></div>
      <div className="border-b flex gap-4"><Link href="/beneficiaries/summary" className={cn("px-4 py-2 text-sm font-bold uppercase tracking-wide", pathname === '/beneficiaries/summary' ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-primary")}>Summary</Link><Link href="/beneficiaries" className={cn("px-4 py-2 text-sm font-bold uppercase tracking-wide", pathname === '/beneficiaries' ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-primary")}>Master List</Link></div>

      <Card className="animate-fade-in-zoom shadow-md border-primary/5">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Master Beneficiaries ({filteredAndSortedBeneficiaries.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Search name or phone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-xs h-9 text-xs" />
                    <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Details</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex gap-2">
                <Button onClick={async () => { setIsSyncing(true); const res = await syncMasterBeneficiaryListAction(); toast({ title: res.success ? 'Sync Complete' : 'Sync Failed', description: res.message, variant: res.success ? 'success' : 'destructive'}); setIsSyncing(false); }} disabled={isSyncing} variant="outline" size="sm" className="font-bold uppercase"><DatabaseZap className="mr-2 h-4 w-4"/> Sync</Button>
                {canCreate && <Button onClick={() => router.push('/beneficiaries/create')} size="sm" className="font-bold uppercase interactive-hover"><PlusCircle className="mr-2 h-4 w-4" /> Create</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
              <Table>
                  <TableHeader><TableRow className="bg-muted/50">
                      <SortableHeader sortKey="srNo" className="w-[80px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                      <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                      <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Phone</SortableHeader>
                      <TableHead>Address</TableHead>
                      <SortableHeader sortKey="isEligibleForZakat" className="text-center" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                      <SortableHeader sortKey="status" className="text-center" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                      <TableHead className="text-right pr-4">Opt</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                      {paginatedList.map((b, i) => (
                        <BeneficiaryRow key={b.id} beneficiary={b} index={((currentPage-1)*itemsPerPage)+i+1} canUpdate={canUpdate} canDelete={canDelete} onView={bn => router.push(`/beneficiaries/${bn.id}`)} onEdit={bn => router.push(`/beneficiaries/${bn.id}`)} onDelete={id => { setUserToDelete(id); setIsDeleteDialogOpen(true); }} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} />
                      ))}
                      {paginatedList.length === 0 && <TableRow><TableCell colSpan={7} className="text-center h-32 font-bold uppercase tracking-widest text-muted-foreground">No entries found.</TableCell></TableRow>}
                  </TableBody>
              </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
              <p className="text-xs text-muted-foreground">Showing {paginatedList.length} of {filteredAndSortedBeneficiaries.length}</p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                  <span className="text-xs font-bold">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="uppercase font-black text-destructive">Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This will permanently remove the beneficiary from the master list and all linked initiatives.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => { const res = await deleteBeneficiaryAction(userToDelete!); toast({ title: res.success ? 'Deleted' : 'Error', variant: res.success ? 'success' : 'destructive'}); setIsDeleteDialogOpen(false); }} className="bg-destructive text-white">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
