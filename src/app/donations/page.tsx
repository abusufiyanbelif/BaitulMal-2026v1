
'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { PlusCircle, MoreHorizontal, Edit, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, DollarSign, FolderKanban, Lightbulb, Trash2, ZoomIn, ZoomOut, RotateCw, RefreshCw, Loader2, DatabaseZap, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { syncDonationsAction, deleteDonationAction } from './actions';

type SortKey = keyof Donation | 'srNo';

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

    const primaryInitiative = donation.linkSplit?.[0]?.linkName || (donation as any).campaignName || 'Unlinked';

    return (
        <React.Fragment>
            <TableRow onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? "open" : "closed"} className="cursor-pointer bg-background hover:bg-accent/50">
                <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {index}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-medium">{donation.donorName}</div>
                    <div className="text-xs text-muted-foreground">{donation.donorPhone}</div>
                </TableCell>
                <TableCell className="text-right font-bold font-mono">₹{donation.amount.toFixed(2)}</TableCell>
                <TableCell className="whitespace-nowrap">{donation.donationDate}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px]">{donation.donationType}</Badge></TableCell>
                <TableCell>
                    <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'}>
                        {donation.status}
                    </Badge>
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-xs font-medium">{primaryInitiative}</TableCell>
                <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)}><Eye className="mr-2 h-4 w-4"/> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit}><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="p-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary"/> Category Breakdown</h4>
                                    <div className="border rounded-md bg-background overflow-hidden">
                                        <Table>
                                            <TableHeader><TableRow className="bg-muted/50"><TableHead className="h-8 py-0">Category</TableHead><TableHead className="text-right h-8 py-0">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(donation.typeSplit || []).map(split => (
                                                    <TableRow key={split.category} className="h-8"><TableCell className="py-1">{split.category}</TableCell><TableCell className="text-right font-mono py-1">₹{split.amount.toFixed(2)}</TableCell></TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary"/> Initiative Allocation</h4>
                                    <div className="border rounded-md bg-background overflow-hidden">
                                        <Table>
                                            <TableHeader><TableRow className="bg-muted/50"><TableHead className="h-8 py-0">Initiative</TableHead><TableHead className="text-right h-8 py-0">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(donation.linkSplit || []).map(link => (
                                                    <TableRow key={link.linkId} className="h-8">
                                                        <TableCell className="flex items-center gap-2 py-1">
                                                            {link.linkType === 'campaign' ? <FolderKanban className="h-3 w-3 text-muted-foreground" /> : <Lightbulb className="h-3 w-3 text-muted-foreground" />}
                                                            <span className="text-xs">{link.linkName}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono py-1">₹{link.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(donation.linkSplit?.length === 0 || !donation.linkSplit) && (
                                                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4 italic text-xs">Unallocated / General Fund</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary"/> Transaction History & Artifacts</h4>
                                <div className="border rounded-md bg-background overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="h-8 py-0">Amount</TableHead>
                                                <TableHead className="h-8 py-0">ID / Reference</TableHead>
                                                <TableHead className="h-8 py-0">Date</TableHead>
                                                <TableHead className="text-right h-8 py-0">Screenshot</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(donation.transactions || []).map((tx) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="font-bold font-mono py-2">₹{tx.amount.toFixed(2)}</TableCell>
                                                    <TableCell className="font-mono text-xs py-2">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="text-xs py-2">{tx.date || donation.donationDate}</TableCell>
                                                    <TableCell className="text-right py-2">
                                                        {tx.screenshotUrl ? (
                                                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }}>
                                                                <ImageIcon className="mr-1 h-3 w-3" /> View
                                                            </Button>
                                                        ) : <span className="text-muted-foreground text-[10px] italic">No image</span>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
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
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
            if (aStr < bStr) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aStr > bStr) return sortConfig.direction === 'ascending' ? 1 : -1;
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
    toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' });
    setIsSyncing(false);
  };

  const handleFormSubmit = async (data: DonationFormData) => {
    if (!firestore || !storage || !userProfile) return;
    setIsFormOpen(false);
    const docRef = editingDonation ? doc(firestore, 'donations', editingDonation.id) : doc(collection(firestore, 'donations'));
    
    // Non-blocking write
    setDoc(docRef, { 
        ...data, 
        uploadedBy: userProfile.name, 
        uploadedById: userProfile.id,
        createdAt: editingDonation ? (editingDonation as any).createdAt : serverTimestamp()
    }, { merge: true })
    .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: editingDonation ? 'update' : 'create',
            requestResourceData: data,
        }));
    });
    toast({ title: "Donation Saved", description: "The record is being synchronized in the background." });
  };

  const handleDeleteConfirm = async () => {
    if (!donationToDelete) return;
    setIsDeleteDialogOpen(false);
    const res = await deleteDonationAction(donationToDelete);
    toast({ title: res.success ? 'Deleted' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' });
    setDonationToDelete(null);
  };

  const handleViewImage = (url: string) => {
    setImageToView(url);
    setZoom(1);
    setRotation(0);
    setIsImageViewerOpen(true);
  };

  const isLoading = areDonationsLoading || isProfileLoading;

  if (isLoading) return <main className="container mx-auto p-4 md:p-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" /></main>;

  return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Donations Hub</h1>
            <div className="flex gap-2">
                <Button variant="outline" onClick={handleSync} disabled={isSyncing}><DatabaseZap className="mr-2 h-4 w-4"/> Sync Legacy Data</Button>
                <Button onClick={() => { setEditingDonation(null); setIsFormOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Donation</Button>
            </div>
        </div>

        <Card>
            <CardHeader>
                <div className="flex flex-wrap gap-2">
                    <Input placeholder="Search donor, phone, ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm"/>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Canceled">Canceled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                            <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                            <SortableHeader sortKey="amount" sortConfig={sortConfig} handleSort={handleSort} className="text-right">Amount</SortableHeader>
                            <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                            <TableHead>Type</TableHead>
                            <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                            <TableHead>Linked To</TableHead>
                            <TableHead className="text-right pr-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedDonations.map((d, i) => (
                            <DonationRow 
                                key={d.id} 
                                donation={d} 
                                index={(currentPage - 1) * itemsPerPage + i + 1} 
                                handleEdit={() => { setEditingDonation(d); setIsFormOpen(true); }} 
                                handleDeleteClick={() => { setDonationToDelete(d.id); setIsDeleteDialogOpen(true); }} 
                                handleViewImage={handleViewImage}
                            />
                        ))}
                        {paginatedDonations.length === 0 && (
                            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No donation records found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center py-4 border-t">
                    <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingDonation ? 'Edit' : 'Add'} Donation</DialogTitle></DialogHeader>
                <DonationForm 
                    donation={editingDonation} 
                    onSubmit={handleFormSubmit} 
                    onCancel={() => setIsFormOpen(false)} 
                    campaigns={allCampaigns || []} 
                    leads={allLeads || []} 
                />
            </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the donation record and all associated transaction screenshots. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader><DialogTitle>Artifact Viewer</DialogTitle></DialogHeader>
                {imageToView && (
                    <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                        <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Screenshot" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                    </div>
                )}
                <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setZoom(z => z * 1.2)}><ZoomIn className="mr-2 h-4 w-4"/> Zoom In</Button>
                    <Button variant="outline" onClick={() => setZoom(z => z / 1.2)}><ZoomOut className="mr-2 h-4 w-4"/> Zoom Out</Button>
                    <Button variant="outline" onClick={() => setRotation(r => r + 90)}><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                    <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }}><RefreshCw className="mr-2 h-4 w-4"/> Reset View</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}
