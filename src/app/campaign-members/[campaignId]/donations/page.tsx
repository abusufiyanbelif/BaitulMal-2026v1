

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenuSubTrigger
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

type SortKey = keyof Donation | 'srNo';

export default function DonationsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;
  const firestore = useFirestore();
  const storage = useStorage();
  console.log("Storage bucket:", storage?.app?.options?.storageBucket);
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
    if (!allDonations) return [];
    return allDonations.filter(d => {
      // Prioritize the new data structure
      if (d.linkSplit && d.linkSplit.length > 0) {
        return d.linkSplit.some(link => link.linkId === campaignId);
      }
      // Fallback for legacy data
      return d.campaignId === campaignId;
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
            description: "User is not authenticated. Please wait for the session to load or log in again.",
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

  const isLoading = isCampaignLoading || areDonationsLoading || isProfileLoading || areAllCampaignsLoading || areAllLeadsLoading;
  
  if (isLoading) {
    return (
        <div>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <CardTitle>Donation List ({filteredAndSortedDonations.length})</CardTitle>
                <CardDescription>
                  Total for filtered donations: <span className="font-bold text-foreground">₹{donations.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</span>
                </CardDescription>
              </div>
               <div className="flex flex-wrap gap-2">
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
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                      <TableHead className="w-[50px] pl-4">#</TableHead>
                      <TableHead className="w-[200px]">Donor</TableHead>
                      <TableHead className="w-[200px]">Receiver</TableHead>
                      <TableHead className="w-[150px] text-right">Amount & Date</TableHead>
                      <TableHead className="w-[200px]">Category & Type</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[100px] text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areDonationsLoading ? (
                  [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                          <TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell>
                      </TableRow>
                  ))
                  ) : (filteredAndSortedDonations && filteredAndSortedDonations.length > 0) ? (
                  filteredAndSortedDonations.map((donation, index) => {
                      const isOpen = openRows[donation.id] || false;
                      const campaignLink = donation.linkSplit?.find(l => l.linkId === campaignId && l.linkType === 'campaign');
                      const amountForThisCampaign = campaignLink?.amount || 0;
                      return (
                        <React.Fragment key={donation.id}>
                          <TableRow className="bg-background hover:bg-accent/50 cursor-pointer" data-state={isOpen ? 'open' : 'closed'} onClick={() => setOpenRows(prev => ({...prev, [donation.id]: !prev[donation.id]}))}>
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
                                  <div className="font-medium font-mono">₹{amountForThisCampaign.toFixed(2)}</div>
                                  <div className="text-xs text-muted-foreground">{donation.donationDate}</div>
                              </TableCell>
                              <TableCell>
                                  <div className="flex flex-wrap items-center gap-1">
                                      {donation.typeSplit?.map(split => (<Badge key={split.category} variant="secondary">{split.category}</Badge>))}
                                      <Badge variant="outline">{donation.donationType}</Badge>
                                  </div>
                              </TableCell>
                              <TableCell>
                                  <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'}>{donation.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                    <div className="flex items-center justify-end">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!donation.transactions || donation.transactions.length === 0}>
                                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                          <span className="sr-only">Toggle details</span>
                                      </Button>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <MoreHorizontal className="h-4 w-4" />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/campaign-members/${campaignId}/donations/${donation.id}`); }}>
                                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                              </DropdownMenuItem>
                                              {canUpdate && (
                                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(donation); }}>
                                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                                  </DropdownMenuItem>
                                              )}
                                              {canUpdate && (
                                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUnlinkClick(donation.id); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer">
                                                      <Link2Off className="mr-2 h-4 w-4" /> Unlink from Campaign
                                                  </DropdownMenuItem>
                                              )}
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </div>
                              </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableCell colSpan={7} className="p-2">
                                <h4 className="text-sm font-semibold mb-2">Transaction Details</h4>
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
                      <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                          No donations found matching your criteria.
                      </TableCell>
                  </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingDonation ? 'Edit' : 'Add'} Donation</DialogTitle>
            </DialogHeader>
            <DonationForm
                donation={editingDonation}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                campaigns={allCampaigns || []}
                leads={allLeads || []}
                defaultLinkId={`campaign_${campaignId}`}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will unlink the donation from this campaign. The donation record itself will not be deleted, but it will no longer contribute to this campaign's funding.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleUnlinkConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Unlink
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

    

  