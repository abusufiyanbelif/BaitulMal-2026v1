'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, setDoc, DocumentReference, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead, TransactionDetail } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DatabaseZap, Check, ChevronsUpDown, X, Link2Off, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator
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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { getNestedValue } from '@/lib/utils';
import { syncDonationsAction } from '@/app/donations/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';

type SortKey = keyof Donation | 'srNo' | 'amountForThisCampaign';

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
  const { data: allCampaigns, isLoading: areAllCampaignsLoading } = useCollection<Campaign>(allCampaignsCollectionRef);

  const allLeadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
  const { data: allLeads, isLoading: areAllLeadsLoading } = useCollection<Lead>(allLeadsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
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
  const [donationTypeFilter, setDonationTypeFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.delete', false);

  const handleSync = async () => {
    if (!canUpdate) {
        toast({ title: "Permission Denied", description: "You don't have permission to sync data.", variant: "destructive"});
        return;
    }
    setIsSyncing(true);
    toast({ title: 'Syncing Donations...', description: 'Please wait while old donation records are updated to the new format.' });

    try {
        const result = await syncDonationsAction();
        if (result.success) {
            toast({ title: 'Sync Complete', description: result.message, variant: 'success' });
        } else {
            toast({ title: 'Sync Failed', description: result.message, variant: 'destructive' });
        }
    } catch (error: any) {
         toast({ title: 'Sync Error', description: 'An unexpected client-side error occurred.', variant: 'destructive' });
    }

    setIsSyncing(false);
  };

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
    
    const updateData = {
        linkSplit: newLinkSplit,
    };
    
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
            toast({ title: 'Success', description: 'Donation unlinked from this campaign successfully.', variant: 'success' });
            setDonationToUnlink(null);
        });
  };
  
  const handleFormSubmit = async (data: DonationFormData) => {
    const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
    if (hasFilesToUpload && !auth?.currentUser) {
        toast({
            title: "Authentication Error",
            description: "User not authenticated yet. Please wait for the session to load or log in again.",
            variant: "destructive",
        });
        return;
    }

    if (!firestore || !storage || !userProfile || !allCampaigns || !allLeads) return;
    
    if (editingDonation && !canUpdate) return;
    if (!editingDonation && !canCreate) return;

    setIsFormOpen(false);
    setEditingDonation(null);

    const docRef = editingDonation
        ? doc(firestore, 'donations', editingDonation.id)
        : doc(collection(firestore, 'donations'));
    
    let finalData: any;

    try {
        const transactionPromises = data.transactions.map(async (transaction) => {
            let screenshotUrl = transaction.screenshotUrl || '';
            const fileList = transaction.screenshotFile as FileList | undefined;
            if (fileList && fileList.length > 0) {
                const file = fileList[0];
                const resizedBlob = await new Promise<Blob>((resolve) => {
                     (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `donations/${docRef.id}/${data.donationDate}_${transaction.id}.png`;
                const fileRef = storageRef(storage, filePath);
                const uploadResult = await uploadBytes(fileRef, resizedBlob);
                screenshotUrl = await getDownloadURL(uploadResult.ref);
            }
            return {
                id: transaction.id,
                amount: transaction.amount,
                transactionId: transaction.transactionId || '',
                screenshotUrl: screenshotUrl,
                screenshotIsPublic: transaction.screenshotIsPublic || false,
            };
        });

        const finalTransactions = await Promise.all(transactionPromises);

        const { transactions, ...donationData } = data;
        
        const finalLinkSplit = data.linkSplit?.map(split => {
            if (!split.linkId || split.linkId === 'unlinked') {
                if (split.amount > 0) {
                    return {
                        linkId: 'unallocated',
                        linkName: 'Unallocated',
                        linkType: 'general' as const,
                        amount: split.amount
                    };
                }
                return null;
            }
            const [type, id] = split.linkId.split('_');
            const linkType = type as 'campaign' | 'lead';
            const source = linkType === 'campaign' ? allCampaigns : allLeads;
            const linkedItem = source?.find(item => item.id === id);

            return {
                linkId: id,
                linkName: linkedItem?.name || 'Unknown Initiative',
                linkType: linkType,
                amount: split.amount
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null && item.amount > 0);
        
        finalData = {
            ...donationData,
            transactions: finalTransactions,
            amount: finalTransactions.reduce((sum, t) => sum + t.amount, 0),
            linkSplit: finalLinkSplit,
            uploadedBy: userProfile.name,
            uploadedById: userProfile.id,
            ...(!editingDonation && { createdAt: serverTimestamp() }),
        };

        if (editingDonation) {
            finalData.campaignId = deleteField();
            finalData.campaignName = deleteField();
        }

        await setDoc(docRef, finalData, { merge: true });

        toast({ title: 'Success', description: `Donation ${editingDonation ? 'updated' : 'added'}.`, variant: 'success' });

    } catch (error: any) {
        console.error("Error during form submission:", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: editingDonation ? 'update' : 'create',
                requestResourceData: finalData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
        }
    }
  };
  
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
    let sortableItems = [...donations];

    // Filtering logic
    if (statusFilter === 'No Transactions') {
        sortableItems = sortableItems.filter(d => !d.transactions || d.transactions.length === 0);
    } else if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.status === statusFilter);
    }

    if (typeFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.typeSplit?.some(s => s.category === typeFilter));
    }
    if (donationTypeFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.donationType === donationTypeFilter);
    }
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(d => 
        (d.donorName || '').toLowerCase().includes(lowercasedTerm) ||
        (d.receiverName || '').toLowerCase().includes(lowercasedTerm) ||
        (d.donorPhone || '').toLowerCase().includes(lowercasedTerm) ||
        (d.referral || '').toLowerCase().includes(lowercasedTerm) ||
        (d.transactions || []).some(t => t.transactionId?.toLowerCase().includes(lowercasedTerm))
      );
    }

    // Sorting
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'srNo') return 0;
        
        const key = sortConfig.key;
        const aValue = (a as any)[key];
        const bValue = (b as any)[key];

        if (key === 'amount' || key === 'amountForThisCampaign') {
            const numA = Number(aValue) || 0;
            const numB = Number(bValue) || 0;
            return sortConfig.direction === 'ascending' ? numA - numB : numB - numA;
        }

        if (key === 'donationDate') {
            const dateA = new Date(aValue as string).getTime() || 0;
            const dateB = new Date(bValue as string).getTime() || 0;
            return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
        }

        const strA = String(aValue || '').toLowerCase();
        const strB = String(bValue || '').toLowerCase();
        if (strA < strB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'ascending' ? 1 : -1;
        
        return 0;
      });
    }
    
    return sortableItems;
  }, [donations, searchTerm, statusFilter, typeFilter, donationTypeFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  const paginatedDonations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedDonations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedDonations, currentPage, itemsPerPage]);

  const isLoading = isCampaignLoading || areDonationsLoading || isProfileLoading || areAllCampaignsLoading || areAllLeadsLoading;
  
  if (isLoading && !campaign) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
        </main>
    );
  }
  
  if (!campaign) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <p className="text-lg text-muted-foreground font-normal">Campaign not found.</p>
            <Button asChild className="mt-4 font-bold">
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
                </Link>
            </Button>
        </main>
    );
  }

  return (
    <>
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4">
            <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
                </Link>
            </Button>
        </div>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
        </div>
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && (
                        <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold hover:bg-primary/10")}>Summary</Link>
                    )}
                    {canReadRation && (
                        <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all duration-200", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold hover:bg-primary/10")}>Item Lists</Link>
                    )}
                    {canReadBeneficiaries && (
                        <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold hover:bg-primary/10")}>Beneficiary List</Link>
                    )}
                    {canReadDonations && (
                        <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground font-bold hover:bg-primary/10")}>Donations</Link>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
        <Card className="animate-fade-in-zoom border-primary/10 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                    <CardTitle className="text-xl font-bold text-primary uppercase tracking-tight">Donation list ({filteredAndSortedDonations.length})</CardTitle>
                    <CardDescription className="font-normal text-primary/70">
                    Total for filtered donations: <span className="font-bold text-foreground">₹{filteredAndSortedDonations.reduce((sum, d) => sum + d.amountForThisCampaign, 0).toFixed(2)}</span>
                    </CardDescription>
                </div>
                {canCreate && (
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleAdd} className="font-bold shadow-md">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Donation
                        </Button>
                    </div>
                )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Input
                        placeholder="Search donor, receiver, phone, etc."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="max-w-sm h-9 text-xs font-normal"
                    />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[180px] h-9 text-xs font-bold border-primary/20 text-primary">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All statuses</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Canceled">Canceled</SelectItem>
                            <SelectItem value="No Transactions">No Transactions</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[180px] h-9 text-xs font-bold border-primary/20 text-primary">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All categories</SelectItem>
                            {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                <Table>
                    <TableHeader className="bg-primary/5">
                    <TableRow>
                        <SortableHeader sortKey="srNo" className="w-[50px] pl-4" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" className="w-[200px]" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                        <SortableHeader sortKey="amountForThisCampaign" className="w-[150px] text-right" sortConfig={sortConfig} handleSort={handleSort}>Value (₹)</SortableHeader>
                        <SortableHeader sortKey="donationDate" className="w-[150px]" sortConfig={sortConfig} handleSort={handleSort}>Entry Date</SortableHeader>
                        <TableHead className="w-[200px] font-bold text-primary">Details</TableHead>
                        <SortableHeader sortKey="status" className="w-[120px]" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                        <TableHead className="w-[100px] text-right pr-4 font-bold text-primary">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody className="font-normal text-primary">
                    {areDonationsLoading ? (
                    [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell>
                        </TableRow>
                    ))
                    ) : (paginatedDonations && paginatedDonations.length > 0) ? (
                    paginatedDonations.map((donation, index) => {
                        const isOpen = openRows[donation.id] || false;
                        return (
                            <React.Fragment key={donation.id}>
                            <TableRow className="bg-background hover:bg-accent/50 cursor-pointer group transition-colors" data-state={isOpen ? 'open' : 'closed'} onClick={() => setOpenRows(prev => ({...prev, [donation.id]: !prev[donation.id]}))}>
                                <TableCell className="pl-4 font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                <TableCell>
                                    <div className="font-bold text-sm">{donation.donorName}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone || 'N/A'}</div>
                                </TableCell>
                                <TableCell className="text-right font-bold font-mono text-sm">₹{donation.amountForThisCampaign.toFixed(2)}</TableCell>
                                <TableCell className="text-xs font-normal">{donation.donationDate}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap items-center gap-1">
                                        {donation.typeSplit?.map(split => (<Badge key={split.category} variant="secondary" className="text-[9px] font-bold uppercase">{split.category}</Badge>))}
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20">{donation.donationType}</Badge>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'} className="text-[9px] font-bold uppercase">{donation.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                        <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" disabled={!donation.transactions || donation.transactions.length === 0}>
                                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/campaign-members/${campaignId}/donations/${donation.id}`); }} className="font-bold text-primary">
                                                    <Eye className="mr-2 h-4 w-4" /> Details
                                                </DropdownMenuItem>
                                                {canUpdate && (
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(donation); }} className="font-bold text-primary">
                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                )}
                                                {canUpdate && (
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUnlinkClick(donation.id); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-bold cursor-pointer">
                                                        <Link2Off className="mr-2 h-4 w-4" /> Unlink
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                            {isOpen && (
                                <TableRow className="bg-primary/[0.02] hover:bg-primary/[0.02] border-b border-primary/5">
                                <TableCell colSpan={7} className="p-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Linked transaction logs</h4>
                                    <div className="border border-primary/10 rounded-md bg-background overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-bold text-primary uppercase">Amount</TableHead>
                                            <TableHead className="text-[10px] font-bold text-primary uppercase">Transaction ID</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold text-primary uppercase">Artifact</TableHead>
                                        </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {(donation.transactions || []).map((tx) => (
                                            <TableRow key={tx.id}>
                                            <TableCell className="font-bold font-mono text-sm">₹{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell className="font-mono text-xs opacity-70">{tx.transactionId || 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                {tx.screenshotUrl ? (
                                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }} className="font-bold border-primary/20 text-primary hover:bg-primary/10 h-7 text-[10px]">
                                                    <Eye className="mr-1 h-3 w-3" /> View
                                                </Button>
                                                ) : <span className="text-muted-foreground text-xs italic font-normal">None</span>}
                                            </TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </TableCell>
                                </TableRow>
                            )}
                            </React.Fragment>
                        );
                    })
                    ) : (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground italic font-normal">
                            No donations found matching criteria.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between py-4 border-t bg-primary/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/20 text-primary h-8">Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/20 text-primary h-8">Next</Button>
                </div>
                </CardFooter>
            )}
        </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-primary/5">
                <DialogTitle className="text-xl font-bold text-primary uppercase tracking-tight">{editingDonation ? 'Edit' : 'Add'} donation record</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
                <DonationForm
                    donation={editingDonation}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    campaigns={allCampaigns || []}
                    leads={allLeads || []}
                    defaultLinkId={`campaign_${campaignId}`}
                />
            </ScrollArea>
            <DialogFooter className="px-6 py-4 border-t bg-muted/5">
                <Button variant="outline" onClick={() => setIsFormOpen(false)} className="font-bold">Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-destructive">Unlink donation?</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    Remove the donation from this campaign? The record itself will remain in the global list, but will not contribute to this initiative's totals.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleUnlinkConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                        Confirm unlink
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle className="text-xl font-bold text-primary">Artifact viewer</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 bg-secondary/20 p-4">
                <div className="relative min-h-[70vh] w-full flex items-center justify-center">
                    {imageToView && (
                        <Image
                            src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                            alt="Donation artifact"
                            fill
                            sizes="100vw"
                            className="object-contain transition-transform duration-200 ease-out origin-center"
                            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                            unoptimized
                        />
                    )}
                </div>
                <ScrollBar orientation="both" />
            </ScrollArea>
             <DialogFooter className="px-6 py-4 border-t bg-white flex-wrap gap-2 justify-center sm:justify-center">
                <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-primary border-primary/20"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(z => z / 1.2)} className="font-bold text-primary border-primary/20"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-primary border-primary/20"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-primary border-primary/20"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
    </>
  );
}