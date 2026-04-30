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
import { VerificationRequestDialog } from '@/components/verification-request-dialog';
import { PendingUpdateWarning } from '@/components/pending-update-warning';

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
 
    const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_config') : null, [firestore]);
    const { data: configSettings } = useDoc<any>(configRef);

    const effectiveVerificationMode = useMemo(() => {
        const rawMode = configSettings?.verificationMode || (configSettings?.isVerificationRequired ? 'Mandatory' : 'Disabled');
        // Per user request: Active or Completed records make approval optional (bypassable)
        if (rawMode !== 'Disabled' && rawMode !== 'disabled' && (lead?.status === 'Active' || lead?.status === 'Completed')) {
            return 'Optional';
        }
        return rawMode;
    }, [configSettings, lead?.status]);

  const [editMode, setEditMode] = useState(false);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ itemId: string; itemName: string } | null>(null);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<any>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('general');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const currentCategory = useMemo(() => {
    return editableLead?.itemCategories?.find(c => c.id === selectedCategoryId) || editableLead?.itemCategories?.[0];
  }, [editableLead, selectedCategoryId]);

  const itemList = useMemo(() => {
    return currentCategory?.items || [];
  }, [currentCategory]);

  useEffect(() => {
    if (lead && !editMode) {
      setEditableLead(JSON.parse(JSON.stringify(lead)));
      if (lead.itemCategories?.[0]) {
        setSelectedCategoryId(lead.itemCategories[0].id);
      }
    }
  }, [editMode, lead]);

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
    
    const updatedCategories = editableLead.itemCategories.map(cat => {
      if (cat.id === selectedCategoryId) {
        const updatedItems = cat.items.map(item => 
          item.id === itemId ? { ...item, [field]: value } : item
        );
        return { ...cat, items: updatedItems };
      }
      return cat;
    });

    handleFieldChange('itemCategories', updatedCategories);
  };

  const handleAddItem = () => {
    if (!editableLead || !selectedCategoryId) return;
    const newItem: RationItem = { id: `item-${Date.now()}`, name: '', quantity: 1, quantityType: 'unit', price: 0, notes: '' };
    
    const updatedCategories = editableLead.itemCategories.map(cat => {
      if (cat.id === selectedCategoryId) {
        return { ...cat, items: [...cat.items, newItem] };
      }
      return cat;
    });

    handleFieldChange('itemCategories', updatedCategories);
  };

  const handleAddCategory = () => {
    if (!editableLead || !newCategoryName.trim()) return;
    const newCat: ItemCategory = {
        id: `cat-${Date.now()}`,
        name: newCategoryName.trim(),
        items: [],
        beneficiaryCount: 0
    };
    const updatedCategories = [...(editableLead.itemCategories || []), newCat];
    handleFieldChange('itemCategories', updatedCategories);
    setNewCategoryName('');
    setIsAddingCategory(false);
    setSelectedCategoryId(newCat.id);
  };

  const handleDeleteCategory = (catId: string) => {
    if (!editableLead || (editableLead.itemCategories?.length || 0) <= 1) return;
    const updatedCategories = editableLead.itemCategories.filter(c => c.id !== catId);
    handleFieldChange('itemCategories', updatedCategories);
    if (selectedCategoryId === catId) {
        setSelectedCategoryId(updatedCategories[0].id);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!editableLead || !selectedCategoryId) return;
    
    const updatedCategories = editableLead.itemCategories.map(cat => {
      if (cat.id === selectedCategoryId) {
        return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
      }
      return cat;
    });

    handleFieldChange('itemCategories', updatedCategories);
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
    return items.reduce((sum, item: RationItem) => sum + (Number(item.price) || 0), 0);
  };

  const handleSave = () => {
    if (!leadDocRef || !editableLead || !canUpdate) return;
    
    const saveData: Partial<Lead> = {
         itemCategories: editableLead.itemCategories,
     };
 
     const isApprovalRequired = configSettings?.verificationMode 
         ? (configSettings.verificationMode !== 'Disabled' && configSettings.verificationMode !== 'disabled')
         : !!configSettings?.isVerificationRequired;

     if (isApprovalRequired) {
         setPendingUpdates(saveData);
         setIsVerificationDialogOpen(true);
         return;
     }
     
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
    
    // Create a map of category ID to its total cost
    const categoryCostMap: Record<string, number> = {};
    const updatedItemCategories = (editableLead.itemCategories || []).map(cat => {
        const cost = cat.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        categoryCostMap[cat.id] = cost;
        return { ...cat, beneficiaryCount: 0 }; // Reset for recounting
    });

    const stats = { total: 0, given: 0, pending: 0, zakatEligible: 0 };
    const categoryCounts: Record<string, number> = {};

    for (const beneficiary of beneficiaries) {
      const catId = beneficiary.itemCategoryId || 'general';
      const newKitAmount = categoryCostMap[catId] || categoryCostMap['general'] || (updatedItemCategories[0] ? categoryCostMap[updatedItemCategories[0].id] : 0);
      
      const beneficiaryRef = doc(firestore, `leads/${leadId}/beneficiaries`, beneficiary.id);
      batch.update(beneficiaryRef, { kitAmount: newKitAmount });
      
      newTotalRequiredAmount += newKitAmount;
      
      // Update stats for lead doc
      stats.total += 1;
      if (beneficiary.status === 'Given') stats.given += 1;
      else stats.pending += 1;
      if (beneficiary.isEligibleForZakat) stats.zakatEligible += 1;
      
      categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
    }

    // Finalize counts in updatedItemCategories
    updatedItemCategories.forEach(cat => {
        cat.beneficiaryCount = categoryCounts[cat.id] || 0;
    });

    if (leadDocRef) {
        batch.update(leadDocRef, { 
            targetAmount: newTotalRequiredAmount,
            requiredAmount: newTotalRequiredAmount,
            beneficiaryStats: stats,
            itemCategories: updatedItemCategories,
            updatedAt: new Date().toISOString() as any
        });
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

  const totalKitCost = useMemo(() => calculateTotal(itemList), [itemList]);

  return (
    <>
    {isSyncing && <BrandedLoader message="Synchronizing Registry Amounts..." />}
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

      <PendingUpdateWarning targetId={leadId} module="leads" />

      <div className="border-b border-primary/10 mb-4">
        <ScrollArea className="w-full">
            <div className="flex w-max space-x-2 pb-2">
                {canReadSummary && (
                    <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/summary') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                )}
                <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                {canReadBeneficiaries && (
                    <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                )}
                {canReadDonations && (
                    <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                )}
                <Link href={`/leads-members/${leadId}/audit`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname.endsWith('/audit') ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Audit Trail</Link>
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
          {/* Category Selection Tabs */}
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    {editableLead.itemCategories?.map((cat) => (
                        <div key={cat.id} className="relative group">
                            <Button 
                                variant={selectedCategoryId === cat.id ? 'default' : 'outline'} 
                                size="sm" 
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={cn(
                                    "font-bold transition-all duration-200 active:scale-95",
                                    selectedCategoryId === cat.id ? "shadow-md" : "text-muted-foreground border-primary/10"
                                )}
                            >
                                {cat.name}
                                {cat.beneficiaryCount !== undefined && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">
                                        {cat.beneficiaryCount}
                                    </span>
                                )}
                            </Button>
                            {editMode && (editableLead.itemCategories?.length || 0) > 1 && (
                                <button 
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-2 w-2" />
                                </button>
                            )}
                        </div>
                    ))}
                    {editMode && !isAddingCategory && (
                        <Button variant="ghost" size="sm" onClick={() => setIsAddingCategory(true)} className="text-primary font-bold">
                            <Plus className="h-4 w-4 mr-1" /> Add Category
                        </Button>
                    )}
                    {editMode && isAddingCategory && (
                        <div className="flex items-center gap-2 animate-fade-in-zoom">
                            <Input 
                                placeholder="Category Name..." 
                                value={newCategoryName} 
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="h-8 text-xs font-normal w-32"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={handleAddCategory}><CheckCircle2 className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setIsAddingCategory(false)}><X className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center flex-wrap gap-4 pt-2 border-t border-primary/5">
                <h4 className="text-lg font-bold text-primary">
                    Cost for <span className="text-primary/70">{currentCategory?.name}</span>: 
                    <span className="font-mono text-xl ml-2 text-primary">₹{totalKitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </h4>
                {canUpdate && (
                    <Button onClick={handleSyncKitAmounts} disabled={isSyncing || editMode} variant="secondary" className="font-bold border-primary/10 text-primary transition-transform active:scale-95 shadow-sm">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync All Allotments
                    </Button>
                )}
            </div>
          </div>
>
          <ScrollArea className="w-full">
            <div className="min-w-[800px] border rounded-xl overflow-hidden shadow-inner">
                <Table>
                <TableHeader className="bg-primary/5">
                    <TableRow>
                    <TableHead className="w-[50px] font-bold text-primary text-[10px] capitalize tracking-widest">#</TableHead>
                    <TableHead className="min-w-[180px] font-bold text-primary text-[10px] capitalize tracking-widest">Description</TableHead>
                    <TableHead className="min-w-[100px] font-bold text-primary text-[10px] capitalize tracking-widest">Quantity</TableHead>
                    <TableHead className="min-w-[150px] font-bold text-primary text-[10px] capitalize tracking-widest">Unit Type</TableHead>
                    <TableHead className="min-w-[120px] font-bold text-primary text-[10px] capitalize tracking-widest">Price / Unit (₹)</TableHead>
                    <TableHead className="text-right min-w-[150px] font-bold text-primary text-[10px] capitalize tracking-widest">Line Total (₹)</TableHead>
                    {canUpdate && editMode && <TableHead className="w-[50px] text-center font-bold text-primary text-[10px] capitalize tracking-widest">Action</TableHead>}
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
                <AlertDialogTitle className="font-bold text-destructive capitalize">Remove Line Item?</AlertDialogTitle>
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

    {userProfile && pendingUpdates && (
        <VerificationRequestDialog
            isOpen={isVerificationDialogOpen}
            onOpenChange={setIsVerificationDialogOpen}
            user={{ id: userProfile.id, name: userProfile.name }}
            isOptional={effectiveVerificationMode.toLowerCase() === 'optional'}
            minApprovals={configSettings?.minApprovalsRequired || 1}
            onBypass={() => {
                setIsVerificationDialogOpen(false);
                updateDoc(leadDocRef!, pendingUpdates)
                    .catch(async (serverError) => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: leadDocRef!.path,
                            operation: 'update',
                            requestResourceData: pendingUpdates,
                        } satisfies SecurityRuleContext));
                    })
                    .finally(() => {
                        toast({ title: 'Success', description: 'Lead Item List Synchronized.', variant: 'success' });
                        setEditMode(false);
                    });
            }}
            onSuccess={() => {
                setEditMode(false);
            }}
            payload={{
                module: 'leads',
                targetId: leadId,
                targetCollection: 'leads',
                description: `Update requirement list for ${lead?.name}`,
                originalValue: lead || {},
                newValue: pendingUpdates,
                revalidatePath: `/leads-members/${leadId}`
            }}
        />
    )}
    </>
  );
}