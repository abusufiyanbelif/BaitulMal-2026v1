'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, collection, doc } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { useSession } from '@/hooks/use-session';
import { updateDoc, DocumentReference, writeBatch } from 'firebase/firestore';
import type { Lead, RationItem, Beneficiary, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, ShieldAlert, Info, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BrandedLoader } from '@/components/branded-loader';
import { SectionLoader } from '@/components/section-loader';

const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen', 'month', 'year', 'semester', 'unit', 'day', 'treatment'];

export default function LeadDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);

  const { data: lead, isLoading: isLeadLoading, forceRefetch: forceRefetchLead } = useDoc<Lead>(leadDocRef);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !leadId) return null;
    return collection(firestore, `leads/${leadId}/beneficiaries`);
  }, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch: forceRefetchBeneficiaries } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [editMode, setEditMode] = useState(false);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [itemToDelete, setItemToDelete] = useState<{ itemId: string; itemName: string } | null>(null);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  
  useEffect(() => {
    if (lead && !editMode) {
      setEditableLead(JSON.parse(JSON.stringify(lead)));
    }
  }, [editMode, lead]);

  const itemList = useMemo(() => {
    if (!editableLead) return [];
    if (Array.isArray(editableLead.itemCategories) && editableLead.itemCategories.length > 0) {
        return editableLead.itemCategories[0]?.items || [];
    }
    return [];
  }, [editableLead]);


  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.update', false);

  const isLoading = isLeadLoading || isProfileLoading || areBeneficiariesLoading;

  const handleFieldChange = (field: keyof Lead, value: any) => {
    if (!editableLead) return;
    setEditableLead(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleItemChange = (itemId: string, field: keyof RationItem, value: string | number) => {
    if (!editableLead || !editableLead.itemCategories) return;
    const updatedItems = itemList.map((item: RationItem) => 
        item.id === itemId ? { ...item, [field]: value } : item
    );
    const newItemCategories = [{ ...editableLead.itemCategories[0], items: updatedItems }];
    handleFieldChange('itemCategories', newItemCategories);
  };

  const handleAddItem = () => {
    if (!editableLead) return;
    const newItem: RationItem = { id: `item-${Date.now()}`, name: '', quantity: 1, quantityType: 'unit', price: 0, notes: '' };
    const updatedItems = [...itemList, newItem];
    const newItemCategories = [{ ...(editableLead.itemCategories?.[0] || {id: 'general', name: 'General', items:[]}), items: updatedItems }];
    handleFieldChange('itemCategories', newItemCategories);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!editableLead || !editableLead.itemCategories) return;
    const updatedItems = itemList.filter((item: RationItem) => item.id !== itemId);
    const newItemCategories = [{ ...editableLead.itemCategories[0], items: updatedItems }];
    handleFieldChange('itemCategories', newItemCategories);
  };

  const handleDeleteItemClick = (itemId: string, itemName: string) => {
    if (!editableLead || !editMode) return;
    setItemToDelete({ itemId, itemName });
    setIsDeleteItemDialogOpen(true);
  };

  const handleDeleteItemConfirm = () => {
    if (!itemToDelete) return;
    handleDeleteItem(itemToDelete.itemId);
    setIsDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };
  
  const calculateTotal = (items: RationItem[]) => {
    return items.reduce((sum, item: RationItem) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  };

  const handleSave = () => {
    if (!leadDocRef || !editableLead || !canUpdate) return;
    
    const saveData: Partial<Lead> = {
        itemCategories: editableLead.itemCategories,
    };
    
    updateDoc(leadDocRef, saveData)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: leadDocRef.path,
                operation: 'update',
                requestResourceData: saveData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Lead Item List Synchronized.', variant: 'success' });
            setEditMode(false);
        });
  };

  const handleCancel = () => {
      setEditMode(false);
      if(lead) {
        setEditableLead(JSON.parse(JSON.stringify(lead)));
      }
  };

  const totalKitCost = useMemo(() => calculateTotal(itemList), [itemList]);
  
  const handleSyncKitAmounts = async () => {
    if (!firestore || !canUpdate || !beneficiaries || !editableLead) {
        toast({ title: "Sync Error", description: "Missing Data For Sync.", variant: 'destructive' });
        return;
    }
    
    if (editMode) {
        toast({ title: "Save Required", description: "Secure Inventory Edits First.", variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    toast({ title: "Syncing...", description: "Recalculating Allocations Across Registry." });

    const batch = writeBatch(firestore);
    let newTotalRequiredAmount = 0;
    const newKitAmount = totalKitCost;

    for (const beneficiary of beneficiaries) {
      const beneficiaryRef = doc(firestore, `leads/${leadId}/beneficiaries`, beneficiary.id);
      batch.update(beneficiaryRef, { kitAmount: newKitAmount });
      newTotalRequiredAmount += newKitAmount;
    }

    if (leadDocRef) {
        batch.update(leadDocRef, { targetAmount: newTotalRequiredAmount });
    }

    try {
        await batch.commit();
        toast({ title: "Sync Complete!", description: `Successfully Updated ${beneficiaries.length} Recipients.`, variant: 'success' });
        forceRefetchBeneficiaries();
        forceRefetchLead();
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `leads/${leadId}`,
            operation: 'write',
            requestResourceData: { note: `Batch Sync For ${beneficiaries.length} Beneficiaries` }
        }));
    } finally {
        setIsSyncing(false);
    }
};

  if (isLoading || !editableLead) {
    return <SectionLoader label="Retrieving Case Inventory..." description="Synchronizing Requirement Lists And Costing Model." />;
  }

  if (!lead) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center text-primary font-normal">
            <p className="text-lg text-primary/60 font-bold">Lead Not Found.</p>
            <Button asChild className="mt-4 font-bold active:scale-95 transition-transform" variant="outline">
                <Link href="/leads-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back To Leads
                </Link>
            </Button>
        </main>
    );
  }

  return (
    <>
    {isSyncing && <BrandedLoader message="Synchronizing registry amounts..." />}
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative">
      <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
              <Link href="/leads-members">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back To Leads
              </Link>
          </Button>
      </div>
      
      <h1 className="text-4xl font-bold tracking-tight text-primary">{editableLead.name}</h1>

      <div className="border-b border-primary/10 mb-4">
        <ScrollArea className="w-full">
            <div className="flex w-max space-x-2 pb-2">
                {canReadSummary && (
                    <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                )}
                <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                {canReadBeneficiaries && (
                    <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                )}
                {canReadDonations && (
                    <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                )}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>
      
      <Card className="animate-fade-in-zoom border-primary/10 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <CardTitle className="text-xl font-bold tracking-tight text-primary">Requirement List & Vetting Cost</CardTitle>
            <div className="flex gap-2">
                {canUpdate && (
                  !editMode ? (
                      <Button onClick={() => setEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                          <Edit className="mr-2 h-4 w-4" /> Modify Item List
                      </Button>
                  ) : (
                      <div className="flex gap-2">
                          <Button variant="outline" onClick={handleCancel} className="font-bold border-primary/20 text-primary">Cancel</Button>
                          <Button onClick={handleSave} className="font-bold shadow-md bg-primary text-white">
                              <Save className="mr-2 h-4 w-4" /> Secure Changes
                          </Button>
                      </div>
                  )
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 font-normal">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h4 className="text-lg font-bold text-primary">Combined Cost Per Recipient: <span className="font-mono text-xl">₹{totalKitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></h4>
            {canUpdate && (
                <Button onClick={handleSyncKitAmounts} disabled={isSyncing || editMode} variant="secondary" className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync All Allotments
                </Button>
            )}
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[800px] border rounded-xl overflow-hidden shadow-inner">
                <Table>
                <TableHeader className="bg-primary/5">
                    <TableRow>
                    <TableHead className="w-[50px] font-bold text-primary text-[10px] uppercase tracking-widest">#</TableHead>
                    <TableHead className="min-w-[180px] font-bold text-primary text-[10px] uppercase tracking-widest">Description</TableHead>
                    <TableHead className="min-w-[100px] font-bold text-primary text-[10px] uppercase tracking-widest">Quantity</TableHead>
                    <TableHead className="min-w-[150px] font-bold text-primary text-[10px] uppercase tracking-widest">Unit Type</TableHead>
                    <TableHead className="min-w-[120px] font-bold text-primary text-[10px] uppercase tracking-widest">Price / Unit (₹)</TableHead>
                    <TableHead className="text-right min-w-[150px] font-bold text-primary text-[10px] uppercase tracking-widest">Line Total (₹)</TableHead>
                    {canUpdate && editMode && <TableHead className="w-[50px] text-center font-bold text-primary text-[10px] uppercase tracking-widest">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody className="font-normal">
                    {itemList.map((item: RationItem, index: number) => (
                    <TableRow key={item.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                        <TableCell className="font-mono text-xs opacity-60">{index + 1}</TableCell>
                        <TableCell>
                        <Input value={item.name || ''} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="Description..." disabled={!editMode || !canUpdate} className="font-bold h-8 text-primary" />
                        </TableCell>
                        <TableCell>
                        <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="0" disabled={!editMode || !canUpdate} className="font-bold h-8 text-primary" />
                        </TableCell>
                        <TableCell>
                        <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(item.id, 'quantityType', value)} disabled={!editMode || !canUpdate}>
                            <SelectTrigger className="font-normal h-8"><SelectValue placeholder="Select Type..." /></SelectTrigger>
                            <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                            {quantityTypes.map(type => (
                                <SelectItem key={type} value={type} className="font-normal">{type}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </TableCell>
                        <TableCell>
                        <Input type="number" value={item.price || ''} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} className="text-right font-mono font-bold h-8" disabled={!editMode || !canUpdate} />
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                        ₹{((item.price || 0) * (item.quantity || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {canUpdate && editMode && (
                        <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteItemClick(item.id, item.name)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                        )}
                    </TableRow>
                    ))}
                    {itemList.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={canUpdate && editMode ? 7 : 6} className="text-center h-32 text-muted-foreground italic font-normal opacity-60">
                        No Items Added.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
            {canUpdate && editMode && (
                <Button onClick={handleAddItem} size="sm" variant="outline" className="mt-6 font-bold border-primary/20 text-primary transition-transform active:scale-95 shadow-sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Line Item
                </Button>
            )}
        </CardContent>
      </Card>
    </main>

    <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-destructive uppercase">Remove Line Item?</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    Permanently Erase "{itemToDelete?.itemName}" From This List?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItemConfirm} className="bg-destructive hover:bg-destructive/90 text-white font-bold transition-transform active:scale-95 rounded-[12px] shadow-md">
                    Confirm Deletion
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
