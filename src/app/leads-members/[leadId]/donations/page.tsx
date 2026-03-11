'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, serverTimestamp, setDoc, updateDoc, type DocumentReference, deleteField } from 'firebase/firestore';
import type { Donation, Lead, Campaign } from '@/lib/types';
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
    Trash2, 
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
    ImageIcon, 
    Link as LinkIcon,
    CheckSquare,
    X,
    ChevronsUpDown,
    Download,
    UploadCloud,
    Users,
    CheckCircle2,
    Hourglass,
    XCircle,
    Smartphone,
    Wallet
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { bulkUpdateDonationStatusAction, bulkImportDonationsAction } from '@/app/donations/actions';
import { donationCategories } from '@/lib/modules';
import { BrandedLoader } from '@/components/branded-loader';
import { DonationImportDialog } from '@/components/donation-import-dialog';

const donationGridClass = "grid grid-cols-[40px_60px_200px_120px_120px_100px_100px_150px_80px] items-center gap-4 px-4 py-3 min-w-[1100px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay, isCurrency = false }: { title: string, count: number | string, description: string, icon: any, colorClass?: string, delay: string, isCurrency?: boolean }) {
    return (
        <Card className={cn("flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all hover:shadow-md", colorClass)} style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight uppercase">{title}</p>
                    <p className="text-2xl font-black text-primary tracking-tight">
                        {isCurrency ? `₹${count}` : count}
                    </p>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="text-[9px] font-medium text-muted-foreground mt-auto">{description}</p>
        </Card>
    );
}

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: any, children: React.ReactNode, className?: string, sortConfig: { key: string; direction: 'ascending' | 'descending' } | null, handleSort: (key: any) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:bg-muted/50 transition-colors font-bold text-[hsl(var(--table-header-fg))] text-[10px] uppercase tracking-widest flex items-center gap-2", className)} onClick={() => handleSort(sortKey)}>
            {children}
            {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
        </div>
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

  const allCampaignsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
  const { data: allCampaigns } = useCollection<Campaign>(allCampaignsCollectionRef);

  const leadsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
  const { data: allLeads } = useCollection<Lead>(leadsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [donationToUnlink, setDonationToUnlink] = useState<string | null>(null);
  
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.update', false);
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.create', false);

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
        if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
        return sortConfig.direction === 'ascending' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    }
    return items;
  }, [donations, searchTerm, statusFilter, sortConfig]);

  const stats = useMemo(() => {
      const data = filteredAndSortedDonations;
      return {
          total: data.length,
          verified: data.filter(d => d.status === 'Verified').length,
          pending: data.filter(d => d.status === 'Pending').length,
          canceled: data.filter(d => d.status === 'Canceled').length,
          online: data.filter(d => d.donationType === 'Online Payment').length,
          cash: data.filter(d => d.donationType === 'Cash').length,
          totalAmount: data.filter(d => d.status === 'Verified').reduce((sum, d) => sum + d.amountForThisLead, 0),
          pendingAmount: data.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amountForThisLead, 0),
      };
  }, [filteredAndSortedDonations]);

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
            toast({ title: 'Success', description: 'Donation Unlinked Successfully.', variant: 'success' });
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
        
        if (editingDonation) {
            (finalData as any).campaignId = deleteField();
            (finalData as any).campaignName = deleteField();
        }

        await setDoc(docRef, finalData, { merge: true });
        toast({ title: 'Success', description: 'Donation Saved Successfully.', variant: 'success' });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: editingDonation ? 'update' : 'create', requestResourceData: data }));
    }
  };
  
  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  const paginatedDonations = useMemo(() => filteredAndSortedDonations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSortedDonations, currentPage, itemsPerPage]);

  const toggleSelectAll = (checked: boolean | string) => {
    const isChecked = checked === true;
    if (isChecked) {
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

  const handleExport = () => {
    if (!donations || donations.length === 0) return;
    const headers = ['ID', 'DonorName', 'DonorPhone', 'ReceiverName', 'Referral', 'TotalAmount', 'DonationDate', 'Status', 'DonationType', 'Comments', 'Suggestions'];
    const rows = donations.map(d => [
        d.id,
        `"${d.donorName || ''}"`,
        d.donorPhone || '',
        `"${d.receiverName || ''}"`,
        `"${d.referral || ''}"`,
        d.amount || 0,
        d.donationDate || '',
        d.status || 'Pending',
        d.donationType || '',
        `"${(d.comments || '').replace(/"/g, '""')}"`,
        `"${(d.suggestions || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `donations_lead_${leadId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (records: Partial<Donation>[]) => {
    if (!userProfile || !lead) return;
    const res = await bulkImportDonationsAction(
        records, 
        { id: userProfile.id, name: userProfile.name },
        { type: 'lead', id: lead.id, name: lead.name }
    );
    if (res && res.success) toast({ title: 'Import Complete', description: res.message, variant: 'success' });
    else toast({ title: 'Import Failed', description: res?.message || "Import Failed.", variant: 'destructive' });
  };

  const isLoading = isLeadLoading || areDonationsLoading || isProfileLoading;
  
  if (isLoading && !lead) return <BrandedLoader />;
  if (!lead) return <div className="p-8 text-center text-primary font-bold"><p>Lead Not Found.</p><Button asChild variant="outline" className="mt-4 border-primary/20 text-primary"><Link href="/leads-members"><ArrowLeft className="mr-2"/>Back</Link></Button></div>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative overflow-hidden">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95 text-primary"><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Leads</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold tracking-tight text-primary">{lead.name}</h1></div>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                    <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                    <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Total Count" count={stats.total} description="All records logged" icon={Users} delay="100ms" />
            <StatCard title="Verified Sum" count={stats.totalAmount.toLocaleString('en-IN')} description="Confirmed funds" icon={CheckCircle2} delay="150ms" isCurrency />
            <StatCard title="Pending Sum" count={stats.pendingAmount.toLocaleString('en-IN')} description="Awaiting vetting" icon={Hourglass} delay="200ms" isCurrency />
            <StatCard title="Online Pay" count={stats.online} description="Digital transfers" icon={Smartphone} delay="250ms" />
            <StatCard title="Cash" count={stats.cash} description="Physical collections" icon={Wallet} delay="300ms" />
            <StatCard title="Canceled" count={stats.canceled} description="Voided records" icon={XCircle} delay="350ms" colorClass="bg-red-50/50" />
        </div>

        {/* Sticky Action Hub */}
        {selectedIds.length > 0 && (
            <div className="sticky top-[73px] z-40 animate-fade-in-up w-full">
                <div className="flex items-center justify-start gap-4 px-4 py-2 bg-primary/5 border border-primary/20 backdrop-blur-md rounded-xl shadow-sm mb-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-primary/10">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold tracking-tight whitespace-nowrap text-primary">{selectedIds.length} Selected</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                    Change Status
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-dropdown border-primary/10">
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-normal">Set To Verified</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-normal">Set To Pending</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkStatusChange('Canceled')} className="font-normal text-destructive">Set To Canceled</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="ml-auto">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/40 hover:text-primary rounded-full" onClick={() => setSelectedIds([])}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        )}

        <Card className="animate-fade-in-zoom border-primary/10 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 border-b p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className="text-xl font-bold tracking-tight text-primary">Donation List ({filteredAndSortedDonations.length})</CardTitle>
                        <CardDescription className="font-normal text-primary/70">Verified contribution logs for this individual case.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleExport} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><Download className="mr-2 h-4 w-4"/> Export CSV</Button>
                        <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><UploadCloud className="mr-2 h-4 w-4"/> Import Data</Button>
                        {canUpdate && <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><LinkIcon className="mr-2 h-4 w-4"/> Select From Master</Button>}
                        {canCreate && <Button onClick={() => { setEditingDonation(null); setIsFormOpen(true); }} className="font-bold shadow-md active:scale-95 transition-transform rounded-[12px]"><PlusCircle className="mr-2 h-4 w-4"/>Add Record</Button>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Input placeholder="Search Donor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs font-normal" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9 text-xs text-primary font-bold border-primary/20"><SelectValue placeholder="Status"/></SelectTrigger>
                        <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectItem value="All" className="font-bold">All Statuses</SelectItem><SelectItem value="Verified" className="font-bold">Verified</SelectItem><SelectItem value="Pending" className="font-bold">Pending</SelectItem><SelectItem value="Canceled" className="font-bold">Canceled</SelectItem></SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold text-[hsl(var(--table-header-fg))] uppercase tracking-widest", donationGridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={paginatedDonations.length > 0 && selectedIds.length === paginatedDonations.length}
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <SortableHeader sortKey="srNo" className="w-[60px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                        <SortableHeader sortKey="amountForThisLead" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Amount</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                        <div className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] uppercase tracking-tighter">Method</div>
                        <div className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] uppercase tracking-tighter">Status</div>
                        <div className="text-right pr-4 font-bold text-[hsl(var(--table-header-fg))] text-[10px] uppercase tracking-tighter">Actions</div>
                    </div>
                    <div className="w-full max-h-[70vh]">
                        {paginatedDonations.map((donation, index) => (
                            <div key={donation.id} className={cn("hover:bg-[hsl(var(--table-row-hover))] transition-colors cursor-pointer border-b border-primary/10 bg-white items-center", donationGridClass)} onClick={() => router.push(`/leads-members/${leadId}/donations/${donation.id}`)}>
                                <div className="pl-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox 
                                        checked={selectedIds.includes(donation.id)}
                                        onCheckedChange={() => toggleSelect(donation.id)}
                                        className="border-primary/40 data-[state=checked]:bg-primary"
                                    />
                                </div>
                                <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                                <div className="min-w-0"><div className="font-bold text-sm text-primary truncate">{donation.donorName}</div><div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone}</div></div>
                                <div className="text-right font-bold font-mono text-primary text-sm">₹{donation.amountForThisLead.toFixed(2)}</div>
                                <div className="text-xs font-normal text-primary/80 text-center">{donation.donationDate}</div>
                                <div className="text-center"><Badge variant="secondary" className="text-[9px] font-bold">{donation.donationType}</Badge></div>
                                <div className="text-center"><Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="text-[9px] font-bold">{donation.status}</Badge></div>
                                <div className="text-right pr-4" onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                            <DropdownMenuItem onClick={() => router.push(`/leads-members/${leadId}/donations/${donation.id}`)} className="text-primary font-normal"><Eye className="mr-2 h-4 w-4 opacity-60" /> Details</DropdownMenuItem>
                                            {canUpdate && <DropdownMenuItem onClick={() => handleEdit(donation)} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4 opacity-60" /> Edit Record</DropdownMenuItem>}
                                            {canUpdate && <DropdownMenuItem onClick={() => handleUnlinkClick(donation.id)} className="text-destructive font-normal"><Link2Off className="mr-2 h-4 w-4 opacity-60" /> Unlink From Project</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                        {paginatedDonations.length === 0 && <div className="h-32 text-center text-muted-foreground font-normal italic bg-primary/[0.02] py-20 uppercase tracking-widest">No Donation Records Found.</div>}
                    </div>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t py-4 bg-primary/5 px-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Page {currentPage} Of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/20 h-8 text-primary transition-transform active:scale-95">Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/20 h-8 text-primary transition-transform active:scale-95">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
                <DialogHeader className="p-6 bg-primary/5 border-b shrink-0"><DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase tracking-widest">{editingDonation ? 'Edit' : 'Add'} Donation Record</DialogTitle></DialogHeader>
                <div className="flex-1 overflow-hidden relative">
                    <DonationForm 
                        donation={editingDonation} 
                        onSubmit={handleFormSubmit} 
                        onCancel={() => setIsFormOpen(false)} 
                        leads={allLeads || []} 
                        campaigns={allCampaigns || []} 
                        defaultLinkId={`lead_${leadId}`} 
                    />
                </div>
            </DialogContent>
        </Dialog>

        <DonationImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />

        {lead && (
            <DonationSearchDialog 
                open={isSearchOpen} 
                onOpenChange={setIsSearchOpen} 
                targetId={leadId} 
                targetName={lead.name} 
                targetType="lead" 
                allowedTypes={lead.allowedDonationTypes || [...donationCategories]} 
            />
        )}

        <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
            <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown"><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Unlink From Project?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Detach This Record From The Current Lead Initiative? The Master Record Will Remain Verified.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnlinkConfirm} className="bg-destructive text-white font-bold hover:bg-destructive/90 rounded-[12px] transition-transform active:scale-95 shadow-md">Confirm Unlink</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
    </main>
  );
}
