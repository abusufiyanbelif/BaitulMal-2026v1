'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection, collection, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, ArrowUp, ArrowDown, DatabaseZap, Loader2, Eye, CheckCircle2, Hourglass, XCircle, Info, ChevronsUpDown, ChevronDown, ChevronUp, BadgeCheck, ShieldAlert } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2">
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
        <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</p>
            <div className="text-sm font-medium pt-1">{value || 'N/A'}</div>
        </div>
    );
    
    return (
        <>
            <TableRow className="bg-background hover:bg-accent/50 data-[state=open]:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[100px]">
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-accent" data-state={isOpen ? 'open' : 'closed'}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span>{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">{beneficiary.name}</TableCell>
                <TableCell>{beneficiary.phone}</TableCell>
                <TableCell className="truncate max-w-xs">{beneficiary.address}</TableCell>
                <TableCell>
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'secondary' : 'outline'}>{beneficiary.status}</Badge>
                </TableCell>
                {(canUpdate || canDelete) && (
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuSeparator />}
                             {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ChevronsUpDown className="mr-2 h-4 w-4" />
                                        <span>Change Status</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                                value={beneficiary.status}
                                                onValueChange={(newStatus) => onStatusChange(beneficiary, newStatus as BeneficiaryStatus)}
                                            >
                                                <DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2 h-4 w-4"/>Pending</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2 h-4 w-4"/>Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2 h-4 w-4"/>Given</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Hold"><XCircle className="mr-2 h-4 w-4"/>Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details"><Info className="mr-2 h-4 w-4"/>Need Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                             {canUpdate && (
                                <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>
                                    {beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    <span>{beneficiary.isEligibleForZakat ? 'Mark Not Eligible' : 'Mark Zakat Eligible'}</span>
                                </DropdownMenuItem>
                            )}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && (
                                <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                )}
            </TableRow>
             {isOpen && (
                 <TableRow className="bg-muted/20 hover:bg-muted/30">
                    <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="p-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 p-4">
                            <DetailItem label="Address" value={beneficiary.address} />
                            <DetailItem label="Age" value={beneficiary.age} />
                            <DetailItem label="Occupation" value={beneficiary.occupation} />
                            <DetailItem label="Family" value={`Total: ${beneficiary.members}, Earning: ${beneficiary.earningMembers}, M: ${beneficiary.male}, F: ${beneficiary.female}`} />
                            <DetailItem label="ID Proof" value={`${beneficiary.idProofType || 'N/A'} - ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Date Added" value={beneficiary.addedDate} />
                            {beneficiary.notes && <div className="sm:col-span-2 lg:grid-cols-3"><DetailItem label="Notes" value={<div className="whitespace-pre-wrap">{beneficiary.notes}</div>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
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
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'beneficiaries');
  }, [firestore]);
  
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const handleAdd = () => {
    if (!canCreate) return;
    router.push('/beneficiaries/create');
  };
  
  const handleView = (beneficiary: Beneficiary) => {
    router.push(`/beneficiaries/${beneficiary.id}`);
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    if (!canUpdate) return;
    router.push(`/beneficiaries/${beneficiary.id}`);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setBeneficiaryToDelete(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleSyncMasterList = async () => {
    setIsSyncing(true);
    toast({ title: 'Syncing Master List...', description: 'Checking all campaigns and leads.' });
    const result = await syncMasterBeneficiaryListAction();
    if (result.success) {
      toast({ title: 'Sync Complete', description: result.message, variant: 'success' });
    } else {
      toast({ title: 'Sync Failed', description: result.message, variant: 'destructive' });
    }
    setIsSyncing(false);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    const result = await deleteBeneficiaryAction(beneficiaryToDelete!);
    toast({ title: result.success ? 'Deleted' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
    setBeneficiaryToDelete(null);
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let sortableItems = [...beneficiaries];

    if (statusFilter !== 'All') sortableItems = sortableItems.filter(b => b.status === statusFilter);
    if (zakatFilter !== 'All') sortableItems = sortableItems.filter(b => !!b.isEligibleForZakat === (zakatFilter === 'Eligible'));
    
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => (b.name || '').toLowerCase().includes(lower) || (b.phone || '').includes(searchTerm) || (b.address || '').toLowerCase().includes(lower));
    }

    if (sortConfig) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = String(a[sortConfig.key as keyof Beneficiary] ?? '').toLowerCase();
            const bVal = String(b[sortConfig.key as keyof Beneficiary] ?? '').toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiariesList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedBeneficiaries, currentPage, itemsPerPage]);

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!canUpdate || !userProfile) return;
    const result = await updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus }, { id: userProfile.id, name: userProfile.name });
    toast({ title: result.success ? 'Status Updated' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
  };
  
  const handleZakatToggle = async (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const result = await updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
    toast({ title: result.success ? 'Zakat Updated' : 'Error', description: result.message, variant: result.success ? 'success' : 'destructive' });
  };

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
  if (isLoading) return <main className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></main>;
  
  if (!canRead) return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
            <Button variant="outline" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                </Link>
            </Button>
        </div>
        <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>Missing permissions.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
          <Button variant="outline" asChild className="transition-transform active:scale-95">
              <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Link>
          </Button>
      </div>
      
      <div className="border-b mb-4">
        <div className="flex space-x-2">
            <Link href="/beneficiaries/summary" className={cn("px-3 py-1.5 text-sm font-medium rounded-md", pathname === '/beneficiaries/summary' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50")}>Summary</Link>
            <Link href="/beneficiaries" className={cn("px-3 py-1.5 text-sm font-medium rounded-md", pathname === '/beneficiaries' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50")}>Beneficiary List</Link>
        </div>
      </div>

      <Card className="animate-fade-in-zoom shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
                <CardTitle>Master Beneficiary List ({filteredAndSortedBeneficiaries.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-sm" />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[150px]">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                            <SelectItem value="Need More Details">Need Details</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={zakatFilter} onValueChange={(value) => { setZakatFilter(value); setCurrentPage(1); }}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Zakat Eligibility" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Zakat</SelectItem>
                          <SelectItem value="Eligible">Eligible</SelectItem>
                          <SelectItem value="Not Eligible">Not Eligible</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={handleSyncMasterList} disabled={isSyncing} variant="outline" size="sm">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>} Sync
                </Button>
                {canCreate && (
                    <Button onClick={handleAdd} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                          <SortableHeader sortKey="srNo" className="w-[100px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                          <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                          <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Phone</SortableHeader>
                          <SortableHeader sortKey="address" sortConfig={sortConfig} handleSort={handleSort}>Address</SortableHeader>
                           <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                          <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                          {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right pr-4">Actions</TableHead>}
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paginatedBeneficiariesList.map((beneficiary, index) => (
                        <BeneficiaryRow
                            key={beneficiary.id}
                            beneficiary={beneficiary}
                            index={(currentPage - 1) * itemsPerPage + index + 1}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                            onView={handleView}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onStatusChange={handleStatusChange}
                            onZakatToggle={handleZakatToggle}
                        />
                      ))}
                      {paginatedBeneficiariesList.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No records found.</TableCell></TableRow>
                      )}
                  </TableBody>
              </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
              <p className="text-sm text-muted-foreground">Showing {paginatedBeneficiariesList.length} of {filteredAndSortedBeneficiaries.length}</p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Permanent Deletion</AlertDialogTitle><AlertDialogDescription>This will delete the beneficiary from the master list and all linked initiatives.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
