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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, 
    PlusCircle, 
    Eye, 
    Search,
    CopyPlus,
    MoreHorizontal,
    ChevronDown,
    Loader2,
    Trash2
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Updated Grid Class to include chevron in first column
const gridClass = "grid grid-cols-[40px_60px_250px_140px_120px_120px_140px_160px_200px_80px] items-center gap-4 px-4 py-3 min-w-[1310px]";

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const itemsPerPage = 15;

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);

  const availableCategories = useMemo(() => {
    if (!lead?.itemCategories) return [];
    return lead.itemCategories;
  }, [lead]);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm) || b.address?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        return matchesSearch && matchesStatus && matchesZakat;
    });
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter]);

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

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: any) => {
    if (!firestore || !leadId || !canUpdate) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { status: newStatus }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !leadId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { isEligibleForZakat: newZakatStatus }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  const handleRemoveFromInitiative = (beneficiaryId: string) => {
    if (!firestore || !leadId || !canUpdate) return;
    if (!confirm('Are you sure you want to remove this beneficiary from this lead initiative? The master record will remain unaffected.')) return;
    
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiaryId);
    deleteDoc(ref).then(() => {
        toast({ title: 'Beneficiary Removed', variant: 'success' });
    }).catch((err: any) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' })));
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !leadId || !userProfile || !lead) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
    const leadRefSub = doc(firestore, 'leads', leadId, 'beneficiaries', masterRef.id);
    
    let idProofUrl = '';
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const resized = await new Promise<Blob>((resolve) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => resolve(b as Blob), 'blob'); });
        const fRef = storageRef(storage, `beneficiaries/${masterRef.id}/id_proof.png`);
        await uploadBytes(fRef, resized);
        idProofUrl = await getDownloadURL(fRef);
    }

    const { idProofFile, idProofDeleted, ...rest } = data;
    const fullData = { ...rest, id: masterRef.id, idProofUrl, addedDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), createdById: userProfile.id, createdByName: userProfile.name };
    const { status, kitAmount, zakatAllocation, ...masterData } = fullData;
    
    batch.set(masterRef, masterData, { merge: true });
    batch.set(leadRefSub, fullData, { merge: true });
    batch.update(doc(firestore, 'leads', leadId), { targetAmount: (lead.targetAmount || 0) + (data.kitAmount || 0) });
    
    await batch.commit().then(() => { toast({ title: 'Success', variant: 'success' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadRefSub.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!lead) return <p className="text-center mt-20 text-primary font-bold">Lead Not Found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-[#14532D] font-normal">
        <div className="mb-4">
            <Button variant="outline" asChild className="font-bold border-[#E2EEE7] text-[#14532D] transition-transform active:scale-95">
                <Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Leads</Link>
            </Button>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-primary uppercase">{lead.name}</h1>
        
        <div className="border-b border-[#E2EEE7] mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-[#1FA34A] text-white shadow-md" : "text-[#355E3B] hover:bg-[#1FA34A]/10 hover:text-[#1FA34A]")}>Summary</Link> )}
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-[#1FA34A] text-white shadow-md" : "text-[#355E3B] hover:bg-[#1FA34A]/10 hover:text-[#1FA34A]")}>Item List</Link>
                    {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-[#1FA34A] text-white shadow-md" : "text-[#355E3B] hover:bg-[#1FA34A]/10 hover:text-[#1FA34A]")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-[#1FA34A] text-white shadow-md" : "text-[#355E3B] hover:bg-[#1FA34A]/10 hover:text-[#1FA34A]")}>Donations</Link> )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-3xl font-bold text-primary tracking-tight">Beneficiary List ({beneficiaries?.length || 0})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="font-normal border-[#E2EEE7] text-[#1FA34A] bg-white hover:bg-[#F0F9F3] active:scale-95 transition-transform">
              <CopyPlus className="mr-2 h-4 w-4"/> Select From Master
            </Button>
            <Button size="sm" onClick={() => setIsFormOpen(true)} className="bg-[#1FA34A] hover:bg-[#16863B] text-white font-bold active:scale-95 transition-transform shadow-md rounded-[12px]">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#1FA34A]/5 p-4 rounded-xl border border-[#E2EEE7]">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1FA34A]/50" />
            <Input placeholder="Search Name, Phone, Address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 text-sm border-[#E2EEE7] focus-visible:ring-[#1FA34A] font-normal text-[#14532D] rounded-[12px]" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm border-[#E2EEE7] text-[#14532D] bg-white rounded-[12px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent className="rounded-[12px] shadow-dropdown border-[#E2EEE7]">
              <SelectItem value="All" className="font-normal">All Statuses</SelectItem>
              <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
              <SelectItem value="Verified" className="font-normal">Verified</SelectItem>
              <SelectItem value="Given" className="font-normal">Given</SelectItem>
              <SelectItem value="Hold" className="font-normal">Hold</SelectItem>
              <SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm border-[#E2EEE7] text-[#14532D] bg-white rounded-[12px]"><SelectValue placeholder="All Zakat Status" /></SelectTrigger>
            <SelectContent className="rounded-[12px] shadow-dropdown border-[#E2EEE7]">
              <SelectItem value="All" className="font-normal">All Zakat Status</SelectItem>
              <SelectItem value="Eligible" className="font-normal">Eligible</SelectItem>
              <SelectItem value="Not Eligible" className="font-normal">Not Eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-[16px] border border-[#E2EEE7] bg-white overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <ScrollArea className="w-full">
                <div className={cn("bg-[#ECFDF5] border-b border-[#E2EEE7] text-[11px] font-bold uppercase tracking-widest text-[#14532D]", gridClass)}>
                    <div></div>
                    <div>Sr. No.</div>
                    <div>Name</div>
                    <div>Phone</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Zakat</div>
                    <div className="text-right">Kit Amount (₹)</div>
                    <div className="text-right">Zakat Allocation (₹)</div>
                    <div>Referred By</div>
                    <div className="text-right">Actions</div>
                </div>

                <div className="w-full">
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

                        if (paginatedList.length === 0) return null;

                        return (
                            <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleGroup(catId)} className="w-full">
                                <CollapsibleTrigger className="w-full bg-[#ECFDF5]/50 px-4 py-3 text-[12px] font-black text-[#14532D] flex items-center gap-2 border-b border-[#E2EEE7] uppercase hover:bg-[#ECFDF5] transition-colors">
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
                                    {categoryName} ({list.length} Beneficiaries)
                                </CollapsibleTrigger>
                                <CollapsibleContent className="w-full">
                                    <Accordion type="single" collapsible className="w-full">
                                        {paginatedList.map((b, idx) => (
                                            <AccordionItem key={b.id} value={b.id} className="border-b border-[#E2EEE7] last:border-0 hover:bg-[#F0FDF4] transition-colors">
                                                <div className={gridClass}>
                                                    <div className="flex justify-center">
                                                        <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#1FA34A]/10 transition-colors">
                                                                <ChevronDown className="h-4 w-4 text-[#1FA34A] shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                            </div>
                                                        </AccordionTrigger>
                                                    </div>
                                                    <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                                    <div className="font-bold text-sm text-[#14532D]">{b.name}</div>
                                                    <div className="font-mono text-xs opacity-60">{b.phone || 'N/A'}</div>
                                                    <div className="text-center"><Badge variant={b.status === 'Given' ? 'given' : 'outline'} className="text-[10px] font-bold uppercase">{b.status}</Badge></div>
                                                    <div className="text-center"><Badge variant={b.isEligibleForZakat ? 'eligible' : 'outline'} className="text-[10px] font-bold uppercase">{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></div>
                                                    <div className="text-right font-mono text-sm font-bold text-[#14532D]">₹{(b.kitAmount || 0).toFixed(2)}</div>
                                                    <div className="text-right font-mono text-sm font-bold text-[#14532D]">₹{(b.zakatAllocation || 0).toFixed(2)}</div>
                                                    <div className="text-xs font-normal text-[#355E3B]/70">{b.referralBy || 'N/A'}</div>
                                                    <div className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-[#1FA34A]"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-[12px] shadow-dropdown border-[#E2EEE7]">
                                                                    <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="text-[#14532D] font-normal"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                                    {canUpdate && (
                                                                        <DropdownMenuSub>
                                                                            <DropdownMenuSubTrigger className="font-normal text-primary">Status</DropdownMenuSubTrigger>
                                                                            <DropdownMenuPortal><DropdownMenuSubContent className="rounded-[12px] shadow-dropdown border-[#E2EEE7]">
                                                                                <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                                                                    <DropdownMenuRadioItem value="Pending" className="text-xs font-normal">Pending</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Verified" className="text-xs font-normal">Verified</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Given" className="text-xs font-normal">Given</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Hold" className="text-xs font-normal">Hold</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Need More Details" className="text-xs font-normal">Need Details</DropdownMenuRadioItem>
                                                                                </DropdownMenuRadioGroup>
                                                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                                                        </DropdownMenuSub>
                                                                    )}
                                                                    {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="text-[#14532D] font-normal">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                                                    {canUpdate && (
                                                                        <>
                                                                            <DropdownMenuSeparator className="bg-[#E2EEE7]" />
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
                                                <AccordionContent className="bg-[#F7FBF8] border-t border-[#E2EEE7] px-12 py-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Address</p>
                                                            <p className="text-sm font-normal leading-relaxed text-[#355E3B]">{b.address || 'N/A'}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Age</p>
                                                                <p className="text-sm font-normal text-[#355E3B]">{b.age || 'N/A'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Occupation</p>
                                                                <p className="text-sm font-normal text-[#355E3B]">{b.occupation || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Family Details</p>
                                                            <p className="text-sm font-normal text-[#355E3B]">Total: {b.members || 0}, Earning: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">ID Proof</p>
                                                            <p className="text-sm font-normal text-[#355E3B]">{b.idProofType || 'Aadhaar'} - {b.idNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Date Added</p>
                                                            <p className="text-sm font-normal text-[#355E3B]">{b.addedDate || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Zakat Allocation</p>
                                                            <p className="text-sm font-bold text-[#14532D]">₹{(b.zakatAllocation || 0).toFixed(2)}</p>
                                                        </div>
                                                        <div className="space-y-2 md:col-span-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-[#14532D]">Notes</p>
                                                            <p className="text-sm font-normal italic opacity-80 text-[#355E3B]">{b.notes || (b.isEligibleForZakat ? `Eligible For Zakat. Amount: ${b.zakatAllocation}` : 'N/A')}</p>
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
            </ScrollArea>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[16px] border-[#E2EEE7]">
                <DialogHeader><DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase">Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={lead?.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={leadId} initiativeType="lead" />
    </main>
  );
}
