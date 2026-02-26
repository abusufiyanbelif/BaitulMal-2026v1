'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, doc, serverTimestamp, writeBatch, setDoc, DocumentReference } from 'firebase/firestore';
import type { Beneficiary, Campaign, RationItem, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, RefreshCw, ZoomIn, ZoomOut, RotateCw, Check, ChevronsUpDown, X, Users, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiaryImportDialog, type ProcessedRecord } from '@/components/beneficiary-import-dialog';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
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
    isSubRow?: boolean;
}

const BeneficiaryRow: React.FC<BeneficiaryRowProps> = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle, isSubRow = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</p>
            <p className="text-sm font-medium pt-1">{value || 'N/A'}</p>
        </div>
    );
    
    return (
        <React.Fragment>
            <TableRow className="bg-background hover:bg-accent/50 data-[state=open]:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[120px]">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-accent" data-state={isOpen ? 'open' : 'closed'}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className={cn(isSubRow && "pl-8")}>{index}</span>
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
                <TableCell className="text-right font-medium font-mono">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium font-mono">₹{(beneficiary.zakatAllocation || 0).toFixed(2)}</TableCell>
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
                    <TableCell colSpan={(canUpdate || canDelete) ? 8 : 7} className="p-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 p-4">
                            <DetailItem label="Address" value={beneficiary.address} />
                            <DetailItem label="Age" value={beneficiary.age} />
                            <DetailItem label="Occupation" value={beneficiary.occupation} />
                            <DetailItem label="Family" value={`Total: ${beneficiary.members}, Earning: ${beneficiary.earningMembers}, M: ${beneficiary.male}, F: ${beneficiary.female}`} />
                            <DetailItem label="ID Proof" value={`${beneficiary.idProofType || 'N/A'} - ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Date Added" value={beneficiary.addedDate} />
                             {beneficiary.isEligibleForZakat && (
                                <DetailItem label="Zakat Allocation" value={`₹${(beneficiary.zakatAllocation || 0).toFixed(2)}`} />
                             )}
                            {beneficiary.notes && <div className="sm:col-span-2 lg:col-span-3"><DetailItem label="Notes" value={<p className="whitespace-pre-wrap">{beneficiary.notes}</p>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
}

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId =
    typeof params?.campaignId === "string"
      ? params.campaignId
      : Array.isArray(params?.campaignId)
      ? params.campaignId[0]
      : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const campaignDocRef = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign>;
  }, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading, forceRefetch: forceRefetchCampaign } = useDoc<Campaign>(campaignDocRef);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return collection(firestore, 'campaigns', campaignId, 'beneficiaries');
  }, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ProcessedRecord[]>([]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState<string[]>([]);
  const [tempReferralFilter, setTempReferralFilter] = useState<string[]>([]);
  const [openReferralPopover, setOpenReferralPopover] = useState(false);
  const [zakatFilter, setZakatFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>({});
  
  const [isSyncing, setIsSyncing] = useState(false);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleSubGroup = (subGroupKey: string) => {
    setCollapsedSubGroups(prev => ({ ...prev, [subGroupKey]: !prev[subGroupKey] }));
  };
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.delete', false);

    const sanitizedItemCategories = useMemo(() => {
        if (!campaign?.itemCategories) return [];
        let lists: ItemCategory[] = Array.isArray(campaign.itemCategories) ? campaign.itemCategories : [];
        return lists.map(cat => {
            if (cat.name === 'General Item List' || cat.name === 'General' || cat.name === 'Item Master List') {
              return { ...cat, name: 'Item Price List' };
            }
            return cat;
        }).sort((a, b) => {
            if (a.name === 'Item Price List') return -1;
            if (b.name === 'Item Price List') return 1;
            if(a.minMembers !== undefined && b.minMembers !== undefined) {
                return a.minMembers - b.minMembers;
            }
            return a.name.localeCompare(b.name);
        });
    }, [campaign?.itemCategories]);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    const referrals = new Set(beneficiaries.map(b => b.referralBy).filter(Boolean) as string[]);
    return [...Array.from(referrals).sort()];
  }, [beneficiaries]);

  const areAllReferralsSelected = useMemo(() => uniqueReferrals.length > 0 && tempReferralFilter.length === uniqueReferrals.length, [tempReferralFilter, uniqueReferrals]);
  
  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let sortableItems = [...beneficiaries];

    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(b => b.status === statusFilter);
    }
    if (zakatFilter !== 'All') {
        sortableItems = sortableItems.filter(b => !!b.isEligibleForZakat === (zakatFilter === 'Eligible'));
    }
    if (referralFilter.length > 0) {
        sortableItems = sortableItems.filter(b => b.referralBy && referralFilter.includes(b.referralBy));
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => 
            (b.name || '').toLowerCase().includes(lowercasedTerm) ||
            (b.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (b.address || '').toLowerCase().includes(lowercasedTerm) ||
            (b.referralBy || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aValue = a[sortConfig.key as keyof Beneficiary] ?? '';
            const bValue = b[sortConfig.key as keyof Beneficiary] ?? '';
            if (sortConfig.key === 'kitAmount') return sortConfig.direction === 'ascending' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
            if (typeof aValue === 'boolean' && typeof bValue === 'boolean') return sortConfig.direction === 'ascending' ? (aValue === bValue ? 0 : aValue ? -1 : 1) : (aValue === bValue ? 0 : aValue ? 1 : -1);
            const strA = String(aValue).toLowerCase();
            const strB = String(bValue).toLowerCase();
            if (strA < strB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (strA > strB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter, sortConfig]);

  const statusCounts = useMemo(() => {
    const counts = { Total: 0, Given: 0, Verified: 0, Pending: 0, Hold: 0, 'Need More Details': 0 };
    if (!filteredAndSortedBeneficiaries) return counts;
    counts.Total = filteredAndSortedBeneficiaries.length;
    for (const b of filteredAndSortedBeneficiaries) {
        const status = b.status || 'Pending';
        if (counts.hasOwnProperty(status)) counts[status as keyof typeof counts]++;
    }
    return counts;
  }, [filteredAndSortedBeneficiaries]);

  const groupedBeneficiaries = useMemo(() => {
    if (!filteredAndSortedBeneficiaries || !sanitizedItemCategories || sanitizedItemCategories.length === 0) return {};
    return filteredAndSortedBeneficiaries.reduce((acc, beneficiary) => {
        const members = beneficiary.members || 0;
        const matchingCategories = sanitizedItemCategories.filter(cat => cat.name !== 'Item Price List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
        let appliedCategory = matchingCategories.length > 1 ? matchingCategories.sort((a, b) => ((a.maxMembers ?? 999) - (a.minMembers ?? 0)) - ((b.maxMembers ?? 999) - (b.minMembers ?? 0)))[0] : (matchingCategories[0] || null);
        const categoryId = appliedCategory ? appliedCategory.id : 'uncategorized';
        const categoryForGroup = appliedCategory || { id: 'uncategorized', name: 'Uncategorized', items: [] };
        if (!acc[categoryId]) acc[categoryId] = { category: categoryForGroup, beneficiariesByMemberCount: {} };
        const memberCount = beneficiary.members || 0;
        if (!acc[categoryId].beneficiariesByMemberCount[memberCount]) acc[categoryId].beneficiariesByMemberCount[memberCount] = [];
        acc[categoryId].beneficiariesByMemberCount[memberCount].push(beneficiary);
        return acc;
    }, {} as Record<string, { category: ItemCategory, beneficiariesByMemberCount: Record<number, Beneficiary[]> }>);
}, [filteredAndSortedBeneficiaries, sanitizedItemCategories]);

const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedBeneficiaries).sort((a, b) => {
        const catA = groupedBeneficiaries[a].category;
        const catB = groupedBeneficiaries[b].category;
        if (catA.id === 'uncategorized') return 1;
        if (catB.id === 'uncategorized') return -1;
        if (catA.name === 'Item Price List') return -1;
        if (catB.name === 'Item Price List') return 1;
        return (catA.minMembers ?? 0) - (catB.minMembers ?? 0);
    });
}, [groupedBeneficiaries]);

  const totalKitAmount = useMemo(() => filteredAndSortedBeneficiaries.reduce((acc, b) => acc + (b.kitAmount || 0), 0), [filteredAndSortedBeneficiaries]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !campaignId || !canUpdate) return;
    const beneficiaryDocRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
    setDoc(beneficiaryDocRef, { status: newStatus }, { merge: true })
      .catch(async (serverError: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: beneficiaryDocRef.path, operation: 'update', requestResourceData: { status: newStatus } }));
      });
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !campaignId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const beneficiaryRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
    const updateData: Partial<Beneficiary> = { isEligibleForZakat: newZakatStatus, ...( !newZakatStatus && { zakatAllocation: 0 }) };
    setDoc(beneficiaryRef, updateData, { merge: true })
      .catch(async (serverError: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: beneficiaryRef.path, operation: 'update', requestResourceData: updateData }));
      });
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading && !campaign) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;
  if (!campaign) return <main className="container mx-auto p-4 md:p-8 text-center"><p>Campaign not found.</p><Button asChild className="mt-4"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns</Link></Button></main>;

  const handleAdd = () => { setEditingBeneficiary(null); setFormMode('add'); setIsFormOpen(true); };
  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !campaignId || !userProfile || !campaign) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const campaignDocRef = doc(firestore, 'campaigns', campaignId);
    const masterBeneficiaryDocRef = masterId ? doc(firestore, 'beneficiaries', masterId) : editingBeneficiary ? doc(firestore, 'beneficiaries', editingBeneficiary.id) : doc(collection(firestore, 'beneficiaries'));
    const newBeneficiaryId = masterBeneficiaryDocRef.id;
    const campaignBeneficiaryDocRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', newBeneficiaryId);
    let idProofUrl = editingBeneficiary?.idProofUrl || '';
    try {
        const fileList = data.idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0 && !auth?.currentUser) { toast({ title: "Auth Error", description: "Wait for session.", variant: "destructive" }); setIsSubmitting(false); return; }
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
            const filePath = `beneficiaries/${newBeneficiaryId}/id_proof.png`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, resizedBlob);
            idProofUrl = await getDownloadURL(fileRef);
        }
        const { idProofFile, idProofDeleted, ...restData } = data;
        const fullData: Beneficiary = { ...restData, id: newBeneficiaryId, addedDate: new Date().toISOString().split('T')[0], idProofUrl, ...(!editingBeneficiary && !masterId && { createdAt: serverTimestamp(), createdById: userProfile.id, createdByName: userProfile.name }) } as Beneficiary;
        const { status, kitAmount, zakatAllocation, ...masterBeneficiaryData } = fullData;
        const amountDifference = (data.kitAmount || 0) - (editingBeneficiary?.kitAmount || 0);
        batch.set(masterBeneficiaryDocRef, masterBeneficiaryData, { merge: true });
        batch.set(campaignBeneficiaryDocRef, fullData, { merge: true });
        batch.update(campaignDocRef, { targetAmount: (campaign.targetAmount || 0) + (editingBeneficiary ? amountDifference : data.kitAmount) });
        await batch.commit();
        toast({ title: 'Success', description: 'Saved.', variant: 'success' });
        setIsFormOpen(false);
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } finally { setIsSubmitting(false); }
  };
  
  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !firestore || !campaignId || !beneficiaries || !campaign) return;
    const beneficiaryData = beneficiaries.find(b => b.id === beneficiaryToDelete);
    if (!beneficiaryData) return;
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiaryToDelete));
    batch.update(doc(firestore, 'campaigns', campaignId), { targetAmount: (campaign.targetAmount || 0) - (beneficiaryData.kitAmount || 0) });
    batch.commit().then(() => toast({ title: 'Success', description: 'Removed.' })).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `campaigns/${campaignId}`, operation: 'write' })));
    setIsDeleteDialogOpen(false);
  };

  const handleSelectExisting = (beneficiaryData: Beneficiary) => {
    const kitAmount = sanitizedItemCategories.find(cat => cat.name !== 'Item Price List')?.items.reduce((s, i) => s + (i.price || 0), 0) || 0;
    handleFormSubmit({ ...beneficiaryData, kitAmount, status: 'Pending' } as any, beneficiaryData.id);
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns</Link></Button></div>
       <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold">{campaign.name}</h1></div>
      <div className="border-b mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2">
                {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}/summary` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Summary</Link> )}
                {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Item Lists</Link> )}
                {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Beneficiary List</Link> )}
                {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>Donations</Link> )}
            </div>
        </ScrollArea>
      </div>
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-1.5"><CardTitle>Beneficiary List ({filteredAndSortedBeneficiaries.length})</CardTitle><p className="text-muted-foreground">Total: <span className="font-bold">₹{totalKitAmount.toFixed(2)}</span></p></div>
                {canCreate && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <Button variant="outline" onClick={() => setIsSearchOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add from Existing</Button>
                        <Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-auto md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <SortableHeader sortKey="srNo" className="w-[120px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                            <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name &amp; Phone</SortableHeader>
                            <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                            <SortableHeader sortKey="kitAmount" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Kit Amount (₹)</SortableHeader>
                            <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort}>Referred By</SortableHeader>
                            {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedGroupKeys.map((categoryId) => {
                            const group = groupedBeneficiaries[categoryId];
                            return Object.values(group.beneficiariesByMemberCount).flat().map((beneficiary, index) => (
                                <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} index={index + 1} canUpdate={canUpdate} canDelete={canDelete} onView={router.push as any} onEdit={router.push as any} onDelete={setIsDeleteDialogOpen as any} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} />
                            ))
                        })}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Beneficiary</DialogTitle></DialogHeader><BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={sanitizedItemCategories} /></DialogContent></Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Beneficiary?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={handleSelectExisting} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}
