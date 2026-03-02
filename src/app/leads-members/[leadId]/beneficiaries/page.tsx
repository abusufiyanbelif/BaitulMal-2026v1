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
    DocumentReference 
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
    CheckCircle2, 
    Hourglass, 
    XCircle, 
    Info, 
    Users, 
    UserCheck, 
    Search,
    CopyPlus,
    MoreHorizontal,
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
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type BeneficiaryStatus = Beneficiary['status'];

const gridClass = "grid grid-cols-[60px_1fr_100px_100px_120px_120px_120px_60px]";

const StatCard = ({ title, count, description, icon: Icon, colorClass }: { title: string, count: number, description: string, icon: any, colorClass?: string }) => (
    <Card className="flex-1 min-w-[150px] interactive-hover border-primary/5">
        <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">{description}</p>
            </div>
            <Icon className={cn("h-4 w-4", colorClass || "text-muted-foreground/40")} />
        </CardContent>
    </Card>
);

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
  const [referralFilter, setReferralFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm) || b.address?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        const matchesReferral = referralFilter === 'All' || b.referralBy === referralFilter;
        return matchesSearch && matchesStatus && matchesZakat && matchesReferral;
    });
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter]);

  const stats = useMemo(() => {
    if (!beneficiaries) return { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0 };
    return beneficiaries.reduce((acc, b) => {
        acc.total++;
        if (b.status === 'Pending') acc.pending++;
        else if (b.status === 'Verified') acc.verified++;
        else if (b.status === 'Given') acc.given++;
        else if (b.status === 'Hold') acc.hold++;
        else if (b.status === 'Need More Details') acc.needDetails++;
        return acc;
    }, { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0 });
  }, [beneficiaries]);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    return Array.from(new Set(beneficiaries.map(b => b.referralBy).filter(Boolean))).sort();
  }, [beneficiaries]);

  const groupedBeneficiaries = useMemo(() => {
    const groups: Record<string, Beneficiary[]> = {};
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filteredBeneficiaries.slice(startIndex, startIndex + itemsPerPage);
    paginated.forEach(b => {
        const catName = b.itemCategoryName || 'General Support';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(b);
    });
    return groups;
  }, [filteredBeneficiaries, currentPage]);

  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);

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
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadSubRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!lead) return <p className="text-center mt-20">Lead not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild className="interactive-hover font-bold uppercase"><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads</Link></Button></div>
        <h1 className="text-3xl font-black tracking-tight text-primary uppercase">{lead.name}</h1>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link> )}
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                    {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link> )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom shadow-md border-primary/10">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black text-primary uppercase tracking-tighter">Beneficiary Details ({stats.total})</CardTitle>
                        <CardDescription className="font-bold text-foreground">Showing current page results grouped by assigned item categories.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="gap-2 font-bold uppercase interactive-hover"><CopyPlus className="h-4 w-4"/> Select from Master</Button>
                        <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2 font-black uppercase tracking-widest interactive-hover shadow-lg"><PlusCircle className="h-4 w-4"/> Add New</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard title="Total" count={stats.total} description="Lead entries" icon={Users} />
                    <StatCard title="Pending" count={stats.pending} description="Wait verification" icon={Hourglass} colorClass="text-amber-500" />
                    <StatCard title="Verified" count={stats.verified} description="Confirmed" icon={CheckCircle2} colorClass="text-blue-500" />
                    <StatCard title="Given" count={stats.given} description="Disbursed" icon={UserCheck} colorClass="text-green-600" />
                    <StatCard title="Hold" count={stats.hold} description="Paused" icon={XCircle} colorClass="text-destructive" />
                    <StatCard title="Need Details" count={stats.needDetails} description="Incomplete" icon={Info} colorClass="text-muted-foreground" />
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search name, phone, address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs" />
                    </div>
                    <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Details</SelectItem></SelectContent>
                    </Select>
                    <Select value={zakatFilter} onValueChange={v => { setZakatFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase"><SelectValue placeholder="Zakat" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Zakat</SelectItem><SelectItem value="Eligible">Eligible</SelectItem><SelectItem value="Not Eligible">Not Eligible</SelectItem></SelectContent>
                    </Select>
                    <Select value={referralFilter} onValueChange={v => { setReferralFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs font-bold uppercase"><SelectValue placeholder="Referral" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Referrals</SelectItem>{uniqueReferrals.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                </div>

                <div className="border rounded-lg overflow-hidden bg-card min-w-[900px]">
                    <div className={cn("bg-muted/50 border-b py-3 px-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground", gridClass)}>
                        <div>#</div>
                        <div>Name & Phone</div>
                        <div className="text-center">Status</div>
                        <div className="text-center">Zakat</div>
                        <div className="text-right">Kit Amount (₹)</div>
                        <div className="text-right">Alloc. (₹)</div>
                        <div className="text-right">Referral</div>
                        <div className="text-right">Opt</div>
                    </div>
                    
                    <Accordion type="multiple" defaultValue={Object.keys(groupedBeneficiaries)} className="w-full">
                        {Object.entries(groupedBeneficiaries).map(([catName, list]) => (
                            <AccordionItem key={catName} value={catName} className="border-none">
                                <AccordionTrigger className="hover:no-underline bg-muted/10 px-4 py-3 border-b group [&[data-state=open]]:bg-primary/5 transition-colors">
                                    <div className="flex items-center gap-3"><span className="text-sm font-black text-primary uppercase tracking-tight">{catName} ({list.length})</span></div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                    {list.map((b, idx) => (
                                        <div key={b.id} className={cn("items-center py-3 px-4 border-b last:border-0 hover:bg-muted/20 transition-colors text-sm", gridClass)}>
                                            <div className="text-muted-foreground font-mono text-xs">{((currentPage-1)*itemsPerPage) + idx + 1}</div>
                                            <div className="truncate"><div className="font-black text-foreground truncate">{b.name}</div><div className="text-[10px] text-muted-foreground font-mono">{b.phone || 'N/A'}</div></div>
                                            <div className="flex justify-center"><Badge variant={b.status === 'Given' ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.status}</Badge></div>
                                            <div className="flex justify-center"><Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[9px] px-2 py-0 h-5 font-black uppercase tracking-tighter">{b.isEligibleForZakat ? 'YES' : 'NO'}</Badge></div>
                                            <div className="text-right font-mono font-bold text-primary">₹{(b.kitAmount || 0).toLocaleString()}</div>
                                            <div className="text-right font-mono text-muted-foreground">₹{(b.zakatAllocation || 0).toLocaleString()}</div>
                                            <div className="text-right text-[10px] font-bold uppercase truncate pl-2">{b.referralBy}</div>
                                            <div className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="font-bold text-primary"><Eye className="mr-2 h-4 w-4" /> Details</DropdownMenuItem>
                                                        {canUpdate && (
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger className="font-bold">Status</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal><DropdownMenuSubContent>
                                                                    <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                        <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Hold">Hold</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Need More Details">Need Details</DropdownMenuRadioItem>
                                                                    </DropdownMenuRadioGroup>
                                                                </DropdownMenuSubContent></DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                        )}
                                                        {canUpdate && <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold text-primary">{b.isEligibleForZakat ? 'Mark Ineligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    {filteredBeneficiaries.length === 0 && <div className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest bg-muted/5">No beneficiaries found matching your filters.</div>}
                </div>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t py-4">
                    <p className="text-xs text-muted-foreground font-bold">Showing page {currentPage} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-bold uppercase h-8 border-primary/20 text-primary">Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-bold uppercase h-8 border-primary/20 text-primary">Next</Button>
                    </div>
                </CardFooter>
            )}
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-xl font-black text-primary uppercase">Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={lead.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={leadId} initiativeType="lead" />
    </main>
  );
}