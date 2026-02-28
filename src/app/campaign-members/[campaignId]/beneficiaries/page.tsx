'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
    useFirestore, 
    useStorage, 
    useAuth, 
    useMemoFirebase, 
    useCollection, 
    useDoc, 
    collection, 
    doc, 
    serverTimestamp, 
    writeBatch, 
    setDoc, 
    DocumentReference 
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Campaign, RationItem, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
    CheckCircle2, 
    Hourglass, 
    XCircle, 
    Info, 
    ChevronsUpDown, 
    ChevronDown, 
    ChevronUp, 
    BadgeCheck, 
    Users, 
    UserCheck, 
    FileUp, 
    Search,
    AlertCircle,
    CopyPlus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { BeneficiaryImportDialog, type ProcessedRecord } from '@/components/beneficiary-import-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BrandedLoader } from '@/components/branded-loader';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

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

const StatCard = ({ title, count, description, icon: Icon, colorClass, delay }: { title: string, count: number, description: string, icon: any, colorClass: string, delay: string }) => (
    <Card className={cn("animate-fade-in-up shadow-sm", delay)} style={{ animationFillMode: 'backwards' }}>
        <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-[10px] text-muted-foreground">{description}</p>
            </div>
            <div className={cn("p-2 rounded-full bg-muted", colorClass)}>
                <Icon className="h-4 w-4" />
            </div>
        </CardContent>
    </Card>
);

const BeneficiaryRow = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle }: { beneficiary: Beneficiary, index: number, canUpdate?: boolean, canDelete?: boolean, onView: (b: Beneficiary) => void, onEdit: (b: Beneficiary) => void, onDelete: (id: string) => void, onStatusChange: (b: Beneficiary, s: BeneficiaryStatus) => void, onZakatToggle: (b: Beneficiary) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <React.Fragment>
            <TableRow className="bg-background hover:bg-accent/50 cursor-pointer border-none" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[60px]">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                        <span className="text-xs text-muted-foreground">{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">
                    <div className="text-sm">{beneficiary.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{beneficiary.phone || 'N/A'}</div>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.status === 'Given' ? 'success' : beneficiary.status === 'Verified' ? 'success' : beneficiary.status === 'Pending' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {beneficiary.status}
                    </Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'} className="text-[10px]">
                        {beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm">₹{(beneficiary.zakatAllocation || 0).toFixed(2)}</TableCell>
                <TableCell className="text-xs">{beneficiary.referralBy || 'Self'}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuSeparator />}
                            {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" /> Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal><DropdownMenuSubContent><DropdownMenuRadioGroup value={beneficiary.status} onValueChange={(s) => onStatusChange(beneficiary, s as any)}><DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem><DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem><DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem><DropdownMenuRadioItem value="Hold">Hold</DropdownMenuRadioItem><DropdownMenuRadioItem value="Need More Details">Need Details</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}
                            {canUpdate && (
                                <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>{beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{beneficiary.isEligibleForZakat ? 'Not Zakat Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>
                            )}
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/20 border-b">
                    <TableCell colSpan={8} className="p-4 pt-0">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs animate-fade-in-down">
                            <div className="space-y-2">
                                <div><p className="font-bold text-primary uppercase tracking-tighter">Address</p><p className="text-foreground/80 leading-relaxed">{beneficiary.address || 'N/A'}</p></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><p className="font-bold text-primary uppercase tracking-tighter">Family</p><p>Total: {beneficiary.members || 0}, Earning: {beneficiary.earningMembers || 0}</p></div>
                                    <div><p className="font-bold text-primary uppercase tracking-tighter">ID Proof</p><p>{beneficiary.idProofType || 'N/A'} - {beneficiary.idNumber || 'N/A'}</p></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><p className="font-bold text-primary uppercase tracking-tighter">Age</p><p>{beneficiary.age || 'N/A'}</p></div>
                                    <div><p className="font-bold text-primary uppercase tracking-tighter">Occupation</p><p>{beneficiary.occupation || 'N/A'}</p></div>
                                </div>
                                <div><p className="font-bold text-primary uppercase tracking-tighter">Date Added</p><p>{beneficiary.addedDate || 'N/A'}</p></div>
                            </div>
                            <div className="space-y-2">
                                <div><p className="font-bold text-primary uppercase tracking-tighter">Zakat Allocation</p><p className="font-mono font-bold">₹{(beneficiary.zakatAllocation || 0).toFixed(2)}</p></div>
                                <div><p className="font-bold text-primary uppercase tracking-tighter">Notes</p><p className="whitespace-pre-wrap italic">{beneficiary.notes || 'No notes.'}</p></div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = typeof params?.campaignId === "string" ? params.campaignId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, 'campaigns', campaignId, 'beneficiaries') : null, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.delete', false);

  const referralOptions = useMemo(() => {
    if (!beneficiaries) return [];
    const referrals = new Set(beneficiaries.map(b => b.referralBy || 'Self').filter(Boolean));
    return Array.from(referrals).sort();
  }, [beneficiaries]);

  const stats = useMemo(() => {
    if (!beneficiaries) return { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0, totalAmount: 0 };
    return beneficiaries.reduce((acc, b) => {
        acc.total++;
        acc.totalAmount += (b.kitAmount || 0);
        if (b.status === 'Pending') acc.pending++;
        else if (b.status === 'Verified') acc.verified++;
        else if (b.status === 'Given') acc.given++;
        else if (b.status === 'Hold') acc.hold++;
        else if (b.status === 'Need More Details') acc.needDetails++;
        return acc;
    }, { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0, totalAmount: 0 });
  }, [beneficiaries]);

  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleView = (b: Beneficiary) => { router.push(`/beneficiaries/${b.id}?redirect=${pathname}`); };
  const handleEdit = (b: Beneficiary) => { router.push(`/beneficiaries/${b.id}?redirect=${pathname}`); };
  const handleDeleteClick = (id: string) => { setBeneficiaryToDelete(id); setIsDeleteDialogOpen(true); };

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let items = beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               b.phone?.includes(searchTerm) || 
                               b.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               b.referralBy?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        const matchesReferral = referralFilter === 'All' || (b.referralBy || 'Self') === referralFilter;
        return matchesSearch && matchesStatus && matchesZakat && matchesReferral;
    });

    if (sortConfig) {
        items.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aVal = String(getNestedValue(a, sortConfig.key as string, '')).toLowerCase();
            const bVal = String(getNestedValue(b, sortConfig.key as string, '')).toLowerCase();
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }
    return items;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter, sortConfig]);

  const groupedBeneficiaries = useMemo(() => {
    const groups: Record<string, Beneficiary[]> = {};
    filteredBeneficiaries.forEach(b => {
        const group = b.referralBy || 'Self';
        if (!groups[group]) groups[group] = [];
        groups[group].push(b);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBeneficiaries]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !campaignId || !canUpdate) return;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    const updateData = { status: newStatus };
    setDoc(ref, updateData, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !campaignId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    setDoc(ref, { isEligibleForZakat: newZakatStatus }, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !campaignId || !userProfile || !campaign) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
    const campRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', masterRef.id);
    
    let idProofUrl = '';
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const resized = await new Promise<Blob>((res) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => res(b as Blob), 'blob'); });
        const fRef = storageRef(storage, `beneficiaries/${masterRef.id}/id_proof.png`);
        await uploadBytes(fRef, resized);
        idProofUrl = await getDownloadURL(fRef);
    }

    const { idProofFile, idProofDeleted, ...rest } = data;
    const fullData = { ...rest, id: masterRef.id, idProofUrl, addedDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), createdById: userProfile.id, createdByName: userProfile.name };
    const { status, kitAmount, zakatAllocation, ...masterData } = fullData;
    
    batch.set(masterRef, masterData, { merge: true });
    batch.set(campRef, fullData, { merge: true });
    batch.update(doc(firestore, 'campaigns', campaignId), { targetAmount: (campaign.targetAmount || 0) + (data.kitAmount || 0) });
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!campaign) return <p className="text-center mt-20">Campaign not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
        <h1 className="text-4xl font-bold text-primary tracking-tight">{campaign.name}</h1>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Summary</Link>
                    )}
                    {canReadRation && (
                        <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item Lists</Link>
                    )}
                    {canReadBeneficiaries && (
                        <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow")}>Beneficiary List</Link>
                    )}
                    {canReadDonations && (
                        <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Donations</Link>
                    )}
                </div>
            </ScrollArea>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-primary">Beneficiary List ({stats.total})</h2>
                <p className="text-sm text-muted-foreground">Total amount: <span className="font-bold text-foreground">₹{filteredBeneficiaries.reduce((sum, b) => sum + (b.kitAmount || 0), 0).toFixed(2)}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-2"><FileUp className="h-4 w-4"/> Import</Button>
                <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="gap-2"><CopyPlus className="h-4 w-4"/> Add Existing</Button>
                <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2"><PlusCircle className="h-4 w-4"/> Add New</Button>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Total" count={stats.total} description="All entries" icon={Users} colorClass="text-primary" delay="delay-0" />
            <StatCard title="Pending" count={stats.pending} description="Verification needed" icon={Hourglass} colorClass="text-amber-500" delay="delay-100" />
            <StatCard title="Verified" count={stats.verified} description="Confirmed" icon={UserCheck} colorClass="text-green-500" delay="delay-200" />
            <StatCard title="Given" count={stats.given} description="Assistance provided" icon={CheckCircle2} colorClass="text-emerald-600" delay="delay-300" />
            <StatCard title="Hold" count={stats.hold} description="Paused" icon={XCircle} colorClass="text-red-500" delay="delay-400" />
            <StatCard title="Need Info" count={stats.needDetails} description="More info" icon={Info} colorClass="text-blue-500" delay="delay-500" />
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-muted/10 p-4 rounded-xl border">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name, phone, referral..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Info</SelectItem></SelectContent></Select>
            <Select value={zakatFilter} onValueChange={setZakatFilter}><SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Zakat" /></SelectTrigger><SelectContent><SelectItem value="All">All Zakat</SelectItem><SelectItem value="Eligible">Eligible</SelectItem><SelectItem value="Not Eligible">Not Eligible</SelectItem></SelectContent></Select>
            <Select value={referralFilter} onValueChange={setReferralFilter}><SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Referral" /></SelectTrigger><SelectContent><SelectItem value="All">All Referrals</SelectItem>{referralOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
        </div>

        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[60px]">#</TableHead>
                            <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name & Phone</SortableHeader>
                            <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat" sortConfig={sortConfig} handleSort={handleSort}>Zakat</SortableHeader>
                            <TableHead className="text-right">Kit Amount</TableHead>
                            <TableHead className="text-right">Zakat Alloc.</TableHead>
                            <SortableHeader sortKey="referralBy" sortConfig={sortConfig} handleSort={handleSort}>Referral</SortableHeader>
                            <TableHead className="text-right pr-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedBeneficiaries.length > 0 ? (
                            <Accordion type="multiple" defaultValue={groupedBeneficiaries.map(([name]) => name)} className="w-full">
                                {groupedBeneficiaries.map(([groupName, groupItems], gIdx) => (
                                    <React.Fragment key={groupName}>
                                        <TableRow className="bg-muted/30 border-b hover:bg-muted/40">
                                            <TableCell colSpan={8} className="p-0">
                                                <AccordionItem value={groupName} className="border-none">
                                                    <AccordionTrigger className="px-4 py-2 hover:no-underline">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-primary" />
                                                            <span className="font-bold">{groupName} ({groupItems.length})</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="p-0">
                                                        {groupItems.map((b, i) => (
                                                            <BeneficiaryRow key={b.id} beneficiary={b} index={i + 1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} />
                                                        ))}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </Accordion>
                        ) : (
                            <TableRow><TableCell colSpan={8} className="text-center py-20 text-muted-foreground italic">No beneficiaries found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={campaignId} initiativeType="campaign" />
        <BeneficiaryImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} processedRecords={[]} onConfirm={() => {}} isImporting={false} />
        
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Remove from this campaign? Master record stays intact.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {}} className="bg-destructive text-white">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </main>
  );
}