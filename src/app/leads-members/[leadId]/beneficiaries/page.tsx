'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { 
    useFirestore, 
    useStorage, 
    useMemoFirebase, 
    useCollection, 
    useDoc, 
    collection, 
    doc, 
    getDoc,
    serverTimestamp, 
    writeBatch, 
    updateDoc,
    deleteDoc,
    type DocumentReference 
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    ArrowLeft, 
    PlusCircle, 
    Eye, 
    Search,
    CopyPlus,
    MoreHorizontal,
    ChevronDown,
    Loader2,
    Trash2,
    Edit,
    Hourglass,
    CheckCircle2,
    ChevronsUpDown,
    Coins,
    XCircle,
    Filter,
    Check,
    UploadCloud,
    Download,
    Users,
    X,
    Info,
    CheckSquare,
    ClipboardCheck
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction, bulkImportBeneficiariesAction, bulkUpdateInitiativeBeneficiaryStatusAction, bulkUpdateBeneficiaryVettingAction, bulkUpdateMasterZakatAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BeneficiaryImportDialog } from '@/components/beneficiary-import-dialog';

const gridClass = "grid grid-cols-[40px_40px_50px_200px_120px_140px_140px_100px_120_120px_150px_60px] items-center gap-4 px-4 py-3 min-w-[1300px]";

function StatCard({ title, count, description, icon: Icon, colorClass, delay }: { title: string, count: number, description: string, icon: any, colorClass?: string, delay: string }) {
    return (
        <Card className={cn("flex flex-col p-4 bg-white border-primary/10 shadow-sm animate-fade-in-up transition-all", colorClass)} style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tight">{title}</p>
                    <p className="text-2xl font-black text-primary tracking-tight">{count}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="text-[10px] font-medium text-muted-foreground mt-auto">{description}</p>
        </Card>
    );
}

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const leadId = typeof params?.leadId === "string" ? params.leadId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, 'leads', leadId, 'beneficiaries') : null, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const itemsPerPage = 15;

  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);

  const itemLabelSuffix = lead?.category === 'Ration Kit' ? 'Kit' : 'Item';

  const availableCategories = useMemo(() => {
    if (!lead?.itemCategories) return [];
    return lead.itemCategories;
  }, [lead]);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    const sources = new Set<string>();
    beneficiaries.forEach(b => {
        if (b.referralBy?.trim()) sources.add(b.referralBy.trim());
    });
    return Array.from(sources).sort();
  }, [beneficiaries]);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm) || b.address?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        const matchesReferral = selectedReferrals.length === 0 || (b.referralBy && selectedReferrals.includes(b.referralBy.trim()));
        
        return matchesSearch && matchesStatus && matchesZakat && matchesReferral;
    });
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, selectedReferrals]);

  const stats = useMemo(() => {
      const data = filteredBeneficiaries;
      return {
          total: data.length,
          pending: data.filter(b => b.status === 'Pending').length,
          verified: data.filter(b => b.verificationStatus === 'Verified').length,
          given: data.filter(b => b.status === 'Given').length,
          hold: data.filter(b => b.verificationStatus === 'Hold').length,
          needDetails: data.filter(b => b.verificationStatus === 'Need More Details').length,
          totalAmount: data.reduce((sum, b) => sum + (b.kitAmount || 0), 0)
      };
  }, [filteredBeneficiaries]);

  const beneficiariesByCategory = useMemo(() => {
    const groups: Record<string, Beneficiary[]> = {};
    if (availableCategories.length === 0 || (availableCategories.length === 1 && availableCategories[0].id === 'general')) {
        groups['general'] = filteredBeneficiaries;
    } else {
        availableCategories.forEach(cat => {
            groups[cat.id] = filteredBeneficiaries.filter(b => b.itemCategoryId === cat.id);
        });
        const uncategorized = filteredBeneficiaries.filter(b => !b.itemCategoryId || !availableCategories.find(c => c.id === b.itemCategoryId));
        if (uncategorized.length > 0) groups['uncategorized'] = uncategorized;
    }
    return groups;
  }, [filteredBeneficiaries, availableCategories]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReferral = (referral: string) => {
    setSelectedReferrals(prev => prev.includes(referral) ? prev.filter(r => r !== referral) : [...prev, referral]);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(filteredBeneficiaries.map(b => b.id));
    } else {
        setSelectedIds([]);
    }
  };

  const toggleSelectAllForCategory = (catId: string, checked: boolean) => {
    const categoryIds = beneficiariesByCategory[catId]?.map(b => b.id) || [];
    if (checked) {
        setSelectedIds(prev => Array.from(new Set([...prev, ...categoryIds])));
    } else {
        setSelectedIds(prev => prev.filter(id => !categoryIds.includes(id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDisbursementChange = async (newStatus: Beneficiary['status']) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateInitiativeBeneficiaryStatusAction('lead', leadId, selectedIds, newStatus);
    if (res && res.success) {
        toast({ title: "Updated", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Failed", description: res?.message || "Operation failed.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleBulkVerificationChange = async (newStatus: Beneficiary['status']) => {
    if (!userProfile || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateBeneficiaryVettingAction(selectedIds, newStatus, { id: userProfile.id, name: userProfile.name }, { type: 'lead', id: leadId });
    if (res && res.success) {
        toast({ title: "Vetting Updated", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Failed", description: res?.message || "Operation failed.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleBulkZakatChange = async (isEligible: boolean) => {
    if (!userProfile || selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const res = await bulkUpdateMasterZakatAction(selectedIds, isEligible, { id: userProfile.id, name: userProfile.name });
    if (res && res.success) {
        toast({ title: "Zakat Updated", description: res.message, variant: "success" });
        setSelectedIds([]);
    } else {
        toast({ title: "Failed", description: res?.message || "Operation failed.", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: any) => {
    if (!firestore || !leadId || !canUpdate) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { status: newStatus }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleVerificationChange = (beneficiary: Beneficiary, newStatus: any) => {
    if (!userProfile || !canUpdate || !firestore || !leadId) return;
    updateMasterBeneficiaryAction(beneficiary.id, { status: newStatus }, { id: userProfile.id, name: userProfile.name });
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { verificationStatus: newStatus }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { verificationStatus: newStatus } })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !leadId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { isEligibleForZakat: newZakatStatus }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
    toast({ title: newZakatStatus ? 'Marked Eligible' : 'Marked Ineligible', variant: 'success' });
  };

  const handleRemoveFromInitiative = (beneficiaryId: string) => {
    if (!firestore || !leadId || !canUpdate) return;
    if (!confirm('Are You Certain?')) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiaryId);
    deleteDoc(ref).then(() => {
        toast({ title: 'Removed', variant: 'success' });
    }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' })));
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !leadId || !userProfile || !lead) { setIsSubmitting(false); return; }
    
    try {
        const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : editingBeneficiary?.id;
        const batch = writeBatch(firestore);
        const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
        const leadRefSub = doc(firestore, 'leads', leadId, 'beneficiaries', masterRef.id);
        
        let masterVerificationStatus: any = 'Pending';
        if (masterId) {
            const masterSnap = await getDoc(masterRef);
            if (masterSnap.exists()) masterVerificationStatus = masterSnap.data().status || 'Pending';
        }
        
        let idProofUrl = editingBeneficiary?.idProofUrl || '';
        const fileList = data.idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
            const fRef = storageRef(storage, `beneficiaries/${masterRef.id}/id_proof.png`);
            await uploadBytes(fRef, resizedBlob);
            idProofUrl = await getDownloadURL(fRef);
        }
        
        const { idProofFile, idProofDeleted, ...rest } = data;
        const fullData = { ...rest, id: masterRef.id, idProofUrl, verificationStatus: masterVerificationStatus, addedDate: editingBeneficiary?.addedDate || new Date().toISOString().split('T')[0], createdAt: editingBeneficiary ? (editingBeneficiary as any).createdAt : serverTimestamp(), createdById: editingBeneficiary ? (editingBeneficiary as any).createdById : userProfile.id, createdByName: editingBeneficiary ? (editingBeneficiary as any).createdByName : userProfile.name };
        const { status, kitAmount, zakatAllocation, ...masterData } = fullData;
        const masterStatusToSave = status === 'Given' ? 'Verified' : status;
        
        batch.set(masterRef, { ...masterData, status: masterStatusToSave }, { merge: true });
        batch.set(leadRefSub, fullData, { merge: true });
        
        if (!editingBeneficiary) {
            batch.update(doc(firestore, 'leads', leadId), { targetAmount: (lead.targetAmount || 0) + (data.kitAmount || 0) });
        }
        
        await batch.commit();
        toast({ title: 'Success', variant: 'success' });
        setIsFormOpen(false);
        setEditingBeneficiary(null);
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'lead beneficiaries', operation: 'create' }));
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImport = async (records: Partial<Beneficiary>[]) => {
    if (!userProfile) return;
    const res = await bulkImportBeneficiariesAction(records, { id: userProfile.id, name: userProfile.name }, { type: 'lead', id: leadId });
    if (res && res.success) toast({ title: 'Import Complete', description: res.message, variant: 'success' });
    else toast({ title: 'Import Failed', description: res?.message || "Import failed.", variant: 'destructive' });
  };

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!lead) return <p className="text-center mt-20 text-primary font-bold">Lead Not Found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative">
        <div className="mb-4">
            <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                <Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Leads</Link>
            </Button>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">{lead.name}</h1>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item list</Link>
                    <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary list</Link>
                    <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-primary tracking-tight">Beneficiary List ({beneficiaries?.length || 0})</h2>
            <p className="text-sm font-bold text-muted-foreground opacity-70">Calculated Requirement: <span className="font-mono text-primary">₹{stats.totalAmount.toLocaleString('en-IN')}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { if(beneficiaries) { const headers = ['Name', 'Phone', 'Vetting', 'Disbursement', 'Amount']; const rows = beneficiaries.map(b => [b.name, b.phone || 'N/A', b.verificationStatus || 'Pending', b.status || 'Pending', b.kitAmount || 0]); const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n'); const link = document.createElement('a'); link.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`; link.download = `beneficiaries_lead_${leadId}.csv`; link.click(); } }} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
              <Download className="mr-2 h-4 w-4"/> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
              <UploadCloud className="mr-2 h-4 w-4"/> Import Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="font-normal border-primary/10 text-primary bg-white hover:bg-primary/5 active:scale-95 transition-transform">
              <CopyPlus className="mr-2 h-4 w-4"/> Select From Master
            </Button>
            <Button size="sm" onClick={() => { setEditingBeneficiary(null); setIsFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-bold active:scale-95 transition-transform shadow-md rounded-[12px]">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Total" count={stats.total} description="All Recipients" icon={Users} delay="100ms" />
            <StatCard title="Pending" count={stats.pending} description="Awaiting Support" icon={Hourglass} delay="150ms" />
            <StatCard title="Verified" count={stats.verified} description="Assistance Secured" icon={CheckCircle2} delay="200ms" />
            <StatCard title="Given" count={stats.given} description="Assistance Disbursed" icon={CheckCircle2} delay="250ms" colorClass="border-primary/10 bg-primary/5" />
            <StatCard title="Hold" count={stats.hold} description="Suspended Status" icon={XCircle} delay="300ms" />
            <StatCard title="Need Details" count={stats.needDetails} description="Review Required" icon={Info} delay="350ms" />
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
          <div className="relative flex-1 min-w-[300px]">
            <Input 
                placeholder="Search Name, Phone, Address..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 pr-10 h-10 text-sm border-primary/10 focus-visible:ring-primary font-normal text-primary rounded-[12px]" 
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50">
                <Search className="h-4 w-4" />
            </div>
          </div>

          <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[220px] justify-between h-10 text-sm border-primary/10 text-primary font-bold rounded-[12px] bg-white">
                        <div className="flex items-center gap-2 truncate">
                            <Filter className="h-3.5 w-3.5 opacity-40 shrink-0" />
                            <span className="truncate">
                                {selectedReferrals.length === 0 ? "All Referral Sources" : `${selectedReferrals.length} Selected`}
                            </span>
                        </div>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 rounded-[12px] shadow-dropdown border-primary/10" align="start">
                    <Command>
                        <CommandInput placeholder="Search Referrals..." className="h-9 font-normal" />
                        <CommandList>
                            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground font-normal">No source found.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem onSelect={() => setSelectedReferrals([])} className="font-bold text-xs">
                                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedReferrals.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                        {selectedReferrals.length === 0 && <Check className="h-3 w-3" />}
                                    </div>
                                    <span>Show All Sources</span>
                                </CommandItem>
                                {uniqueReferrals.map((source) => (
                                    <CommandItem key={source} onSelect={() => toggleReferral(source)} className="font-normal text-xs">
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedReferrals.includes(source) ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                            {selectedReferrals.includes(source) && <Check className="h-3 w-3" />}
                                        </div>
                                        <span className="truncate">{source}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm border-primary/10 text-primary bg-white rounded-[12px] font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
              <SelectItem value="All" className="font-normal">All Statuses</SelectItem>
              <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
              <SelectItem value="Verified" className="font-normal">Verified</SelectItem>
              <SelectItem value="Given" className="font-normal">Given (Completed)</SelectItem>
              <SelectItem value="Hold" className="font-normal">Hold</SelectItem>
              <SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm border-primary/10 text-primary bg-white rounded-[12px] font-bold"><SelectValue placeholder="All Zakat Status" /></SelectTrigger>
            <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
              <SelectItem value="All" className="font-normal">All Zakat Status</SelectItem>
              <SelectItem value="Eligible" className="font-normal">Eligible</SelectItem>
              <SelectItem value="Not Eligible" className="font-normal">Not Eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Simplified Sticky Action Hub */}
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
                                    Distribution
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-dropdown border-primary/10">
                                <DropdownMenuItem onClick={() => handleBulkDisbursementChange('Given')} className="font-normal">Mark Given</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkDisbursementChange('Verified')} className="font-normal">Mark Secured</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkDisbursementChange('Pending')} className="font-normal">Mark Pending</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                    Vetting
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-dropdown border-primary/10">
                                <DropdownMenuItem onClick={() => handleBulkVerificationChange('Verified')} className="font-normal">Mark Verified</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkVerificationChange('Pending')} className="font-normal">Mark Pending</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkVerificationChange('Hold')} className="font-normal">Mark Hold</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkVerificationChange('Need More Details')} className="font-normal">More Details</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-bold h-8 text-xs px-3" disabled={isBulkUpdating}>
                                    Zakat
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-dropdown border-primary/10">
                                <DropdownMenuItem onClick={() => handleBulkZakatChange(true)} className="font-normal">Mark Eligible</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkZakatChange(false)} className="font-normal">Mark Ineligible</DropdownMenuItem>
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

        <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm transition-all hover:shadow-lg">
            <ScrollArea className="w-full">
                <div className={cn("bg-[hsl(var(--table-header-bg))] border-b border-primary/10 text-[11px] font-bold text-[hsl(var(--table-header-fg))] tracking-tight", gridClass)}>
                    <div className="flex justify-center">
                        <Checkbox 
                            checked={filteredBeneficiaries.length > 0 && selectedIds.length === filteredBeneficiaries.length}
                            onCheckedChange={toggleSelectAll}
                            className="border-primary/40 data-[state=checked]:bg-primary"
                        />
                    </div>
                    <div></div>
                    <div>Sr. No.</div>
                    <div>Name</div>
                    <div>Phone</div>
                    <div className="text-center">Verification Status</div>
                    <div className="text-center">Disbursement Status</div>
                    <div className="text-center">Zakat</div>
                    <div className="text-right">Kit Amount (₹)</div>
                    <div className="text-right">Zakat Allocation (₹)</div>
                    <div>Referred By</div>
                    <div className="text-right pr-4">Actions</div>
                </div>

                <div className="w-full max-h-[70vh]">
                    {Object.entries(beneficiariesByCategory).map(([catId, list]) => {
                        const cat = availableCategories.find(c => c.id === catId);
                        let categoryName = cat?.name || (catId === 'general' ? 'General Support' : 'Uncategorized');
                        if (lead.purpose === 'Relief' && lead.category === 'Ration Kit' && cat) {
                            if (cat.minMembers === 1 && cat.maxMembers === 1) categoryName = `Member (1)`;
                            else if (cat.minMembers !== undefined && cat.maxMembers !== undefined) categoryName = `Members (${cat.minMembers}-${cat.maxMembers})`;
                        }
                        const currentPage = currentPages[catId] || 1;
                        const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                        const isExpanded = openGroups[catId] !== false;
                        if (list.length === 0) return null;

                        return (
                            <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleGroup(catId)} className="w-full">
                                <CollapsibleTrigger className="w-full bg-primary/[0.02] px-4 py-3 text-[12px] font-bold text-primary flex items-center gap-2 border-b border-primary/10 hover:bg-primary/5 transition-colors">
                                    <ChevronDown className={cn("h-4 w-4 transition-transform text-primary", !isExpanded && "-rotate-90")} />
                                    {categoryName} ({list.length} Beneficiaries)
                                </CollapsibleTrigger>
                                <CollapsibleContent className="w-full">
                                    <div className={cn("bg-primary/[0.05] border-b border-primary/10 flex items-center gap-4 px-4 py-2 text-[10px] font-bold text-primary tracking-tight")}>
                                        <Checkbox 
                                            checked={list.length > 0 && list.every(b => selectedIds.includes(b.id))}
                                            onCheckedChange={(checked) => toggleSelectAllForCategory(catId, !!checked)}
                                            className="border-primary/40 data-[state=checked]:bg-primary"
                                        />
                                        <span>Select All In Category</span>
                                    </div>
                                    <Accordion type="single" collapsible className="w-full">
                                        {paginatedList.map((b, idx) => (
                                            <AccordionItem key={b.id} value={b.id} className="border-b border-primary/10 last:border-0 hover:bg-[hsl(var(--table-row-hover))] transition-colors">
                                                <div className={gridClass}>
                                                    <div className="flex justify-center">
                                                        <Checkbox 
                                                            checked={selectedIds.includes(b.id)}
                                                            onCheckedChange={() => toggleSelect(b.id)}
                                                            className="border-primary/40 data-[state=checked]:bg-primary"
                                                        />
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                                                <ChevronDown className="h-4 w-4 text-primary shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                            </div>
                                                        </AccordionTrigger>
                                                    </div>
                                                    <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                                    <div className="font-bold text-sm text-primary truncate">{b.name}</div>
                                                    <div className="font-mono text-xs opacity-60">{b.phone || 'N/A'}</div>
                                                    <div className="text-center">
                                                        <Badge variant={b.verificationStatus === 'Verified' ? 'eligible' : 'outline'} className="text-[10px] font-bold">
                                                            {b.verificationStatus || 'Pending'}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-center">
                                                        <Badge 
                                                            variant={b.status === 'Given' ? 'eligible' : b.status === 'Verified' ? 'active' : 'outline'} 
                                                            className="text-[10px] font-bold"
                                                        >
                                                            {b.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-center"><Badge variant={b.isEligibleForZakat ? 'eligible' : 'outline'} className="text-[10px] font-bold">{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></div>
                                                    <div className="text-right font-mono text-sm font-bold text-primary">₹{(b.kitAmount || 0).toLocaleString('en-IN')}</div>
                                                    <div className="text-right font-mono text-sm font-bold text-primary">₹{(b.zakatAllocation || 0).toLocaleString('en-IN')}</div>
                                                    <div className="text-xs font-normal text-primary/70 truncate">{b.referralBy || 'N/A'}</div>
                                                    <div className="text-right pr-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown border-primary/10">
                                                                    <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="text-primary font-normal"><Eye className="mr-2 h-4 w-4 opacity-60" /> View Details</DropdownMenuItem>
                                                                    {canUpdate && <DropdownMenuItem onClick={() => { setEditingBeneficiary(b); setIsFormOpen(true); }} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4 opacity-60" /> Edit</DropdownMenuItem>}
                                                                    
                                                                    <DropdownMenuSeparator />
                                                                    
                                                                    {canUpdate && (
                                                                        <DropdownMenuSub>
                                                                            <DropdownMenuSubTrigger className="font-normal text-primary"><ChevronsUpDown className="mr-2 h-4 w-4 opacity-60" /> Change Verification Status</DropdownMenuSubTrigger>
                                                                            <DropdownMenuPortal><DropdownMenuSubContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                                                <DropdownMenuRadioGroup value={b.verificationStatus || 'Pending'} onValueChange={(s) => handleVerificationChange(b, s)}>
                                                                                    <DropdownMenuRadioItem value="Pending" className="font-normal">Pending</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Verified" className="font-normal">Verified</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Hold" className="font-normal">Hold</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Need More Details" className="font-normal">Need Details</DropdownMenuRadioItem>
                                                                                </DropdownMenuRadioGroup>
                                                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                                                        </DropdownMenuSub>
                                                                    )}

                                                                    {canUpdate && (
                                                                        <DropdownMenuSub>
                                                                            <DropdownMenuSubTrigger className="font-normal text-primary"><ClipboardCheck className="mr-2 h-4 w-4 opacity-60" /> Change Disbursement Status</DropdownMenuSubTrigger>
                                                                            <DropdownMenuPortal><DropdownMenuSubContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                                                <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                                                                    <DropdownMenuRadioItem value="Pending" className="font-normal">Pending</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Verified" className="font-normal">Verified (Secured)</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Given" className="font-normal">Given (Completed)</DropdownMenuRadioItem>
                                                                                </DropdownMenuRadioGroup>
                                                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                                                        </DropdownMenuSub>
                                                                    )}

                                                                    {canUpdate && (
                                                                        <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="text-primary font-normal">
                                                                            {b.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4 text-destructive" /> : <Coins className="mr-2 h-4 w-4 text-primary" />}
                                                                            {b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Eligible'}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    
                                                                    {canUpdate && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => handleRemoveFromInitiative(b.id)} className="text-destructive font-normal">
                                                                                <Trash2 className="mr-2 h-4 w-4" /> Remove From Lead
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                </div>
                                                <AccordionContent className="bg-primary/[0.01] border-t border-primary/10 px-6 py-4">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
                                                        <div className="space-y-1 col-span-2">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Address</p>
                                                            <p className="text-sm font-normal leading-tight text-primary">{b.address || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Age</p>
                                                            <p className="text-sm font-normal text-primary">{b.age || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Occupation</p>
                                                            <p className="text-sm font-normal text-primary">{b.occupation || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Family Details</p>
                                                            <p className="text-sm font-normal text-primary">T: {b.members || 0}, E: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">ID Proof</p>
                                                            <p className="text-sm font-normal text-primary">{b.idProofType || 'Aadhaar'} - {b.idNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Date Added</p>
                                                            <p className="text-sm font-normal text-primary">{b.addedDate || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Zakat Allocation</p>
                                                            <p className="text-sm font-bold text-primary">₹{(b.zakatAllocation || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div className="space-y-1 col-span-2">
                                                            <p className="text-[10px] font-bold opacity-60 tracking-tight text-primary">Notes</p>
                                                            <p className="text-sm font-normal italic opacity-80 text-primary line-clamp-2">{b.notes || (b.isEligibleForZakat ? `Eligible For Zakat. Amount: ${b.zakatAllocation}` : 'N/A')}</p>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
            </ScrollArea>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[16px] border-primary/10">
                <DialogHeader><DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase">{editingBeneficiary ? 'Edit Beneficiary Record' : 'Add New Beneficiary'}</DialogTitle></DialogHeader>
                <BeneficiaryForm 
                    beneficiary={editingBeneficiary}
                    onSubmit={handleFormSubmit} 
                    onCancel={() => { setIsFormOpen(false); setEditingBeneficiary(null); }} 
                    itemCategories={lead?.itemCategories || []} 
                />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={leadId} initiativeType="lead" />
        <BeneficiaryImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImport} />
    </main>
  );
}
