
'use client';
import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead, TransactionDetail } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DollarSign, CheckCircle2, Hourglass, XCircle, ChevronDown, ChevronUp, DatabaseZap, Check, ChevronsUpDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { syncDonationsAction } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type SortKey = keyof Donation | 'srNo';

export default function DonationsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const pathname = usePathname();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const donationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignsCollectionRef = useMemo(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const leadsCollectionRef = useMemo(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [donationTypeFilter, setDonationTypeFilter] = useState('All');
  const [linkFilter, setLinkFilter] = useState<string[]>([]);
  const [openLinkFilter, setOpenLinkFilter] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  
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
    if (!donationToDelete || !firestore || !storage || !canDelete || !donations) return;

    const donationData = donations.find(d => d.id === donationToDelete);
    if (!donationData) return;

    const docRef = doc(firestore, 'donations', donationToDelete);
    
    // Collect all screenshot URLs from all transactions
    const screenshotUrls = (donationData.transactions || []).map(t => t.screenshotUrl).filter(Boolean) as string[];

    setIsDeleteDialogOpen(false);

    // Delete all associated screenshots from storage
    if (screenshotUrls.length > 0) {
        const deletePromises = screenshotUrls.map(url => 
            deleteObject(storageRef(storage, url)).catch(err => {
                if (err.code !== 'storage/object-not-found') {
                    console.warn(`Failed to delete screenshot from storage: ${url}`, err);
                }
            })
        );
        await Promise.all(deletePromises);
    }
    
    deleteDoc(docRef)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Donation deleted successfully.', variant: 'success' });
            setDonationToDelete(null);
        });
  };
  
  const handleFormSubmit = async (data: DonationFormData) => {
    if (!firestore || !storage || !userProfile) return;
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
            // @ts-ignore
            if (transaction.screenshotFile) {
                const file = (transaction.screenshotFile as FileList)[0];
                if(file) {
                    const { default: Resizer } = await import('react-image-file-resizer');
                    const resizedBlob = await new Promise<Blob>((resolve) => {
                         Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
                    });
                    const filePath = `donations/${docRef.id}/${transaction.id}.png`;
                    const fileRef = storageRef(storage, filePath);
                    const uploadResult = await uploadBytes(fileRef, resizedBlob);
                    screenshotUrl = await getDownloadURL(uploadResult.ref);
                }
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
        console.warn("Error during form submission:", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: editingDonation ? 'update' : 'create',
                requestResourceData: finalData,
            });
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
  };
  
  const filteredAndSortedDonations = useMemo(() => {
    if (!donations) return [];
    let sortableItems = [...donations];

    // Filtering logic
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.status === statusFilter);
    }
    if (typeFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.typeSplit.some(s => s.category === typeFilter));
    }
    if (donationTypeFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.donationType === donationTypeFilter);
    }
    if (linkFilter.length > 0) {
      sortableItems = sortableItems.filter(d => {
        const links = d.linkSplit || [];
        const isUnlinked = links.length === 0 || links.every(l => l.linkType === 'general');
        
        return linkFilter.some(filterValue => {
          if (filterValue === 'unlinked') {
            return isUnlinked;
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

    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aValue = a[sortConfig.key as keyof Donation] ?? '';
            const bValue = b[sortConfig.key as keyof Donation] ?? '';
            
            if (sortConfig.key === 'amount') {
                 return sortConfig.direction === 'ascending' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
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
  }, [donations, searchTerm, statusFilter, typeFilter, donationTypeFilter, linkFilter, sortConfig]);

  const isLoading = areDonationsLoading || isProfileLoading || areCampaignsLoading || areLeadsLoading;
  
  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => {
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
  
  if (isLoading && !donations) {
    return (
        <main className="container mx-auto p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
    );
  }

  if (!canRead) {
    return (
        <main className="container mx-auto p-4">
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to view this page.
                </AlertDescription>
            </Alert>
        </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4">
        <div className="mb-4">
            <Button variant="outline" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </div>

        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    <Link href="/donations" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pathname === '/donations' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                    )}>All Donations</Link>
                    <Link href="/donations/summary" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pathname === '/donations/summary' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                    )}>Summary</Link>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
        
        <Card className="animate-fade-in-zoom">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <CardTitle>All Donations ({filteredAndSortedDonations.length})</CardTitle>
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
            <div className="flex flex-col gap-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                  <Input
                      placeholder="Search donations..."
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
                          <SelectItem value="Verified">Verified</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Canceled">Canceled</SelectItem>
                      </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
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
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by donation type" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Donation Types</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Online Payment">Online Payment</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                  </Select>
                   <Popover open={openLinkFilter} onOpenChange={setOpenLinkFilter}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openLinkFilter}
                          className="w-auto md:w-[250px] justify-between"
                        >
                          <span className="truncate">
                            {linkFilter.length > 0
                              ? `${linkFilter.length} linked initiative(s)`
                              : "Filter by linked initiative..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search initiative..." />
                          <CommandList>
                            <CommandEmpty>No initiative found.</CommandEmpty>
                            <CommandGroup heading="Status">
                                <CommandItem
                                    key="unlinked"
                                    value="Unlinked Donations"
                                    onSelect={() => {
                                      const selected = linkFilter.includes('unlinked');
                                      setLinkFilter(selected ? linkFilter.filter((l) => l !== 'unlinked') : [...linkFilter, 'unlinked']);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", linkFilter.includes('unlinked') ? "opacity-100" : "opacity-0")} />
                                    Unlinked Donations
                                </CommandItem>
                            </CommandGroup>
                            <CommandGroup heading="Campaigns">
                              {campaigns?.map((campaign) => (
                                <CommandItem
                                  key={campaign.id}
                                  value={campaign.name}
                                  onSelect={() => {
                                    const filterId = `campaign_${campaign.id}`;
                                    const selected = linkFilter.includes(filterId);
                                    setLinkFilter(selected ? linkFilter.filter((l) => l !== filterId) : [...linkFilter, filterId]);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", linkFilter.includes(`campaign_${campaign.id}`) ? "opacity-100" : "opacity-0")} />
                                  {campaign.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup heading="Leads">
                              {leads?.map((lead) => (
                                <CommandItem
                                  key={lead.id}
                                  value={lead.name}
                                  onSelect={() => {
                                    const filterId = `lead_${lead.id}`;
                                    const selected = linkFilter.includes(filterId);
                                    setLinkFilter(selected ? linkFilter.filter((l) => l !== filterId) : [...linkFilter, filterId]);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", linkFilter.includes(`lead_${lead.id}`) ? "opacity-100" : "opacity-0")} />
                                  {lead.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                  </Popover>
              </div>
              {linkFilter.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1 items-center">
                    {linkFilter.map((filter) => {
                        let label = 'Unknown';
                        if (filter === 'unlinked') {
                            label = 'Unlinked Donations';
                        } else {
                            const [type, id] = filter.split('_');
                            const source = type === 'campaign' ? campaigns : leads;
                            const item = source?.find(i => i.id === id);
                            if(item) label = item.name;
                        }
                        return (
                            <Badge
                                key={filter}
                                variant="secondary"
                                className="flex items-center gap-1"
                            >
                                {label}
                                <button
                                    type="button"
                                    aria-label={`Remove ${label} filter`}
                                    onClick={() => setLinkFilter(linkFilter.filter((l) => l !== filter))}
                                    className="ml-1 rounded-full p-0.5 hover:bg-background/50 focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto py-0.5 px-1 text-xs text-muted-foreground hover:bg-transparent"
                        onClick={() => setLinkFilter([])}
                    >
                        Clear all
                    </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table className="table-fixed">
                  <TableHeader>
                      <TableRow>
                          <SortableHeader sortKey="srNo" className="w-[50px] pl-4">#</SortableHeader>
                          <SortableHeader sortKey="donorName" className="w-[200px]">Donor</SortableHeader>
                          <SortableHeader sortKey="receiverName" className="w-[200px]">Receiver</SortableHeader>
                          <SortableHeader sortKey="amount" className="w-[150px] text-right">Amount & Date</SortableHeader>
                          <TableHead className="w-[200px]">Category & Type</TableHead>
                          <SortableHeader sortKey="status" className="w-[120px]">Status</SortableHeader>
                          <TableHead className="w-[200px]">Linked To</TableHead>
                          <TableHead className="w-[100px] text-right pr-4">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                      [...Array(5)].map((_, i) => (
                          <TableRow key={i}>
                              <TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell>
                          </TableRow>
                      ))
                      ) : (filteredAndSortedDonations && filteredAndSortedDonations.length > 0) ? (
                      filteredAndSortedDonations.map((donation, index) => {
                          const donationLinks = donation.linkSplit || [];
                          const linkedInitiatives = donationLinks.filter(l => l.linkType !== 'general');
                          const isOpen = openRows[donation.id] || false;
                          return (
                              <Collapsible key={donation.id} open={isOpen} onOpenChange={(open) => setOpenRows(prev => ({...prev, [donation.id]: open}))}>
                                  <>
                                      <TableRow>
                                          <TableCell className="pl-4">{index + 1}</TableCell>
                                          <TableCell>
                                              <div className="font-medium">{donation.donorName}</div>
                                              <div className="text-xs text-muted-foreground">{donation.donorPhone || 'No Phone'}</div>
                                          </TableCell>
                                          <TableCell>
                                              <div className="font-medium">{donation.receiverName}</div>
                                              <div className="text-xs text-muted-foreground">Ref: {donation.referral || 'N/A'}</div>
                                          </TableCell>
                                          <TableCell className="text-right">
                                              <div className="font-medium font-mono">₹{donation.amount.toFixed(2)}</div>
                                              <div className="text-xs text-muted-foreground">{donation.donationDate}</div>
                                          </TableCell>
                                          <TableCell>
                                              <div className="flex flex-wrap items-center gap-1">
                                                  {donation.typeSplit?.map(split => (
                                                      <Badge key={split.category} variant="secondary">
                                                          {split.category}
                                                      </Badge>
                                                  ))}
                                                  <Badge variant="outline">{donation.donationType}</Badge>
                                              </div>
                                          </TableCell>
                                          <TableCell>
                                              <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'}>{donation.status}</Badge>
                                          </TableCell>
                                          <TableCell>
                                          {donation.linkSplit && donation.linkSplit.length > 0 ? (
                                              <div className="flex flex-col gap-1">
                                              {donation.linkSplit.map(link => (
                                                  <Link 
                                                  key={link.linkId}
                                                  href={link.linkType === 'campaign' ? `/campaign-members/${link.linkId}` : link.linkType === 'lead' ? `/leads-members/${link.linkId}` : '#'}
                                                  className={cn("text-primary hover:underline text-xs", link.linkType === 'general' && "text-muted-foreground no-underline cursor-default")}
                                                  onClick={(e) => e.stopPropagation()}
                                                  >
                                                  {link.linkName} {donation.linkSplit && donation.linkSplit.length > 1 ? `(₹${link.amount.toFixed(2)})` : ''}
                                                  </Link>
                                              ))}
                                              </div>
                                          ) : "Unlinked"}
                                          </TableCell>
                                          <TableCell className="text-right pr-4">
                                              <div className="flex items-center justify-end">
                                                      <CollapsibleTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!donation.transactions || donation.transactions.length === 0}>
                                                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                          <span className="sr-only">Toggle details</span>
                                                      </Button>
                                                  </CollapsibleTrigger>
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                                              <MoreHorizontal className="h-4 w-4" />
                                                          </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end">
                                                          {canUpdate && (
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(donation); }}>
                                                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                                              </DropdownMenuItem>
                                                          )}

                                                          {linkedInitiatives.length === 0 ? (
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/donations/${donation.id}`); }}>
                                                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                                              </DropdownMenuItem>
                                                          ) : linkedInitiatives.length === 1 ? (
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/${linkedInitiatives[0].linkType === 'campaign' ? 'campaign-members' : 'leads-members'}/${linkedInitiatives[0].linkId}/donations/${donation.id}`); }}>
                                                                  <Eye className="mr-2 h-4 w-4" /> View in "{linkedInitiatives[0].linkName}"
                                                              </DropdownMenuItem>
                                                          ) : (
                                                              <DropdownMenuSub>
                                                                  <DropdownMenuSubTrigger>
                                                                      <Eye className="mr-2 h-4 w-4" /> View In...
                                                                  </DropdownMenuSubTrigger>
                                                                  <DropdownMenuPortal>
                                                                      <DropdownMenuSubContent>
                                                                          {linkedInitiatives.map(link => (
                                                                              <DropdownMenuItem key={link.linkId} onClick={(e) => { e.stopPropagation(); router.push(`/${link.linkType === 'campaign' ? 'campaign-members' : 'leads-members'}/${link.linkId}/donations/${donation.id}`); }}>
                                                                                  {link.linkName}
                                                                              </DropdownMenuItem>
                                                                          ))}
                                                                      </DropdownMenuSubContent>
                                                                  </DropdownMenuPortal>
                                                              </DropdownMenuSub>
                                                          )}
                                                          {canDelete && <DropdownMenuSeparator />}
                                                          {canDelete && (
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(donation.id); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer">
                                                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                              </DropdownMenuItem>
                                                          )}
                                                      </DropdownMenuContent>
                                                  </DropdownMenu>
                                              </div>
                                          </TableCell>
                                      </TableRow>
                                      <CollapsibleContent asChild>
                                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                                              <TableCell colSpan={8} className="p-0">
                                                  <div className="p-3">
                                                      <h4 className="text-sm font-semibold mb-2">Transaction Details</h4>
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
                                                                                  <Eye className="mr-2 h-4 w-4"/> View
                                                                              </Button>
                                                                          ) : 'No'}
                                                                      </TableCell>
                                                                  </TableRow>
                                                              ))}
                                                          </TableBody>
                                                      </Table>
                                                  </div>
                                              </TableCell>
                                          </TableRow>
                                      </CollapsibleContent>
                                  </>
                              </Collapsible>
                          )
                      })
                      ) : (
                      <TableRow>
                          <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                              No donations found.
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingDonation ? 'Edit' : 'Add'} Donation</DialogTitle>
            </DialogHeader>
            <DonationForm
                donation={editingDonation}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                campaigns={campaigns || []}
                leads={leads || []}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the donation record and its associated screenshots from storage.
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

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Donation Screenshot</DialogTitle>
            </DialogHeader>
            {imageToView && (
                <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                     <img
                        src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                        alt="Donation screenshot"
                        className="transition-transform duration-200 ease-out origin-center"
                        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        crossOrigin="anonymous"
                    />
                </div>
            )}
             <DialogFooter className="sm:justify-center pt-4">
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
