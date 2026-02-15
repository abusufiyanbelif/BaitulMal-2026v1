'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, errorEmitter, FirestorePermissionError, useMemoFirebase } from '@/firebase';
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
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DollarSign, CheckCircle2, Hourglass, XCircle, DatabaseZap, Check, ChevronsUpDown, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  
  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'campaigns') : null), [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const leadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
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
  const [tempLinkFilter, setTempLinkFilter] = useState<string[]>([]);
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

  const handleDeleteConfirm = () => {
    if (!donationToDelete || !firestore || !storage || !canDelete || !donations) return;

    const donationData = donations.find(d => d.id === donationToDelete);
    if (!donationData) return;

    const docRef = doc(firestore, 'donations', donationToDelete);
    
    // Collect all screenshot URLs from all transactions
    const screenshotUrls = (donationData.transactions || []).map(t => t.screenshotUrl).filter(Boolean) as string[];

    setIsDeleteDialogOpen(false);
    
    deleteDoc(docRef)
        .then(() => {
            if (screenshotUrls.length > 0) {
                const deletePromises = screenshotUrls.map(url => 
                    deleteObject(storageRef(storage, url)).catch((err: any) => {
                        if (err.code !== 'storage/object-not-found') {
                            console.warn(`Failed to delete screenshot from storage: ${url}`, err);
                        }
                    })
                );
                return Promise.all(deletePromises);
            }
        })
        .then(() => {
             toast({ title: 'Success', description: 'Donation deleted successfully.', variant: 'success' });
        })
        .catch(async (serverError: any) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
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
                         Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
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

        setDoc(docRef, finalData, { merge: true })
            .then(() => {
                toast({ title: 'Success', description: `Donation ${editingDonation ? 'updated' : 'added'}.`, variant: 'success' });
            })
            .catch((error: any) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: editingDonation ? 'update' : 'create',
                    requestResourceData: finalData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

    } catch (error: any) {
        console.warn("Error during file processing:", error);
        toast({ title: 'Save Failed', description: error.message || 'Could not process uploaded files.', variant: 'destructive' });
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
      
        
            
                
                    
                    Back to Dashboard
                
            
        

        
            
                
                    
                        Donation Summary
                        Donation List
                    
                
            
        
        
          
            
              
                
                  Donation List ({filteredAndSortedDonations.length})
                
              
              
                {canUpdate && (
                    
                        
                        Sync Data
                    
                )}
                {canCreate && (
                    
                        
                        Add Donation
                    
                )}
              
            
            
              
                  
                      
                          
                      
                      
                          
                              
                          
                          
                              
                                  
                                  
                                  
                                  
                              
                          
                      
                      
                          
                              
                          
                          
                              
                                  
                                  
                                  
                                  
                                  
                                  
                              
                          
                      
                       openLinkFilter(isOpen);
                       if (isOpen) {
                           setTempLinkFilter(linkFilter);
                       }
                   }}>
                      
                        
                          
                            {linkFilter.length > 0
                              ? `${linkFilter.length} linked initiative(s)`
                              : "Filter by linked initiative..."}
                          
                          
                        
                      
                      
                          
                            
                              
                                
                                    
                                    
                                        
                                      setTempLinkFilter(prev => prev.includes('unlinked') ? prev.filter((l) => l !== 'unlinked') : [...prev, 'unlinked']);
                                    }}
                                >
                                    
                                    Unlinked Donations
                                
                            
                                
                                  {campaigns?.map((campaign) => (
                                    
                                      value={campaign.name}
                                      onSelect={() => {
                                        const filterId = `campaign_${campaign.id}`;
                                        setTempLinkFilter(prev => prev.includes(filterId) ? prev.filter((l) => l !== filterId) : [...prev, filterId]);
                                      }}
                                    >
                                      
                                      {campaign.name}
                                    
                                  ))}
                                
                                
                                  {leads?.map((lead) => (
                                    
                                      value={lead.name}
                                      onSelect={() => {
                                        const filterId = `lead_${lead.id}`;
                                        setTempLinkFilter(prev => prev.includes(filterId) ? prev.filter((l) => l !== filterId) : [...prev, filterId]);
                                      }}
                                    >
                                      
                                      {lead.name}
                                    
                                  ))}
                                
                              
                            
                            
                                
                                    setTempLinkFilter([]);
                                    setLinkFilter([]);
                                }}>Clear All
                                setLinkFilter(tempLinkFilter);
                                setOpenLinkFilter(false);
                            }}>Apply
                        
                      
                  
              
              {linkFilter.length > 0 && (
                
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
                            
                                {label}
                                
                                    
                                    
                                
                            
                        );
                    })}
                      
                        Clear all
                    
                
              )}
            
          
          
            
              
                  
                      
                          
                          
                          
                          
                          
                          
                          
                      
                  
                  
                      {isLoading ? (
                      [...Array(5)].map((_, i) => (
                          
                              
                          
                      ))
                      ) : (filteredAndSortedDonations && filteredAndSortedDonations.length > 0) ? (
                      filteredAndSortedDonations.map((donation, index) => {
                          const linkedInitiatives = donation.linkSplit?.filter(l => l.linkType !== 'general') || [];
                          const isOpen = openRows[donation.id] || false;
                          return (
                              
                                  
                                      
                                          {index + 1}
                                      
                                      
                                          
                                              {donation.donorName}
                                          
                                          {donation.donorPhone || 'No Phone'}
                                      
                                      
                                          
                                              {donation.receiverName}
                                          
                                          Ref: {donation.referral || 'N/A'}
                                      
                                      
                                          ₹{donation.amount.toFixed(2)}
                                          {donation.donationDate}
                                      
                                      
                                          {donation.typeSplit?.map(split => (
                                              
                                                  {split.category}
                                              
                                          ))}
                                          
                                      
                                      
                                          {donation.status}
                                      
                                      {donation.linkSplit && donation.linkSplit.length > 0 ? (
                                          
                                          {donation.linkSplit.map(link => (
                                              
                                              
                                              {link.linkName} {donation.linkSplit && donation.linkSplit.length > 1 ? `(₹${link.amount.toFixed(2)})` : ''}
                                              
                                          ))}
                                          
                                      ) : "Unlinked"}
                                      
                                          
                                              
                                                  
                                                      Toggle details
                                                  
                                                  
                                                      
                                                          
                                                               Edit
                                                          
                                                      

                                                      {linkedInitiatives.length === 0 ? (
                                                          
                                                               View Details
                                                          
                                                      ) : linkedInitiatives.length === 1 ? (
                                                          
                                                               View in "{linkedInitiatives[0].linkName}"
                                                          
                                                      ) : (
                                                          
                                                              View In...
                                                              
                                                              
                                                              {linkedInitiatives.map(link => (
                                                                      {link.linkName}
                                                              ))}
                                                              
                                                          
                                                      )}
                                                      
                                                          
                                                      
                                                      
                                                          
                                                              Delete
                                                          
                                                      
                                                  
                                              
                                          
                                      
                                  
                                  {isOpen && (
                                    
                                      
                                          
                                              
                                              
                                              Transaction Details
                                              
                                                
                                                    
                                                        
                                                            
                                                            
                                                        
                                                    
                                                    
                                                        {(donation.transactions || []).map((tx) => (
                                                            
                                                                ₹{tx.amount.toFixed(2)}
                                                                {tx.transactionId || 'N/A'}
                                                                {tx.screenshotUrl ? (
                                                                     View
                                                                ) : 'No'}
                                                            
                                                        ))}
                                                    
                                                
                                              
                                          
                                      
                                    
                                  )}
                              
                          );
                      })
                      ) : (
                      
                          
                              No donations found.
                          
                      
                      )}
                  
              
            
          
        
      

      
        
            
                {editingDonation ? 'Edit' : 'Add'} Donation
            
            
                
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    campaigns={campaigns || []}
                    leads={leads || []}
                
            
        
      
      
        
            
                Are you sure?
                This action cannot be undone. This will permanently delete the donation record and its associated screenshots from storage.
            
            
                Cancel
                
                    Delete
                
            
        
      

      
        
            
                Donation Screenshot
            
            {imageToView && (
                
                     
                        
                        src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                        alt="Donation screenshot"
                        fill
                        sizes="(max-width: 896px) 100vw, 896px"
                        className="object-contain transition-transform duration-200 ease-out origin-center"
                        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        unoptimized
                    
                
            )}
             
                
                    Zoom In
                    Zoom Out
                    Rotate
                    Reset
                
            
        
      
    </>
  );
}
