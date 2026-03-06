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
    type DocumentReference 
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Campaign } from '@/lib/types';
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
    Loader2
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

const gridClass = "grid grid-cols-[60px_250px_140px_120px_120px_140px_160px_200px_80px] items-center gap-4 px-4 py-3 min-w-[1470px]";

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = typeof params?.campaignId === "string" ? params.campaignId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, 'campaigns', campaignId, 'beneficiaries') : null, [firestore, campaignId]);
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

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);

  const availableCategories = useMemo(() => {
    if (!campaign?.itemCategories) return [];
    return campaign.itemCategories.filter(c => c.name !== 'Item Price List');
  }, [campaign]);

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
    
    availableCategories.forEach(cat => {
        groups[cat.id] = filteredBeneficiaries.filter(b => b.itemCategoryId === cat.id);
    });

    const uncategorized = filteredBeneficiaries.filter(b => !b.itemCategoryId || !availableCategories.find(c => c.id === b.itemCategoryId));
    if (uncategorized.length > 0) {
        groups['uncategorized'] = uncategorized;
    }

    return groups;
  }, [filteredBeneficiaries, availableCategories]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: any) => {
    if (!firestore || !campaignId || !canUpdate) return;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { status: newStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !campaignId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    updateDoc(ref, { isEligibleForZakat: newZakatStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
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
        const resized = await new Promise<Blob>((resolve) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => resolve(b as Blob), 'blob'); });
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
    
    await batch.commit().then(() => { toast({ title: 'Success', variant: 'success' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!campaign) return <p className="text-center mt-20 text-primary font-bold">Campaign Not Found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">{campaign.name}</h1>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link> )}
                    {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item Lists</Link> )}
                    {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link> )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-primary tracking-tight">Beneficiary List ({beneficiaries?.length || 0})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform">
              <CopyPlus className="mr-2 h-4 w-4"/> Select From Master
            </Button>
            <Button size="sm" onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold active:scale-95 transition-transform shadow-md">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New Beneficiary
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
            <Input placeholder="Search Name, Phone, Address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 text-sm border-primary/20 focus-visible:ring-primary font-normal text-primary" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="font-bold">All Statuses</SelectItem>
              <SelectItem value="Pending" className="font-bold">Pending</SelectItem>
              <SelectItem value="Verified" className="font-bold">Verified</SelectItem>
              <SelectItem value="Given" className="font-bold">Given</SelectItem>
              <SelectItem value="Hold" className="font-bold">Hold</SelectItem>
              <SelectItem value="Need More Details" className="font-bold">Need Details</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-primary"><SelectValue placeholder="Zakat Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="font-bold">All Zakat Status</SelectItem>
              <SelectItem value="Eligible" className="font-bold">Eligible</SelectItem>
              <SelectItem value="Not Eligible" className="font-bold">Not Eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-primary/10 bg-white overflow-hidden shadow-sm">
            <ScrollArea className="w-full">
                <div className={cn("bg-primary/5 border-b border-primary/10 text-[12px] font-bold uppercase tracking-wider text-primary", gridClass)}>
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
                        let categoryName = cat?.name || 'Uncategorized';
                        
                        if (campaign.category === 'Ration' && cat) {
                            if (cat.minMembers === 1 && cat.maxMembers === 1) categoryName = `Member (1)`;
                            else if (cat.minMembers !== undefined && cat.maxMembers !== undefined) categoryName = `Members (${cat.minMembers}-${cat.maxMembers})`;
                        }

                        const currentPage = currentPages[catId] || 1;
                        const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                        const isExpanded = openGroups[catId] !== false;

                        if (paginatedList.length === 0) return null;

                        return (
                            <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleGroup(catId)} className="w-full">
                                <CollapsibleTrigger className="w-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary flex items-center gap-2 border-b border-primary/10 uppercase hover:bg-primary/20 transition-colors">
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
                                    {categoryName} ({list.length} Beneficiaries)
                                </CollapsibleTrigger>
                                <CollapsibleContent className="w-full">
                                    <Accordion type="single" collapsible className="w-full">
                                        {paginatedList.map((b, idx) => (
                                            <AccordionItem key={b.id} value={b.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02] transition-colors">
                                                <div className={gridClass}>
                                                    <div className="font-mono text-xs opacity-60">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                                    <div className="font-bold text-sm text-primary">{b.name}</div>
                                                    <div className="font-mono text-xs opacity-60">{b.phone || 'N/A'}</div>
                                                    <div className="text-center"><Badge variant={b.status === 'Given' ? 'success' : 'outline'} className="text-[10px] font-bold uppercase">{b.status}</Badge></div>
                                                    <div className="text-center"><Badge variant={b.isEligibleForZakat ? 'eligible' : 'outline'} className="text-[10px] font-bold uppercase">{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></div>
                                                    <div className="text-right font-mono text-sm font-bold">₹{(b.kitAmount || 0).toFixed(2)}</div>
                                                    <div className="text-right font-mono text-sm font-bold">₹{(b.zakatAllocation || 0).toFixed(2)}</div>
                                                    <div className="text-sm font-normal text-primary/70">{b.referralBy || 'N/A'}</div>
                                                    <div className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                                                    <ChevronDown className="h-4 w-4 text-primary shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                                </div>
                                                            </AccordionTrigger>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="font-bold text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                                    {canUpdate && (
                                                                        <DropdownMenuSub>
                                                                            <DropdownMenuSubTrigger className="font-bold text-primary">Status</DropdownMenuSubTrigger>
                                                                            <DropdownMenuPortal><DropdownMenuSubContent>
                                                                                <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s)}>
                                                                                    <DropdownMenuRadioItem value="Pending" className="text-xs font-bold">Pending</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Verified" className="text-xs font-bold">Verified</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Given" className="text-xs font-bold">Given</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Hold" className="text-xs font-bold">Hold</DropdownMenuRadioItem>
                                                                                    <DropdownMenuRadioItem value="Need More Details" className="text-xs font-bold">Need Details</DropdownMenuRadioItem>
                                                                                </DropdownMenuRadioGroup>
                                                                            </DropdownMenuSubContent></DropdownMenuPortal>
                                                                        </DropdownMenuSub>
                                                                    )}
                                                                    {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold text-primary">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                </div>
                                                <AccordionContent className="bg-primary/[0.01] border-t border-primary/5 px-12 py-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Address</p>
                                                            <p className="text-sm font-normal leading-relaxed text-primary">{b.address || 'N/A'}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Age</p>
                                                                <p className="text-sm font-normal text-primary">{b.age || 'N/A'}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Occupation</p>
                                                                <p className="text-sm font-normal text-primary">{b.occupation || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Family Details</p>
                                                            <p className="text-sm font-normal text-primary">Total: {b.members || 0}, Earning: {b.earningMembers || 0}, M: {b.male || 0}, F: {b.female || 0}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">ID Proof</p>
                                                            <p className="text-sm font-normal text-primary">{b.idProofType || 'Aadhaar'} - {b.idNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Date Added</p>
                                                            <p className="text-sm font-normal text-primary">{b.addedDate || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Zakat Allocation</p>
                                                            <p className="text-sm font-bold text-primary">₹{(b.zakatAllocation || 0).toFixed(2)}</p>
                                                        </div>
                                                        <div className="space-y-2 md:col-span-2">
                                                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-primary">Notes</p>
                                                            <p className="text-sm font-normal italic opacity-80 text-primary">{b.notes || (b.isEligibleForZakat ? `Eligible For Zakat. Amount: ${b.zakatAllocation}` : 'N/A')}</p>
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-xl font-bold text-primary tracking-tight uppercase">Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}
