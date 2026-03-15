'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, serverTimestamp, setDoc, updateDoc, type DocumentReference, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    ArrowLeft, 
    Edit, 
    MoreHorizontal, 
    PlusCircle, 
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
    Link as LinkIcon, 
    ImageIcon,
    CheckSquare,
    X,
    ChevronsUpDown,
    Download,
    UploadCloud,
    IndianRupee,
    Hourglass,
    XCircle,
    Smartphone,
    Wallet,
    CheckCircle2,
    Users,
    CalendarIcon,
    AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
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
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

const donationGridClass = "grid grid-cols-[40px_60px_200px_120px_120px_100px_100px_150px_80px] items-center gap-4 px-4 py-3 min-w-[1150px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay, isCurrency = false, onClick }: { title: string, count: number | string, description: string, icon: any, colorClass?: string, delay: string, isCurrency?: boolean, onClick?: () => void }) {
    return (
        <Card 
            onClick={onClick}
            className={cn(
                "flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all duration-300 hover:shadow-md", 
                onClick && "cursor-pointer hover:-translate-y-1 active:scale-95",
                colorClass
            )} 
            style={{ animationDelay: delay, animationFillMode: 'backwards' }}
        >
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
        <div className={cn("cursor-pointer hover:bg-muted/50 text-[hsl(var(--table-header-fg))] font-bold text-[10px] tracking-tight flex items-center gap-2 uppercase", className)} onClick={() => handleSort(sortKey)}>
            {children}
            <div className="flex flex-col opacity-40">
                <ArrowUp className={cn("h-2.5 w-2.5 -mb-1", isSorted && sortConfig?.direction === 'ascending' && "text-primary opacity-100")} />
                <ArrowDown className={cn("h-2.5 w-2.5", isSorted && sortConfig?.direction === 'descending' && "text-primary opacity-100")} />
            </div>
        </div>
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
  const { data: allCampaigns } = useCollection<Campaign>(allCampaignsCollectionRef);

  const allLeadsCollectionRef = useMemoFirebase(() => (firestore ? collection(firestore, 'leads') : null), [firestore]);
  const { data: allLeads } = useCollection<Lead>(allLeadsCollectionRef);

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
  const [identityFilter, setIdentityFilter] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.update', false);

  const filteredAndSortedDonations = useMemo(() => {
    if (!donations) return [];
    let items = [...donations];

    if (statusFilter !== 'All') {
        items = items.filter(d => d.status === statusFilter);
    }

    if (identityFilter === 'Unlinked') {
        items = items.filter(d => !d.donorId);
    } else if (identityFilter === 'Linked') {
        items = items.filter(d => !!d.donorId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(d => (d.donorName || '').toLowerCase().includes(term) || (d.donorPhone || '').includes(term));
    }

    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        items = items.filter(d => {
            if (!d.donationDate) return false;
            try {
                const dDate = parseISO(d.donationDate);
                return dDate >= from && dDate <= to;
            } catch (e) { return false; }
        });
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
  }, [donations, searchTerm, statusFilter, identityFilter, dateRange, sortConfig]);

  const stats = useMemo(() => {
      const allData = donations || [];
      return {
          total: allData.length,
          verified: allData.filter(d => d.status === 'Verified').length,
          pending: allData.filter(d => d.status === 'Pending').length,
          unlinked: allData.filter(d => !d.donorId).length,
          totalAmount: allData.filter(d => d.status === 'Verified').reduce((sum, d) => sum + d.amountForThisCampaign, 0),
          pendingAmount: allData.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amountForThisCampaign, 0),
      };
  }, [donations]);

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

  const handleUnlinkConfirm = async () => {
    if (!donationToUnlink || !firestore || !canUpdate || !donations || !campaignId) return;
    const donationData = donations.find(d => d.id === donationToUnlink);
    if (!donationData) return;
    setIsUnlinkDialogOpen(false);
    const docRef = doc(firestore, 'donations', donationToUnlink);
    const newLinkSplit = (donationData.linkSplit || []).filter(link => link.linkId !== campaignId || link.linkType !== 'campaign');
    const updateData = { linkSplit: newLinkSplit };
    updateDoc(docRef, updateData)
        .catch(async (serverError: any) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData }));
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Donation Unlinked Successfully.', variant: 'success' });
            setDonationToUnlink(null);
        });
  };

  const isLoading = isCampaignLoading || areDonationsLoading || isProfileLoading;
  
  if (isLoading && !campaign) return <BrandedLoader />;
  if (!campaign) return <div className="p-8 text-center text-primary font-bold"><p>Campaign Not Found.</p><Button asChild variant="outline" className="mt-4 border-primary/20 text-primary"><Link href="/campaign-members"><ArrowLeft className="mr-2"/>Back</Link></Button></div>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative overflow-hidden">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95 text-primary"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
        <div className="flex justify-between items-center mb-4"><h1 className="text-3xl font-bold tracking-tight text-primary">{campaign.name}</h1></div>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                    <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item Lists</Link>
                    <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                    <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}/donations` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard 
                title="Total Count" 
                count={stats.total} 
                description="All Records Logged" 
                icon={Users} 
                delay="100ms" 
                onClick={() => { setStatusFilter('All'); setIdentityFilter('All'); setSearchTerm(''); }}
            />
            <StatCard 
                title="Verified Sum" 
                count={stats.totalAmount.toLocaleString('en-IN')} 
                description="Confirmed Funds" 
                icon={CheckCircle2} 
                delay="150ms" 
                isCurrency 
                onClick={() => { setStatusFilter('Verified'); }}
            />
            <StatCard 
                title="Pending Sum" 
                count={stats.pendingAmount.toLocaleString('en-IN')} 
                description="Awaiting Vetting" 
                icon={Hourglass} 
                delay="200ms" 
                isCurrency 
                onClick={() => { setStatusFilter('Pending'); }}
            />
            <StatCard 
                title="Unlinked" 
                count={stats.unlinked} 
                description="Needs Profile Mapping" 
                icon={AlertCircle} 
                delay="250ms" 
                colorClass={stats.unlinked > 0 ? "bg-amber-50 border-amber-200" : ""} 
                onClick={() => { setIdentityFilter('Unlinked'); }}
            />
            <StatCard title="Online Pay" count={stats.online} description="Digital Transfers" icon={Smartphone} delay="300ms" />
            <StatCard title="Cash" count={stats.cash} description="Physical Collections" icon={Wallet} delay="350ms" />
        </div>

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
            <CardHeader className="bg-primary/5 p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className="text-xl font-bold tracking-tight text-primary">Donation List ({filteredAndSortedDonations.length})</CardTitle>
                        <CardDescription className="font-normal text-primary/70">Refined And Verified Donations For This Project Hub.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleExport} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><Download className="mr-2 h-4 w-4"/> Export CSV</Button>
                        <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><UploadCloud className="mr-2 h-4 w-4"/> Import Data</Button>
                        {canUpdate && <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"><LinkIcon className="mr-2 h-4 w-4"/> Select From Master</Button>}
                        {canUpdate && <Button onClick={() => setIsFormOpen(true)} className="font-bold shadow-md active:scale-95 transition-transform rounded-[12px]"><PlusCircle className="mr-2 h-4 w-4" /> Add Record</Button>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Input placeholder="Search Donor..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-[200px] h-9 text-xs font-normal" />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs text-primary font-bold border-primary/20"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectItem value="All" className="font-bold">All Statuses</SelectItem><SelectItem value="Verified" className="font-bold">Verified</SelectItem><SelectItem value="Pending" className="font-bold">Pending</SelectItem><SelectItem value="Canceled" className="font-bold">Canceled</SelectItem></SelectContent>
                    </Select>
                    <Select value={identityFilter} onValueChange={v => { setIdentityFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs border-primary/10 text-primary rounded-[10px] bg-white font-normal shrink-0"><SelectValue placeholder="Identity Linkage"/></SelectTrigger>
                        <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                            <SelectItem value="All" className="font-normal">All Identities</SelectItem>
                            <SelectItem value="Linked" className="font-normal text-primary">Fully Linked</SelectItem>
                            <SelectItem value="Unlinked" className="font-normal text-amber-600 font-bold">Needs Resolution</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold text-[hsl(var(--table-header-fg))] tracking-tight", donationGridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={paginatedDonations.length > 0 && selectedIds.length === paginatedDonations.length}
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/40 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <SortableHeader sortKey="srNo" className="w-[60px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor</SortableHeader>
                        <SortableHeader sortKey="amountForThisCampaign" className="text-right" sortConfig={sortConfig} handleSort={handleSort}>Amount</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort}>Date</SortableHeader>
                        <div className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Method</div>
                        <div className="font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Status</div>
                        <div className="text-right pr-4 font-bold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight uppercase">Actions</div>
                    </div>
                    <div className="w-full max-h-[70vh]">
                        {paginatedDonations.map((donation, index) => {
                            const isOpen = openRows[donation.id] || false;
                            const isSelected = selectedIds.includes(donation.id);
                            return (
                                <React.Fragment key={donation.id}>
                                    <div className={cn("bg-white border-b border-primary/10 hover:bg-[hsl(var(--table-row-hover))] cursor-pointer group transition-colors", donationGridClass)} onClick={() => setOpenRows(prev => ({...prev, [donation.id]: !prev[donation.id]}))}>
                                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelect(donation.id)}
                                                className="border-primary/40 data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" disabled={!donation.transactions || donation.transactions.length === 0}>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                                            <span className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-sm text-primary truncate">{donation.donorName}</div>
                                                {!donation.donorId && <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{donation.donorPhone || 'N/A'}</div>
                                        </div>
                                        <div className="text-right font-bold font-mono text-primary text-sm">₹{donation.amountForThisCampaign.toFixed(2)}</div>
                                        <div className="text-xs font-normal text-primary/80 text-center">{donation.donationDate}</div>
                                        <div className="text-center"><Badge variant="secondary" className="text-[9px] font-bold">{donation.donationType}</Badge></div>
                                        <div className="text-center"><Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="text-[9px] font-bold">{donation.status}</Badge></div>
                                        <div className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-transform active:scale-90"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown border-primary/10">
                                                    <DropdownMenuItem onClick={() => router.push(`/campaign-members/${campaignId}/donations/${donation.id}`)} className="font-normal text-primary"><Eye className="mr-2 h-4 w-4 opacity-60" /> Details</DropdownMenuItem>
                                                    {canUpdate && <DropdownMenuItem onClick={() => { setEditingDonation(donation); setIsFormOpen(true); }} className="font-normal text-primary"><Edit className="mr-2 h-4 w-4 opacity-60" /> Edit Record</DropdownMenuItem>}
                                                    {canUpdate && <DropdownMenuItem onClick={() => handleUnlinkClick(donation.id)} className="text-destructive font-normal"><Link2Off className="mr-2 h-4 w-4 opacity-60" /> Unlink From Project</DropdownMenuItem>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="bg-primary/[0.01] border-b border-primary/10 p-4 animate-fade-in-up">
                                            <div className="max-w-4xl mx-auto space-y-4">
                                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2"><IndianRupee className="h-3.5 w-3.5"/> Linked Transactions</h4>
                                                <div className="border border-primary/10 rounded-xl bg-white shadow-sm overflow-hidden">
                                                    <ScrollArea className="w-full">
                                                        <Table>
                                                            <TableHeader className="bg-primary/5">
                                                                <TableRow>
                                                                    <TableHead className="text-[9px] font-bold text-primary tracking-tight uppercase">Value (₹)</TableHead>
                                                                    <TableHead className="text-[9px] font-bold text-primary tracking-tight uppercase">Reference</TableHead>
                                                                    <TableHead className="text-right text-[9px] font-bold text-primary tracking-tight pr-6 uppercase">Proof</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {(donation.transactions || []).map((tx) => (
                                                                    <TableRow key={tx.id} className="hover:bg-primary/[0.02]">
                                                                        <TableCell className="font-bold font-mono text-sm text-primary">₹{tx.amount.toFixed(2)}</TableCell>
                                                                        <TableCell className="font-mono text-xs opacity-70 text-primary">{tx.transactionId || 'N/A'}</TableCell>
                                                                        <TableCell className="text-right pr-6">{tx.screenshotUrl ? (<Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewImage(tx.screenshotUrl!); }} className="font-bold text-[10px] h-7 border-primary/20 text-primary hover:bg-primary/5 transition-transform active:scale-95 shadow-none"><ImageIcon className="mr-1 h-3 w-3" /> View Artifact</Button>) : <span className="text-muted-foreground text-[10px] uppercase opacity-40">None</span>}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                        <ScrollBar orientation="horizontal" />
                                                    </ScrollArea>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {paginatedDonations.length === 0 && <div className="text-center py-20 text-muted-foreground italic font-normal bg-primary/[0.02] tracking-widest uppercase">No Donation Records Linked.</div>}
                    </div>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between py-4 border-t bg-primary/5 p-4">
                    <p className="text-[10px] font-bold text-muted-foreground">Page {currentPage} Of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold border-primary/20 h-8 text-primary transition-transform active:scale-95">Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold border-primary/20 h-8 text-primary transition-transform active:scale-95">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>
      
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setEditingDonation(null); }}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
            <DialogHeader className="border-b bg-primary/5 p-6 shrink-0">
                <DialogTitle className="text-xl font-bold tracking-tight text-primary">
                    {editingDonation ? 'Modify Donation Profile' : 'Donation Details To Be Add'}
                </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden relative">
                <DonationForm donation={editingDonation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} campaigns={allCampaigns || []} leads={allLeads || []} defaultLinkId={`campaign_${campaignId}`} />
            </div>
        </DialogContent>
      </Dialog>

      <DonationImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />

      {campaign && (
        <DonationSearchDialog 
            open={isSearchOpen} 
            onOpenChange={setIsSearchOpen} 
            targetId={campaignId} 
            targetName={campaign.name} 
            targetType="campaign" 
            allowedTypes={campaign.allowedDonationTypes || [...donationCategories]} 
        />
      )}
      
      <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown"><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive uppercase">Unlink From Project?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">Detach This Record From The Current Campaign? The Record Remains Secured In The Master Registry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnlinkConfirm} className="bg-destructive hover:bg-destructive/90 text-white font-bold rounded-[12px] transition-transform active:scale-95 shadow-md">Confirm Unlink</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
