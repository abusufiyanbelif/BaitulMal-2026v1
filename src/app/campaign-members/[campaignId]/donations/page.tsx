'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, serverTimestamp, setDoc, DocumentReference, updateDoc, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    ArrowLeft, 
    Edit, 
    MoreHorizontal, 
    PlusCircle, 
    Loader2, 
    Eye, 
    ArrowUp, 
    ArrowDown, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    RefreshCw, 
    Link2Off, 
    ChevronDown, 
    ChevronUp, 
    Link as LinkIcon, 
    ImageIcon,
    CheckSquare,
    X,
    ChevronsUpDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { DonationSearchDialog } from '@/components/donation-search-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, getNestedValue } from '@/lib/utils';
import { bulkUpdateDonationStatusAction } from '@/app/donations/actions';
import { donationCategories } from '@/lib/modules';
import { BrandedLoader } from '@/components/branded-loader';

type SortKey = keyof Donation | 'srNo' | 'amountForThisCampaign';

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50 text-[hsl(var(--table-header-fg))] font-bold", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2 whitespace-nowrap">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
};

export default function DonationsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();
  
  const campaignDocRef = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign>;
  }, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  
  const allDonationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

  const donations = useMemo(() => {
    if (!allDonations || !campaignId) return [];
    return allDonations
      .filter(d => {
        if (d.linkSplit && d.linkSplit.length > 0) {
          return d.linkSplit.some(link => link.linkId === campaignId && link.linkType === 'campaign');
        }
        return (d as any).campaignId === campaignId;
      })
      .map(d => {
        const campaignLink = d.linkSplit?.find(l => l.linkId === campaignId && l.linkType === 'campaign');
        const amountForThisCampaign = campaignLink?.amount || ((d as any).campaignId === campaignId ? d.amount : 0);
        return { ...d, amountForThisCampaign };
      });
  }, [allDonations, campaignId]);

  const allCampaignsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
  const { data: allCampaigns } = useCollection<Campaign>(allCampaignsCollectionRef);

  const allLeadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
  const { data: allLeads } = useCollection<Lead>(allLeadsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [donationToUnlink, setDonationToUnlink] = useState<string | null>(null);
  
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.update', false);

  const handleAdd = () => {
    if (!canCreate) return;
    setEditingDonation(null);
    setIsFormOpen(true);
  };
  
  const handleEdit = (donation: Donation) => {
    if (!canUpdate) return;
    setEditingDonation(donation);
    setIsFormOpen(true);
  };

  const handleUnlinkClick = (id: string) => {
    if (!canUpdate) return;
    setDonationToUnlink(id);
    setIsUnlinkDialogOpen(true);
  };

  const handleViewImage = (url: string) => {
    setImageToView(url);
    setZoom(1);
    setRotation(0);
    setIsImageViewerOpen(true);
  };

  const handleUnlinkConfirm = async () => {
    if (!donationToUnlink || !firestore || !canUpdate || !donations || !campaignId) return;

    const donationData = donations.find(d => d.id === donationToUnlink);
    if (!donationData) return;

    setIsUnlinkDialogOpen(false);

    const docRef = doc(firestore, 'donations', donationToUnlink);
    const newLinkSplit = (donationData.linkSplit || []).filter(link => link.linkId !== campaignId || link.linkType !== 'campaign');
    
    const updateData = { linkSplit: newLinkSplit };
    
    updateDoc(docRef, updateData)
        .catch(async (serverError: any) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Donation Unlinked Successfully.', variant: 'success' });
            setDonationToUnlink(null);
        });
  };
  
  const handleFormSubmit = async (data: DonationFormData) => {
    const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
    if (hasFilesToUpload && !auth?.currentUser) {
        toast({ title: "Authentication Error", description: "User Not Authenticated Yet.", variant: "destructive" });
        return;
    }

    if (!firestore || !storage || !userProfile || !allCampaigns || !allLeads) return;
    
    setIsFormOpen(false);
    setEditingDonation(null);

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
        
        const finalData = { ...donationData, transactions: finalTransactions, amount: finalTransactions.reduce((sum, t) => sum + t.amount, 0), linkSplit: finalLinkSplit, uploadedBy: userProfile.name, uploadedById: userProfile.id, ...(!editingDonation && { createdAt: serverTimestamp() }) };

        if (editingDonation) {
            (finalData as any).campaignId = deleteField();
            (finalData as any).campaignName = deleteField();
        }

        await setDoc(docRef, finalData, { merge: true });
        toast({ title: 'Success', description: 'Donation Saved.', variant: 'success' });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: editingDonation ? 'update' : 'create', requestResourceData: data }));
    }
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const filteredAndSortedDonations = useMemo(() => {
    if (!donations) return [];
    let items = [...donations];

    if (statusFilter === 'No Transactions') {
        items = items.filter(d => !d.transactions || d.transactions.length === 0);
    } else if (statusFilter !== 'All') {
        items = items.filter(d => d.status === statusFilter);
    }

    if (typeFilter !== 'All') {
        items = items.filter(d => d.typeSplit?.some(s => s.category === typeFilter));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(d => (d.donorName || '').toLowerCase().includes(term) || (d.donorPhone || '').includes(term));
    }

    if (sortConfig !== null) {
      items.sort((a, b) => {
        if (sortConfig.key === 'srNo') return 0;
        const aVal = (a as any)[sortConfig.key];
        const bVal = (b as any)[sortConfig.key];
        if (typeof aVal === 'number') return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
        return sortConfig.direction === 'ascending' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    }
    return items;
  }, [donations, searchTerm, statusFilter, typeFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  const paginatedDonations = useMemo(() => filteredAndSortedDonations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSortedDonations, currentPage, itemsPerPage]);

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
    if (res.success) {
        toast({ title: "Bulk Update Successful", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Update Failed", description: res.message, variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const isLoading = isCampaignLoading || areDonationsLoading || isProfileLoading;
  
  if (isLoading && !campaign) return <BrandedLoader />;
  if (!campaign) return <div className="p-8 text-center"><p>Campaign Not Found.</p><Button asChild variant="outline" className="mt-4"><Link href="/campaign-members"><ArrowLeft className="mr-2"/>Back</Link></Button></div>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold tracking-tight uppercase">{campaign.name}</h1></div>
        
        <div className="mb-6">
            <ScrollArea className="w-full">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full bg-transparent p-0 border-b border-primary/10 pb-4">
                    {canReadSummary && (<Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>)}
                    {canReadRation && (<Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item Lists</Link>)}
                    {canReadBeneficiaries && (<Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>)}
                    {canReadDonations && (<Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}/donations` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link>)}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom border-primary/10 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className="text-xl font-bold tracking-tight">Donation List ({filteredAndSortedDonations.length})</CardTitle>
                        <CardDescription className="font-normal">Total verified for this campaign: <span className="font-bold text-primary font-mono">₹{filteredAndSortedDonations.reduce((sum, d) => sum + d.amountForThisCampaign, 0).toFixed(2)}</span></CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {canUpdate && <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><LinkIcon className="mr-2 h-4 w-4"/> Select From Master</Button>}
                        {canCreate && <Button onClick={handleAdd} className="font-bold shadow-md active:scale-95 transition-transform"><PlusCircle className="mr-2 h-4 w-4" /> Add Record</Button>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Input placeholder="Search Donor..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-xs h-9 text-xs font-normal" />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs text-primary font-bold"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="All" className="font-bold">All Statuses</SelectItem><SelectItem value="Verified" className="font-bold">Verified</SelectItem><SelectItem value="Pending" className="font-bold">Pending</SelectItem><SelectItem value="Canceled" className="font-bold">Canceled</SelectItem></SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs text-primary font-bold"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent><SelectItem value="All" className="font-bold">All Categories</SelectItem>{donationCategories.map(cat => <SelectItem key={cat} value={cat} className="font-normal">{cat}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-[40px] pl-4 bg-[hsl(var(--table-header-bg))]">
                            <Checkbox 
                                checked={selectedIds.length > 0 && selectedIds.length === paginatedDonations.length}
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </TableHead>
                        <SortableHeader sortKey="srNo" className="w-[60px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                        <SortableHeader sortKey="amountForThisCampaign" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Amount</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="text-right pr-4 font-bold">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {paginatedDonations.map((donation, index) => {
                        const isOpen = openRows[donation.id] || false;
                        return (
                            <React.Fragment key={donation.id}>
                            <TableRow className="bg-white border-b border-primary/10 hover:bg-[hsl(var(--table-row-hover))] cursor-pointer group transition-colors" onClick={() => setOpenRows(prev => ({...prev, [donation.id]: !prev[donation.id]}))}>
                                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox 
                                        checked={selectedIds.includes(donation.id)}
                                        onCheckedChange={() => toggleSelect(donation.id)}
                                        className="border-primary/40 data-[state=checked]:bg-primary"
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" disabled={!donation.transactions || donation.transactions.length === 0}>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                                        <span className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                                    </div>
                                </TableCell>
                                <TableCell><div className="font-bold text-sm text-primary">{donation.donorName}</div><div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone || 'N/A'}</div></TableCell>
                                <TableCell className="text-right font-bold font-mono text-primary">₹{donation.amountForThisCampaign.toFixed(2)}</TableCell>
                                <TableCell className="text-xs font-normal">{donation.donationDate}</TableCell>
                                <TableCell><Badge variant={donation.status === 'Verified' ? 'success' : 'outline'} className="text-[10px] font-bold uppercase">{donation.status}</Badge></TableCell>
                                <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                            <DropdownMenuItem onClick={() => router.push(`/campaign-members/${campaignId}/donations/${donation.id}`)} className="font-normal text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                            {canUpdate && <DropdownMenuItem onClick={() => handleEdit(donation)} className="font-normal text-primary"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                                            {canUpdate && <DropdownMenuItem onClick={() => handleUnlinkClick(donation.id)} className="text-destructive font-normal"><Link2Off className="mr-2 h-4 w-4" /> Unlink</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                            {isOpen && (
                                <TableRow className="bg-primary/[0.01] border-b border-primary/10">
                                <TableCell colSpan={7} className="p-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Linked Transactions</h4>
                                    <div className="border border-primary/10 rounded-md bg-white overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader><TableRow className="bg-[hsl(var(--table-header-bg))]"><TableHead className="text-[10px] font-bold text-primary">Sum</TableHead><TableHead className="text-[10px] font-bold text-primary">Reference</TableHead><TableHead className="text-right text-[10px] font-bold text-primary">Artifact</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {(donation.transactions || []).map((tx) => (
                                            <TableRow key={tx.id} className="hover:bg-[hsl(var(--table-row-hover))]"><TableCell className="font-bold font-mono text-sm">₹{tx.amount.toFixed(2)}</TableCell><TableCell className="font-mono text-xs opacity-70">{tx.transactionId || 'N/A'}</TableCell><TableCell className="text-right">{tx.screenshotUrl ? (<Button variant="outline" size="sm" onClick={() => handleViewImage(tx.screenshotUrl!)} className="font-bold text-[10px] h-7 border-primary/20"><ImageIcon className="mr-1 h-3 w-3" /> View</Button>) : <span className="text-muted-foreground text-[10px]">None</span>}</TableCell></TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </TableCell>
                                </TableRow>
                            )}
                            </React.Fragment>
                        );
                    })}
                    {paginatedDonations.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic font-normal bg-primary/[0.02]">No Donation Records Matching Your Criteria.</TableCell></TableRow>}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between py-4 border-t bg-primary/5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/20 h-8">Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/20 h-8">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in-from-bottom">
                <div className="flex items-center gap-4 px-6 py-3 bg-primary text-white rounded-full shadow-2xl border border-white/20 backdrop-blur-md">
                    <div className="flex items-center gap-2 pr-4 border-r border-white/20">
                        <CheckSquare className="h-5 w-5" />
                        <span className="text-sm font-bold tracking-tight">{selectedIds.length} Selected</span>
                    </div>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 font-bold h-8" disabled={isBulkUpdating}>
                                {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ChevronsUpDown className="mr-2 h-4 w-4"/>}
                                Bulk Update Status
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-dropdown border-primary/10">
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-bold">Set To Verified</DropdownMenuItem>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[16px] border-primary/10 p-0 overflow-hidden">
            <DialogHeader className="border-b bg-primary/5 p-6"><DialogTitle className="text-xl font-bold tracking-tight">{editingDonation ? 'Edit' : 'Add'} Donation Record</DialogTitle></DialogHeader>
            <div className="p-6"><DonationForm donation={editingDonation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} campaigns={allCampaigns || []} leads={allLeads || []} defaultLinkId={`campaign_${campaignId}`} /></div>
            <DialogFooter className="p-4 border-t bg-muted/5"><Button variant="outline" onClick={() => setIsFormOpen(false)} className="font-bold border-primary/20">Close Form</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {campaign && (
        <DonationSearchDialog 
            open={isSearchOpen} 
            onOpenChange={setIsSearchOpen} 
            targetId={campaignId} 
            targetName={campaign.name} 
            targetType="campaign" 
            allowedTypes={campaign.allowedDonationTypes || [...donationCategories]} 
        />
      )}
      
      <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown">
            <AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Unlink Donation?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Detach this record from the current campaign? The donation remains in the global database but will no longer contribute to this project's totals.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/10">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnlinkConfirm} className="bg-destructive hover:bg-destructive/90 text-white font-bold transition-transform active:scale-95 shadow-md rounded-[12px]">Confirm Unlink</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[16px] border-primary/10">
            <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="font-bold text-primary uppercase">Institutional Artifact Viewer</DialogTitle></DialogHeader>
            <div className="p-4 bg-secondary/20 h-[70vh] flex items-center justify-center">
                {imageToView && (<div className="relative w-full h-full"><Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Vetting Evidence" fill sizes="100vw" className="object-contain transition-all duration-300 origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized /></div>)}
            </div>
             <DialogFooter className="px-6 py-4 border-t bg-white flex-wrap gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
