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
import { PlusCircle, MoreHorizontal, Edit, Eye, ArrowUp, ArrowDown, ChevronDown, ChevronUp, DollarSign, FolderKanban, Lightbulb, Trash2, ZoomIn, ZoomOut, RotateCw, RefreshCw, DatabaseZap, ImageIcon, Loader2 } from 'lucide-react';
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
import { cn, getNestedValue } from '@/lib/utils';
import { syncDonationsAction, deleteDonationAction } from './actions';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';

type SortKey = keyof Donation | 'srNo';

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50 transition-colors text-primary font-bold", className)} onClick={() => handleSort(sortKey)}>
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
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.update', false);
    const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.delete', false);

    const primaryInitiative = donation.linkSplit?.[0]?.linkName || (donation as any).campaignName || 'Unlinked';

    return (
        <>
            <TableRow onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? "open" : "closed"} className="cursor-pointer bg-background hover:bg-accent/50 group transition-colors">
                <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="font-mono text-xs">{(index)}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-bold text-sm text-foreground whitespace-nowrap">{donation.donorName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone || 'N/A'}</div>
                </TableCell>
                <TableCell className="text-right font-bold font-mono text-primary text-sm">₹{donation.amount.toFixed(2)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs font-normal text-foreground">{donation.donationDate}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[9px] font-bold uppercase">{donation.donationType}</Badge></TableCell>
                <TableCell>
                    <Badge variant={donation.status === 'Verified' ? 'success' : donation.status === 'Canceled' ? 'destructive' : 'outline'} className="text-[9px] font-bold uppercase">
                        {donation.status}
                    </Badge>
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-[10px] font-normal text-muted-foreground">{primaryInitiative}</TableCell>
                <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)} className="font-bold text-primary"><Eye className="mr-2 h-4 w-4"/> Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit} className="font-bold text-primary"><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:bg-destructive/20 focus:text-destructive font-bold">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-primary/[0.02] hover:bg-primary/[0.02] border-b border-primary/10">
                    <TableCell colSpan={8} className="p-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-primary"><DollarSign className="h-3 w-3"/> Category breakdown</h4>
                                    <div className="border border-primary/10 rounded-md bg-background overflow-hidden">
                                        <ScrollArea className="w-full">
                                            <Table>
                                                <TableHeader className="bg-primary/5"><TableRow><TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Category</TableHead><TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Value</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {(donation.typeSplit || []).map(split => (
                                                        <TableRow key={split.category} className="h-8 hover:bg-muted/30"><TableCell className="py-1 text-[11px] font-normal text-foreground whitespace-nowrap">{split.category}</TableCell><TableCell className="text-right font-bold font-mono py-1 text-primary text-[11px]">₹{split.amount.toFixed(2)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-primary"><FolderKanban className="h-3 w-3"/> Initiative allocation</h4>
                                    <div className="border border-primary/10 rounded-md bg-background overflow-hidden">
                                        <ScrollArea className="w-full">
                                            <Table>
                                                <TableHeader><TableRow className="bg-primary/5"><TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Target</TableHead><TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Allocated</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {(donation.linkSplit || []).map(link => (
                                                        <TableRow key={link.linkId} className="h-8 hover:bg-muted/30">
                                                            <TableCell className="flex items-center gap-2 py-1">
                                                                {link.linkType === 'campaign' ? <FolderKanban className="h-3 w-3 text-primary/40" /> : <Lightbulb className="h-3 w-3 text-primary/40" />}
                                                                <span className="text-[10px] font-normal text-foreground whitespace-nowrap">{link.linkName}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold font-mono py-1 text-primary text-[11px]">₹{link.amount.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {(donation.linkSplit?.length === 0 || !donation.linkSplit) && (
                                                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4 italic text-xs font-normal">Unallocated / general fund</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-primary"><ImageIcon className="h-3 w-3"/> Verified transaction logs</h4>
                                <div className="border border-primary/10 rounded-md bg-background overflow-hidden">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-primary/5">
                                                    <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Sum</TableHead>
                                                    <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Ref id</TableHead>
                                                    <TableHead className="h-8 py-0 text-[9px] font-bold text-primary">Date</TableHead>
                                                    <TableHead className="text-right h-8 py-0 text-[9px] font-bold text-primary">Artifact</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(donation.transactions || []).map((tx) => (
                                                    <TableRow key={tx.id} className="hover:bg-muted/30">
                                                        <TableCell className="font-bold font-mono text-primary text-[11px] py-2">₹{tx.amount.toFixed(2)}</TableCell>
                                                        <TableCell className="font-mono text-[10px] py-2 text-foreground whitespace-nowrap">{tx.transactionId || 'N/A'}</TableCell>
                                                        <TableCell className="text-[10px] font-normal text-muted-foreground py-2 whitespace-nowrap">{tx.date || donation.donationDate}</TableCell>
                                                        <TableCell className="text-right py-2">
                                                            {tx.screenshotUrl ? (
                                                                <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold border-primary/20 text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }}>
                                                                    <ImageIcon className="mr-1 h-3 w-3" /> View
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
                    </TableCell>
                </TableRow>
            )}
        </>
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
    
    setDoc(docRef, { 
        ...data, 
        uploadedBy: userProfile.name, 
        uploadedById: userProfile.id,
        createdAt: editingDonation ? (editingDonation as any).createdAt : serverTimestamp()
    }, { merge: true })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: editingDonation ? 'update' : 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    toast({ title: "Donation synchronized", description: "The financial record is now secured.", variant: 'success' });
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

  if (isLoading) return <SectionLoader label="Loading donation records..." description="Retrieving organizational financial logs." />;

  return (
    <main className="container mx-auto p-4 md:p-8 font-normal text-primary">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold tracking-tighter text-primary uppercase">Financial donations</h1>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleSync} disabled={isSyncing} className="flex-1 sm:flex-none font-bold text-[10px] border-primary/20 text-primary active:scale-95 transition-transform">
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                  Sync logs
                </Button>
                <Button onClick={() => { setEditingDonation(null); setIsFormOpen(true); }} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white font-bold text-xs active:scale-95 transition-transform shadow-md">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add record
                </Button>
            </div>
        </div>

        <Card className="shadow-sm border-primary/10 bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 p-4 border-b">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex flex-nowrap gap-2 pb-2">
                        <Input placeholder="Search donor, phone, id..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-[300px] h-9 text-xs border-primary/20 focus-visible:ring-primary text-primary font-normal"/>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-xs font-bold border-primary/20 text-primary"><SelectValue placeholder="All statuses"/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All" className="font-bold">All statuses</SelectItem>
                                <SelectItem value="Verified" className="font-bold">Verified</SelectItem>
                                <SelectItem value="Pending" className="font-bold">Pending</SelectItem>
                                <SelectItem value="Canceled" className="font-bold text-destructive">Canceled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <Table>
                        <TableHeader className="bg-primary/5">
                            <TableRow>
                                <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort} className="pl-4">#</SortableHeader>
                                <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                                <SortableHeader sortKey="amount" sortConfig={sortConfig} handleSort={handleSort} className="text-right">Sum (₹)</SortableHeader>
                                <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                                <TableHead className="text-primary font-bold text-[10px] uppercase tracking-wider">Method</TableHead>
                                <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                                <TableHead className="text-primary font-bold text-[10px] uppercase tracking-wider">Target</TableHead>
                                <TableHead className="text-right pr-4 text-primary font-bold text-[10px] uppercase tracking-wider">Actions</TableHead>
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
                                <TableRow><TableCell colSpan={8} className="text-center py-24 text-primary/40 font-bold bg-primary/[0.02]">No donation records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center py-4 border-t bg-primary/5 p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold h-8 border-primary/20 text-primary">Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold h-8 border-primary/20 text-primary">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
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
                    />
                </ScrollArea>
                <DialogFooter className="px-6 py-4 border-t bg-muted/5">
                    <Button variant="outline" onClick={() => setIsFormOpen(false)} className="font-bold">Close form</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Delete record?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Permanently erase this donation record and all attached artifacts. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90">Confirm deletion</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
            <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b"><DialogTitle className="text-xl font-bold text-primary">Artifact viewer</DialogTitle></DialogHeader>
                <ScrollArea className="flex-1 bg-secondary/20">
                    <div className="relative min-h-[70vh] w-full flex items-center justify-center p-4">
                        {imageToView && (
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`} alt="Verification" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        )}
                    </div>
                    <ScrollBar orientation="both" />
                </ScrollArea>
                <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                    <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-[10px] border-primary/20 text-primary"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                    <Button variant="outline" size="sm" onClick={() => setZoom(z => z / 1.2) } className="font-bold text-[10px] border-primary/20 text-primary"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                    <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-[10px] border-primary/20 text-primary"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                    <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-[10px] border-primary/20 text-primary"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}