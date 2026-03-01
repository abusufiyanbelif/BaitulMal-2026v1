
'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, setDoc, DocumentReference, deleteField } from 'firebase/firestore';
import type { Donation, Lead, Campaign, TransactionDetail } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, ZoomIn, ZoomOut, RotateCw, RefreshCw, DatabaseZap, Check, ChevronsUpDown, X, Link2Off, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
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
import { BrandedLoader } from '@/components/branded-loader';

type SortKey = keyof Donation | 'srNo' | 'amountForThisLead';

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50 transition-colors", className)} onClick={() => handleSort(sortKey)}>
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
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();
  
  const leadDocRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  
  const allDonationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'donations');
  }, [firestore]);
  const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);

  const donations = useMemo(() => {
    if (!allDonations || !leadId) return [];
    return allDonations
      .filter(d => d.linkSplit?.some(link => link.linkId === leadId && link.linkType === 'lead'))
      .map(d => {
        const leadLink = d.linkSplit?.find(l => l.linkId === leadId && l.linkType === 'lead');
        const amountForThisLead = leadLink?.amount || 0;
        return { ...d, amountForThisLead };
      });
  }, [allDonations, leadId]);

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
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.delete', false);

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
    if (!donationToUnlink || !firestore || !canUpdate || !donations || !leadId) return;
    const donationData = donations.find(d => d.id === donationToUnlink);
    if (!donationData) return;
    setIsUnlinkDialogOpen(false);
    const docRef = doc(firestore, 'donations', donationToUnlink);
    const newLinkSplit = (donationData.linkSplit || []).filter(link => link.linkId !== leadId || link.linkType !== 'lead');
    const updateData = { linkSplit: newLinkSplit };
    updateDoc(docRef, updateData)
        .catch(async (serverError: any) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Donation unlinked.', variant: 'success' });
            setDonationToUnlink(null);
        });
  };
  
  const handleFormSubmit = async (data: DonationFormData) => {
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
        await setDoc(docRef, finalData, { merge: true });
        toast({ title: 'Success', description: 'Donation saved.', variant: 'success' });
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
    if (statusFilter !== 'All') items = items.filter(d => d.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(d => d.donorName.toLowerCase().includes(term) || d.receiverName.toLowerCase().includes(term) || d.donorPhone.includes(term));
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
  }, [donations, searchTerm, statusFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  const paginatedDonations = useMemo(() => filteredAndSortedDonations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSortedDonations, currentPage, itemsPerPage]);

  const isLoading = isLeadLoading || areDonationsLoading || isProfileLoading;
  
  if (isLoading && !lead) return <BrandedLoader />;
  if (!lead) return <div className="p-8 text-center"><p>Lead not found.</p><Button asChild variant="outline" className="mt-4"><Link href="/leads-members"><ArrowLeft className="mr-2"/>Back</Link></Button></div>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold">{lead.name}</h1></div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && (
                        <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                    )}
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                    {canReadBeneficiaries && (
                        <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary Details</Link>
                    )}
                    {canReadDonations && (
                        <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom shadow-md">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1.5">
                        <CardTitle>Donation List ({filteredAndSortedDonations.length})</CardTitle>
                        <CardDescription>Total verified collection for this lead: <span className="font-bold text-primary font-mono">₹{filteredAndSortedDonations.reduce((sum, d) => sum + d.amountForThisLead, 0).toFixed(2)}</span></CardDescription>
                    </div>
                    {canCreate && <Button onClick={() => setIsFormOpen(true)} className="interactive-hover font-bold"><PlusCircle className="mr-2 h-4 w-4"/>Add Donation</Button>}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Input placeholder="Search donor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold"><SelectValue placeholder="Status"/></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Canceled">Canceled</SelectItem></SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <SortableHeader sortKey="srNo" className="w-[60px] pl-4" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                                <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                                <SortableHeader sortKey="amountForThisLead" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Amount</SortableHeader>
                                <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right pr-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedDonations.map((donation, index) => (
                                <TableRow key={donation.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push(`/leads-members/${leadId}/donations/${donation.id}`)}>
                                    <TableCell className="pl-4 font-mono text-xs">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                    <TableCell><div className="font-bold text-sm">{donation.donorName}</div><div className="text-[10px] text-muted-foreground">{donation.donorPhone}</div></TableCell>
                                    <TableCell className="text-right font-black font-mono">₹{donation.amountForThisLead.toFixed(2)}</TableCell>
                                    <TableCell className="text-xs">{donation.donationDate}</TableCell>
                                    <TableCell><Badge variant={donation.status === 'Verified' ? 'success' : 'outline'} className="text-[10px] uppercase font-black">{donation.status}</Badge></TableCell>
                                    <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => router.push(`/leads-members/${leadId}/donations/${donation.id}`)}><Eye className="mr-2 h-4 w-4"/>View Details</DropdownMenuItem>
                                                {canUpdate && <DropdownMenuItem onClick={() => handleEdit(donation)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>}
                                                {canUpdate && <DropdownMenuItem onClick={() => handleUnlinkClick(donation.id)} className="text-destructive"><Link2Off className="mr-2 h-4 w-4"/>Unlink</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {paginatedDonations.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-bold uppercase tracking-widest bg-muted/10">No donations found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t py-4">
                    <p className="text-xs text-muted-foreground">Showing {paginatedDonations.length} of {filteredAndSortedDonations.length}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                        <span className="text-xs font-bold">{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingDonation ? 'Edit' : 'Add'} Donation</DialogTitle></DialogHeader>
                <DonationForm donation={editingDonation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} allLeads={allLeads || []} allCampaigns={allCampaigns || []} defaultLinkId={`lead_${leadId}`} />
            </DialogContent>
        </Dialog>

        <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Unlink Donation?</AlertDialogTitle><AlertDialogDescription>This will remove the donation from this initiative but will not delete the record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnlinkConfirm} className="bg-destructive text-white">Unlink</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
    </main>
  );
}
