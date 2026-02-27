'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc, collection, doc, serverTimestamp, writeBatch, setDoc, DocumentReference } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Campaign, RationItem, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, CheckCircle2, Hourglass, XCircle, Info, ChevronsUpDown, ChevronDown, ChevronUp, BadgeCheck } from 'lucide-react';
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
            <div className="flex items-center gap-2 whitespace-nowrap">
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
                <TableCell className="w-[120px]">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                        <span>{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium"><div>{beneficiary.name}</div><div className="text-xs text-muted-foreground font-mono">{beneficiary.phone}</div></TableCell>
                <TableCell><Badge variant={beneficiary.status === 'Given' || beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'secondary' : 'outline'}>{beneficiary.status}</Badge></TableCell>
                <TableCell><Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge></TableCell>
                <TableCell className="text-right font-medium">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell>{beneficiary.referralBy}</TableCell>
                {(canUpdate || canDelete) && (
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuSeparator />}
                            {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" /> Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal><DropdownMenuSubContent><DropdownMenuRadioGroup value={beneficiary.status} onValueChange={(s) => onStatusChange(beneficiary, s as any)}><DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2 h-4 w-4"/>Pending</DropdownMenuRadioItem><DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2 h-4 w-4"/>Verified</DropdownMenuRadioItem><DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2 h-4 w-4"/>Given</DropdownMenuRadioItem><DropdownMenuRadioItem value="Hold"><XCircle className="mr-2 h-4 w-4"/>Hold</DropdownMenuRadioItem><DropdownMenuRadioItem value="Need More Details"><Info className="mr-2 h-4 w-4"/>Need Details</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                            {canUpdate && (
                                <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>{beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{beneficiary.isEligibleForZakat ? 'Not Zakat Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>
                            )}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                )}
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/20 hover:bg-muted/30">
                    <TableCell colSpan={8} className="p-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Address</p><p className="text-sm font-medium">{beneficiary.address || 'N/A'}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Age</p><p className="text-sm font-medium">{beneficiary.age || 'N/A'}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Family</p><p className="text-sm font-medium">Total: {beneficiary.members}, Earning: {beneficiary.earningMembers}</p></div>
                            {beneficiary.notes && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Notes</p><p className="text-sm whitespace-pre-wrap">{beneficiary.notes}</p></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = typeof params?.campaignId === "string" ? params.campaignId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, 'campaigns', campaignId, 'beneficiaries') : null, [firestore, campaignId]);
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

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.delete', false);

  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleView = (b: Beneficiary) => { router.push(`/beneficiaries/${b.id}?redirect=${pathname}`); };
  const handleEdit = (b: Beneficiary) => { router.push(`/beneficiaries/${b.id}?redirect=${pathname}`); };
  const handleDeleteClick = (id: string) => { setBeneficiaryToDelete(id); setIsDeleteDialogOpen(true); };

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

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !campaignId || !canUpdate) return;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    setDoc(ref, { status: newStatus }, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !campaignId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    setDoc(ref, { isEligibleForZakat: newZakatStatus }, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !campaignId || !userProfile || !campaign) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
    const campRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', masterRef.id);
    
    let idProofUrl = '';
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const resized = await new Promise<Blob>((res) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => res(b as Blob), 'blob'); });
        const fRef = storageRef(storage, `beneficiaries/${masterRef.id}/id_proof.png`);
        await uploadBytes(fRef, resized);
        idProofUrl = await getDownloadURL(fRef);
    }

    const { idProofFile, idProofDeleted, ...rest } = data;
    const fullData = { ...rest, id: masterRef.id, idProofUrl, addedDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), createdById: userProfile.id, createdByName: userProfile.name };
    const { status, kitAmount, zakatAllocation, ...masterData } = fullData;
    
    batch.set(masterRef, masterData, { merge: true });
    batch.set(campRef, fullData, { merge: true });
    batch.update(doc(firestore, 'campaigns', campaignId), { targetAmount: (campaign.targetAmount || 0) + (data.kitAmount || 0) });
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  const handleSelectExisting = (beneficiaryData: Beneficiary) => {
    handleFormSubmit({ ...beneficiaryData, kitAmount: 0, status: 'Pending' } as any, beneficiaryData.id);
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;
  if (!campaign) return <p className="text-center mt-20">Campaign not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold">{campaign.name}</h1></div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Summary</Link>
                    )}
                    {canReadRation && (
                        <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item Lists</Link>
                    )}
                    {canReadBeneficiaries && (
                        <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow")}>Beneficiary List</Link>
                    )}
                    {canReadDonations && (
                        <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Donations</Link>
                    )}
                </div>
            </ScrollArea>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between"><div><CardTitle>Beneficiary List ({filteredAndSortedBeneficiaries.length})</CardTitle></div><div className="flex gap-2">{canCreate && <><Button variant="outline" onClick={() => setIsSearchOpen(true)}>Add Existing</Button><Button onClick={() => setIsFormOpen(true)}>Add New</Button></>}</div></CardHeader>
          <CardContent><div className="flex gap-2 mb-4"><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-auto md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select></div>
            <Table><TableHeader><TableRow><SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader><SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name &amp; Phone</SortableHeader><SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader><SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader><TableHead className="text-right">Kit Amount</TableHead><SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort}>Referred By</SortableHeader><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filteredAndSortedBeneficiaries.map((b, i) => <BeneficiaryRow key={b.id} beneficiary={b} index={i+1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} />)}</TableBody></Table>
          </CardContent>
        </Card>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add Beneficiary</DialogTitle></DialogHeader><BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} /></DialogContent></Dialog>
        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={handleSelectExisting} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}