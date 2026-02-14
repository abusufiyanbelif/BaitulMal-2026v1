
'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection } from 'firebase/firestore';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, ShieldAlert, ArrowUp, ArrowDown, DatabaseZap, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getNestedValue } from '@/lib/utils';

type SortKey = keyof Beneficiary | 'srNo';

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [isSyncing, setIsSyncing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const beneficiariesCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'beneficiaries');
  }, [firestore]);
  
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const handleAdd = () => {
    if (!canCreate) return;
    router.push('/beneficiaries/create');
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
    toast({ title: 'Syncing Master List...', description: 'Please wait while we check all campaigns and leads for new beneficiaries.' });
    
    const result = await syncMasterBeneficiaryListAction();
    
    if (result.success) {
      toast({ title: 'Sync Complete', description: result.message, variant: 'success' });
    } else {
      toast({ title: 'Sync Failed', description: result.message, variant: 'destructive' });
    }

    setIsSyncing(false);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !canDelete) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to delete beneficiaries.', variant: 'destructive'});
        return;
    };
    
    setIsDeleteDialogOpen(false);

    const result = await deleteBeneficiaryAction(beneficiaryToDelete);

    if (result.success) {
        toast({ title: 'Beneficiary Deleted', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
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

    // Filtering
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(b => b.status === statusFilter);
    }
    if (zakatFilter !== 'All') {
        const isEligible = zakatFilter === 'Eligible';
        sortableItems = sortableItems.filter(b => !!b.isEligibleForZakat === isEligible);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => 
            (b.name || '').toLowerCase().includes(lowercasedTerm) ||
            (b.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (b.address || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    // Sorting
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aValue = a[sortConfig.key as keyof Beneficiary] ?? '';
            const bValue = b[sortConfig.key as keyof Beneficiary] ?? '';
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
             if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                 return sortConfig.direction === 'ascending' ? (aValue === bValue ? 0 : aValue ? -1 : 1) : (aValue === bValue ? 0 : aValue ? 1 : -1);
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                 if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }
            return 0;
        });
    }

    return sortableItems;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedBeneficiaries, currentPage, itemsPerPage]);

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
  };
  
  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                <CardContent>
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        </main>
    )
  }
  
  if (!canRead) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to view beneficiaries.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
          <Button variant="outline" asChild>
              <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
              </Link>
          </Button>
      </div>

      <Card className="animate-fade-in-zoom">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
                <CardTitle>Master Beneficiary List ({filteredAndSortedBeneficiaries.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Input 
                        placeholder="Search name, phone, address..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="max-w-sm"
                    />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[150px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                            <SelectItem value="Need More Details">Need More Details</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={zakatFilter} onValueChange={(value) => { setZakatFilter(value); setCurrentPage(1); }}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by Zakat" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Zakat Status</SelectItem>
                          <SelectItem value="Eligible">Eligible</SelectItem>
                          <SelectItem value="Not Eligible">Not Eligible</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={handleSyncMasterList} disabled={isSyncing || areBeneficiariesLoading} variant="outline">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                    Sync Master List
                </Button>
                {canCreate && (
                    <Button onClick={handleAdd} disabled={areBeneficiariesLoading}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Beneficiary
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                          <SortableHeader sortKey="srNo">#</SortableHeader>
                          <SortableHeader sortKey="name">Name</SortableHeader>
                          <SortableHeader sortKey="phone">Phone</SortableHeader>
                          <SortableHeader sortKey="address">Address</SortableHeader>
                           <SortableHeader sortKey="isEligibleForZakat">Zakat</SortableHeader>
                          <SortableHeader sortKey="status">Status</SortableHeader>
                          {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {areBeneficiariesLoading ? (
                          [...Array(10)].map((_, i) => (
                              <TableRow key={`skeleton-${i}`}>
                                  <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  {(canUpdate || canDelete) && <TableCell><Skeleton className="h-5 w-10 ml-auto" /></TableCell>}
                              </TableRow>
                          ))
                      ) : paginatedBeneficiaries.length > 0 ? (
                          paginatedBeneficiaries.map((beneficiary, index) => (
                          <TableRow key={beneficiary.id} onClick={() => handleEdit(beneficiary)} className="cursor-pointer">
                              <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
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
                              <TableCell className="text-right">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon">
                                              <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          {canUpdate && (
                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(beneficiary)}}>
                                                  <Edit className="mr-2 h-4 w-4" />
                                                  View / Edit
                                              </DropdownMenuItem>
                                          )}
                                          {canDelete && <DropdownMenuSeparator />}
                                          {canDelete && (
                                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleDeleteClick(beneficiary.id)}} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                  Delete
                                              </DropdownMenuItem>
                                          )}
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </TableCell>
                              )}
                          </TableRow>
                      ))
                      ) : (
                      <TableRow>
                          <TableCell colSpan={canUpdate || canDelete ? 7 : 6} className="text-center h-24 text-muted-foreground">
                              No beneficiaries found matching your criteria.
                          </TableCell>
                      </TableRow>
                      )}
                  </TableBody>
              </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                  Showing {paginatedBeneficiaries.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedBeneficiaries.length)} of {filteredAndSortedBeneficiaries.length} beneficiaries
              </p>
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
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the beneficiary and all of their associated data.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
