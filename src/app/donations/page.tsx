
'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase, useAuth } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DatabaseZap, Check, ChevronsUpDown, X, LinkIcon, FolderKanban, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { DonationForm, type DonationFormData } from '@/components/donation-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { syncDonationsAction, deleteDonationAction } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';

type SortKey = keyof Donation | 'srNo' | 'linkSplit';

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

function DonationRow({ donation, index, handleEdit, handleDeleteClick, handleViewImage }: { donation: Donation, index: number, handleEdit: () => void, handleDeleteClick: () => void, handleViewImage: (url: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const { userProfile } = useSession();

    const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.update;
    const canDelete = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.delete;

    const getInitiativeLink = (link: any) => {
        if (link.linkType === 'campaign') {
            return `/campaign-members/${link.linkId}/donations`;
        }
        if (link.linkType === 'lead') {
            return `/leads-members/${link.linkId}/donations`;
        }
        return '#';
    };

    return (
        <React.Fragment>
            <TableRow onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? "open" : "closed"} className="cursor-pointer">
                <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!donation.transactions || donation.transactions.length === 0}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="sr-only">Toggle details</span>
                        </Button>
                        {index}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-medium">{donation.donorName}</div>
                    <div className="text-xs text-muted-foreground">{donation.donorPhone || 'No Phone'}</div>
                </TableCell>
                <TableCell className="text-right font-medium font-mono">₹{donation.amount.toFixed(2)}</TableCell>
                <TableCell>{donation.donationDate}</TableCell>
                <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                        {donation.typeSplit?.map(split => (<Badge key={split.category} variant="secondary">{split.category}</Badge>))}
                        <Badge variant="outline">{donation.donationType}</Badge>
                    </div>
                </TableCell>
                <TableCell><Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'}>{donation.status}</Badge></TableCell>
                <TableCell className="truncate">
                    {donation.linkSplit && donation.linkSplit.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {donation.linkSplit.map(link => (
                                <Button key={`${link.linkType}_${link.linkId}`} variant="link" className="p-0 h-auto justify-start" asChild onClick={(e) => e.stopPropagation()}>
                                    <Link href={getInitiativeLink(link)} className="flex items-center gap-1 text-xs">
                                        {link.linkType === 'campaign' ? <FolderKanban className="h-3 w-3 shrink-0" /> : <Lightbulb className="h-3 w-3 shrink-0" />}
                                        <span className="truncate">{link.linkName} {donation.linkSplit && donation.linkSplit.length > 1 ? `(₹${link.amount.toFixed(2)})` : ''}</span>
                                    </Link>
                                </Button>
                            ))}
                        </div>
                    ) : "Unlinked"}
                </TableCell>
                <TableCell className="text-right pr-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:bg-destructive/20 focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={8} className="p-2">
                        <h4 className="text-sm font-semibold mb-2 px-2">Transaction Details</h4>
                        <div className="border rounded-md bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Transaction ID</TableHead>
                                        <TableHead>Screenshot</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(donation.transactions || []).map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>₹{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell>{tx.transactionId || 'N/A'}</TableCell>
                                            <TableCell>
                                                {tx.screenshotUrl ? (
                                                    <Button variant="outline" size="sm" onClick={() => handleViewImage(tx.screenshotUrl!)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View
                                                    </Button>
                                                ) : 'No'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(donation.transactions?.length || 0) === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">No transaction details available.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    )
}


export default function DonationsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  console.log("Storage instance:", storage);
  const { toast } = useToast();
  const pathname = usePathname();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();
  
  const donationsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
  const campaignsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
  const leadsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);

  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [donationTypeFilter, setDonationTypeFilter] = useState('All');
  const [linkFilter, setLinkFilter] = useState<string[]>([]);
  const [tempLinkFilter, setTempLinkFilter] = useState<string[]>([]);
  const [openLinkFilter, setOpenLinkFilter] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const canRead = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.read;
  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.create;
  const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.update;
  const canDelete = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.delete;

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

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setDonationToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleViewImage = (url: string) => {
    setImageToView(url);
    setZoom(1);
    setRotation(0);
    setIsImageViewerOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!donationToDelete) return;
    setIsDeleteDialogOpen(false);
    const result = await deleteDonationAction(donationToDelete);
    if (result.success) {
      toast({ title: "Success", description: result.message, variant: "success" });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setDonationToDelete(null);
  };
  
  const handleFormSubmit = async (data: DonationFormData) => {
    const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
    if (hasFilesToUpload && !auth?.currentUser) {
        toast({
            title: "Authentication Error",
            description: "User is not authenticated. Please wait for the session to load or log in again.",
            variant: "destructive",
        });
        return;
    }

    if (!firestore || !storage || !userProfile || !campaigns || !leads) return;
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
                date: transaction.date || '',
                upiId: transaction.upiId || '',
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
            const source = linkType === 'campaign' ? campaigns : leads;
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
        toast({ title: 'Save Failed', description: error.message || 'Could not process uploaded files or save data.', variant: 'destructive' });
    }
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const allLinkFilterOptions = useMemo(() => {
    if (!campaigns || !leads) return [];
    return [
        'unlinked',
        ...campaigns.map(c => `campaign_${c.id}`),
        ...leads.map(l => `lead_${l.id}`)
    ];
  }, [campaigns, leads]);
  const areAllLinksSelected = useMemo(() => allLinkFilterOptions.length > 0 && tempLinkFilter.length === allLinkFilterOptions.length, [tempLinkFilter, allLinkFilterOptions]);

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
    if (linkFilter.length > 0) {
      sortableItems = sortableItems.filter(d => {
        const links = d.linkSplit || [];
        const legacyCampaignId = (d as any).campaignId;
        
        const isUnlinked = links.length === 0 && !legacyCampaignId;
        const hasLegacyLink = (id: string) => legacyCampaignId && `campaign_${legacyCampaignId}` === id && links.length === 0;
        
        return linkFilter.some(filterValue => {
          if (filterValue === 'unlinked') {
            return isUnlinked;
          }
          if (hasLegacyLink(filterValue)) {
            return true;
          }
          return links.some(link => `${link.linkType}_${link.linkId}` === filterValue);
        });
      });
    }
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(d => 
        (d.donorName || '').toLowerCase().includes(lowercasedTerm) ||
        (d.receiverName || '').toLowerCase().includes(lowercasedTerm) ||
        (d.donorPhone || '').toLowerCase().includes(lowercasedTerm) ||
        (d.transactions || []).some(t => t.transactionId?.toLowerCase().includes(lowercasedTerm))
      );
    }

    // Sorting
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;

            if (sortConfig.key === 'linkSplit') {
                const aLinks = a.linkSplit || [];
                const bLinks = b.linkSplit || [];
                const aLinkName = aLinks.length > 0 ? aLinks[0].linkName : 'Unlinked';
                const bLinkName = bLinks.length > 0 ? bLinks[0].linkName : 'Unlinked';

                if (aLinkName.toLowerCase() < bLinkName.toLowerCase()) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aLinkName.toLowerCase() > bLinkName.toLowerCase()) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            }
            
            const key = sortConfig.key as keyof Donation;
            const aValue = a[key] ?? '';
            const bValue = b[key] ?? '';

            if (key === 'amount') {
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
  }, [donations, searchTerm, statusFilter, typeFilter, donationTypeFilter, linkFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  const paginatedDonations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedDonations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedDonations, currentPage, itemsPerPage]);


  const isLoading = areDonationsLoading || isProfileLoading || areCampaignsLoading || areLeadsLoading;
  
  if (isLoading && !donations) {
    return (
        <div className="container mx-auto p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!canRead) {
    return (
        <div className="container mx-auto p-4">
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to view this page.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
            <Button variant="outline" asChild>
                <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>

        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    <Link href="/donations/summary" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pathname === '/donations/summary' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                    )}>Donation Summary</Link>
                    <Link href="/donations" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pathname === '/donations' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                    )}>Donation List</Link>
                </div>
            </ScrollArea>
        </div>
        <Card className="animate-fade-in-zoom">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <CardTitle>Donation List ({filteredAndSortedDonations.length})</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Total for filtered donations: <span className="font-bold">₹{filteredAndSortedDonations.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canUpdate && (
                    <Button onClick={handleSync} disabled={isSyncing} variant="secondary">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                        Sync Data
                    </Button>
                )}
                {canCreate && (
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Donation
                    </Button>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 pt-4">
                <Input
                    placeholder="Search donor, receiver, phone, etc."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-auto md:w-[150px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Verified">Verified</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Canceled">Canceled</SelectItem>
                        <SelectItem value="No Transactions">No Transactions</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-auto md:w-[180px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        <SelectItem value="Zakat">Zakat</SelectItem>
                        <SelectItem value="Sadaqah">Sadaqah</SelectItem>
                        <SelectItem value="Interest">Interest</SelectItem>
                        <SelectItem value="Lillah">Lillah</SelectItem>
                        <SelectItem value="Loan">Loan</SelectItem>
                        <SelectItem value="Monthly Contribution">Monthly Contribution</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={donationTypeFilter} onValueChange={setDonationTypeFilter}>
                     <SelectTrigger className="w-auto md:w-[180px]"><SelectValue placeholder="Filter by donation type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Donation Types</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Online Payment">Online Payment</SelectItem>
                        <SelectItem value="Check">Check</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                </Select>
                 <Popover open={openLinkFilter} onOpenChange={(isOpen) => {
                    setOpenLinkFilter(isOpen);
                    if (isOpen) {
                        setTempLinkFilter(linkFilter);
                    }
                 }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLinkFilter}
                        className="w-auto md:w-[250px] justify-between"
                      >
                        <span className="truncate">
                          {linkFilter.length > 0 ? `${linkFilter.length} linked initiative(s)`: "Filter by linked initiative..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0">
                      <Command>
                        <CommandInput placeholder="Search initiatives..." />
                        <CommandList>
                          <CommandEmpty>No initiatives found.</CommandEmpty>
                          <CommandGroup>
                             <CommandItem 
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => {
                                 if (areAllLinksSelected) {
                                     setTempLinkFilter([]);
                                 } else {
                                     setTempLinkFilter([...allLinkFilterOptions]);
                                 }
                                }}>
                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", areAllLinksSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                  <Check className={cn("h-4 w-4")} />
                                </div>
                                Select All
                            </CommandItem>
                            <Separator className="my-1"/>
                             <CommandItem 
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => setTempLinkFilter(prev => prev.includes('unlinked') ? prev.filter(l => l !== 'unlinked') : [...prev, 'unlinked'])}>
                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", tempLinkFilter.includes('unlinked') ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                  <Check className={cn("h-4 w-4")} />
                                </div>
                                Unlinked Donations
                            </CommandItem>
                            <CommandGroup heading="Campaigns">
                              {campaigns?.map((campaign) => (
                                <CommandItem key={`campaign_${campaign.id}`} value={campaign.name} 
                                    onMouseDown={(e) => e.preventDefault()}
                                    onSelect={() => {
                                    const filterId = `campaign_${campaign.id}`;
                                    setTempLinkFilter(prev => prev.includes(filterId) ? prev.filter(l => l !== filterId) : [...prev, filterId]);
                                }}>
                                  <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", tempLinkFilter.includes(`campaign_${campaign.id}`) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                      <Check className={cn("h-4 w-4")} />
                                  </div>
                                  {campaign.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup heading="Leads">
                              {leads?.map((lead) => (
                                <CommandItem key={`lead_${lead.id}`} value={lead.name}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onSelect={() => {
                                    const filterId = `lead_${lead.id}`;
                                    setTempLinkFilter(prev => prev.includes(filterId) ? prev.filter(l => l !== filterId) : [...prev, filterId]);
                                }}>
                                  <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", tempLinkFilter.includes(`lead_${lead.id}`) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                    <Check className={cn("h-4 w-4")} />
                                  </div>
                                  {lead.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                       <div className="p-2 border-t flex justify-between items-center">
                            <Button variant="ghost" size="sm" onClick={() => { setTempLinkFilter([]); setLinkFilter([]); setOpenLinkFilter(false);}}>Reset</Button>
                            <Button size="sm" onClick={() => { setLinkFilter(tempLinkFilter); setOpenLinkFilter(false); }}>Apply</Button>
                        </div>
                    </PopoverContent>
                  </Popover>
              </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                      <SortableHeader sortKey="srNo" className="w-[50px] pl-4" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                      <SortableHeader sortKey="donorName" className="w-[200px]" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                      <SortableHeader sortKey="amount" className="w-[150px] text-right" sortConfig={sortConfig} handleSort={handleSort}>Amount</SortableHeader>
                      <SortableHeader sortKey="donationDate" className="w-[150px]" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                      <TableHead className="w-[200px]">Category &amp; Type</TableHead>
                      <SortableHeader sortKey="status" className="w-[120px]" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                      <SortableHeader sortKey="linkSplit" className="w-[200px]" sortConfig={sortConfig} handleSort={handleSort}>Linked To</SortableHeader>
                      <TableHead className="w-[100px] text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell></TableRow>))
                  ) : paginatedDonations.length > 0 ? (
                    paginatedDonations.map((donation, index) => (
                        <DonationRow
                            key={donation.id}
                            donation={donation}
                            index={(currentPage - 1) * itemsPerPage + index + 1}
                            handleEdit={() => handleEdit(donation)}
                            handleDeleteClick={() => handleDeleteClick(donation.id)}
                            handleViewImage={handleViewImage}
                        />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No donations found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
           {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                  Showing {paginatedDonations.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedDonations.length)} of {filteredAndSortedDonations.length} donations
              </p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </CardFooter>
        )}
        </Card>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingDonation ? 'Edit' : 'Add'} Donation</DialogTitle></DialogHeader>
            <DonationForm donation={editingDonation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} campaigns={campaigns || []} leads={leads || []} />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete the donation record and its associated screenshots from storage.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Donation Screenshot</DialogTitle>
            </DialogHeader>
            {imageToView && (
                <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                    <Image
                        src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                        alt="Donation screenshot"
                        fill
                        sizes="(max-width: 896px) 100vw, 896px"
                        className="object-contain transition-transform duration-200 ease-out origin-center"
                        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        unoptimized
                    />
                </div>
            )}
             <DialogFooter className="sm:justify-center pt-4 flex-wrap">
                <Button variant="outline" onClick={() => setZoom(z => z * 1.2)}><ZoomIn className="mr-2"/> Zoom In</Button>
                <Button variant="outline" onClick={() => setZoom(z => z / 1.2)}><ZoomOut className="mr-2"/> Zoom Out</Button>
                <Button variant="outline" onClick={() => setRotation(r => r + 90)}><RotateCw className="mr-2"/> Rotate</Button>
                <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }}><RefreshCw className="mr-2"/> Reset</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
