'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase, useAuth } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, MoreHorizontal, Edit, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, IndianRupee, FolderKanban, Lightbulb, Trash2, ZoomIn, ZoomOut, RotateCw, RefreshCw, DatabaseZap, ImageIcon, Loader2, CheckSquare, X, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { syncDonationsAction, deleteDonationAction, bulkUpdateDonationStatusAction } from './actions';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';

type SortKey = keyof Donation | 'srNo';

const donationGridClass = "grid grid-cols-[40px_60px_200px_120px_120px_100px_100px_150px_80px] items-center gap-4 px-4 py-3 min-w-[1000px]";

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2 font-bold text-[10px] text-[hsl(var(--table-header-fg))]", className)} onClick={() => handleSort(sortKey)}>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)} className="text-primary font-normal"><Eye className="mr-2 h-4 w-4"/> Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator className="bg-primary/10" />
                                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-normal">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {isOpen && (
                <div className="bg-primary/[0.02] border-b border-primary/10 p-4">
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary"><IndianRupee className="h-3 w-3"/> Category Breakdown</h4>
                                <div className="border border-primary/10 rounded-md bg-white overflow-hidden shadow-sm">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader className="bg-[hsl(var(--table-header-bg))]"><TableRow><TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Category</TableHead><TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Value</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(donation.typeSplit || []).map(split => (
                                                    <TableRow key={split.category} className="h-8 hover:bg-[hsl(var(--table-row-hover))]"><TableCell className="py-1 text-[11px] font-normal text-primary/80 whitespace-nowrap">{split.category}</TableCell><TableCell className="text-right font-bold font-mono text-primary py-1 text-[11px]">₹{split.amount.toFixed(2)}</TableCell></TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary"><FolderKanban className="h-3 w-3"/> Initiative Allocation</h4>
                                <div className="border border-primary/10 rounded-md bg-white overflow-hidden shadow-sm">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader><TableRow className="bg-[hsl(var(--table-header-bg))]"><TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Target Initiative</TableHead><TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Allocated Sum</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(donation.linkSplit || []).map(link => (
                                                    <TableRow key={link.linkId} className="h-8 hover:bg-[hsl(var(--table-row-hover))]">
                                                        <TableCell className="flex items-center gap-2 py-1">
                                                            {link.linkType === 'campaign' ? <FolderKanban className="h-3.5 w-3.5 text-primary/40" /> : <Lightbulb className="h-3.5 w-3.5 text-primary/40" />}
                                                            <span className="text-[10px] font-normal text-primary/80 whitespace-nowrap">{link.linkName}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-primary py-1 text-[11px]">₹{link.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(donation.linkSplit?.length === 0 || !donation.linkSplit) && (
                                                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4 italic text-xs font-normal">Unallocated / General Fund</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold flex items-center gap-2 text-primary"><ImageIcon className="h-3 w-3"/> Transaction Documents</h4>
                            <div className="border border-primary/10 rounded-md bg-white overflow-hidden shadow-sm">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-[hsl(var(--table-header-bg))]">
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Amount</TableHead>
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Ref. ID</TableHead>
                                                <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Date</TableHead>
                                                <TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Evidence</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(donation.transactions || []).map((tx) => (
                                                <TableRow key={tx.id} className="hover:bg-[hsl(var(--table-row-hover))]">
                                                    <TableCell className="font-bold font-mono text-primary text-[11px] py-2">₹{tx.amount.toFixed(2)}</TableCell>
                                                    <TableCell className="font-mono text-[10px] py-2 text-primary/80 whitespace-nowrap">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="text-[10px] font-normal text-muted-foreground py-2 whitespace-nowrap">{tx.date || donation.donationDate}</TableCell>
                                                    <TableCell className="text-right py-2">
                                                        {tx.screenshotUrl ? (
                                                            <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold border-primary/20 text-primary hover:bg-primary/5" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }}>
                                                                <ImageIcon className="mr-1 h-3 w-3" /> View Evidence
                                                            </Button>
                                                        ) : <span className="text-muted-foreground text-[9px] font-normal opacity-40">None</span>}
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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
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
            d.receiverName.toLowerCase().includes(lower) ||
            d.id.toLowerCase().includes(lower)
        );
    }

    if (sortConfig) {
        items.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = a[sortConfig.key as keyof Donation];
            const bVal = b[sortConfig.key as keyof Donation];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
            }
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();
            if (aStr < bStr) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aStr > bStr) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    return items;
  }, [donations, searchTerm, statusFilter, sortConfig]);

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
        toast({ title: 'Error', description: res?.message || 'Sync failed.', variant: 'destructive' });
    }
    setIsSyncing(false);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
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
        toast({ title: "Update Failed", description: res?.message || "Failed to update status.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleFormSubmit = async (data: DonationFormData) => {
    if (!firestore || !storage || !userProfile) return;
    setIsFormOpen(false);
    const docRef = editingDonation ? doc(firestore, 'donations', editingDonation.id) : doc(collection(firestore, 'donations'));
    
    setDoc(docRef, { 
        ...data, 
        uploadedBy: userProfile.name, 
        uploadedById: userProfile.id,
        createdAt: editingDonation ? (editingDonation as any).createdAt : serverTimestamp()
    }, { merge: true })
    .catch(async (serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: editingDonation ? 'update' : 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    toast({ title: "Donation Synchronized", description: "The Record Is Now Secured.", variant: 'success' });
  };

  const handleDeleteConfirm = async () => {
    if (!donationToDelete) return;
    setIsDeleteDialogOpen(false);
    const res = await deleteDonationAction(donationToDelete);
    if (res && res.success) {
        toast({ title: 'Deleted', description: res.message, variant: 'success' });
    } else {
        toast({ title: 'Error', description: res?.message || 'Delete failed.', variant: 'destructive' });
    }
    setDonationToDelete(null);
  };

  const handleViewImage = (url: string) => {
    setImageToView(url);
    setZoom(1);
    setRotation(0);
    setIsImageViewerOpen(true);
  };

  const isLoading = areDonationsLoading || isProfileLoading;

  if (isLoading) return <SectionLoader label="Loading donation records..." description="Retrieving logs." />;

  return (
    <main className="container mx-auto p-4 md:p-8 font-normal text-primary relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold tracking-tighter text-primary">Donations</h1>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="secondary" onClick={handleSync} disabled={isSyncing} className="flex-1 sm:flex-none font-bold text-[10px] border-primary/10 text-primary active:scale-95 transition-transform">
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                  Sync Records
                </Button>
                <Button onClick={() => { setEditingDonation(null); setIsFormOpen(true); }} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white font-bold text-xs active:scale-95 transition-transform shadow-md rounded-[12px]">
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

        <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm transition-all hover:shadow-lg">
            <CardHeader className="bg-primary/5 border-b">
                <ScrollArea className="w-full">
                    <div className="flex flex-nowrap gap-2 pb-2">
                        <Input placeholder="Search Donor, Phone, ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-[300px] h-9 text-xs border-primary/10 focus-visible:ring-primary text-primary font-normal bg-primary/[0.02] rounded-[10px] shrink-0"/>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-xs border-primary/10 text-primary rounded-[10px] bg-primary/[0.02] font-normal shrink-0"><SelectValue placeholder="All Statuses"/></SelectTrigger>
                            <SelectContent className="rounded-[12px] border-primary/10 shadow-dropdown">
                                <SelectItem value="All" className="font-normal">All Statuses</SelectItem>
                                <SelectItem value="Verified" className="font-normal">Verified</SelectItem>
                                <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
                                <SelectItem value="Canceled" className="font-normal">Canceled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--table-header-fg))]", donationGridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={selectedIds.length > 0 && selectedIds.length === paginatedDonations.length}
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor Name</SortableHeader>
                        <SortableHeader sortKey="amount" sortConfig={sortConfig} handleSort={handleSort} className="text-right">Amount (₹)</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Entry Date</SortableHeader>
                        <div className="text-center font-bold text-[10px] uppercase text-[hsl(var(--table-header-fg))]">Method</div>
                        <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Vetting Status</SortableHeader>
                        <div className="font-bold text-[10px] uppercase text-[hsl(var(--table-header-fg))]">Target Initiative</div>
                        <div className="text-right pr-4 font-bold text-[10px] uppercase text-[hsl(var(--table-header-fg))]">Actions</div>
                    </div>
                    <div className="w-full">
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
                            <div className="text-center py-24 text-primary/40 font-bold bg-primary/[0.02]">No Donation Records Found Matching Filters.</div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center py-4 border-t bg-primary/5 p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} Of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold h-8 border-primary/10 text-primary">Previous</Button>
                        <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold h-8 border-primary/10 text-primary">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in-from-bottom w-full max-w-[95vw] sm:max-w-fit">
                <div className="flex items-center gap-4 px-6 py-3 bg-primary text-white rounded-full shadow-2xl border border-white/20 backdrop-blur-md">
                    <div className="flex items-center gap-2 pr-4 border-r border-white/20">
                        <CheckSquare className="h-5 w-5" />
                        <span className="text-sm font-bold tracking-tight whitespace-nowrap">{selectedIds.length} Selected</span>
                    </div>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 font-bold h-8" disabled={isBulkUpdating}>
                                {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ChevronsUpDown className="mr-2 h-4 w-4"/>}
                                <span className="hidden sm:inline">Bulk Change Status</span>
                                <span className="sm:hidden">Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-dropdown border-primary/10">
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-normal">Set To Verified</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-normal">Set To Pending</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Canceled')} className="font-normal text-destructive">Set To Canceled</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={() => setSelectedIds([])}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 rounded-[12px] border-primary/10">
                <DialogHeader className="px-6 py-4 border-b bg-primary/5">
                    <DialogTitle className="text-xl font-bold text-primary tracking-tight">{editingDonation ? 'Edit' : 'Add New'} Donation Record</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 px-6 py-4">
                    <DonationForm 
                        donation={editingDonation} 
                        onSubmit={handleFormSubmit} 
                        onCancel={() => setIsFormOpen(false)} 
                        leads={allLeads || []} 
                        campaigns={allCampaigns || []} 
                    />
                </ScrollArea>
                <DialogFooter className="px-6 py-4 border-t bg-muted/5">
                    <Button variant="secondary" onClick={() => setIsFormOpen(false)} className="font-bold border-primary/10 text-primary">Close Form</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-[12px] border-primary/10">
                <AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Confirm Permanent Deletion?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Permanently Erase This Donation Record And All Attached Verification Evidence. This Action Is Irreversible.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90 rounded-[12px]">Confirm Deletion</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
            <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 rounded-[12px] border-primary/10">
                <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="text-xl font-bold text-primary">Evidence Viewer</DialogTitle></DialogHeader>
                <ScrollArea className="flex-1 bg-secondary/20">
                    <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                        {imageToView && (
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Evidence Document" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                    <Button variant="secondary" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomIn className="mr-1 h-4 w-4"/> Zoom In</Button>
                    <Button variant="secondary" size="sm" onClick={() => setZoom(z => z / 1.2) } className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><ZoomOut className="mr-1 h-4 w-4"/> Zoom Out</Button>
                    <Button variant="secondary" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-[10px] border-primary/10 text-primary transition-transform active:scale-95"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}