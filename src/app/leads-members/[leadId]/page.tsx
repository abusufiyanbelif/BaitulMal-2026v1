
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc, DocumentReference, collection, writeBatch } from 'firebase/firestore';
import type { Lead, RationItem, ItemCategory, Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Download, Edit, Save, ShieldAlert, Info, RefreshCw, Loader2, Database } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen'];

export default function LeadDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const leadDocRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);

  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);
  
  const beneficiariesCollectionRef = useMemo(() => {
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

  const isLegacyData = useMemo(() => {
    // @ts-ignore
    return lead && !lead.itemCategories && lead.rationLists;
  }, [lead]);

  const itemList = useMemo(() => {
    if (!editableLead) return [];
    if (Array.isArray(editableLead.itemCategories) && editableLead.itemCategories.length > 0) {
        return editableLead.itemCategories[0]?.items || [];
    }
    // Fallback for old structure for safety, though UI should prevent this state.
    // @ts-ignore
    if (editableLead.rationLists && !Array.isArray(editableLead.rationLists)) {
        // @ts-ignore
        return editableLead.rationLists['General Item List'] || [];
    }
    return [];
  }, [editableLead]);


  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.leads-members.update', false);

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
    return items.reduce((sum, item: RationItem) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  };

  const handleSave = () => {
    if (!leadDocRef || !editableLead || !canUpdate) return;
    
    const saveData: Partial<Lead> = {
        name: editableLead.name,
        description: editableLead.description || '',
        notes: editableLead.notes || '',
        startDate: editableLead.startDate,
        endDate: editableLead.endDate,
        status: editableLead.status,
        category: editableLead.category,
        targetAmount: editableLead.targetAmount || 0,
        authenticityStatus: editableLead.authenticityStatus,
        publicVisibility: editableLead.publicVisibility,
        itemCategories: editableLead.itemCategories,
        priceDate: editableLead.priceDate || '',
        shopName: editableLead.shopName || '',
        shopContact: editableLead.shopContact || '',
        shopAddress: editableLead.shopAddress || '',
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
            toast({ title: 'Success', description: 'Lead details saved.', variant: 'success' });
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
        toast({ title: "Error", description: "Cannot sync. Data is missing or you don't have permission.", variant: 'destructive' });
        return;
    }
    
    if (editMode) {
        toast({ title: "Save Required", description: "Please save your changes before syncing.", variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    toast({ title: "Syncing started...", description: "Recalculating and updating beneficiary kit amounts." });

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
        toast({ title: "Sync Complete!", description: `Updated ${beneficiaries.length} beneficiaries and the lead's target amount.`, variant: 'success' });
        forceRefetchBeneficiaries();
    } catch (e: any) {
        console.error("Sync error:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `leads/${leadId}`,
            operation: 'write',
            requestResourceData: { note: `Batch sync for ${beneficiaries.length} beneficiaries` }
        }));
    } finally {
        setIsSyncing(false);
    }
};

  if (isLoading || !editableLead) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Skeleton className="h-10 w-44" />
            </div>
            <Skeleton className="h-9 w-64 mb-4" />
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <Skeleton className="h-8 w-48 mb-4" />
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-96" />
                                <Skeleton className="h-6 w-80" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-32" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        </main>
    );
  }

  if (!lead) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <p className="text-lg text-muted-foreground">Lead not found.</p>
            <Button asChild className="mt-4">
                <Link href="/leads-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </Button>
        </main>
    );
  }

  return (
    <>
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
          <Button variant="outline" asChild>
              <Link href="/leads-members">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Leads
              </Link>
          </Button>
      </div>
      <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{editableLead.name}</h1>
      </div>

      <div className="border-b mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2">
                {canReadSummary && (
                    <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                        <Link href={`/leads-members/${leadId}/summary`}>Summary</Link>
                    </Button>
                )}
                <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                    <Link href={`/leads-members/${leadId}`}>Item List</Link>
                </Button>
                {canReadBeneficiaries && (
                    <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/leads-members/${leadId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                        <Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link>
                    </Button>
                )}
                {canReadDonations && (
                    <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                        <Link href={`/leads-members/${leadId}/donations`}>Donations</Link>
                    </Button>
                )}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

        {isLegacyData && (
            <Alert variant="destructive" className="mb-4">
              <Database className="h-4 w-4" />
              <AlertTitle>Data Migration Required</AlertTitle>
              <AlertDescription>
                This lead is using an old data format. To enable editing of its item lists and full functionality, please run the migration script from your terminal: <code className="font-mono bg-destructive/20 p-1 rounded-sm">npm run db:migrate-categories</code>
              </AlertDescription>
            </Alert>
        )}
      
      <Card className="animate-fade-in-zoom mb-6">
        <CardHeader>
           <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="flex-1">
                  <CardTitle>Lead Details</CardTitle>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                  {canUpdate && (
                      !editMode ? (
                          <Button onClick={() => setEditMode(true)} disabled={isLegacyData}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Details
                          </Button>
                      ) : (
                          <div className="flex gap-2">
                              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                              <Button onClick={handleSave}>
                                  <Save className="mr-2 h-4 w-4" /> Save
                              </Button>
                          </div>
                      )
                  )}
              </div>
           </div>
        </CardHeader>
        <CardContent className="space-y-6">
              <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={editableLead.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} disabled={!editMode || !canUpdate} placeholder="A brief description of the lead..." />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea id="notes" value={editableLead.notes || ''} onChange={(e) => handleFieldChange('notes', e.target.value)} disabled={!editMode || !canUpdate} placeholder="Private notes about this lead..." />
              </div>
        </CardContent>
      </Card>
      
      {editableLead.category === 'Ration' ? (
          <Card className="animate-fade-in-zoom">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Item List</CardTitle>
                <div className="flex gap-2">
                  {canUpdate && (
                    <Button onClick={handleSyncKitAmounts} disabled={isSyncing || editMode} variant="secondary">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Kit Amounts
                    </Button>
                  )}
                  {canUpdate && editMode && (
                    <Button onClick={handleAddItem} size="sm">
                      <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h4 className="text-lg font-bold">Total Kit Cost: <span className="font-mono">₹{totalKitCost.toFixed(2)}</span></h4>
              </div>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead className="min-w-[180px]">Item Name</TableHead>
                      <TableHead className="min-w-[100px]">Quantity</TableHead>
                      <TableHead className="min-w-[150px]">Quantity Type</TableHead>
                      <TableHead className="min-w-[120px]">Price per Unit (₹)</TableHead>
                      <TableHead className="text-right min-w-[150px]">Total Price (₹)</TableHead>
                      {canUpdate && editMode && <TableHead className="w-[50px] text-center">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemList.map((item: RationItem, index: number) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Input value={item.name || ''} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="Item name" disabled={!editMode || !canUpdate} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="e.g. 1" disabled={!editMode || !canUpdate} />
                        </TableCell>
                        <TableCell>
                          <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(item.id, 'quantityType', value)} disabled={!editMode || !canUpdate}>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                              {quantityTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.price || ''} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} className="text-right" disabled={!editMode || !canUpdate} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                        </TableCell>
                        {canUpdate && editMode && (
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItemClick(item.id, item.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {itemList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={canUpdate && editMode ? 7 : 6} className="text-center h-24 text-muted-foreground">
                          No items added yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Not a Ration-Based Lead</AlertTitle>
                <AlertDescription>
                    Item lists and kit amount calculations are only applicable to leads with the 'Ration' category.
                </AlertDescription>
            </Alert>
        )}
    </main>

    <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the item "{itemToDelete?.itemName}" from the list. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItemConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
