'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
    Loader2
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type BeneficiaryStatus = Beneficiary['status'];

// Updated grid class to accommodate requested columns
const gridClass = "grid grid-cols-[40px_40px_1.5fr_100px_100px_120px_140px_1fr_60px] items-center gap-2";

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
  
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const itemsPerPage = 10;

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
    const groups: Record<string, Beneficiary[]> = { all: filteredBeneficiaries };
    
    availableCategories.forEach(cat => {
        groups[cat.id] = filteredBeneficiaries.filter(b => b.itemCategoryId === cat.id);
    });

    const uncategorized = filteredBeneficiaries.filter(b => !b.itemCategoryId || !availableCategories.find(c => c.id === b.itemCategoryId));
    if (uncategorized.length > 0) {
        groups['uncategorized'] = uncategorized;
    }

    return groups;
  }, [filteredBeneficiaries, availableCategories]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !leadId || !canUpdate) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { status: newStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !leadId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { isEligibleForZakat: newZakatStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !leadId || !userProfile || !lead) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
    const leadSubRef = doc(firestore, 'leads', leadId, 'beneficiaries', masterRef.id);
    
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
    batch.set(leadSubRef, fullData, { merge: true });
    batch.update(doc(firestore, 'leads', leadId), { targetAmount: (lead.targetAmount || 0) + (data.kitAmount || 0) });
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.', variant: 'success' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadSubRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!lead) return <p className="text-center mt-20 text-primary font-bold">Lead not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 text-primary"><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to hub</Link></Button></div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{lead.name}</h1>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link> )}
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item list</Link>
                    {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary list</Link> )}
                    {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link> )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-primary tracking-tight">Lead beneficiaries ({beneficiaries?.length || 0})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-primary">
              <CopyPlus className="mr-2 h-4 w-4"/> Select from master
            </Button>
            <Button size="sm" onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold">
              <PlusCircle className="mr-2 h-4 w-4"/> Add new
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
            <Input placeholder="Search name, phone, address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 text-sm border-primary/20 focus-visible:ring-primary font-bold text-primary" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Given">Given</SelectItem>
              <SelectItem value="Hold">Hold</SelectItem>
              <SelectItem value="Need More Details">Need details</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Zakat status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Zakat status</SelectItem>
              <SelectItem value="Eligible">Eligible</SelectItem>
              <SelectItem value="Not Eligible">Not eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-primary/10 bg-white overflow-hidden shadow-sm">
            <ScrollArea className="w-full overflow-x-auto">
                <div className={cn("bg-primary/5 border-b border-primary/10 py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-primary/70", gridClass)}>
                    <div></div>
                    <div>sr.no.</div>
                    <div>Name & Phone</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Zakat</div>
                    <div className="text-right">Kit Amount (₹)</div>
                    <div className="text-right">Zakat Allocation (₹)</div>
                    <div className="pl-4">Referred By</div>
                    <div className="text-right">Actions</div>
                </div>

                <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab} className="w-full">
                    {Object.entries(beneficiariesByCategory).map(([catId, list]) => {
                        const categoryName = availableCategories.find(c => c.id === catId)?.name || (catId === 'all' ? 'All Beneficiaries' : 'Uncategorized');
                        const currentPage = currentPages[catId] || 1;
                        const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                        return (
                            <div key={catId} className="w-full">
                                <div className="bg-primary/5 px-4 py-2 text-sm font-bold text-primary flex items-center gap-2 border-b border-primary/10">
                                    <ChevronDown className="h-4 w-4" />
                                    {categoryName} ({list.length} beneficiaries)
                                </div>
                                <Accordion type="single" collapsible className="w-full">
                                    {paginatedList.map((b, idx) => (
                                        <AccordionItem key={b.id} value={b.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02] transition-colors">
                                            <div className={cn("py-3 px-4", gridClass)}>
                                                <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                                        <ChevronDown className="h-4 w-4 text-primary shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                    </div>
                                                </AccordionTrigger>
                                                <div className="font-mono text-xs text-muted-foreground">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-primary truncate">{b.name}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground">{b.phone || 'N/A'}</span>
                                                </div>
                                                <div className="text-center">
                                                    <Badge variant={b.status === 'Given' ? 'success' : 'outline'} className="text-[10px] font-bold">
                                                        {b.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-center">
                                                    <Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[10px] font-bold">
                                                        {b.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}
                                                    </Badge>
                                                </div>
                                                <div className="text-right font-mono text-sm font-medium">₹{(b.kitAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-right font-mono text-sm font-medium">₹{(b.zakatAllocation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                <div className="pl-4 text-xs font-medium truncate opacity-70">{b.referralBy || 'N/A'}</div>
                                                <div className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="font-bold text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                            {canUpdate && (
                                                                <DropdownMenuSub>
                                                                    <DropdownMenuSubTrigger className="font-bold text-primary">Status</DropdownMenuSubTrigger>
                                                                    <DropdownMenuPortal><DropdownMenuSubContent>
                                                                        <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                            <DropdownMenuRadioItem value="Pending" className="text-xs font-bold">Pending</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Verified" className="text-xs font-bold">Verified</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Given" className="text-xs font-bold">Given</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Hold" className="text-xs font-bold">Hold</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Need More Details" className="text-xs font-bold">Need details</DropdownMenuRadioItem>
                                                                        </DropdownMenuRadioGroup>
                                                                    </DropdownMenuSubContent></DropdownMenuPortal>
                                                                </DropdownMenuSub>
                                                            )}
                                                            {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold text-primary">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat eligible'}</DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            <AccordionContent className="bg-primary/[0.01] px-4 pt-0 pb-4 border-t border-primary/5">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4 px-12">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-primary/60">Address</p>
                                                            <p className="text-sm font-medium leading-relaxed">{b.address || 'N/A'}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">Occupation</p>
                                                                <p className="text-sm font-medium">{b.occupation || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">ID Proof</p>
                                                                <p className="text-sm font-medium">{b.idProofType || 'Aadhar'} - {b.idNumber || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">Age</p>
                                                                <p className="text-sm font-medium">{b.age || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">Family</p>
                                                                <p className="text-sm font-medium">Total: {b.members || 0}, Earning: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">Date Added</p>
                                                                <p className="text-sm font-medium">{b.addedDate || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-primary/60">Zakat Allocation</p>
                                                                <p className="text-sm font-bold text-primary">₹{(b.zakatAllocation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-primary/60">Notes</p>
                                                            <p className="text-sm font-medium italic opacity-80">{b.notes || (b.isEligibleForZakat ? `Eligible for zakat. Amount: ${b.zakatAllocation}` : 'N/A')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        );
                    })}
                </Tabs>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-xl font-bold text-primary tracking-tight">Add new beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={lead?.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={leadId} initiativeType="lead" />
    </main>
  );
}
