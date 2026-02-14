
'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, setDoc, DocumentReference, writeBatch, updateDoc } from 'firebase/firestore';
import type { Beneficiary, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronsUpDown, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSeparator,
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

export default function BeneficiariesPage() {
  const params = useParams();
  const pathname = usePathname();
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading, forceRefetch: forceRefetchLead } = useDoc<Lead>(leadDocRef);
  
  const beneficiariesCollectionRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return collection(firestore, 'leads', leadId, 'beneficiaries');
  }, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.delete', false);
  
  const totalLeadAmount = useMemo(() => {
    if (!lead || !lead.itemCategories || lead.itemCategories.length === 0) return 0;
    const items = lead.itemCategories[0]?.items || [];
    return items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  }, [lead]);

  const kitAmountLabel = useMemo(() => {
      switch (lead?.purpose) {
          case 'Medical': return 'Medical Cost (₹)';
          case 'Education': return 'Educational Fees (₹)';
          case 'Relief': return 'Relief Aid Amount (₹)';
          default: return 'Required Amount (₹)';
      }
  }, [lead?.purpose]);

  const handleAdd = () => {
    if (!canCreate) return;
    setEditingBeneficiary(null);
    setFormMode('add');
    setIsFormOpen(true);
  };

  const handleView = (beneficiary: Beneficiary) => {
    setEditingBeneficiary(beneficiary);
    setFormMode('view');
    setIsFormOpen(true);
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    if (!canUpdate) return;
    setEditingBeneficiary(beneficiary);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setBeneficiaryToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !firestore || !storage || !leadId || !canDelete || !beneficiaries || !lead) return;

    const beneficiaryData = beneficiaries.find(b => b.id === beneficiaryToDelete);
    if (!beneficiaryData) return;
    
    setIsDeleteDialogOpen(false);

    const batch = writeBatch(firestore);
    const beneficiaryDocRef = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiaryToDelete);
    const leadDocRef = doc(firestore, 'leads', leadId);

    const amountToSubtract = beneficiaryData.kitAmount || 0;
    const newTargetAmount = (lead.targetAmount || 0) - amountToSubtract;

    batch.delete(beneficiaryDocRef);
    batch.update(leadDocRef, { targetAmount: newTargetAmount });
    
    if (beneficiaryData.idProofUrl) {
        const fileRef = storageRef(storage, beneficiaryData.idProofUrl);
        await deleteObject(fileRef).catch(err => {
            if (err.code !== 'storage/object-not-found') {
                console.warn("Failed to delete ID proof from storage, but Firestore transaction will proceed:", err);
            }
        });
    }

    try {
        await batch.commit();
        toast({ title: 'Success', description: 'Beneficiary deleted and lead total updated.', variant: 'success' });
        forceRefetch();
        forceRefetchLead();
    } catch (serverError) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `Batch operation on leads/${leadId}`,
            operation: 'write'
        }));
    } finally {
        setBeneficiaryToDelete(null);
    }
  };
  
  const handleFormSubmit = async (data: BeneficiaryFormData, masterId?: string) => {
    if (!firestore || !storage || !leadId || !userProfile || !lead) return;
    if (editingBeneficiary && !canUpdate) return;
    if (!editingBeneficiary && !canCreate) return;

    if (!editingBeneficiary) {
        const isDuplicate = beneficiaries && beneficiaries.some(b => 
            b.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
            (b.phone || '') === (data.phone || '')
        );
        if (isDuplicate) {
            toast({
                title: 'Duplicate Beneficiary',
                description: 'A beneficiary with the same name and phone number already exists in this lead.',
                variant: 'destructive',
            });
            return;
        }
    }

    setIsFormOpen(false);
    setEditingBeneficiary(null);

    const batch = writeBatch(firestore);
    const leadDocRef = doc(firestore, 'leads', leadId);
    
    const newBeneficiaryId = masterId || (editingBeneficiary ? editingBeneficiary.id : doc(collection(firestore, 'beneficiaries')).id);
    const leadBeneficiaryDocRef = doc(firestore, 'leads', leadId, 'beneficiaries', newBeneficiaryId);
    const masterBeneficiaryDocRef = doc(firestore, 'beneficiaries', newBeneficiaryId);
    
    let finalData: Beneficiary;

    try {
        let idProofUrl = editingBeneficiary?.idProofUrl || '';
      
        if (data.idProofDeleted && idProofUrl) {
            await deleteObject(storageRef(storage, idProofUrl)).catch(err => {
                if (err.code !== 'storage/object-not-found') console.warn("Failed to delete old ID proof:", err);
            });
            idProofUrl = '';
        }
      
        const fileList = data.idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const { default: Resizer } = await import('react-image-file-resizer');
            const resizedBlob = await new Promise<Blob>((resolve) => {
                Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
            });
            const filePath = `beneficiaries/${newBeneficiaryId}/${Date.now()}.png`;
            const fileRef = storageRef(storage, filePath);
            const uploadResult = await uploadBytes(fileRef, resizedBlob);
            idProofUrl = await getDownloadURL(uploadResult.ref);
        }

        const { idProofFile, idProofDeleted, ...restData } = data;

        finalData = {
            ...restData,
            id: newBeneficiaryId,
            idProofUrl,
            ...(!editingBeneficiary && !masterId && {
                createdAt: serverTimestamp(),
                createdById: userProfile.id,
                createdByName: userProfile.name,
            }),
             ...(editingBeneficiary && {
                updatedAt: serverTimestamp(),
                updatedById: userProfile.id,
                updatedByName: userProfile.name,
            }),
        } as Beneficiary;

        const oldKitAmount = editingBeneficiary?.kitAmount || 0;
        const newKitAmount = data.kitAmount || 0;
        const amountDifference = newKitAmount - oldKitAmount;
        const newTargetAmount = (lead.targetAmount || 0) + (editingBeneficiary ? amountDifference : newKitAmount);

        batch.set(masterBeneficiaryDocRef, finalData, { merge: true });
        batch.set(leadBeneficiaryDocRef, finalData, { merge: true });
        batch.update(leadDocRef, { targetAmount: newTargetAmount });
        
        await batch.commit();
        
        toast({ title: 'Success', description: `Beneficiary ${editingBeneficiary ? 'updated' : 'added'} and lead total updated.`, variant: 'success' });
        forceRefetch();
        forceRefetchLead();

    } catch (error: any) {
        console.warn("Error during form submission:", error);
        if (error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: leadBeneficiaryDocRef.path,
                operation: editingBeneficiary ? 'update' : 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
        }
    }
  };

  const handleSelectExisting = (beneficiaryData: Beneficiary) => {
    const dataToSubmit: BeneficiaryFormData = {
        name: beneficiaryData.name,
        address: beneficiaryData.address,
        phone: beneficiaryData.phone,
        occupation: beneficiaryData.occupation,
        members: beneficiaryData.members,
        earningMembers: beneficiaryData.earningMembers,
        male: beneficiaryData.male,
        female: beneficiaryData.female,
        idProofType: beneficiaryData.idProofType,
        idNumber: beneficiaryData.idNumber,
        referralBy: beneficiaryData.referralBy,
        kitAmount: 0,
        status: 'Pending',
        notes: beneficiaryData.notes,
        isEligibleForZakat: beneficiaryData.isEligibleForZakat,
        zakatAllocation: beneficiaryData.zakatAllocation,
    };
    handleFormSubmit(dataToSubmit, beneficiaryData.id);
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !leadId || !canUpdate) return;
    
    const beneficiaryDocRef = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    
    try {
      await updateDoc(beneficiaryDocRef, { status: newStatus });
      toast({
        title: 'Status Updated',
        description: `${beneficiary.name}'s status has been set to ${newStatus}.`,
        variant: 'success',
      });
    } catch (serverError) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: beneficiaryDocRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      }));
    }
  };
  
  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let sortableItems = [...beneficiaries];
    
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(b => b.status === statusFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => 
            (b.name || '').toLowerCase().includes(lowercasedTerm) ||
            (b.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (b.address || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0; // Keep original order for srNo
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
  }, [beneficiaries, searchTerm, statusFilter, sortConfig]);

  const isLoading = isLeadLoading || areBeneficiariesLoading || isProfileLoading;
  
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

  if (isLoading && !lead) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
        </main>
    );
  }
  
  if (!lead) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <p className="text-lg text-muted-foreground">Lead not found.</p>
            <Button asChild className="mt-4">
                <Link href="/leads-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </Button>
        </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
            <Button variant="outline" asChild>
                <Link href="/leads-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </Button>
        </div>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">{lead.name}</h1>
        </div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/summary`}>Summary</Link>
                        </Button>
                    )}
                    <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                        <Link href={`/leads-members/${leadId}`}>Item List</Link>
                    </Button>
                    {canReadBeneficiaries && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link>
                        </Button>
                    )}
                    {canReadDonations && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/leads-members/${leadId}/donations`}>Donations</Link>
                        </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                    <CardTitle>Beneficiary Details ({areBeneficiariesLoading ? '...' : filteredAndSortedBeneficiaries.length})</CardTitle>
                </div>
                {canCreate && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <Button variant="outline" onClick={() => setIsSearchOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add from Existing
                        </Button>
                        <Button onClick={handleAdd}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New
                        </Button>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-4">
                <Input 
                    placeholder="Search by name, phone, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-auto md:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Given">Given</SelectItem>
                        <SelectItem value="Verified">Verified</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Hold">Hold</SelectItem>
                        <SelectItem value="Need More Details">Need More Details</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader sortKey="srNo" className="w-[80px]">#</SortableHeader>
                            <SortableHeader sortKey="name">Name & Phone</SortableHeader>
                            <SortableHeader sortKey="status">Status</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat">Zakat</SortableHeader>
                            <SortableHeader sortKey="kitAmount" className="text-right">Kit Amount (₹)</SortableHeader>
                            <SortableHeader sortKey="referralBy">Referred By</SortableHeader>
                            {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {areBeneficiariesLoading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={`skeleton-${i}`}>
                                    <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    {(canUpdate || canDelete) && <TableCell className="text-right"><Skeleton className="h-6 w-12 ml-auto" /></TableCell>}
                                </TableRow>
                            ))
                        ) : filteredAndSortedBeneficiaries.length > 0 ? (
                            filteredAndSortedBeneficiaries.map((beneficiary, index) => (
                                <BeneficiaryRow
                                    key={beneficiary.id}
                                    beneficiary={beneficiary}
                                    index={index + 1}
                                    canUpdate={canUpdate}
                                    canDelete={canDelete}
                                    onView={handleView}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteClick}
                                    onStatusChange={handleStatusChange}
                                />
                            ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="text-center h-24 text-muted-foreground">
                                No beneficiaries found for this lead.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{formMode === 'add' ? 'Add' : formMode === 'view' ? 'View' : 'Edit'} Beneficiary</DialogTitle>
            </DialogHeader>
            <BeneficiaryForm
                beneficiary={editingBeneficiary}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                itemCategories={lead?.itemCategories || []}
                kitAmountLabel={kitAmountLabel}
                defaultKitAmount={totalLeadAmount}
                initialReadOnly={formMode === 'view'}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the beneficiary record.
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
      
      <BeneficiarySearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectBeneficiary={handleSelectExisting}
        currentLeadId={leadId}
      />
    </>
  );
}

interface BeneficiaryRowProps {
    beneficiary: Beneficiary;
    index: number;
    canUpdate?: boolean;
    canDelete?: boolean;
    onView: (beneficiary: Beneficiary) => void;
    onEdit: (beneficiary: Beneficiary) => void;
    onDelete: (id: string) => void;
    onStatusChange: (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => void;
}

const BeneficiaryRow: React.FC<BeneficiaryRowProps> = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</p>
            <p className="text-sm font-medium pt-1">{value || 'N/A'}</p>
        </div>
    );
    
    return (
        <>
            <TableRow className="bg-background hover:bg-accent/50 data-[state=open]:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[80px]">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-accent" data-state={isOpen ? 'open' : 'closed'}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span>{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">
                    <div>{beneficiary.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{beneficiary.phone}</div>
                </TableCell>
                <TableCell>
                    <Badge variant={
                        beneficiary.status === 'Given' || beneficiary.status === 'Verified' ? 'success' :
                        beneficiary.status === 'Pending' ? 'secondary' :
                        beneficiary.status === 'Hold' ? 'destructive' : 'outline'
                    }>{beneficiary.status}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell>{beneficiary.referralBy}</TableCell>
                {(canUpdate || canDelete) && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                                {canUpdate && <DropdownMenuSeparator />}

                                {canUpdate && beneficiary.status !== 'Given' && (
                                    <DropdownMenuItem onClick={() => onStatusChange(beneficiary, 'Given')}>
                                        <CheckCircle2 className="mr-2 h-4 w-4 text-success-foreground" />
                                        <span>Mark as Given</span>
                                    </DropdownMenuItem>
                                )}
                                {canUpdate && beneficiary.status === 'Given' && (
                                    <DropdownMenuItem onClick={() => onStatusChange(beneficiary, 'Pending')}>
                                        <Hourglass className="mr-2 h-4 w-4" />
                                        <span>Mark as Pending</span>
                                    </DropdownMenuItem>
                                )}

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
                                                    <DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2"/>Pending</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2"/>Verified</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2"/>Given</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="Hold"><XCircle className="mr-2"/>Hold</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="Need More Details"><Info className="mr-2"/>Need More Details</DropdownMenuRadioItem>
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                )}
                                {canDelete && <DropdownMenuSeparator />}
                                {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive focus:bg-destructive/20 focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
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
                            <DetailItem label="Occupation" value={beneficiary.occupation} />
                            <DetailItem label="Family" value={`Total: ${beneficiary.members}, Earning: ${beneficiary.earningMembers}, M: ${beneficiary.male}, F: ${beneficiary.female}`} />
                            <DetailItem label="ID Proof" value={`${beneficiary.idProofType || 'N/A'} - ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Date Added" value={beneficiary.addedDate} />
                             {beneficiary.isEligibleForZakat && beneficiary.zakatAllocation != null && (
                                <DetailItem label="Zakat Allocation" value={`₹${(beneficiary.zakatAllocation || 0).toFixed(2)}`} />
                             )}
                            {beneficiary.notes && <div className="sm:col-span-2 lg:col-span-3"><DetailItem label="Notes" value={<p className="whitespace-pre-wrap">{beneficiary.notes}</p>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

    
