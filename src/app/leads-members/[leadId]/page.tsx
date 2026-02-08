
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { doc, updateDoc, DocumentReference, collection, writeBatch } from 'firebase/firestore';
import type { Lead, RationItem, RationCategory, Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, ShieldAlert, Copy } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { get } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen'];

export default function LeadDetailsPage() {
  const params = useParams();
  const leadId = params.leadId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { brandingSettings } = useBranding();
  
  const leadDocRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return doc(firestore, 'leads', leadId) as DocumentReference<Lead>;
  }, [firestore, leadId]);

  const { data: lead, isLoading: isLeadLoading } = useDoc<Lead>(leadDocRef);

  const beneficiariesCollectionRef = useMemo(() => {
    if (!firestore || !leadId) return null;
    return collection(firestore, `leads/${leadId}/beneficiaries`);
  }, [firestore, leadId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [editMode, setEditMode] = useState(false);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryMin, setNewCategoryMin] = useState('');
  const [newCategoryMax, setNewCategoryMax] = useState('');
  
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<RationCategory | null>(null);
  const [dependentBeneficiaries, setDependentBeneficiaries] = useState<Beneficiary[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Copy items state
  const [isCopyItemsOpen, setIsCopyItemsOpen] = useState(false);
  const [copyTargetCategory, setCopyTargetCategory] = useState<RationCategory | null>(null);
  const [copySourceCategoryId, setCopySourceCategoryId] = useState<string | null>(null);
  
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<RationCategory | null>(null);

  // Reset local state if edit mode is cancelled or if the base data changes while NOT in edit mode.
  useEffect(() => {
    if (lead && !editMode) {
      const leadCopy = JSON.parse(JSON.stringify(lead));
       if (leadCopy.rationLists && !Array.isArray(leadCopy.rationLists)) {
        leadCopy.rationLists = [
          {
            id: 'general',
            name: 'General Item List',
            minMembers: 0,
            maxMembers: 0,
            items: (leadCopy.rationLists as any)['General Item List'] || []
          }
        ];
      }
      setEditableLead(leadCopy);
    }
  }, [editMode, lead])
  
  const sanitizedEditableRationLists = useMemo(() => {
    if (!editableLead?.rationLists) return [];
    
    let lists: RationCategory[];

    if (Array.isArray(editableLead.rationLists)) {
        lists = editableLead.rationLists.map(cat => {
            // Rename "General" to "General Item List" for consistent display logic
            if (cat.name === 'General') {
                return { ...cat, name: 'General Item List' };
            }
            return cat;
        });
    } else {
        // Hotfix for old object format
        lists = [
            {
                id: 'general',
                name: 'General Item List',
                minMembers: 0,
                maxMembers: 0,
                items: (editableLead.rationLists as any)['General Item List'] || []
            }
        ];
    }
    
    // Sort to put "General Item List" first
    return lists.sort((a, b) => {
        if (a.name === 'General Item List') return -1;
        if (b.name === 'General Item List') return 1;
        return a.name.localeCompare(b.name);
    });
  }, [editableLead?.rationLists]);

  const canReadSummary = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.leads-members.update', false);

  const isLoading = isLeadLoading || isProfileLoading || areBeneficiariesLoading;

  const handleFieldChange = (field: keyof Lead, value: any) => {
    if (!editableLead) return;
    setEditableLead(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleItemChange = (categoryId: string, itemId: string, field: keyof RationItem, value: string | number) => {
    if (!editableLead || !editableLead.rationLists) return;
    
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id !== categoryId) return cat;
        const updatedItems = cat.items.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, [field]: value };
        });
        return { ...cat, items: updatedItems };
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const handleAddItem = (categoryId: string) => {
    if (!editableLead || !editableLead.rationLists) return;
    const newItem: RationItem = { id: `item-${Date.now()}`, name: '', quantity: 1, quantityType: 'kg', price: 0, notes: '' };
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: [...cat.items, newItem] };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    if (!editableLead || !editableLead.rationLists) return;
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };
  
  const calculateTotal = (items: RationItem[]) => {
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  };

  const handleSave = () => {
    if (!leadDocRef || !editableLead || !canUpdate) return;

    // Only send the fields that are editable on this page
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
        rationLists: sanitizedEditableRationLists,
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
      // editableLead will be reset by the useEffect
  };

  const handleAddNewCategory = () => {
    if (!editableLead) return;

    const min = Number(newCategoryMin);
    const max = Number(newCategoryMax);

    if (!newCategoryName.trim()) {
        toast({ title: 'Invalid Name', description: 'Category name cannot be empty.', variant: 'destructive' });
        return;
    }
    if (isNaN(min) || isNaN(max) || min < 1 || min > max) {
        toast({ title: 'Invalid Range', description: 'Please enter valid positive numbers for min and max members, with min being less than or equal to max.', variant: 'destructive' });
        return;
    }
    
    const newCategory: RationCategory = {
        id: `cat-${Date.now()}`,
        name: newCategoryName,
        minMembers: min,
        maxMembers: max,
        items: []
    };
    
    const newRationLists = [...sanitizedEditableRationLists, newCategory];
    handleFieldChange('rationLists', newRationLists);
    
    setNewCategoryName('');
    setNewCategoryMin('');
    setNewCategoryMax('');
    setIsAddCategoryOpen(false);
  };
  
  const handleEditCategoryClick = (category: RationCategory) => {
    if (!canUpdate || !editMode || category.name === 'General Item List') return;
    setCategoryToEdit(JSON.parse(JSON.stringify(category))); // Deep copy
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!editableLead || !categoryToEdit) return;

    const min = Number(categoryToEdit.minMembers);
    const max = Number(categoryToEdit.maxMembers);

    if (!categoryToEdit.name.trim()) {
        toast({ title: 'Invalid Name', description: 'Category name cannot be empty.', variant: 'destructive' });
        return;
    }
    if (isNaN(min) || isNaN(max) || min < 1 || min > max) {
        toast({ title: 'Invalid Range', description: 'Please enter valid positive numbers for min and max members, with min being less than or equal to max.', variant: 'destructive' });
        return;
    }

    const newRationLists = sanitizedEditableRationLists.map(cat => 
        cat.id === categoryToEdit.id ? categoryToEdit : cat
    );
    handleFieldChange('rationLists', newRationLists);
    
    setIsEditCategoryOpen(false);
    setCategoryToEdit(null);
  };

  const handleDeleteCategoryClick = (categoryToDelete: RationCategory) => {
      if (!beneficiaries || !canUpdate || !editMode || categoryToDelete.name === 'General Item List') return;
      
      const generalCategory = sanitizedEditableRationLists.find(cat => cat.name === 'General Item List');

      const dependents = beneficiaries.filter(beneficiary => {
          const members = beneficiary.members;
          if (members === undefined || members === null) return false;

          const specificCategory = sanitizedEditableRationLists.find(
            cat => cat.name !== 'General Item List' && members >= cat.minMembers && members <= cat.maxMembers
          );
          
          const appliedCategory = specificCategory || generalCategory;
          
          return appliedCategory?.id === categoryToDelete.id;
      });
      
      setCategoryToDelete(categoryToDelete);
      setDependentBeneficiaries(dependents);
      setTargetCategoryId(null);
      setIsDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!firestore || !canUpdate || !categoryToDelete || !editableLead) return;

    if (dependentBeneficiaries.length > 0 && !targetCategoryId) {
        toast({ title: 'Error', description: 'Please select a category to move beneficiaries to.', variant: 'destructive'});
        return;
    }

    setIsDeletingCategory(true);
    
    try {
        const batch = writeBatch(firestore);

        if (dependentBeneficiaries.length > 0 && targetCategoryId) {
            const targetCategory = sanitizedEditableRationLists.find(c => c.id === targetCategoryId);
            if (!targetCategory) throw new Error("Target category not found.");
            
            const newKitAmount = calculateTotal(targetCategory.items);
            
            for (const beneficiary of dependentBeneficiaries) {
                const beneficiaryRef = doc(firestore, `leads/${leadId}/beneficiaries`, beneficiary.id);
                batch.update(beneficiaryRef, { kitAmount: newKitAmount });
            }
        }

        const newRationLists = sanitizedEditableRationLists.filter(cat => cat.id !== categoryToDelete.id);
        if(leadDocRef) {
          batch.update(leadDocRef, { rationLists: newRationLists });
        }
        
        await batch.commit();

        handleFieldChange('rationLists', newRationLists);

        toast({ title: 'Category Deleted', description: `Successfully deleted '${categoryToDelete.name}'.`, variant: 'success' });
        
        setIsDeleteCategoryDialogOpen(false);
        setCategoryToDelete(null);

    } catch (error: any) {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `leads/${leadId}`,
            operation: 'write',
            requestResourceData: { note: `Batch delete category operation for ${categoryToDelete.name}` }
        }));
    } finally {
        setIsDeletingCategory(false);
    }
  };

  const handleCopyItemsClick = (category: RationCategory) => {
    setCopyTargetCategory(category);
    setCopySourceCategoryId(null);
    setIsCopyItemsOpen(true);
  };

  const handleCopyItemsConfirm = () => {
    if (!editableLead || !copyTargetCategory || !copySourceCategoryId) return;

    const sourceCategory = sanitizedEditableRationLists.find(c => c.id === copySourceCategoryId);
    if (!sourceCategory) {
        toast({ title: "Error", description: "Source category not found.", variant: "destructive" });
        return;
    }

    const itemsToAppend = sourceCategory.items.map(item => ({
        ...item,
        id: `${copyTargetCategory.id}-item-${Date.now()}-${Math.random()}`
    }));
    
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === copyTargetCategory.id) {
            return { ...cat, items: [...cat.items, ...itemsToAppend] };
        }
        return cat;
    });

    handleFieldChange('rationLists', newRationLists);
    
    toast({ title: 'Success', description: `Copied ${itemsToAppend.length} items to '${copyTargetCategory.name}'.` });
    setIsCopyItemsOpen(false);
  };

  const renderRationTable = (category: RationCategory) => {
    const total = calculateTotal(category.items);

    return (
      <Card className="animate-fade-in-zoom">
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>{category.name === 'General Item List' ? 'Item List' : 'Items for this category'}</CardTitle>
                {canUpdate && editMode && (
                    <div className="flex gap-2">
                        <Button onClick={() => handleCopyItemsClick(category)} size="sm" variant="outline">
                          <Copy className="mr-2 h-4 w-4" /> Copy Items
                        </Button>
                        <Button onClick={() => handleAddItem(category.id)} size="sm">
                          <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </div>
                )}
            </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h4 className="text-lg font-bold">Total Kit Cost: <span className="font-mono">₹{total.toFixed(2)}</span></h4>
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[180px]">Item Name</TableHead>
                        <TableHead className="min-w-[100px]">Quantity</TableHead>
                        <TableHead className="min-w-[150px]">Quantity Type</TableHead>
                        <TableHead className="min-w-[120px]">Price per Unit (₹)</TableHead>
                        <TableHead className="min-w-[180px]">Notes</TableHead>
                        <TableHead className="text-right min-w-[150px]">Total Price (₹)</TableHead>
                        {canUpdate && editMode && <TableHead className="w-[50px] text-center">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {category.items.map((item, index) => (
                        <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                                <Input value={item.name || ''} onChange={e => handleItemChange(category.id, item.id, 'name', e.target.value)} placeholder="Item name" disabled={!editMode || !canUpdate} />
                            </TableCell>
                            <TableCell>
                                <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(category.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="e.g. 1" disabled={!editMode || !canUpdate} />
                            </TableCell>
                            <TableCell>
                                <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(category.id, item.id, 'quantityType', value)} disabled={!editMode || !canUpdate}>
                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                    <SelectContent>
                                        {quantityTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                                <Input type="number" value={item.price || ''} onChange={e => handleItemChange(category.id, item.id, 'price', parseFloat(e.target.value) || 0)} className="text-right" disabled={!editMode || !canUpdate} />
                            </TableCell>
                            <TableCell>
                                <Input value={item.notes || ''} onChange={e => handleItemChange(category.id, item.id, 'notes', e.target.value)} placeholder="e.g. brand, quality" disabled={!editMode || !canUpdate} />
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                ₹{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                            </TableCell>
                            {canUpdate && editMode && (
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(category.id, item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                    {category.items.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={canUpdate && editMode ? 8 : 7} className="text-center h-24 text-muted-foreground">
                                No items added yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
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
              <div className="flex w-max space-x-4">
                  {userProfile && canReadSummary && (
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        <Link href={`/leads-members/${leadId}/summary`}>Summary</Link>
                    </Button>
                  )}
                  {userProfile && (
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-primary text-primary shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none" data-active="true">
                        <Link href={`/leads-members/${leadId}`}>Item List</Link>
                    </Button>
                  )}
                  {userProfile && canReadBeneficiaries && (
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        <Link href={`/leads-members/${leadId}/beneficiaries`}>Beneficiary Details</Link>
                    </Button>
                  )}
                   {userProfile && canReadDonations && (
                    <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        <Link href={`/leads-members/${leadId}/donations`}>Donations</Link>
                    </Button>
                  )}
              </div>
              <ScrollBar orientation="horizontal" />
          </ScrollArea>
      </div>
      
      <Card className="animate-fade-in-zoom">
        <CardHeader>
           <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="flex-1">
                  <CardTitle>Lead Details</CardTitle>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                  {canUpdate && (
                      !editMode ? (
                          <Button onClick={() => setEditMode(true)}>
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
                  {editableLead.category === 'Ration' && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download List
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => {}}>Download as CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download as Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download as PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
           </div>
        </CardHeader>
        <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                      <Label htmlFor="leadName">Lead Name</Label>
                      <Input id="leadName" value={editableLead.name} onChange={(e) => handleFieldChange('name', e.target.value)} disabled={!editMode || !canUpdate} />
                  </div>
                   <div className="space-y-1">
                      <Label htmlFor="category">Category</Label>
                      <Select value={editableLead.category} onValueChange={(value) => handleFieldChange('category', value)} disabled={!editMode || !canUpdate}>
                          <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Ration">Ration</SelectItem>
                              <SelectItem value="Relief">Relief</SelectItem>
                              <SelectItem value="General">General</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-1">
                      <Label htmlFor="status">Status</Label>
                      <Select value={editableLead.status} onValueChange={(value) => handleFieldChange('status', value)} disabled={!editMode || !canUpdate}>
                          <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Upcoming">Upcoming</SelectItem>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-1">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input id="startDate" type="date" value={editableLead.startDate} onChange={(e) => handleFieldChange('startDate', e.target.value)} disabled={!editMode || !canUpdate} />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input id="endDate" type="date" value={editableLead.endDate} onChange={(e) => handleFieldChange('endDate', e.target.value)} disabled={!editMode || !canUpdate} />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="targetAmount">Target Amount</Label>
                      <Input id="targetAmount" type="number" value={editableLead.targetAmount} onChange={(e) => handleFieldChange('targetAmount', Number(e.target.value))} disabled={!editMode || !canUpdate} />
                  </div>
                  {editableLead.category === 'Ration' && (
                    <>
                       <div className="space-y-1">
                            <Label htmlFor="priceDate">Price Date</Label>
                            <Input id="priceDate" type="date" value={editableLead.priceDate || ''} onChange={(e) => handleFieldChange('priceDate', e.target.value)} disabled={!editMode || !canUpdate} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="shopName">Shop Name</Label>
                            <Input id="shopName" value={editableLead.shopName || ''} onChange={(e) => handleFieldChange('shopName', e.target.value)} disabled={!editMode || !canUpdate} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="shopContact">Shop Contact</Label>
                            <Input id="shopContact" value={editableLead.shopContact || ''} onChange={(e) => handleFieldChange('shopContact', e.target.value)} disabled={!editMode || !canUpdate} />
                        </div>
                        <div className="space-y-1 col-span-1 md:col-span-2 lg:col-span-3">
                            <Label htmlFor="shopAddress">Shop Address</Label>
                            <Input id="shopAddress" value={editableLead.shopAddress || ''} onChange={(e) => handleFieldChange('shopAddress', e.target.value)} disabled={!editMode || !canUpdate} />
                        </div>
                    </>
                  )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                      <Label htmlFor="authenticityStatus">Authenticity Status</Label>
                      <Select value={editableLead.authenticityStatus || 'Pending Verification'} onValueChange={(value) => handleFieldChange('authenticityStatus', value)} disabled={!editMode || !canUpdate}>
                          <SelectTrigger id="authenticityStatus"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                              <SelectItem value="On Hold">On Hold</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                              <SelectItem value="Need More Details">Need More Details</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="publicVisibility">Public Visibility</Label>
                      <Select value={editableLead.publicVisibility || 'Hold'} onValueChange={(value) => handleFieldChange('publicVisibility', value)} disabled={!editMode || !canUpdate}>
                          <SelectTrigger id="publicVisibility"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Hold">Hold (Private)</SelectItem>
                              <SelectItem value="Ready to Publish">Ready to Publish</SelectItem>
                              <SelectItem value="Published">Published</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
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
            <div className="mt-6">
                {(sanitizedEditableRationLists.length > 0) ? (
                    <Tabs defaultValue={sanitizedEditableRationLists[0]?.id} className="w-full">
                        <ScrollArea>
                            <TabsList>
                                {sanitizedEditableRationLists.map(category => (
                                    <div key={category.id} className="flex items-center gap-1 p-1">
                                        <TabsTrigger value={category.id}>
                                            {category.name === 'General Item List'
                                                ? 'General Item List'
                                                : category.minMembers === category.maxMembers
                                                    ? `${category.name} ${category.minMembers}`
                                                    : `${category.name} (${category.minMembers}-${category.maxMembers})`
                                            }
                                        </TabsTrigger>
                                        {editMode && canUpdate && category.name !== 'General Item List' && (
                                            <div className="flex items-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 shrink-0"
                                                    onClick={() => handleEditCategoryClick(category)}
                                                    title="Edit category"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 shrink-0"
                                                    onClick={() => handleDeleteCategoryClick(category)}
                                                    disabled={isDeletingCategory}
                                                    title="Delete category"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </TabsList>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        {sanitizedEditableRationLists.map(category => (
                            <TabsContent key={category.id} value={category.id} className="mt-4">
                                {renderRationTable(category)}
                            </TabsContent>
                        ))}
                    </Tabs>
                ) : (
                    <div className="text-center text-muted-foreground py-10 border rounded-md">
                        No ration categories defined for this lead yet.
                    </div>
                )}
            </div>
        ) : (
            <div className="mt-6">
                {sanitizedEditableRationLists.find(c => c.name === 'General Item List') &&
                    renderRationTable(sanitizedEditableRationLists.find(c => c.name === 'General Item List')!)
                }
            </div>
        )}

        <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Delete Category: {categoryToDelete?.name}?</AlertDialogTitle>
                    {dependentBeneficiaries.length === 0 ? (
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete this category and all of its items? This action cannot be undone.
                        </AlertDialogDescription>
                    ) : (
                        <AlertDialogDescription>
                            <Alert variant="destructive" className="mb-4">
                                <ShieldAlert className="h-4 w-4" />
                                <AlertTitle>Warning: {dependentBeneficiaries.length} Beneficiaries Found</AlertTitle>
                                <AlertDescription>
                                    These beneficiaries are linked to this category. You must move them to another category before deleting this one. Their kit amounts will be automatically recalculated.
                                </AlertDescription>
                            </Alert>
                            <div className="pt-4 space-y-2">
                                <Label htmlFor="target-category-lead">Move Beneficiaries To</Label>
                                <Select onValueChange={setTargetCategoryId} value={targetCategoryId || ''}>
                                    <SelectTrigger id="target-category-lead">
                                        <SelectValue placeholder="Select a new category..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sanitizedEditableRationLists.filter(cat => cat.id !== categoryToDelete?.id).map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                                {cat.name !== 'General Item List' && ` (${cat.minMembers}-${cat.maxMembers} Members)`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteCategoryConfirm} 
                    disabled={isDeletingCategory || (dependentBeneficiaries.length > 0 && !targetCategoryId)}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeletingCategory ? <Loader2 className="animate-spin" /> : 'Delete'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
      </AlertDialog>

       <Dialog open={isCopyItemsOpen} onOpenChange={setIsCopyItemsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Copy Items to '{copyTargetCategory?.name}'</DialogTitle>
                    <DialogDescription>
                        Select a source category to copy all of its items into the current category.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Label htmlFor="source-category-copy-lead">Copy items from</Label>
                    <Select onValueChange={setCopySourceCategoryId} value={copySourceCategoryId || ''}>
                        <SelectTrigger id="source-category-copy-lead">
                            <SelectValue placeholder="Select a source category..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sanitizedEditableRationLists.filter(cat => cat.id !== copyTargetCategory?.id).map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>
                                     {cat.name === 'General Item List'
                                        ? 'General Item List'
                                        : cat.minMembers === cat.maxMembers
                                            ? `${cat.name} ${cat.minMembers}`
                                            : `${cat.name} (${cat.minMembers}-${cat.maxMembers})`
                                    }
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCopyItemsOpen(false)}>Cancel</Button>
                    <Button onClick={handleCopyItemsConfirm} disabled={!copySourceCategoryId}>
                        <Copy className="mr-2 h-4 w-4" /> Copy Items
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Category: {categoryToEdit?.name}</DialogTitle>
                    <DialogDescription>Update the category name and member range.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-cat-name-lead">Category Name</Label>
                        <Input
                            id="edit-cat-name-lead"
                            value={categoryToEdit?.name || ''}
                            onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, name: e.target.value} : null)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-min-members-lead">Min Members</Label>
                            <Input
                                id="edit-min-members-lead"
                                type="number"
                                value={categoryToEdit?.minMembers || ''}
                                onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, minMembers: Number(e.target.value) || 0} : null)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-max-members-lead">Max Members</Label>
                            <Input
                                id="edit-max-members-lead"
                                type="number"
                                value={categoryToEdit?.maxMembers || ''}
                                onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, maxMembers: Number(e.target.value) || 0} : null)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditCategoryOpen(false)}>Cancel</Button>
                    <Button type="submit" onClick={handleUpdateCategory}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
    </>
  );
}
