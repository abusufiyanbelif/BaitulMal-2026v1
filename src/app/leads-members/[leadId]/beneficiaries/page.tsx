'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc, collection, doc, serverTimestamp, setDoc, DocumentReference, writeBatch } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronsUpDown, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info } from 'lucide-react';
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
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const BeneficiaryRow = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle }: { beneficiary: Beneficiary, index: number, canUpdate?: boolean, canDelete?: boolean, onView: (b: Beneficiary) => void, onEdit: (b: Beneficiary) => void, onDelete: (id: string) => void, onStatusChange: (b: Beneficiary, s: BeneficiaryStatus) => void, onZakatToggle: (b: Beneficiary) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <React.Fragment>
            <TableRow className="bg-background hover:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[80px]"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-8 w-8">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><span>{index}</span></div></TableCell>
                <TableCell className="font-medium"><div>{beneficiary.name}</div><div className="text-xs text-muted-foreground font-mono">{beneficiary.phone}</div></TableCell>
                <TableCell><Badge variant={beneficiary.status === 'Given' || beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'secondary' : 'outline'}>{beneficiary.status}</Badge></TableCell>
                <TableCell><Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge></TableCell>
                <TableCell className="text-right font-medium">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell>{beneficiary.referralBy}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" /> Status</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal><DropdownMenuSubContent><DropdownMenuRadioGroup value={beneficiary.status} onValueChange={(s) => onStatusChange(beneficiary, s as any)}><DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem><DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem><DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/20">
                    <TableCell colSpan={7} className="p-4"><p className="text-sm"><strong>Address:</strong> {beneficiary.address || 'N/A'}</p><p className="text-sm"><strong>Notes:</strong> {beneficiary.notes || 'No notes.'}</p></TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

export default function BeneficiariesPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const leadId = typeof params?.leadId === "string" ? params.leadId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, 'leads', leadId, 'beneficiaries') : null, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.delete', false);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !leadId || !canUpdate) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    const updateData = { status: newStatus };
    setDoc(ref, updateData, { merge: true })
      .catch(async (err: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData }));
      });
  };

  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleView = (b: Beneficiary) => {
    router.push(`/beneficiaries/${b.id}?redirect=${pathname}`);
  };

  const handleEdit = (b: Beneficiary) => {
    router.push(`/beneficiaries/${b.id}?redirect=${pathname}`);
  };

  const handleDeleteClick = (id: string) => {
    setBeneficiaryToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let items = beneficiaries.filter(b => (statusFilter === 'All' || b.status === statusFilter) && (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm)));
    if (sortConfig) items.sort((a, b) => {
        const aVal = String(a[sortConfig.key as keyof Beneficiary] || '').toLowerCase();
        const bVal = String(b[sortConfig.key as keyof Beneficiary] || '').toLowerCase();
        return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return items;
  }, [beneficiaries, searchTerm, statusFilter, sortConfig]);

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;
  if (!lead) return <p className="text-center mt-20">Lead not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold">{lead.name}</h1></div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Beneficiaries ({filteredAndSortedBeneficiaries.length})</CardTitle><div className="flex gap-2">{canCreate && <Button onClick={() => setIsFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>}</div></CardHeader>
          <CardContent><div className="flex gap-2 mb-4"><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select></div>
            <Table><TableHeader><TableRow>
                <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                <TableHead className="text-right">Amount</TableHead>
                <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort}>Referral</SortableHeader>
                <TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filteredAndSortedBeneficiaries.map((b, i) => (
                <BeneficiaryRow 
                    key={b.id} 
                    beneficiary={b} 
                    index={i+1} 
                    canUpdate={canUpdate} 
                    canDelete={canDelete} 
                    onView={handleView} 
                    onEdit={handleEdit} 
                    onDelete={handleDeleteClick} 
                    onStatusChange={handleStatusChange} 
                    onZakatToggle={() => {}} 
                />
            ))}</TableBody></Table>
          </CardContent>
        </Card>
    </main>
  );
}
