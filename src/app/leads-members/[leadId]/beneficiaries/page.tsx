'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { 
    useFirestore, 
    useStorage, 
    useAuth, 
    useMemoFirebase, 
    useCollection, 
    useDoc, 
    collection, 
    doc, 
    setDoc, 
    DocumentReference,
    writeBatch,
    serverTimestamp
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Beneficiary, Lead } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
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
    Users,
    UserCheck,
    FileUp,
    CopyPlus,
    Search,
    ShieldAlert
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandedLoader } from '@/components/branded-loader';
import Resizer from 'react-image-file-resizer';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';

type BeneficiaryStatus = Beneficiary['status'];

export default function BeneficiariesPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
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

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.update', false);

  const groupedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return {};
    let filtered = beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        return matchesSearch && matchesStatus && matchesZakat;
    });
    const groups: Record<string, Beneficiary[]> = {};
    filtered.forEach(b => {
        const catName = b.itemCategoryName || 'General Support';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(b);
    });
    return groups;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !leadId || !canUpdate) return;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    const updateData = { status: newStatus };
    setDoc(ref, updateData, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !leadId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'leads', leadId, 'beneficiaries', beneficiary.id);
    setDoc(ref, { isEligibleForZakat: newZakatStatus }, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
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
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.' }); setIsFormOpen(false); }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadSubRef.path, operation: 'create' }));
    });
    setIsSubmitting(false);
  };

  if (isLeadLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!lead) return <p className="text-center mt-20">Lead not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
        <h1 className="text-3xl font-bold">{lead.name}</h1>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && ( <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Summary</Link> )}
                    <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item List</Link>
                    {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow")}>Beneficiary Details</Link> )}
                    {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Donations</Link> )}
                </div>
            </ScrollArea>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">Beneficiary Details ({beneficiaries?.length || 0})</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Given">Given</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="gap-2"><CopyPlus className="h-4 w-4"/> Add Existing</Button>
                <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2"><PlusCircle className="mr-2 h-4 w-4"/> Add New</Button>
            </div>
        </div>

        <Accordion type="multiple" defaultValue={Object.keys(groupedBeneficiaries)} className="space-y-4">
            {Object.entries(groupedBeneficiaries).map(([catName, list]) => (
                <AccordionItem key={catName} value={catName} className="border rounded-lg px-4 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{catName}</span>
                            <Badge variant="secondary" className="rounded-full">{list.length}</Badge>
                            <span className="text-sm text-muted-foreground font-normal">Total Amount: ₹{list.reduce((sum, b) => sum + (b.kitAmount || 0), 0).toLocaleString()}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                        <div className="w-full overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[60px]">#</TableHead>
                                        <TableHead>Name & Phone</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Zakat</TableHead>
                                        <TableHead className="text-right">Required Amount</TableHead>
                                        <TableHead className="text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {list.map((b, idx) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{b.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{b.phone || 'N/A'}</div>
                                            </TableCell>
                                            <TableCell><Badge variant={b.status === 'Given' ? 'success' : 'outline'}>{b.status}</Badge></TableCell>
                                            <TableCell><Badge variant={b.isEligibleForZakat ? 'success' : 'outline'}>{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></TableCell>
                                            <TableCell className="text-right font-mono">₹{(b.kitAmount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right pr-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                        {canUpdate && (
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" /> Status</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal>
                                                                    <DropdownMenuSubContent>
                                                                        <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                            <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                                                        </DropdownMenuRadioGroup>
                                                                    </DropdownMenuSubContent>
                                                                </DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                        )}
                                                        {canUpdate && (
                                                            <DropdownMenuItem onClick={() => handleZakatToggle(b)}>{b.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} {b.isEligibleForZakat ? 'Mark Not Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={lead.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={leadId} initiativeType="lead" />
    </main>
  );
}