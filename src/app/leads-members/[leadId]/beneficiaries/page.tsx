

'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, setDoc, DocumentReference, writeBatch, updateDoc } from 'firebase/firestore';
import type { Beneficiary, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronsUpDown, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info, Check } from 'lucide-react';
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
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';

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
};

interface BeneficiaryRowProps {
    beneficiary: Beneficiary;
    index: number;
    canUpdate?: boolean;
    canDelete?: boolean;
    onView: (beneficiary: Beneficiary) => void;
    onEdit: (beneficiary: Beneficiary) => void;
    onDelete: (id: string) => void;
    onStatusChange: (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => void;
    onZakatToggle: (beneficiary: Beneficiary) => void;
}

const BeneficiaryRow: React.FC<BeneficiaryRowProps> = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle }) => {
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
                                {canUpdate && (
                                    <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>
                                        {beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        <span>{beneficiary.isEligibleForZakat ? 'Mark as Not Eligible' : 'Mark as Zakat Eligible'}</span>
                                    </DropdownMenuItem>
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
                            <DetailItem label="Age" value={beneficiary.age} />
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

export default function BeneficiariesPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const leadId =
    typeof params?.leadId === "string"
      ? params.leadId
      : Array.isArray(params?.leadId)
      ? params.leadId[0]
      : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading, forceRefetch: forceRefetchLead } = useDoc<Lead>(leadDocRef);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return collection(firestore, 'leads', leadId, 'beneficiaries');
  }, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleAdd = () => {
    if (!canCreate) return;
    setEditingBeneficiary(null);
    setFormMode('add');
    setIsFormOpen(true);
  };

  const handleView = (beneficiary: Beneficiary) => {
    const redirectUrl = `/leads-members/${leadId}/beneficiaries`;
    router.push(`/beneficiaries/${beneficiary.id}?redirect=${encodeURIComponent(redirectUrl)}`);
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    if (!canUpdate) return;
    const redirectUrl = `/leads-members/${leadId}/beneficiaries`;
    router.push(`/beneficiaries/${beneficiary.id}?redirect=${encodeURIComponent(redirectUrl)}`);
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
    
    // IMPORTANT: Do NOT delete the ID proof file from storage here.
    // This is an "unlink" operation from the lead, not a "deep delete".
    // The master beneficiary record and its file should persist.

    try {
        await batch.commit();
        toast({ title: 'Success', description: 'Beneficiary removed from this lead.', variant: 'success' });
        forceRefetch();
        forceRefetchLead();
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `Batch operation on leads/${leadId}`,
            operation: 'write'
        }));
    } finally {
        setBeneficiaryToDelete(null);
    }
  };
  
  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !leadId || !userProfile || !lead) {
      setIsSubmitting(false);
      return;
    }
    if (editingBeneficiary && !canUpdate) {
      setIsSubmitting(false);
      return;
    }
    if (!editingBeneficiary && !canCreate) {
      setIsSubmitting(false);
      return;
    }
    
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;

    if (!editingBeneficiary && !masterId) {
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
            setIsSubmitting(false);
            return;
        }
    }

    setIsFormOpen(false);
    setEditingBeneficiary(null);
    
    const batch = writeBatch(firestore);
    const leadDocRef = doc(firestore, 'leads', leadId);
    
    const masterBeneficiaryDocRef = masterId
        ? doc(firestore, 'beneficiaries', masterId)
        : editingBeneficiary
            ? doc(firestore, 'beneficiaries', editingBeneficiary.id)
            : doc(collection(firestore, 'beneficiaries'));
            
    const newBeneficiaryId = masterBeneficiaryDocRef.id;
    const leadBeneficiaryDocRef = doc(firestore, 'leads', leadId, 'beneficiaries', newBeneficiaryId);
    
    let finalData: Beneficiary;
    let idProofUrl = editingBeneficiary?.idProofUrl || '';

    try {
      const fileList = data.idProofFile as FileList | undefined;
      const hasFileToUpload = fileList && fileList.length > 0;

      if (hasFileToUpload) {
          if (isProfileLoading) {
            toast({ title: 'Please wait', description: 'Authentication is still loading. Please try again in a moment.' });
            setIsSubmitting(false);
            return;
          }
          if (!auth?.currentUser) {
              toast({
                  title: "Authentication Error",
                  description: "User not authenticated yet. Please wait and try again.",
                  variant: "destructive",
              });
              setIsSubmitting(false);
              return;
          }
      }
      
      if (data.idProofDeleted && idProofUrl) {
          await deleteObject(storageRef(storage, idProofUrl)).catch((err: any) => {
              if ((err as any).code !== 'storage/object-not-found') console.warn("Failed to delete old ID proof:", err);
          });
          idProofUrl = '';
      }
    
      if (hasFileToUpload) {
          const file = fileList[0];
          let fileToUpload: Blob | File = file;
          let fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';

          if (idProofUrl) {
            const oldFileRef = storageRef(storage, idProofUrl);
            await deleteObject(oldFileRef).catch((err: any) => {
                if ((err.code !== 'storage/object-not-found')) console.warn("Failed to delete old ID proof:", err);
            });
          }

          if (file.type.startsWith('image/')) {
              await new Promise<void>((resolve) => {
                  (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => {
                    fileToUpload = blob as Blob;
                    resolve();
                  }, 'blob');
              });
              fileExtension = 'png';
          } else if (file.type !== 'application/pdf') {
              toast({ title: 'Invalid File Type', description: 'Please upload an image or PDF file.', variant: 'destructive' });
              setIsSubmitting(false);
              return;
          }

          const filePath = `beneficiaries/${newBeneficiaryId}/id_proof.${fileExtension}`;
          const fileRef = storageRef(storage, filePath);
          const uploadResult = await uploadBytes(fileRef, fileToUpload);
          idProofUrl = await getDownloadURL(uploadResult.ref);
      }

        const { idProofFile, idProofDeleted, ...restData } = data;

        finalData = {
            ...restData,
            id: newBeneficiaryId,
            idProofUrl,
            ...(!editingBeneficiary && !masterId && {
                addedDate: new Date().toISOString().split('T')[0],
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
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: leadBeneficiaryDocRef.path,
                operation: editingBeneficiary ? 'update' : 'create',
                requestResourceData: data,
            }));
        } else {
            toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
        }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectExisting = (beneficiaryData: Beneficiary) => {
    const dataToSubmit: BeneficiaryFormData = {
        name: beneficiaryData.name,
        address: beneficiaryData.address || '',
        phone: beneficiaryData.phone || '',
        age: beneficiaryData.age,
        occupation: beneficiaryData.occupation || '',
        members: beneficiaryData.members,
        earningMembers: beneficiaryData.earningMembers,
        male: beneficiaryData.male,
        female: beneficiaryData.female,
        idProofType: beneficiaryData.idProofType || '',
        idNumber: beneficiaryData.idNumber || '',
        referralBy: beneficiaryData.referralBy || '',
        kitAmount: 0,
        status: 'Pending',
        notes: beneficiaryData.notes || '',
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
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: beneficiaryDocRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      }));
    }
  };
  
    const handleZakatToggle = async (beneficiary: Beneficiary) => {
        if (!canUpdate || !userProfile) return;
        const newZakatStatus = !beneficiary.isEligibleForZakat;
        const result = await updateMasterBeneficiaryAction(
            beneficiary.id,
            { isEligibleForZakat: newZakatStatus },
            { id: userProfile.id, name: userProfile.name }
        );
        if (result.success) {
            toast({
                title: 'Zakat Status Updated',
                description: `${beneficiary.name} is now ${newZakatStatus ? 'Eligible' : 'Not Eligible'} for Zakat.`,
                variant: 'success',
            });
        } else {
            toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
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

  const totalLeadAmount = lead.itemCategories.reduce((acc, cat) => acc + cat.items.reduce((s, i) => s + i.price, 0), 0);
  const kitAmountLabel = `${lead.purpose} Cost (₹)`;

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
                            Add New Beneficiary
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
                            <SortableHeader sortKey="srNo" className="w-[80px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                            <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name &amp; Phone</SortableHeader>
                            <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                            <SortableHeader sortKey="kitAmount" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Kit Amount (₹)</SortableHeader>
                            <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort}>Referred By</SortableHeader>
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
                                    onZakatToggle={handleZakatToggle}
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
                isReadOnly={formMode === 'view'}
                isSubmitting={isSubmitting}
                isSessionLoading={isProfileLoading}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the beneficiary from this lead, but their record will remain in the master list. This action cannot be undone.
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
