'use client';
import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useStorage, useAuth, storageRef, uploadBytes, getDownloadURL, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteField } from 'firebase/firestore';
import type { Donation, Campaign, Lead, DonationLink, TransactionDetail, Donor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    PlusCircle, 
    MoreHorizontal, 
    Edit, 
    Eye, 
    ArrowUp, 
    ArrowDown, 
    ChevronDown, 
    ChevronUp, 
    IndianRupee, 
    FolderKanban, 
    Lightbulb, 
    Trash2, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    RefreshCw, 
    DatabaseZap, 
    ImageIcon, 
    Loader2, 
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
    Wallet,
    ArrowLeft,
    CalendarIcon,
    AlertCircle,
    Save,
    Calculator,
    Filter,
    Check,
    Coins,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    Activity,
    Search
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, getNestedValue } from '@/lib/utils';
import { bulkUpdateDonationStatusAction, bulkImportDonationsAction, upsertDonationWithDonorAction, deleteDonationAction, bulkMapDonorsAction, bulkUnmapDonorsAction, bulkManualMapDonorsAction } from './actions';
import { donationCategories } from '@/lib/modules';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SectionLoader } from '@/components/section-loader';
import { DonationImportDialog } from '@/components/donation-import-dialog';
import { DonorSearchDialog } from '@/components/donor-search-dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

type SortKey = keyof Donation | 'srNo';

function MultiSelectFilter({ title, options, selected, onChange }: { title: string, options: readonly string[], selected: string[], onChange: (val: string[]) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 text-xs border-primary/10 text-primary rounded-xl bg-white font-bold transition-all hover:border-primary/30 min-w-[140px] justify-between shadow-sm group">
                    <div className="flex items-center gap-2 truncate">
                        <Filter className={cn("h-3.5 w-3.5 shrink-0 transition-transform group-hover:rotate-12", selected.length > 0 ? "text-primary opacity-100" : "opacity-40")} />
                        <span className="truncate">{selected.length === 0 ? `All ${title}s` : `${selected.length} ${title}${selected.length > 1 ? 's' : ''}`}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0 rounded-2xl shadow-dropdown border-primary/10 overflow-hidden" align="start">
                <Command className="w-full">
                    <CommandInput placeholder={`Search ${title}...`} className="h-10 text-xs font-normal px-4 outline-none w-full border-b" />
                    <CommandList className="max-h-[300px] overflow-y-auto p-1.5">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-bold opacity-60">No results found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem onSelect={() => onChange([])} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 cursor-pointer font-bold text-xs mb-1">
                                <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selected.length === 0 ? "bg-primary text-white" : "bg-transparent")}>
                                    {selected.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="flex-1 truncate">All {title}s</span>
                            </CommandItem>
                            
                            <div className="h-px bg-primary/5 my-1.5" />

                            {options.map((opt) => (
                                <CommandItem 
                                    key={opt} 
                                    onSelect={() => {
                                        const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                                        onChange(next);
                                    }} 
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 cursor-pointer font-bold text-xs"
                                >
                                    <div className={cn("flex h-4 w-4 items-center justify-center rounded-md border border-primary transition-colors", selected.includes(opt) ? "bg-primary text-white" : "bg-transparent")}>
                                        {selected.includes(opt) && <Check className="h-3 w-3 stroke-[3]" />}
                                    </div>
                                    <span className="flex-1 truncate">{opt}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {selected.length > 0 && (
                        <div className="p-1.5 border-t bg-primary/[0.02]">
                            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="w-full h-9 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-xl">
                                Clear Selections
                            </Button>
                        </div>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const donationGridClass = "grid grid-cols-[40px_60px_200px_120px_120px_100px_100px_100px_80px] items-center gap-6 px-6 py-4 min-w-[1100px]";

interface StatCardProps {
    title: string;
    count: number | string;
    description: string;
    icon: any;
    delay: string;
    isCurrency?: boolean;
    colorClass?: string;
    onClick?: () => void;
}

function StatCard({ title, count, description, icon: Icon, delay, isCurrency = false, colorClass, onClick }: StatCardProps) {
    return (
        <Card 
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-5 bg-white border-primary/5 shadow-sm animate-fade-in-up transition-all duration-500 hover:shadow-xl hover:-translate-y-1 overflow-hidden", 
                onClick && "cursor-pointer active:scale-95",
                colorClass
            )} 
            style={{ animationDelay: delay, animationFillMode: 'backwards' }}
        >
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                <Icon className="h-24 w-24" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 rounded-2xl bg-primary/[0.03] text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] opacity-40 mb-1">{title}</p>
                    <p className="text-2xl sm:text-3xl font-black text-primary tracking-tighter">
                        {isCurrency ? `₹${count}` : count}
                    </p>
                </div>
            </div>
            <div className="relative z-10 mt-auto">
                <p className="text-[10px] font-bold text-muted-foreground/60 leading-tight truncate">{description}</p>
            </div>
        </Card>
    );
}

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <div className={cn("cursor-pointer hover:text-primary transition-colors flex items-center gap-2 font-black text-[10px] text-muted-foreground tracking-[0.1em]", className)} onClick={() => handleSort(sortKey)}>
            {children}
            <div className="flex flex-col opacity-30">
                <ArrowUp className={cn("h-2.5 w-2.5 -mb-0.5 transition-all", isSorted && sortConfig?.direction === 'ascending' && "text-primary opacity-100 scale-125")} />
                <ArrowDown className={cn("h-2.5 w-2.5 transition-all", isSorted && sortConfig?.direction === 'descending' && "text-primary opacity-100 scale-125")} />
            </div>
        </div>
    );
};

interface DonationRowProps {
    donation: Donation;
    index: number;
    isSelected: boolean;
    onToggle: () => void;
    handleEdit: () => void;
    handleDeleteClick: () => void;
    handleViewImage: (url: string) => void;
}

function DonationRow({ donation, index, isSelected, onToggle, handleEdit, handleDeleteClick, handleViewImage }: DonationRowProps) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const { userProfile } = useSession();
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.update', false);
    const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.delete', false);

    const donationAny = donation as Record<string, any>;
    const primaryInitiative = donation.linkSplit?.[0]?.linkName || donationAny.campaignName || 'Unlinked';

    return (
        <div className="flex flex-col">
            {/* Desktop View */}
            <div onClick={() => setIsOpen(!isOpen)} className={cn("hidden md:grid cursor-pointer border-b border-primary/5 hover:bg-primary/[0.01] group transition-colors bg-white/40", donationGridClass)}>
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                        checked={isSelected}
                        onCheckedChange={onToggle}
                        className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/5 rounded-xl transition-all" disabled={!donation.transactions || donation.transactions.length === 0}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <span className="font-mono text-[11px] font-bold opacity-30">{index}</span>
                </div>
                <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-0.5">
                        <div className="font-bold text-sm text-primary truncate tracking-tight">{donation.donorName}</div>
                        {!donation.donorId && <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-black opacity-50 tracking-tight">{donation.donorPhone || 'N/A'}</div>
                </div>
                <div className="text-right pr-4">
                    <div className="font-black font-mono text-primary text-sm flex items-center justify-end gap-1.5">
                        {donation.status === 'Verified' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/60" />}
                        ₹{donation.amount.toFixed(2)}
                    </div>
                </div>
                <div className="whitespace-nowrap text-[11px] font-bold text-primary/60 text-center italic">{donation.donationDate}</div>
                <div className="text-center">
                    <Badge variant="secondary" className="text-[9px] font-black px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm bg-primary/5 text-primary">
                        {donation.donationType}
                    </Badge>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 overflow-hidden">
                    {(donation.typeSplit && donation.typeSplit.length > 0) ? (
                        donation.typeSplit.map(s => (
                            <Badge key={s.category} variant="outline" className="text-[8px] font-bold px-2 py-0.5 border-primary/10 text-primary/60 rounded-lg">{s.category}</Badge>
                        ))
                    ) : (
                        <Badge variant="outline" className="text-[8px] font-bold px-2 py-0.5 border-primary/10 text-primary/60 rounded-lg">{donation.type || 'N/A'}</Badge>
                    )}
                </div>
                <div className="text-center">
                    <Badge variant={donation.status === 'Verified' ? 'eligible' : donation.status === 'Canceled' ? 'given' : 'secondary'} className="text-[9px] font-black px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm">
                        {donation.status}
                    </Badge>
                </div>
                <div className="text-right pr-6" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-90"><MoreHorizontal className="h-5 w-5"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-56">
                            <DropdownMenuItem onClick={() => router.push(`/donations/${donation.id}`)} className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer"><Eye className="mr-3 h-4 w-4 opacity-40"/> Full Audit View</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={handleEdit} className="text-primary font-bold text-xs p-3 rounded-xl"><Edit className="mr-3 h-4 w-4 opacity-40"/> Modify Record</DropdownMenuItem>}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive font-black text-xs p-3 rounded-xl hover:bg-destructive/10">
                                        <Trash2 className="mr-3 h-4 w-4 opacity-80"/> Hard Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Mobile Registry Card */}
            <div className="md:hidden p-5 border-b border-primary/5 bg-white/60 space-y-4 group/mobile" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={onToggle}
                            className="h-6 w-6 rounded-lg border-primary/20 data-[state=checked]:bg-primary mt-1"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="space-y-1">
                            <div className="font-black text-lg text-primary tracking-tighter leading-tight flex items-center gap-2">
                                {donation.donorName}
                                {!donation.donorId && <AlertCircle className="h-4 w-4 text-amber-500 animate-pulse" />}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-black opacity-50 tracking-tight">{donation.donorPhone}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-black text-primary text-lg tracking-tighter">₹{donation.amount.toFixed(2)}</div>
                        <Badge variant={donation.status === 'Verified' ? 'eligible' : donation.status === 'Canceled' ? 'given' : 'secondary'} className="text-[9px] font-black px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm mt-1">
                            {donation.status}
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] font-black px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm bg-primary/5 text-primary">{donation.donationType}</Badge>
                        <span className="text-[10px] font-bold text-muted-foreground italic">{donation.donationDate}</span>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/5 bg-primary/5 rounded-2xl" onClick={() => router.push(`/donations/${donation.id}`)}><Eye className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/5 bg-primary/5 rounded-2xl" onClick={() => setIsOpen(!isOpen)}>
                            <ChevronDown className={cn("h-5 w-5 transition-transform duration-500", isOpen && "rotate-180")} />
                        </Button>
                    </div>
                </div>
            </div>
            
            {isOpen && (
                <div className="bg-primary/[0.02] border-b border-primary/5 p-6 animate-fade-in-up">
                    <div className="space-y-8 max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black flex items-center gap-2 text-primary tracking-[0.2em] opacity-50"><IndianRupee className="h-3.5 w-3.5"/> Classification Matrix</h4>
                                <div className="border border-primary/10 rounded-[24px] bg-white shadow-xl overflow-hidden">
                                    <ScrollArea className="w-full">
                                        <Table>
                                            <TableHeader className="bg-primary/[0.02]">
                                                <TableRow className="hover:bg-transparent border-primary/5">
                                                    <TableHead className="h-10 py-0 text-[9px] font-black text-muted-foreground tracking-[0.1em] px-6">Category</TableHead>
                                                    <TableHead className="text-right h-10 py-0 text-[9px] font-black text-muted-foreground tracking-[0.1em] px-6">Allocated Value</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(donation.typeSplit || []).map(split => (
                                                    <TableRow key={split.category} className="hover:bg-primary/[0.01] border-primary/5">
                                                        <TableCell className="py-4 px-6 text-sm font-bold text-primary tracking-tight">{split.category}</TableCell>
                                                        <TableCell className="text-right font-black font-mono text-primary py-4 px-6 text-sm">₹{split.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <ScrollBar orientation="horizontal" className="h-1.5" />
                                    </ScrollArea>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black flex items-center gap-2 text-primary tracking-[0.2em] opacity-50"><FolderKanban className="h-3.5 w-3.5"/> Registry Linking</h4>
                                <div className="border border-primary/10 rounded-[24px] bg-white shadow-xl overflow-hidden">
                                    <ScrollArea className="w-full">
                                        <div className="min-w-[300px]">
                                            <Table>
                                                <TableHeader className="bg-primary/[0.02]">
                                                    <TableRow className="hover:bg-transparent border-primary/5">
                                                        <TableHead className="h-10 py-0 text-[9px] font-black text-muted-foreground tracking-[0.1em] px-6">Target Initiative</TableHead>
                                                        <TableHead className="text-right h-10 py-0 text-[9px] font-black text-muted-foreground tracking-[0.1em] px-6">Assigned Sum</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(donation.linkSplit || []).map(link => (
                                                        <TableRow key={link.linkId} className="hover:bg-primary/[0.01] border-primary/5">
                                                            <TableCell className="flex items-center gap-3 py-4 px-6">
                                                                <div className="p-2 rounded-lg bg-primary/[0.03] text-primary">
                                                                    {link.linkType === 'campaign' ? <FolderKanban className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
                                                                </div>
                                                                <span className="text-sm font-bold text-primary tracking-tight truncate max-w-[150px]">{link.linkName}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-black font-mono text-primary py-4 px-6 text-sm">₹{link.amount.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {(donation.linkSplit?.length === 0 || !donation.linkSplit) && (
                                                        <TableRow className="hover:bg-transparent"><TableCell colSpan={2} className="text-center text-muted-foreground py-10 italic text-sm font-bold opacity-40 tracking-widest">Unallocated General Pool</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <ScrollBar orientation="horizontal" className="h-1.5" />
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DonationListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { user, userProfile, isLoading: isProfileLoading } = useSession();
  const auth = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [identityFilter, setIdentityFilter] = useState<string[]>([]);
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'donationDate', direction: 'descending'});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const donationsCollectionRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'donations') : null, [firestore, user]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignsCollectionRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'campaigns') : null, [firestore, user]);
  const { data: allCampaigns } = useCollection<Campaign>(campaignsCollectionRef);

  const leadsCollectionRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'leads') : null, [firestore, user]);
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

    if (statusFilter.length > 0) items = items.filter(d => statusFilter.includes(d.status));
    
    if (identityFilter.length > 0) {
        items = items.filter(d => {
            const isLinked = !!d.donorId;
            if (identityFilter.includes('Linked') && isLinked) return true;
            if (identityFilter.includes('Unlinked') && !isLinked) return true;
            return false;
        });
    }

    if (methodFilter.length > 0) items = items.filter(d => methodFilter.includes(d.donationType));
    
    if (categoryFilter.length > 0) {
        items = items.filter(d => {
            if (d.typeSplit && d.typeSplit.length > 0) {
                return d.typeSplit.some(s => categoryFilter.includes(s.category));
            }
            return categoryFilter.includes(d.type || 'N/A');
        });
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(d => 
            d.donorName.toLowerCase().includes(lower) || 
            d.donorPhone.includes(searchTerm) ||
            d.id.toLowerCase().includes(lower)
        );
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

    if (sortConfig) {
        items.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = (a[sortConfig.key as keyof Donation] ?? '').toString().toLowerCase();
            const bVal = (b[sortConfig.key as keyof Donation] ?? '').toString().toLowerCase();
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }
    return items;
  }, [donations, searchTerm, statusFilter, identityFilter, methodFilter, dateRange, sortConfig]);

  const stats = useMemo(() => {
      const allData = donations || [];
      return {
          total: allData.length,
          verified: allData.filter(d => d.status === 'Verified').length,
          pending: allData.filter(d => d.status === 'Pending').length,
          unlinked: allData.filter(d => !d.donorId).length,
          totalAmount: allData.filter(d => d.status === 'Verified').reduce((sum, d) => sum + d.amount, 0),
          pendingAmount: allData.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amount, 0),
          online: allData.filter(d => d.donationType === 'Online Payment').length,
          cash: allData.filter(d => d.donationType === 'Cash').length,
      };
  }, [donations]);

  const paginatedDonations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedDonations.slice(start, start + itemsPerPage);
  }, [filteredAndSortedDonations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedDonations.length / itemsPerPage);
  
  const filteredTotalAmount = useMemo(() => {
    return filteredAndSortedDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [filteredAndSortedDonations]);

  const handleFormSubmit = async (data: DonationFormData) => {
    if (!firestore || !storage || !userProfile || !allCampaigns || !allLeads) return;
    setIsFormOpen(false);
    setIsSubmitting(true);
    try {
        const result = await upsertDonationWithDonorAction(editingDonation?.id || null, data as any, { id: userProfile.id, name: userProfile.name });
        if (result.success) toast({ title: "Record Finalized", description: result.message, variant: 'success' });
        else toast({ title: "Registry Error", description: result.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
        setEditingDonation(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: Donation['status']) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    setIsSubmitting(true);
    try {
        const res = await bulkUpdateDonationStatusAction(selectedIds, newStatus);
        if (res.success) {
            toast({ title: "Batch Authentication Complete", description: res.message, variant: "success" });
            setSelectedIds([]);
        } else {
            toast({ title: "Batch Update Failed", description: res?.message || "Failed to modify records.", variant: "destructive" });
        }
    } finally {
        setIsBulkUpdating(false);
        setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!donationToDelete) return;
    setIsSubmitting(true);
    setIsDeleteDialogOpen(false);
    try {
        const result = await deleteDonationAction(donationToDelete);
        toast({ title: result.success ? "Record Erased" : "Deletion Failed", description: result.message, variant: result.success ? "success" : "destructive" });
    } finally {
        setIsSubmitting(false);
        setDonationToDelete(null);
    }
  };

  const handleImport = async (records: Partial<Donation>[]) => {
    if (!userProfile) return;
    setIsSubmitting(true);
    try {
        const res = await bulkImportDonationsAction(records, { id: userProfile.id, name: userProfile.name });
        if (res && res.success) toast({ title: 'Import Successful', description: res.message, variant: 'success' });
        else toast({ title: 'Import Denied', description: res?.message || "Check data integrity.", variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBulkMapDonors = async () => {
      if (selectedIds.length === 0 || !userProfile) return;
      setIsBulkUpdating(true);
      setIsSubmitting(true);
      try {
          const res = await bulkMapDonorsAction(selectedIds, { id: userProfile.id, name: userProfile.name });
          if (res.success) {
              toast({ title: "Identity Mapping Success", description: res.message, variant: "success" });
              setSelectedIds([]);
          } else {
              toast({ title: "Mapping Failed", description: res.message, variant: "destructive" });
          }
      } finally { setIsBulkUpdating(false); setIsSubmitting(false); }
  };

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

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (areDonationsLoading || isProfileLoading) return <SectionLoader label="Syncing Financial Hub..." description="Retrieving Cloud Donation Logs." />;

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-2">
                        <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9">
                            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                        </Button>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Donation Registry</h1>
                    <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Financial oversight of all inbound support, categorical allocation, and identity mapping.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-primary/5 shadow-sm">
                        <Button variant="ghost" size="sm" onClick={() => setIsImportOpen(true)} className="font-bold text-primary rounded-xl h-10 px-4 hover:bg-primary/5">
                            <UploadCloud className="mr-2 h-4 w-4 opacity-40" /> Import
                        </Button>
                    </div>
                    <Button onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <PlusCircle className="mr-2 h-4 w-4" /> Log Donation
                    </Button>
                </div>
            </div>

            <div className="bg-white/30 backdrop-blur-md p-1.5 rounded-[24px] border border-primary/5 shadow-sm inline-flex w-fit overflow-hidden">
                <div className="flex flex-nowrap">
                    {[
                        { label: 'Registry List', path: '/donations', icon: Activity },
                        { label: 'Financial Summary', path: '/donations/summary', icon: TrendingUp },
                        { label: 'Pending Audit', path: '/verifications?module=donations', icon: ShieldCheck },
                        { label: 'Donor Hub', path: '/donors', icon: Users },
                    ].map((tab) => (
                        <Link 
                            key={tab.path}
                            href={tab.path} 
                            className={cn(
                                "inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black tracking-widest transition-all duration-500",
                                pathname === tab.path ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-primary/60 hover:bg-primary/5 hover:text-primary"
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </Link>
                    ))}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up">
            <StatCard title="Total Volume" count={stats.total} description="Authorized and Pending Logs" icon={Activity} delay="100ms" onClick={() => { setSearchTerm(''); setStatusFilter([]); setIdentityFilter([]); setMethodFilter([]); setCategoryFilter([]); }} />
            <StatCard title="Verified Liquidity" count={stats.totalAmount.toLocaleString('en-IN')} description="Finalized Fund Reserves" icon={IndianRupee} delay="150ms" isCurrency onClick={() => setStatusFilter(['Verified'])} />
            <StatCard title="Audit Pipeline" count={stats.pendingAmount.toLocaleString('en-IN')} description="Funds Awaiting Clearance" icon={Hourglass} delay="200ms" isCurrency onClick={() => setStatusFilter(['Pending'])} />
            <StatCard title="Identity Gap" count={stats.unlinked} description="Awaiting Profile Mapping" icon={AlertCircle} delay="250ms" colorClass={stats.unlinked > 0 ? "bg-amber-500/[0.03] border-amber-500/10" : ""} onClick={() => setIdentityFilter(['Unlinked'])} />
        </div>

        <Card className="rounded-[32px] border border-primary/5 bg-white/30 backdrop-blur-md overflow-hidden shadow-none animate-fade-in-zoom" style={{ animationDelay: '400ms' }}>
            <CardHeader className="p-4 sm:p-6 border-b bg-white/80 backdrop-blur-md sticky top-[73px] z-20">
                <ScrollArea className="w-full">
                    <div className="flex flex-nowrap gap-4 pb-3">
                        <div className="relative w-[300px] shrink-0">
                            <Input 
                                placeholder="Search Donor, Phone, ID..." 
                                value={searchTerm} 
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                                className="pl-11 h-11 text-sm border-primary/10 focus-visible:ring-primary font-bold text-primary rounded-2xl bg-white shadow-sm"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30">
                                <Search className="h-4 w-4" />
                            </div>
                        </div>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-[240px] shrink-0 justify-start h-11 text-sm border-primary/10 text-primary font-bold rounded-2xl bg-white shadow-sm transition-all hover:border-primary/30", !dateRange && "opacity-60")}>
                                    <CalendarIcon className="mr-3 h-4 w-4 opacity-40" />
                                    {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</> : format(dateRange.from, "LLL dd, y")) : "Log Range"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none overflow-hidden" align="start">
                                <Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); setCurrentPage(1); }} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>

                        <MultiSelectFilter title="Status" options={['Verified', 'Pending', 'Canceled']} selected={statusFilter} onChange={setStatusFilter} />
                        <MultiSelectFilter title="Category" options={donationCategories} selected={categoryFilter} onChange={setCategoryFilter} />
                        <MultiSelectFilter title="Method" options={['Online Payment', 'Cash', 'Check', 'Other']} selected={methodFilter} onChange={setMethodFilter} />
                        <MultiSelectFilter title="Identity" options={['Linked', 'Unlinked']} selected={identityFilter} onChange={setIdentityFilter} />
                    </div>
                    <ScrollBar orientation="horizontal" className="h-1.5" />
                </ScrollArea>

                {selectedIds.length > 0 && (
                    <div className="mt-4 animate-fade-in-up w-full">
                        <div className="flex items-center justify-between gap-4 px-6 py-3 bg-primary/10 border border-primary/20 backdrop-blur-xl rounded-[20px] shadow-xl">
                            <div className="flex items-center gap-4 pr-6 border-r border-primary/10">
                                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg">
                                    {selectedIds.length}
                                </div>
                                <span className="text-xs font-black tracking-tight text-primary">Batch Financial Operations</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleBulkMapDonors} 
                                    className="bg-white/80 hover:bg-white text-primary font-black h-10 text-[10px] px-5 rounded-xl tracking-widest shadow-sm"
                                    disabled={isBulkUpdating}
                                >
                                    <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isBulkUpdating && "animate-spin")} /> Auto-Map Profiles
                                </Button>
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="secondary" size="sm" className="bg-white/80 hover:bg-white text-primary font-black h-10 text-[10px] px-5 rounded-xl tracking-widest shadow-sm" disabled={isBulkUpdating}>
                                            Authentication <ChevronDown className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56 rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                        <DropdownMenuItem onClick={() => handleBulkStatusChange('Verified')} className="font-bold text-xs p-3 rounded-xl">Verify Selection</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleBulkStatusChange('Pending')} className="font-bold text-xs p-3 rounded-xl">Revert to Pending</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="ml-auto">
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary/40 hover:text-primary hover:bg-white/50 rounded-xl transition-all" onClick={() => setSelectedIds([])}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full">
                    <div className={cn("hidden md:grid bg-primary/[0.02] border-b border-primary/5 text-[10px] font-black tracking-[0.15em] text-muted-foreground", donationGridClass)}>
                        <div className="flex justify-center">
                            <Checkbox 
                                checked={paginatedDonations.length > 0 && selectedIds.length === paginatedDonations.length} 
                                onCheckedChange={toggleSelectAll} 
                                className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary" 
                            />
                        </div>
                        <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                        <SortableHeader sortKey="donorName" sortConfig={sortConfig} handleSort={handleSort}>Donor Identity</SortableHeader>
                        <SortableHeader sortKey="amount" sortConfig={sortConfig} handleSort={handleSort} className="text-right">Net Sum (₹)</SortableHeader>
                        <SortableHeader sortKey="donationDate" sortConfig={sortConfig} handleSort={handleSort} className="text-center">Log Date</SortableHeader>
                        <div className="text-center font-black tracking-[0.1em] text-[10px]">Method</div>
                        <div className="text-center font-black tracking-[0.1em] text-[10px]">Classification</div>
                        <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort} className="text-center">State</SortableHeader>
                        <div className="text-right pr-6 font-black tracking-[0.1em] text-[10px]">Audit</div>
                    </div>
                    <div className="w-full">
                        {paginatedDonations.map((d, i) => (
                            <DonationRow 
                                key={d.id} 
                                donation={d} 
                                isSelected={selectedIds.includes(d.id)}
                                onToggle={() => toggleSelect(d.id)}
                                index={(currentPage - 1) * itemsPerPage + i + 1} 
                                handleEdit={() => { setEditingDonation(d); setIsFormOpen(true); }} 
                                handleDeleteClick={() => { setDonationToDelete(d.id); setIsDeleteDialogOpen(true); }} 
                                handleViewImage={(url) => { setImageToView(url); setZoom(1); setRotation(0); setIsImageViewerOpen(true); }}
                            />
                        ))}
                        <div className={cn("bg-primary/[0.03] border-t border-primary/5 py-6 px-10", donationGridClass)}>
                            <div />
                            <div />
                            <div className="text-right font-black text-muted-foreground tracking-widest text-[10px]">Page Liquidity</div>
                            <div className="text-right font-black font-mono text-primary text-lg tracking-tighter">₹{paginatedDonations.reduce((sum, d) => sum + d.amount, 0).toLocaleString('en-IN')}</div>
                            <div className="col-span-3" />
                            <div className="text-right pr-6 flex flex-col items-end">
                                <span className="text-[9px] font-black text-muted-foreground opacity-40">Registry Total</span>
                                <span className="text-sm font-black text-primary tracking-tighter">₹{filteredTotalAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center p-8 border-t bg-primary/[0.01]">
                    <div className="bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-primary/5 shadow-sm">
                        <p className="text-xs font-black text-primary tracking-tight">Registry Page <span className="text-primary">{currentPage}</span> <span className="opacity-30">/ {totalPages}</span></p>
                    </div>
                    <div className="flex gap-3">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 1} 
                            className="font-black text-[10px] tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm"
                        >
                            Prev
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === totalPages} 
                            className="font-black text-[10px] tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm"
                        >
                            Next
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setEditingDonation(null); }}>
            <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 overflow-hidden rounded-[32px] border-primary/10 shadow-2xl gap-0">
                <DialogHeader className="px-8 py-6 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-2xl font-black text-primary tracking-tighter">Manage Donation Log</DialogTitle>
                        <p className="text-xs font-bold opacity-60 text-primary">Authenticate financial records and initiative allocations.</p>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden relative">
                    <DonationForm donation={editingDonation} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} leads={allLeads || []} campaigns={allCampaigns || []} defaultLinkId={'unlinked'} />
                </div>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-[32px] border-primary/10 shadow-2xl p-8">
                <AlertDialogHeader>
                    <AlertDialogTitle className="font-black text-destructive text-2xl tracking-tighter">Confirm Erasure?</AlertDialogTitle>
                    <AlertDialogDescription className="font-bold opacity-70 text-primary mt-2">
                        You are about to permanently delete this financial record from the organization cloud registry. This action is irreversible.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="font-bold rounded-xl h-11 px-6 border-primary/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white font-black rounded-xl h-11 px-8 shadow-xl shadow-destructive/20 active:scale-95 transition-all">
                        Erase Record
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {isImageViewerOpen && (
            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl h-[90vh] p-0 bg-black/95 border-none rounded-none overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center p-4 bg-white/5 border-b border-white/10 shrink-0">
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="text-white hover:bg-white/10"><ZoomIn className="h-5 w-5"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="text-white hover:bg-white/10"><ZoomOut className="h-5 w-5"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => setRotation(r => r + 90)} className="text-white hover:bg-white/10"><RotateCw className="h-5 w-5"/></Button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsImageViewerOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5"/></Button>
                    </div>
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
                        <div className="relative transition-all duration-300 ease-out flex items-center justify-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}>
                            <img src={imageToView!} alt="Attachment" className="max-w-full max-h-[70vh] shadow-2xl object-contain"/>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )}
    </main>
  );
}

export default function DonationPage() {
    return (
        <Suspense fallback={<BrandedLoader message="Initializing Financial Hub..." />}>
            <DonationListContent />
        </Suspense>
    );
}
