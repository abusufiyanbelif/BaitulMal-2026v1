'use client';
import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSession } from '@/hooks/use-session';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, ShieldAlert, ArrowUp, ArrowDown, DatabaseZap, Loader2, Upload, Download, Eye, CheckCircle2, Hourglass, XCircle, Info, ChevronsUpDown, Check, X, ChevronDown, ChevronUp, BadgeCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { deleteBeneficiaryAction, syncMasterBeneficiaryListAction, updateMasterBeneficiaryAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getNestedValue } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
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

function BeneficiaryRow({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle }: {
    beneficiary: Beneficiary;
    index: number;
    canUpdate?: boolean;
    canDelete?: boolean;
    onView: (beneficiary: Beneficiary) => void;
    onEdit: (beneficiary: Beneficiary) => void;
    onDelete: (id: string) => void;
    onStatusChange: (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => void;
    onZakatToggle: (beneficiary: Beneficiary) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</p>
            <div className="text-sm font-medium pt-1">{value || 'N/A'}</div>
        </div>
    );
    
    return (
        <React.Fragment>
            <TableRow className="bg-background hover:bg-accent/50 data-[state=open]:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[100px]">
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-accent" data-state={isOpen ? 'open' : 'closed'}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span>{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">{beneficiary.name}</TableCell>
                <TableCell>{beneficiary.phone}</TableCell>
                <TableCell className="truncate max-w-xs">{beneficiary.address}</TableCell>
                <TableCell>
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'secondary' : 'outline'}>{beneficiary.status}</Badge>
                </TableCell>
                {(canUpdate || canDelete) && (
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuSeparator />}
                             {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ChevronsUpDown className="mr-2 h-4 w-4" />
                                        <span>Change Status</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                                value={beneficiary.status}
                                                onValueChange={(newStatus) => onStatusChange(beneficiary, newStatus as BeneficiaryStatus)}
                                            >
                                                <DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2"/>Pending</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2"/>Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2"/>Given</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Hold"><XCircle className="mr-2"/>Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details"><Info className="mr-2"/>Need More Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                             {canUpdate && (
                                <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>
                                    {beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    <span>{beneficiary.isEligibleForZakat ? 'Mark as Not Eligible' : 'Mark as Zakat Eligible'}</span>
                                </DropdownMenuItem>
                            )}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && (
                                <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                )}
            </TableRow>
             {isOpen && (
                 <TableRow className="bg-muted/20 hover:bg-muted/30">
                    <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="p-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 p-4">
                            <DetailItem label="Address" value={beneficiary.address} />
                            <DetailItem label="Age" value={beneficiary.age} />
                            <DetailItem label="Occupation" value={beneficiary.occupation} />
                            <DetailItem label="Family" value={`Total: ${beneficiary.members}, Earning: ${beneficiary.earningMembers}, M: ${beneficiary.male}, F: ${beneficiary.female}`} />
                            <DetailItem label="ID Proof" value={`${beneficiary.idProofType || 'N/A'} - ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Date Added" value={beneficiary.addedDate} />
                            {beneficiary.notes && <div className="sm:col-span-2 lg:col-span-3"><DetailItem label="Notes" value={<div className="whitespace-pre-wrap">{beneficiary.notes}</div>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
}

export default function BeneficiariesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState<string[]>([]);
  const [tempReferralFilter, setTempReferralFilter] = useState<string[]>([]);
  const [openReferralPopover, setOpenReferralPopover] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'beneficiaries');
  }, [firestore]);
  
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.delete', false);
  const canRead = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.beneficiaries.read', false);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    const referrals = new Set(beneficiaries.map(b => b.referralBy).filter(Boolean) as string[]);
    return [...Array.from(referrals).sort()];
  }, [beneficiaries]);

  const areAllReferralsSelected = useMemo(() => uniqueReferrals.length > 0 && tempReferralFilter.length === uniqueReferrals.length, [tempReferralFilter, uniqueReferrals]);

  const handleAdd = () => {
    if (!canCreate) return;
    router.push('/beneficiaries/create');
  };
  
  const handleView = (beneficiary: Beneficiary) => {
    router.push(`/beneficiaries/${beneficiary.id}`);
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    if (!canUpdate) return;
    router.push(`/beneficiaries/${beneficiary.id}`);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setBeneficiaryToDelete(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleSyncMasterList = async () => {
    setIsSyncing(true);
    toast({ title: 'Syncing Master List...', description: 'Please wait while we check all campaigns and leads for new beneficiaries.' });
    
    const result = await syncMasterBeneficiaryListAction();
    
    if (result.success) {
      toast({ title: 'Sync Complete', description: result.message, variant: 'success' });
    } else {
      toast({ title: 'Sync Failed', description: result.message, variant: 'destructive' });
    }

    setIsSyncing(false);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !canDelete) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to delete beneficiaries.', variant: 'destructive'});
        return;
    };
    
    setIsDeleteDialogOpen(false);

    const result = await deleteBeneficiaryAction(beneficiaryToDelete);

    if (result.success) {
        toast({ title: 'Beneficiary Deleted', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
    setBeneficiaryToDelete(null);
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let sortableItems = [...beneficiaries];

    // Filtering
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(b => b.status === statusFilter);
    }
    if (zakatFilter !== 'All') {
        const isEligible = zakatFilter === 'Eligible';
        sortableItems = sortableItems.filter(b => !!b.isEligibleForZakat === isEligible);
    }
    if (referralFilter.length > 0) {
        sortableItems = sortableItems.filter(b => b.referralBy && referralFilter.includes(b.referralBy));
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => 
            (b.name || '').toLowerCase().includes(lowercasedTerm) ||
            (b.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (b.address || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    // Sorting
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aValue = a[sortConfig.key as keyof Beneficiary] ?? '';
            const bValue = b[sortConfig.key as keyof Beneficiary] ?? '';
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
             if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                 return sortConfig.direction === 'ascending' ? (aValue === bValue ? 0 : aValue ? -1 : 1) : (aValue === bValue ? 0 : aValue ? 1 : -1);
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
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedBeneficiaries.length / itemsPerPage);
  const paginatedBeneficiaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedBeneficiaries, currentPage, itemsPerPage]);

  const isLoading = areBeneficiariesLoading || isProfileLoading;
  
    const handleStatusChange = async (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
        if (!canUpdate || !userProfile) return;
        const result = await updateMasterBeneficiaryAction(
            beneficiary.id,
            { status: newStatus },
            { id: userProfile.id, name: userProfile.name }
        );
        if (result.success) {
            toast({
                title: 'Status Updated',
                description: `${beneficiary.name}'s status has been set to ${newStatus}.`,
                variant: 'success',
            });
        } else {
            toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
        }
    };
  
    const handleZakatToggle = async (beneficiary: Beneficiary) => {
        if (!canUpdate || !userProfile) return;
        const newZakatStatus = !beneficiary.isEligibleForZakat;

        const updateData: Partial<Beneficiary> = { isEligibleForZakat: newZakatStatus };
        
        const result = await updateMasterBeneficiaryAction(
            beneficiary.id,
            updateData,
            { id: userProfile.id, name: userProfile.name }
        );
        if (result.success) {
            toast({
                title: 'Zakat Status Updated',
                description: `${beneficiary.name} is now ${newZakatStatus ? 'Eligible' : 'Not Eligible'} for Zakat.`,
                variant: 'success',
            });
        } else {
            toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
        }
    };
  
  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                <CardContent>
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        </main>
    )
  }
  
  if (!canRead) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to view beneficiaries.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
          <Button variant="outline" asChild className="transition-transform active:scale-95">
              <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
              </Link>
          </Button>
      </div>
      
      <div className="border-b mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2">
                <Link href="/beneficiaries/summary" className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    pathname === '/beneficiaries/summary' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                )}>Summary</Link>
                <Link href="/beneficiaries" className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    pathname === '/beneficiaries' ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "text-muted-foreground"
                )}>Beneficiary List</Link>
            </div>
        </ScrollArea>
      </div>

      <Card className="animate-fade-in-zoom shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
                <CardTitle>Master Beneficiary List ({filteredAndSortedBeneficiaries.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Input 
                        placeholder="Search name, phone, address..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="max-w-sm"
                    />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[150px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                            <SelectItem value="Need More Details">Need More Details</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={zakatFilter} onValueChange={(value) => { setZakatFilter(value); setCurrentPage(1); }}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by Zakat" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Zakat Status</SelectItem>
                          <SelectItem value="Eligible">Eligible</SelectItem>
                          <SelectItem value="Not Eligible">Not Eligible</SelectItem>
                      </SelectContent>
                  </Select>
                    <Popover open={openReferralPopover} onOpenChange={(isOpen) => {
                      setOpenReferralPopover(isOpen);
                      if (isOpen) {
                          setTempReferralFilter(referralFilter);
                      }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openReferralPopover}
                        className="w-auto md:w-[250px] justify-between"
                      >
                        <span className="truncate">
                          {referralFilter.length > 0
                            ? `${referralFilter.length} referral(s) selected`
                            : "Filter by referral..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0 animate-fade-in-zoom">
                      <Command>
                        <CommandInput placeholder="Search referrals..." />
                        <CommandList>
                          <CommandEmpty>No referral found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => {
                                    if (areAllReferralsSelected) {
                                        setTempReferralFilter([]);
                                    } else {
                                        setTempReferralFilter([...uniqueReferrals]);
                                    }
                                }}
                            >
                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", areAllReferralsSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                  <Check className={cn("h-4 w-4")} />
                                </div>
                                Select All
                            </CommandItem>
                            <Separator className="my-1" />
                            {uniqueReferrals.map((referral) => (
                              <CommandItem
                                key={referral}
                                value={referral}
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => {
                                  setTempReferralFilter(prev => {
                                      const selected = prev.includes(referral);
                                      if (selected) {
                                          return prev.filter((r) => r !== referral);
                                      } else {
                                          return [...prev, referral];
                                      }
                                  });
                                }}
                              >
                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", tempReferralFilter.includes(referral) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                    <Check className={cn("h-4 w-4")} />
                                </div>
                                {referral}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                       <div className="p-2 border-t flex justify-between items-center">
                            <Button variant="ghost" size="sm" onClick={() => {
                                setTempReferralFilter([]);
                                setReferralFilter([]);
                                setOpenReferralPopover(false);
                            }}>Reset</Button>
                            <Button size="sm" onClick={() => {
                                setReferralFilter(tempReferralFilter);
                                setOpenReferralPopover(false);
                            }}>Apply</Button>
                        </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {referralFilter.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1 items-center animate-fade-in-up">
                      {referralFilter.map((referral) => (
                          <Badge
                              key={referral}
                              variant="secondary"
                              className="flex items-center gap-1"
                          >
                              {referral}
                              <button
                                  type="button"
                                  aria-label={`Remove ${referral} filter`}
                                  onClick={() => setReferralFilter(referralFilter.filter((r) => r !== referral))}
                                  className="ml-1 rounded-full p-0.5 hover:bg-background/50 focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                  <X className="h-3 w-3" />
                              </button>
                          </Badge>
                      ))}
                       <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto py-0.5 px-1 text-xs text-muted-foreground hover:bg-transparent"
                          onClick={() => setReferralFilter([])}
                      >
                          Clear all
                      </Button>
                  </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={handleSyncMasterList} disabled={isSyncing || areBeneficiariesLoading} variant="outline" className="transition-transform active:scale-95">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                    Sync Master List
                </Button>
                {canCreate && (
                    <Button onClick={handleAdd} className="transition-transform active:scale-95">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Beneficiary
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                          <SortableHeader sortKey="srNo" className="w-[100px]" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                          <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                          <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Phone</SortableHeader>
                          <SortableHeader sortKey="address" sortConfig={sortConfig} handleSort={handleSort}>Address</SortableHeader>
                           <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                          <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                          {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {areBeneficiariesLoading ? (
                          [...Array(10)].map((_, i) => (
                              <TableRow key={`skeleton-${i}`}>
                                  <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  {(canUpdate || canDelete) && <TableCell><Skeleton className="h-5 w-10 ml-auto" /></TableCell>}
                              </TableRow>
                          ))
                      ) : paginatedBeneficiaries.length > 0 ? (
                          paginatedBeneficiaries.map((beneficiary, index) => (
                            <BeneficiaryRow
                                key={beneficiary.id}
                                beneficiary={beneficiary}
                                index={(currentPage - 1) * itemsPerPage + index + 1}
                                canUpdate={canUpdate}
                                canDelete={canDelete}
                                onView={handleView}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                                onStatusChange={handleStatusChange}
                                onZakatToggle={handleZakatToggle}
                            />
                      ))
                      ) : (
                      <TableRow>
                          <TableCell colSpan={canUpdate || canDelete ? 7 : 6} className="text-center h-24 text-muted-foreground">
                              No beneficiaries found matching your criteria.
                          </TableCell>
                      </TableRow>
                      )}
                  </TableBody>
              </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                  Showing {paginatedBeneficiaries.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedBeneficiaries.length)} of {filteredAndSortedBeneficiaries.length} beneficiaries
              </p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="animate-fade-in-zoom">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the beneficiary from the master list AND remove them from all campaigns and leads they are associated with.
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
    </main>
  );
}
