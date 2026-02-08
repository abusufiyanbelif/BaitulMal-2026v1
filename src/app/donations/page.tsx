

'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DollarSign, CheckCircle2, Hourglass, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

type SortKey = keyof Donation | 'srNo';

export default function DonationsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  
  const canRead = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.read;
  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.create;
  const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.update;
  const canDelete = userProfile?.role === 'Admin' || !!userProfile?.permissions?.donations?.delete;

  const handleAdd = () => {
    if (!canCreate) return;
    setEditingDonation(null);
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
    const screenshotUrl = donationData.screenshotUrl;
    
    setIsDeleteDialogOpen(false);

    if (screenshotUrl) {
        await deleteObject(storageRef(storage, screenshotUrl)).catch(err => {
            if (err.code !== 'storage/object-not-found') {
                console.warn("Failed to delete screenshot from storage:", err);
            }
        });
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

    if (data.isTransactionIdRequired && data.transactionId && !editingDonation) {
        const isDuplicate = donations && donations.some(d => d.transactionId === data.transactionId);
        if (isDuplicate) {
            toast({
                title: 'Duplicate Transaction ID',
                description: 'A donation with this transaction ID already exists.',
                variant: 'destructive',
            });
            return;
        }
    }

    setIsFormOpen(false);
    setEditingDonation(null);

    const docRef = editingDonation
        ? doc(firestore, 'donations', editingDonation.id)
        : doc(collection(firestore, 'donations'));
    
    let finalData: any;

    try {
        let screenshotUrl = editingDonation?.screenshotUrl || '';
    
        const fileList = data.screenshotFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            
            const { default: Resizer } = await import('react-image-file-resizer');
            const resizedBlob = await new Promise<Blob>((resolve) => {
                 Resizer.imageFileResizer(
                    file, 1024, 1024, 'PNG', 100, 0,
                    blob => {
                        resolve(blob as Blob);
                    }, 'blob'
                );
            });
            
            const transactionIdPart = data.transactionId || 'NULL';
            const fileNameParts = [ data.donorName, data.donorPhone, data.donationDate, transactionIdPart, 'referby', userProfile.name ];
            const sanitizedBaseName = fileNameParts.join('_').replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_{2,}/g, '_');
            const fileExtension = 'png';
            const finalFileName = `${docRef.id}_${sanitizedBaseName}.${fileExtension}`;
            const filePath = `donations/${finalFileName}`;
            const fileRef = storageRef(storage, filePath);

            const uploadResult = await uploadBytes(fileRef, resizedBlob);
            screenshotUrl = await getDownloadURL(uploadResult.ref);
        }

        const { screenshotFile, screenshotDeleted, isTransactionIdRequired, linkId, ...donationData } = data;
        
        finalData = {
            ...donationData,
            screenshotUrl,
            uploadedBy: userProfile.name,
            uploadedById: userProfile.id,
            ...(!editingDonation && { createdAt: serverTimestamp() }),
        };
        
        if (editingDonation) {
            finalData.campaignId = editingDonation.campaignId;
            finalData.campaignName = editingDonation.campaignName;
        }

        if (!isEditing && linkId && linkId !== 'unlinked') {
            const [type, id] = linkId.split('_');
            const sourceData = type === 'campaign' ? campaigns : leads;
            const linkedItem = sourceData?.find(item => item.id === id);
            if (linkedItem) {
                finalData.campaignId = linkedItem.id;
                finalData.campaignName = linkedItem.name;
            }
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

    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.status === statusFilter);
    }
    if (typeFilter !== 'All') {
        sortableItems = sortableItems.filter(d => d.typeSplit.some(s => s.category === typeFilter));
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
        (d.transactionId || '').toLowerCase().includes(lowercasedTerm) ||
        (d.campaignName || '').toLowerCase().includes(lowercasedTerm)
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
  }, [donations, searchTerm, statusFilter, typeFilter, donationTypeFilter, sortConfig]);

  const { zakatTotal, loanTotal, interestTotal, sadaqahTotal, lillahTotal, monthlyContributionTotal, grandTotal } = useMemo(() => {
    if (!filteredAndSortedDonations) {
        return { zakatTotal: 0, loanTotal: 0, interestTotal: 0, sadaqahTotal: 0, lillahTotal: 0, monthlyContributionTotal: 0, grandTotal: 0 };
    }

    let zakat = 0;
    let loan = 0;
    let interest = 0;
    let sadaqah = 0;
    let lillah = 0;
    let monthlyContribution = 0;

    for (const d of filteredAndSortedDonations) {
        if (d.typeSplit && d.typeSplit.length > 0) {
            for (const split of d.typeSplit) {
                switch (split.category) {
                    case 'Zakat':
                        zakat += split.amount;
                        break;
                    case 'Loan':
                        loan += split.amount;
                        break;
                    case 'Interest':
                        interest += split.amount;
                        break;
                    case 'Sadaqah':
                        sadaqah += split.amount;
                        break;
                    case 'Lillah':
                        lillah += split.amount;
                        break;
                    case 'Monthly Contribution':
                        monthlyContribution += split.amount;
                        break;
                }
            }
        }
    }
    const grandTotal = zakat + loan + interest + sadaqah + lillah + monthlyContribution;

    return {
        zakatTotal: zakat,
        loanTotal: loan,
        interestTotal: interest,
        sadaqahTotal: sadaqah,
        lillahTotal: lillah,
        monthlyContributionTotal: monthlyContribution,
        grandTotal: grandTotal,
    };
}, [filteredAndSortedDonations]);

  const statusStats = useMemo(() => {
    if (!filteredAndSortedDonations) {
      return {
        verified: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        canceled: { count: 0, amount: 0 },
      };
    }
    return filteredAndSortedDonations.reduce((acc, donation) => {
      const status = donation.status || 'Pending';
      if (status === 'Verified') {
        acc.verified.count += 1;
        acc.verified.amount += donation.amount;
      } else if (status === 'Pending') {
        acc.pending.count += 1;
        acc.pending.amount += donation.amount;
      } else if (status === 'Canceled') {
        acc.canceled.count += 1;
        acc.canceled.amount += donation.amount;
      }
      return acc;
    }, {
      verified: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      canceled: { count: 0, amount: 0 },
    });
  }, [filteredAndSortedDonations]);

  const isLoading = areDonationsLoading || isProfileLoading || areCampaignsLoading || areLeadsLoading;
  
  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => {
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
                <div className="flex w-max space-x-4">
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-primary text-primary shadow-none" data-active="true">
                        <Link href="/donations">All Donations</Link>
                    </Button>
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 text-muted-foreground hover:text-foreground">
                        <Link href="/donations/summary">Summary</Link>
                    </Button>
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
              {canCreate && (
                  <Button onClick={handleAdd}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Donation
                  </Button>
              )}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                    <CardContent className="p-2">
                        <div className="text-2xl font-bold">{statusStats.verified.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.verified.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2">
                        <div className="text-2xl font-bold">{statusStats.pending.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.pending.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Canceled</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                    <CardContent className="p-2">
                        <div className="text-2xl font-bold">{statusStats.canceled.count}</div>
                        <p className="text-xs text-muted-foreground">₹{statusStats.canceled.amount.toLocaleString('en-IN')}</p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Grand Total</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{grandTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Zakat</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{zakatTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Interest</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{interestTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Loan</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{loanTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Sadaqah</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{sadaqahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Lillah</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{lillahTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Contribution</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-xl font-bold">₹{monthlyContributionTotal.toLocaleString('en-IN')}</div></CardContent>
                </Card>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-4">
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px] text-center sticky left-0 bg-card z-10">Actions</TableHead>
                            <SortableHeader sortKey="srNo">#</SortableHeader>
                            <SortableHeader sortKey="status">Status</SortableHeader>
                            <SortableHeader sortKey="donorName">Donor Name</SortableHeader>
                            <SortableHeader sortKey="receiverName">Receiver Name</SortableHeader>
                            <SortableHeader sortKey="donorPhone">Phone</SortableHeader>
                            <SortableHeader sortKey="referral">Referral</SortableHeader>
                            <SortableHeader sortKey="amount" className="text-right">Amount (₹)</SortableHeader>
                            <TableHead>Category</TableHead>
                            <SortableHeader sortKey="donationType">Donation Type</SortableHeader>
                            <SortableHeader sortKey="transactionId">Transaction ID</SortableHeader>
                            <SortableHeader sortKey="donationDate">Date</SortableHeader>
                            <TableHead>Screenshot</TableHead>
                            <SortableHeader sortKey="campaignName">Linked To</SortableHeader>
                            <SortableHeader sortKey="uploadedBy">Uploaded By</SortableHeader>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                        [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={15}><Skeleton className="h-6 w-full" /></TableCell>
                            </TableRow>
                        ))
                        ) : (filteredAndSortedDonations && filteredAndSortedDonations.length > 0) ? (
                        filteredAndSortedDonations.map((donation, index) => (
                            <TableRow key={donation.id}>
                                <TableCell className="text-center sticky left-0 bg-card z-10">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {canDelete && (
                                                <DropdownMenuItem onClick={() => handleDeleteClick(donation.id)} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                    <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'}>{donation.status}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">{donation.donorName}</TableCell>
                                <TableCell>{donation.receiverName}</TableCell>
                                <TableCell>{donation.donorPhone}</TableCell>
                                <TableCell>{donation.referral}</TableCell>
                                <TableCell className="text-right font-medium">₹{donation.amount.toFixed(2)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {donation.typeSplit?.map(split => (
                                            <Badge key={split.category} variant="secondary">
                                                {split.category}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant="outline">{donation.donationType}</Badge></TableCell>
                                <TableCell>{donation.transactionId || 'N/A'}</TableCell>
                                <TableCell>{donation.donationDate}</TableCell>
                                <TableCell>
                                    {donation.screenshotUrl && donation.screenshotIsPublic && (
                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); donation.screenshotUrl && handleViewImage(donation.screenshotUrl); }}>
                                        <Eye className="mr-2 h-4 w-4" /> View
                                    </Button>
                                    )}
                                     {donation.screenshotUrl && !donation.screenshotIsPublic && "Private"}
                                     {!donation.screenshotUrl && "N/A"}
                                </TableCell>
                                <TableCell>
                                  {donation.campaignId ? (
                                    <Link 
                                      href={`/campaign-members/${donation.campaignId}`} 
                                      className="text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {donation.campaignName}
                                    </Link>
                                  ) : "Unlinked"}
                                </TableCell>
                                <TableCell>{donation.uploadedBy}</TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={15} className="text-center h-24 text-muted-foreground">
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                    This action cannot be undone. This will permanently delete the donation record and its associated screenshot from storage.
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
