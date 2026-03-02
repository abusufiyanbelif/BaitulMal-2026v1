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
import type { Beneficiary, Campaign, ItemCategory } from '@/lib/types';
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
    Trash2,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';

type BeneficiaryStatus = Beneficiary['status'];

const gridClass = "grid grid-cols-[40px_40px_1fr_120px_1.5fr_100px_100px_60px] items-center";

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
  
  // Tab and Pagination state
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
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
    const groups: Record<string, Beneficiary[]> = { all: filteredBeneficiaries };
    
    availableCategories.forEach(cat => {
        groups[cat.id] = filteredBeneficiaries.filter(b => b.itemCategoryId === cat.id);
    });

    // Also handle any that might not have a category assigned
    const uncategorized = filteredBeneficiaries.filter(b => !b.itemCategoryId || !availableCategories.find(c => c.id === b.itemCategoryId));
    if (uncategorized.length > 0) {
        groups['uncategorized'] = uncategorized;
    }

    return groups;
  }, [filteredBeneficiaries, availableCategories]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
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
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.', variant: 'success' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!campaign) return <p className="text-center mt-20 text-primary font-bold uppercase">Campaign not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 text-[#138808]"><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub</Link></Button></div>
        <h1 className="text-3xl font-black tracking-tighter text-[#138808] uppercase">{campaign.name}</h1>
        
        <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.endsWith('/summary') ? "bg-[#138808] text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-[#138808]")}>Summary</Link> )}
                    {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname === `/campaign-members/${campaignId}` ? "bg-[#138808] text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-[#138808]")}>Item Lists</Link> )}
                    {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-[#138808] text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-[#138808]")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-[#138808] text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-[#138808]")}>Donations</Link> )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-[#138808] uppercase tracking-tighter">Campaign Beneficiaries ({beneficiaries?.length || 0})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="font-bold border-primary/20 text-[#138808]">
              <CopyPlus className="mr-2 h-4 w-4"/> Select from Master
            </Button>
            <Button size="sm" onClick={() => setIsFormOpen(true)} className="bg-[#16a34a] hover:bg-[#16a34a]/90 text-white font-bold">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#138808]/50" />
            <Input placeholder="Search name, phone, address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 text-sm border-primary/20 focus-visible:ring-[#138808] font-bold text-[#1B5E20]" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-[#138808]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Given">Given</SelectItem>
              <SelectItem value="Hold">Hold</SelectItem>
              <SelectItem value="Need More Details">Need Details</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPages({}); }}>
            <SelectTrigger className="w-[160px] h-10 text-sm font-bold border-primary/20 text-[#138808]"><SelectValue placeholder="Zakat Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Zakat Status</SelectItem>
              <SelectItem value="Eligible">Eligible</SelectItem>
              <SelectItem value="Not Eligible">Not Eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab} className="w-full">
            <ScrollArea className="w-full whitespace-nowrap bg-white border border-primary/10 rounded-t-xl">
                <TabsList className="h-auto bg-transparent p-0 rounded-none w-max">
                    <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent px-6 py-3 font-black uppercase tracking-widest text-muted-foreground data-[state=active]:border-[#138808] data-[state=active]:text-[#138808] data-[state=active]:bg-primary/5">All ({filteredBeneficiaries.length})</TabsTrigger>
                    {availableCategories.map(cat => (
                        <TabsTrigger key={cat.id} value={cat.id} className="rounded-none border-b-2 border-transparent px-6 py-3 font-black uppercase tracking-widest text-muted-foreground data-[state=active]:border-[#138808] data-[state=active]:text-[#138808] data-[state=active]:bg-primary/5">
                            {cat.name} ({beneficiariesByCategory[cat.id]?.length || 0})
                        </TabsTrigger>
                    ))}
                    {beneficiariesByCategory['uncategorized'] && (
                        <TabsTrigger value="uncategorized" className="rounded-none border-b-2 border-transparent px-6 py-3 font-black uppercase tracking-widest text-muted-foreground data-[state=active]:border-[#138808] data-[state=active]:text-[#138808] data-[state=active]:bg-primary/5">Uncategorized ({beneficiariesByCategory['uncategorized'].length})</TabsTrigger>
                    )}
                </TabsList>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {Object.entries(beneficiariesByCategory).map(([catId, list]) => {
                const currentPage = currentPages[catId] || 1;
                const totalPages = Math.ceil(list.length / itemsPerPage);
                const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                return (
                    <TabsContent key={catId} value={catId} className="mt-0">
                        <div className="rounded-b-lg border border-t-0 border-primary/10 bg-white overflow-hidden shadow-sm">
                            <div className={cn("bg-primary/5 border-b border-primary/10 py-3 px-4 text-[11px] font-black uppercase tracking-wider text-[#138808]/70", gridClass)}>
                                <div></div>
                                <div>#</div>
                                <div>Name</div>
                                <div>Phone</div>
                                <div>Address</div>
                                <div className="text-center">Zakat</div>
                                <div className="text-center">Status</div>
                                <div className="text-right">Actions</div>
                            </div>

                            <Accordion type="single" collapsible className="w-full">
                                {paginatedList.map((b, idx) => (
                                    <AccordionItem key={b.id} value={b.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02] transition-colors">
                                        <div className={cn("py-3 px-4", gridClass)}>
                                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors">
                                                    <ChevronDown className="h-4 w-4 text-[#138808] shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                </div>
                                            </AccordionTrigger>
                                            <div className="font-mono text-xs text-muted-foreground">{(currentPage - 1) * itemsPerPage + idx + 1}</div>
                                            <div className="font-black text-[#1B5E20] truncate pr-2 uppercase">{b.name}</div>
                                            <div className="font-mono text-xs text-muted-foreground">{b.phone || 'N/A'}</div>
                                            <div className="text-xs font-bold text-[#1B5E20]/70 truncate pr-2">{b.address || 'N/A'}</div>
                                            <div className="text-center">
                                                <Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[10px] h-5 px-2 font-black uppercase">
                                                    {b.isEligibleForZakat ? 'YES' : 'NO'}
                                                </Badge>
                                            </div>
                                            <div className="text-center">
                                                <Badge variant={b.status === 'Given' ? 'success' : 'outline'} className="text-[10px] h-5 px-2 font-black uppercase tracking-tighter">
                                                    {b.status}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-[#138808]"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="font-bold text-[#138808]"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                        {canUpdate && (
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger className="font-bold text-[#138808]">Status</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal><DropdownMenuSubContent>
                                                                    <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                        <DropdownMenuRadioItem value="Pending" className="text-xs font-bold">Pending</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Verified" className="text-xs font-bold">Verified</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Given" className="text-xs font-bold">Given</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Hold" className="text-xs font-bold">Hold</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Need More Details" className="text-xs font-bold">Need Details</DropdownMenuRadioItem>
                                                                    </DropdownMenuRadioGroup>
                                                                </DropdownMenuSubContent></DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                        )}
                                                        {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold text-[#138808]">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        <AccordionContent className="bg-primary/[0.01] px-4 pt-0 pb-4 border-t border-primary/5">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 px-12">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-[#138808]/60 tracking-wider">Address</p>
                                                    <p className="text-sm font-bold text-[#1B5E20]">{b.address || 'N/A'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-[#138808]/60 tracking-wider">Family Stats</p>
                                                    <p className="text-sm font-bold text-[#1B5E20]">Members: {b.members || 0} | Earning: {b.earningMembers || 0}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-[#138808]/60 tracking-wider">Category Assigned</p>
                                                    <Badge variant="secondary" className="text-[10px] font-black uppercase">{b.itemCategoryName || 'Uncategorized'}</Badge>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                            {list.length === 0 && (
                                <div className="text-center py-20 bg-primary/[0.02] text-[#138808]/40 font-black uppercase tracking-widest italic">No records found.</div>
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between py-4 bg-white">
                                <p className="text-[10px] font-black uppercase text-[#138808]/60 tracking-widest">Page {currentPage} of {totalPages}</p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPages(prev => ({...prev, [catId]: Math.max(1, currentPage - 1)}))} disabled={currentPage === 1} className="font-black uppercase text-[10px] border-primary/20 text-[#138808]">Previous</Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPages(prev => ({...prev, [catId]: Math.min(totalPages, currentPage + 1)}))} disabled={currentPage === totalPages} className="font-black uppercase text-[10px] border-primary/20 text-[#138808]">Next</Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                );
            })}
        </Tabs>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-xl font-black text-[#138808] uppercase tracking-tighter">Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}
