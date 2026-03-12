'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase, useAuth } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, serverTimestamp, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    PlusCircle, 
    MoreHorizontal, 
    Edit, 
    Eye, 
    ArrowUp, 
    ArrowDown, 
    ChevronDown, 
    ChevronUp, 
    IndianRupee, 
    FolderKanban, 
    Lightbulb, 
    Trash2, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    RefreshCw, 
    DatabaseZap, 
    ImageIcon, 
    Loader2, 
    CheckSquare, 
    X, 
    ChevronsUpDown, 
    Download, 
    UploadCloud,
    Users,
    CheckCircle2,
    Hourglass,
    XCircle,
    Smartphone,
    Wallet,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
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
    DialogFooter,
} from "@/components/ui/dialog";
import { DonationForm, type DonationFormData } from '@/components/donation-form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, getNestedValue } from '@/lib/utils';
import { syncDonationsAction, deleteDonationAction, bulkUpdateDonationStatusAction, bulkImportDonationsAction } from './actions';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';
import { DonationImportDialog } from '@/components/donation-import-dialog';

type SortKey = keyof UserProfile | 'srNo';

const donationGridClass = "grid grid-cols-[40px_60px_200px_120px_120px_100px_100px_150px_80px] items-center gap-4 px-4 py-3 min-w-[1100px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay, isCurrency = false }: { title: string, count: number | string, description: string, icon: any, colorClass?: string, delay: string, isCurrency?: boolean }) {
    return (
        <Card className={cn("flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all duration-300 hover:shadow-md", colorClass)} style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase">{title}</p>
                    <p className="text-2xl font-black text-primary tracking-tight">
                        {isCurrency ? `₹${count}` : count}
                    </p>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="text-[9px] font-medium text-muted-foreground mt-auto">{description}</p>
        </Card>
    );
}

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: any, children: React.ReactNode, className?: string, sortConfig: { key: any; direction: 'ascending' | 'descending' } | null, handleSort: (key: any) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2 font-bold text-[10px] text-[hsl(var(--table-header-fg))] tracking-tight uppercase", className)} onClick={() => handleSort(sortKey)}>
            {children}
            <div className="flex flex-col opacity-40">
                <ArrowUp className={cn("h-2.5 w-2.5 -mb-1", isSorted && sortConfig?.direction === 'ascending' && "text-primary opacity-100")} />
                <ArrowDown className={cn("h-2.5 w-2.5", isSorted && sortConfig?.direction === 'descending' && "text-primary opacity-100")} />
            </div>
        </div>
    );
};

function DonationRow({ donation, index, isSelected, onToggle, handleEdit, handleDeleteClick, handleViewImage }: { donation: Donation, index: number, isSelected: boolean, onToggle: () => void, handleEdit: () => void, handleDeleteClick: () => void, handleViewImage: (url: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const { userProfile } = useSession();
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.update', false);
    const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.delete', false);

    const primaryInitiative = donation.linkSplit?.[0]?.linkName || (donation as any).campaignName || 'Unlinked';

    return (
        <>
            <div onClick={() => setIsOpen(!isOpen)} className={cn("cursor-pointer bg-white hover:bg-[hsl(var(--table-row-hover))] group transition-colors border-b border-primary/10", donationGridClass)}>
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                        checked={isSelected}
                        onCheckedChange={onToggle}
                        className="border-primary/40 data-[state=checked]:bg-primary"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" disabled={!donation.transactions || donation.transactions.length === 0}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <span className="font-mono text-xs opacity-60">{index}</span>
                </div>
                <div className="min-w-0">
                    <div className="font-bold text-sm text-primary truncate">{donation.donorName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone || 'N/A'}</div>
                </div>
                <div className="text-right font-bold font-mono text-primary text-sm">₹{donation.amount.toFixed(2)}</div>
                <div className="whitespace-nowrap text-xs font-normal text-primary/80 text-center">{donation.donationDate}</div>
                <div className="text-center"><Badge variant="secondary" className="text-[9px] font-bold">{donation.donationType}</Badge></div>
                <div className="text-center">
                    <Badge variant={donation.status === 'Verified' ? 'eligible' : donation.status === 'Canceled' ? 'given' : 'active'} className="text-[9px] font-bold">
                        {donation.status}
                    </Badge>
                </div>
                <div className="truncate text-[10px] font-normal text-muted-foreground">{primaryInitiative}</div>
                <div className="text-right pr-4" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)} className="text-primary font-normal"><Eye className="mr-2 h-4 w-4 opacity-60"/> Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4 opacity-60"/> Edit Record</DropdownMenuItem>}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator className="bg-primary/10" />
                                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-normal">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete Permanently
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {isOpen && (
                <div className="bg-primary/[0.02] border-b border-primary/10 p-4 animate-fade-in-up">
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary tracking-tight uppercase"><IndianRupee className="h-3 w-3"/> Category Breakdown</h4>
                                <div className="border border-primary/10 rounded-xl bg-white shadow-sm overflow-hidden">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader className="bg-primary/5">
                                                <TableRow>
                                                    <TableHead className="h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Category</TableHead>
                                                    <TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Value</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(donation.typeSplit || []).map(split => (
                                                    <TableRow key={split.category} className="h-8 hover:bg-[hsl(var(--table-row-hover))]">
                                                        <TableCell className="py-1 text-[11px] font-normal text-primary/80 whitespace-nowrap">{split.category}</TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-primary py-1 text-[11px]">₹{split.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary tracking-tight uppercase"><FolderKanban className="h-3 w-3"/> Initiative Allocation</h4>
                                <div className="border border-primary/10 rounded-xl bg-white shadow-sm overflow-hidden">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader className="bg-primary/5">
                                                <TableRow>
                                                    <TableHead className="h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Target Initiative</TableHead>
                                                    <TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Allocated Sum</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(donation.linkSplit || []).map(link => (
                                                    <TableRow key={link.linkId} className="h-8 hover:bg-[hsl(var(--table-row-hover))]">
                                                        <TableCell className="flex items-center gap-2 py-1">
                                                            {link.linkType === 'campaign' ? <FolderKanban className="h-3.5 w-3.5 text-primary/40" /> : <Lightbulb className="h-3.5 w-3.5 text-primary/40" />}
                                                            <span className="text-[10px] font-bold text-primary/80 whitespace-nowrap">{link.linkName}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-primary py-1 text-[11px]">₹{link.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(donation.linkSplit?.length === 0 || !donation.linkSplit) && (
                                                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6 italic text-xs font-normal">Unallocated / General Institutional Fund</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary tracking-tight uppercase"><ImageIcon className="h-3 w-3"/> Transaction Documents</h4>
                            <div className="border border-primary/10 rounded-xl bg-white shadow-sm overflow-hidden">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Amount</TableHead>
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Ref. ID</TableHead>
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary tracking-tight">Date</TableHead>
                                                <TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary tracking-tight pr-6">Evidence</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(donation.transactions || []).map((tx) => (
                                                <TableRow key={tx.id} className="hover:bg-[hsl(var(--table-row-hover))]">
                                                    <TableCell className="font-bold font-mono text-primary text-[11px] py-2">₹{tx.amount.toFixed(2)}</TableCell>
                                                    <TableCell className="font-mono text-[10px] py-2 text-primary/80 whitespace-nowrap">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="text-[10px] font-normal text-muted-foreground py-2 whitespace-nowrap">{tx.date || donation.donationDate}</TableCell>
                                                    <TableCell className="text-right py-2 pr-6">
                                                        {tx.screenshotUrl ? (
                                                            <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold border-primary/20 text-primary hover:bg-primary/5 transition-transform active:scale-95 shadow-sm" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }}>
                                                                <ImageIcon className="mr-1 h-3 w-3" /> View Evidence
                                                            </Button>
                                                        ) : <span className="text-muted-foreground text-[9px] font-normal opacity-40 tracking-tight">No Artifact</span>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default function DonationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: any; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const donationsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
  const { data: allCampaigns } = useCollection<Campaign>(campaignsCollectionRef);

  const leadsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
  const { data: allLeads } = useCollection<Lead>(leadsCollectionRef);

  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const filteredAndSortedDonations = useMemo(() => {
    if (!donations) return [];
    let items = [...donations];

    if (statusFilter !== 'All') {
        items = items.filter(d => d.status === statusFilter);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(d => 
            d.donorName.toLowerCase().includes(lower) || 
            d.donorPhone.includes(searchTerm) ||
            d.id.toLowerCase().includes(lower) ||
            d.receiverName.toLowerCase().includes(lower)
        );
    }

    if (sortConfig) {
        items.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = (a[sortConfig.key as keyof Donation] ?? '').toString().toLowerCase();
            const bVal = (b[sortConfig.key as keyof Donation] ?? '').toString().toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    return items;
  }, [donations, searchTerm, statusFilter, sortConfig]);

  const stats = useMemo(() => {
      const data = filteredAndSortedDonations;
      return {
          total: data.length,
          verified: data.filter(d => d.status === 'Verified').length,
          pending: data.filter(d => d.status === 'Pending').length,
          canceled: data.filter(d => d.status === 'Canceled').length,
          online: data.filter(d => d.donationType === 'Online Payment').length,
          cash: data.filter(d => d.donationType === 'Cash').length,
          totalAmount: data.filter(d => d.status === 'Verified').reduce((sum, d) => sum + d.amount, 0),
          pendingAmount: data.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amount, 0),
      };
  }, [filteredAndSortedDonations]);

  const paginatedDonations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedDonations.slice(start, start + itemsPerPage);
  }, [filteredAndSortedDonations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);

  const handleSync = async () => {
    setIsSyncing(true);
    const res = await syncDonationsAction();
    if (res && res.success) {
        toast({ title: 'Success', description: res.message, variant: 'success' });
    } else {
        toast({ title: 'Error', description: res?.message || 'Sync Failed.', variant: 'destructive' });
    }
    setIsSyncing(false);
  };

  const handleAdd = () => {
    setEditingDonation(null);
    setIsFormOpen(true);
  };

  const toggleSelectAll = (checked: boolean | string) => {
    const isChecked = checked === true;
    if (isChecked) {
        setSelectedIds(paginatedDonations.map(d => d.id));
    } else {
        setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatusChange = async (newStatus: Donation['status']) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateDonationStatusAction(selectedIds, newStatus);
    if (res && res.success) {
        toast({ title: "Bulk Update Successful", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Update Failed", description: res?.message || "Failed To Update Status.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleFormSubmit = async (data: DonationFormData) => {
    if (!firestore || !storage || !userProfile || !allCampaigns || !allLeads) return;
    setIsFormOpen(false);
    const docRef = editingDonation ? doc(firestore, 'donations', editingDonation.id) : doc(collection(firestore, 'donations'));
    
    try {
        const transactionPromises = data.transactions.map(async (transaction) => {
            let screenshotUrl = transaction.screenshotUrl || '';
            const fileList = transaction.screenshotFile as FileList | undefined;
            if (fileList && fileList.length > 0) {
                const file = fileList[0];
                const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
                const filePath = `donations/${docRef.id}/${data.donationDate}_${transaction.id}.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                screenshotUrl = await getDownloadURL(fileRef);
            }
            return { id: transaction.id, amount: transaction.amount, transactionId: transaction.transactionId || '', screenshotUrl, screenshotIsPublic: transaction.screenshotIsPublic || false };
        });

        const finalTransactions = await Promise.all(transactionPromises);
        const { transactions, ...donationData } = data;
        
        const finalLinkSplit = data.linkSplit?.map(split => {
            if (!split.linkId || split.linkId === 'unlinked') return split.amount > 0 ? { linkId: 'unallocated', linkName: 'Unallocated', linkType: 'general' as const, amount: split.amount } : null;
            const [type, id] = split.linkId.split('_');
            const linkType = type as 'campaign' | 'lead';
            const source = linkType === 'campaign' ? allCampaigns : allLeads;
            const linkedItem = source?.find(item => item.id === id);
            return { linkId: id, linkName: linkedItem?.name || 'Unknown', linkType, amount: split.amount };
        }).filter((item): item is NonNullable<typeof item> => item !== null && item.amount > 0);
        
        const finalData = { 
            ...donationData, 
            transactions: finalTransactions, 
            amount: finalTransactions.reduce((sum, t) => sum + t.amount, 0), 
            linkSplit: finalLinkSplit, 
            uploadedBy: userProfile.name, 
            uploadedById: userProfile.id, 
            createdAt: editingDonation ? (editingDonation as any).createdAt : serverTimestamp() 
        };

        if (editingDonation) {
            (finalData as any).campaignId = deleteField();
            (finalData as any).campaignName = deleteField();
        }

        await setDoc(docRef, finalData, { merge: true });
        toast({ title: "Donation Synchronized", description: "The Record Is Now Secured.", variant: 'success' });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: editingDonation ? 'update' : 'create',
            requestResourceData: data,
        }));
    } finally {
        setEditingDonation(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!donationToDelete) return;
    setIsDeleteDialogOpen(false);
    const res = await deleteDonationAction(donationToDelete);
    if (res && res.success) {
        toast({ title: 'Deleted', description: res.message, variant: 'success' });
    } else {
        toast({ title: 'Error', description: res?.message || 'Delete Failed.', variant: 'destructive' });
    }
    setDonationToDelete(null);
  };

  const handleViewImage = (url: string) => {
    setImageToView(url);
    setZoom(1);
    setRotation(0);
    setIsImageViewerOpen(true);
  };

  const handleImport = async (records: Partial<Donation>[]) => {
    if (!userProfile) return;
    const res = await bulkImportDonationsAction(records, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: 'Import Complete', description: res.message, variant: 'success' });
    } else {
        toast({ title: 'Import Failed', description: res?.message || "Operation Failed.", variant: 'destructive' });
    }
  };

  const isLoading = areDonationsLoading || isProfileLoading;

  if (isLoading) return <SectionLoader label="Loading Donation Records..." description="Retrieving Institutional Logs." />;

  return (
    <main className="container mx-auto p-4 md:p-8 font-normal text-primary relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col gap-2">
                <Button variant="outline" asChild className="w-fit font-bold border-primary/20 text-primary transition-transform active:scale-95">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-primary">Master Donation Registry</h1>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => { if(!filteredAndSortedDonations.length) return; const headers = ['ID', 'Donor Name', 'Donor Phone', 'Receiver Name', 'Referral', 'Amount', 'Donation Date', 'Status', 'Donation Type', 'Comments', 'Suggestions']; const rows = filteredAndSortedDonations.map(d => [ d.id, `"${d.donorName || ''}"`, d.donorPhone || '', `"${d.receiverName || ''}"`, `"${d.referral || ''}"`, d.amount || 0, d.donationDate || '', d.status || 'Pending', d.donationType || '', `"${(d.comments || '').replace(/"/g, '""')}"`, `"${(d.suggestions || '').replace(/"/g, '""')}"` ]); const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "master_donation_registry.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link); }} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                    <UploadCloud className="mr-2 h-4 w-4" /> Import Data
                </Button>
                <Button variant="secondary" onClick={handleSync} disabled={isSyncing} className="font-bold text-[10px] border-primary/10 text-primary active:scale-95 transition-transform">
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                  Refresh Sync
                </Button>
                <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-white font-bold text-xs active:scale-95 transition-transform shadow-md rounded-[12px]">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Record
                </Button>
            </div>
        </div>

        <div className="border-b mb-4">
            <ScrollArea className="w-full">
                <div className="flex w-max space-x-2 pb-2">
                    <Link href="/donations/summary" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                        pathname === '/donations/summary' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}>Donation Summary</Link>
                    <Link href="/donations" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300",
                        pathname === '/donations' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}>Donation List</Link>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard title="Total Count" count={stats.total} description="All Records Logged" icon={Users} delay="100ms" />
            <StatCard title="Verified Sum" count={stats.totalAmount.toLocaleString('en-IN')} description="Confirmed Funds" icon={CheckCircle2} delay="150ms" isCurrency />
            <StatCard title="Pending Sum" count={stats.pendingAmount.toLocaleString('en-IN')} description="Awaiting Vetting" icon={Hourglass} delay="150ms" isCurrency />
            <StatCard title="Online Pay" count={stats.online} description="Digital Transfers" icon={Smartphone} delay="250ms" />
            <StatCard title="Cash" count={stats.cash} description="Physical Collections" icon={Wallet} delay="300ms" />
            <StatCard title="Canceled" count={stats.canceled} description="Voided Records" icon={XCircle} delay="350ms" colorClass="bg-red-50/50" />
        </div>

        {selectedIds.length > 0 && (
            <div className="sticky top-[73px] z-40 animate-fade-in-up w-full">
                <div className="flex items-center justify-start gap-4 px-4 py-2 bg-primary/5 border border-primary/20 backdrop-blur-md rounded-xl shadow-sm mb-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-primary/10">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold tracking-tight whitespace-nowrap text-primary">{selectedIds.length} Selected</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                    Change Status
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-dropdown border-primary/10">
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-normal">Set To Verified</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-normal">Set To Pending</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Canceled')} className="font-normal text-destructive">Set To Canceled</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="ml-auto">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/40 hover:text-primary rounded-full" onClick={() => setSelectedIds([])}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        )}

        <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm transition-all hover:shadow-lg">
            <CardHeader className="bg-primary/5 border-b">
                <ScrollArea className="w-full">
                    <div className="flex flex-nowrap gap-2 pb-2">
                        <Input placeholder="Search Donor, Phone, ID..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-[300px] h-9 text-xs border-primary/10 focus-visible:ring-primary text-primary font-normal bg-primary/[0.02] rounded-[10px] shrink-0"/>
                        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[180px] h-9 text-xs border-primary/10 text-primary rounded-[10px] bg-primary/[0.02] font-normal shrink-0"><SelectValue placeholder="All Statuses"/></SelectTrigger>
                            <SelectContent className="rounded-[12px] border-primary/10 shadow-dropdown">
                                <SelectItem value="All" className="font-normal">All Statuses</SelectItem>
                                <SelectItem value="Verified" className="font-normal text-primary">Verified</SelectItem>
                                <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
                                <SelectItem value="Canceled" className="font-normal text-destructive">Canceled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold text-[hsl(var(--table-header-fg))] tracking-tight", donationGridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={paginatedDonations.length > 0 && selectedIds.length === paginatedDonations.length}
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor Name</SortableHeader>
                        <SortableHeader sortKey="amount" sortConfig={sortConfig} handleSort={handleSort} className="text-right">Amount (₹)</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Entry Date</SortableHeader>
                        <div className="text-center font-bold text-[10px] tracking-tight">Method</div>
                        <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Verification Status</SortableHeader>
                        <div className="font-bold text-[10px] tracking-tight">Target Initiative</div>
                        <div className="text-right pr-4 font-bold text-[10px] tracking-tight">Actions</div>
                    </div>
                    <div className="w-full max-h-[70vh]">
                        {paginatedDonations.map((d, i) => (
                            <DonationRow 
                                key={d.id} 
                                donation={d} 
                                isSelected={selectedIds.includes(d.id)}
                                onToggle={() => toggleSelect(d.id)}
                                index={(currentPage - 1) * itemsPerPage + i + 1} 
                                handleEdit={() => { setEditingDonation(d); setIsFormOpen(true); }} 
                                handleDeleteClick={() => { setDonationToDelete(d.id); setIsDeleteDialogOpen(true); }} 
                                handleViewImage={handleViewImage}
                            />
                        ))}
                        {paginatedDonations.length === 0 && (
                            <div className="text-center py-24 text-primary/40 font-bold bg-primary/[0.02] italic tracking-widest">No Donation Records Found.</div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center py-4 border-t bg-primary/5 p-4">
                    <p className="text-[10px] font-bold text-muted-foreground">Page {currentPage} Of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold h-8 border-primary/10 text-primary transition-transform active:scale-95">Previous</Button>
                        <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold h-8 border-primary/10 text-primary transition-transform active:scale-95">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setEditingDonation(null); }}>
            <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
                <DialogHeader className="px-6 py-4 bg-primary/5 border-b shrink-0">
                    <DialogTitle className="text-xl font-bold text-primary tracking-tight">
                        {editingDonation ? 'Modify Donation Profile' : 'Donation Details To Be Add'}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <DonationForm 
                        donation={editingDonation} 
                        onSubmit={handleFormSubmit} 
                        onCancel={() => setIsFormOpen(false)} 
                        leads={allLeads || []} 
                        campaigns={allCampaigns || []} 
                        defaultLinkId={'unlinked'} 
                    />
                </div>
            </DialogContent>
        </Dialog>

        <DonationImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-[16px] border-border shadow-dropdown">
                <AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Confirm Permanent Deletion?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Permanently Erase This Donation Record And All Attached Verification Evidence. This Action Is Irreversible.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="font-bold border-border">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteConfirm} 
                        className="bg-destructive hover:bg-destructive/90 text-white font-bold rounded-[12px] shadow-md transition-transform active:scale-95">Confirm Deletion</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
            <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 rounded-[12px] border-primary/10 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="text-xl font-bold text-primary tracking-tight">Evidence Artifact Viewer</DialogTitle></DialogHeader>
                <ScrollArea className="flex-1 bg-secondary/20">
                    <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                        {imageToView && (
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Evidence Document" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
                <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                    <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomIn className="mr-1 h-4 w-4"/> Zoom In</Button>
                    <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5)) } className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomOut className="mr-1 h-4 w-4"/> Zoom Out</Button>
                    <Button variant="secondary" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}