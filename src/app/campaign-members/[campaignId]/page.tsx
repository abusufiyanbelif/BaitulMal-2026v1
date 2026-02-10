

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { doc, updateDoc, DocumentReference, collection, writeBatch } from 'firebase/firestore';
import type { Campaign, RationItem, Beneficiary, RationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, Copy, RefreshCw, ShieldAlert, Info } from 'lucide-react';
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn, getNestedValue } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';



const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen'];

export default function CampaignDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { brandingSettings } = useBranding();
  
  const campaignDocRef = useMemo(() => {
    if (!firestore || !campaignId) return null;
    return doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign>;
  }, [firestore, campaignId]);

  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  
  const beneficiariesCollectionRef = useMemo(() => {
    if (!firestore || !campaignId) return null;
    return collection(firestore, `campaigns/${campaignId}/beneficiaries`);
  }, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [editMode, setEditMode] = useState(false);
  const [editableCampaign, setEditableCampaign] = useState<Campaign | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryMin, setNewCategoryMin] = useState('');
  const [newCategoryMax, setNewCategoryMax] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<RationCategory | null>(null);
  const [dependentBeneficiaries, setDependentBeneficiaries] = useState<Beneficiary[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Copy items state
  const [isCopyItemsOpen, setIsCopyItemsOpen] = useState(false);
  const [copyTargetCategory, setCopyTargetCategory] = useState<RationCategory | null>(null);
  const [copySourceCategoryId, setCopySourceCategoryId] = useState<string | null>(null);
  const [selectedItemsToCopy, setSelectedItemsToCopy] = useState<string[]>([]);
  
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<RationCategory | null>(null);

  // Reset local state if edit mode is cancelled or if the base data changes while NOT in edit mode.
  useEffect(() => {
    if (campaign && !editMode) {
        const campaignCopy = JSON.parse(JSON.stringify(campaign));
        // Sanitize rationLists on load
        if (campaignCopy.rationLists && !Array.isArray(campaignCopy.rationLists)) {
            campaignCopy.rationLists = [
                {
                    id: 'general',
                    name: 'General Item List',
                    minMembers: 0,
                    maxMembers: 0,
                    items: (campaignCopy.rationLists as any)['General Item List'] || []
                }
            ];
        }
        setEditableCampaign(campaignCopy);
    }
  }, [editMode, campaign])

  useEffect(() => {
    if (!isCopyItemsOpen) {
        setCopySourceCategoryId(null);
        setSelectedItemsToCopy([]);
    }
  }, [isCopyItemsOpen]);

  const sanitizedEditableRationLists = useMemo(() => {
    if (!editableCampaign?.rationLists) return [];
    
    let lists: RationCategory[];

    if (Array.isArray(editableCampaign.rationLists)) {
        lists = editableCampaign.rationLists.map(cat => {
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
                items: (editableCampaign.rationLists as any)['General Item List'] || []
            }
        ];
    }
    
    // Sort to put "General Item List" first, then by min members
    return lists.sort((a, b) => {
        if (a.name === 'General Item List') return -1;
        if (b.name === 'General Item List') return 1;
        return a.minMembers - b.minMembers;
    });
  }, [editableCampaign?.rationLists]);

  const sourceCategoryForCopy = useMemo(() => {
    if (!copySourceCategoryId) return null;
    return sanitizedEditableRationLists.find(c => c.id === copySourceCategoryId);
  }, [copySourceCategoryId, sanitizedEditableRationLists]);
  
  const masterPriceList = useMemo(() => {
    const generalCategory = sanitizedEditableRationLists.find(
      cat => cat.name === 'General Item List'
    );
    if (!generalCategory?.items) {
      return {};
    }
    return generalCategory.items.reduce((acc, item) => {
        const itemName = (item.name || '').trim().toLowerCase();
        if (itemName) {
            const unitPrice = Number(item.price) || 0;
            acc[itemName] = {
                price: unitPrice,
                quantityType: item.quantityType || '',
            };
        }
        return acc;
    }, {} as Record<string, { price: number; quantityType: string }>);
  }, [sanitizedEditableRationLists]);

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.update', false) || getNestedValue(userProfile, 'permissions.campaigns.ration.update', false);

  const isLoading = isCampaignLoading || isProfileLoading || areBeneficiariesLoading;

  const handleSave = () => {
    if (!campaignDocRef || !editableCampaign || !canUpdate) return;

    // Only send the fields that are editable on this page to respect granular security rules
    const saveData = {
        priceDate: editableCampaign.priceDate,
        shopName: editableCampaign.shopName,
        shopContact: editableCampaign.shopContact,
        shopAddress: editableCampaign.shopAddress,
        rationLists: sanitizedEditableRationLists,
    };
    
    updateDoc(campaignDocRef, saveData)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: campaignDocRef.path,
                operation: 'update',
                requestResourceData: saveData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Campaign details saved.', variant: 'success' });
            setEditMode(false);
        });
  };

  const handleCancel = () => {
      setEditMode(false);
      // editableCampaign will be reset by the useEffect
  };

  const handleFieldChange = (field: keyof Campaign, value: any) => {
    if (!editableCampaign) return;
    setEditableCampaign(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleItemChange = (
    categoryId: string,
    itemId: string,
    field: keyof RationItem,
    value: string | number
  ) => {
    if (!editableCampaign || !editableCampaign.rationLists) return;

    const oldItem = sanitizedEditableRationLists.find(c => c.id === categoryId)?.items.find(i => i.id === itemId);
    const oldName = oldItem?.name?.trim().toLowerCase();

    const category = sanitizedEditableRationLists.find(cat => cat.id === categoryId);
    const isGeneralList = category?.name === 'General Item List';

    // Create a deep copy to avoid mutation issues
    const newRationLists = JSON.parse(JSON.stringify(sanitizedEditableRationLists));

    // Find the category and item to update
    const categoryToUpdate = newRationLists.find((cat: RationCategory) => cat.id === categoryId);
    if (!categoryToUpdate) return;

    const itemToUpdate = categoryToUpdate.items.find((item: RationItem) => item.id === itemId);
    if (!itemToUpdate) return;

    // Update the specific field
    (itemToUpdate as any)[field] = value;
    
    // If we're updating a non-general list, just recalculate its price from the master list
    if (!isGeneralList) {
        const masterItem = masterPriceList[itemToUpdate.name.trim().toLowerCase()];
        if (field === 'quantity' || field === 'name') {
            if (masterItem) {
                itemToUpdate.price = masterItem.price * (Number(itemToUpdate.quantity) || 0);
                itemToUpdate.quantityType = masterItem.quantityType;
            } else {
                itemToUpdate.price = 0;
                itemToUpdate.quantityType = '';
            }
        }
    }
    
    // If we are updating the general list, we need to propagate the changes.
    if (isGeneralList && oldName) {
        const newName = itemToUpdate.name.trim().toLowerCase();
        const newUnitPrice = Number(itemToUpdate.price) || 0;
        const newUnitType = itemToUpdate.quantityType || '';

        // Iterate over all other categories and update matching items
        newRationLists.forEach((cat: RationCategory) => {
            if (cat.id !== categoryId) { // Don't update the general list itself
                cat.items.forEach((item: RationItem) => {
                    if (item.name.trim().toLowerCase() === oldName) {
                        item.price = newUnitPrice * (Number(item.quantity) || 0);
                        item.quantityType = newUnitType;
                        if (field === 'name') {
                            item.name = itemToUpdate.name;
                        }
                    }
                });
            }
        });
    }

    handleFieldChange('rationLists', newRationLists);
  };

  const handleAddItem = (categoryId: string) => {
    if (!editableCampaign || !editableCampaign.rationLists) return;
    const newItem: RationItem = {
      id: `${categoryId}-${Date.now()}`,
      name: '',
      quantity: 0,
      quantityType: '',
      price: 0,
      notes: '',
    };
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: [...cat.items, newItem] };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    if (!editableCampaign || !editableCampaign.rationLists) return;
    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const calculateTotal = (items: RationItem[], isGeneralList: boolean) => {
    return items.reduce((sum, item) => {
        const itemPrice = Number(item.price || 0);
        const itemQuantity = Number(item.quantity || 0);
        const total = isGeneralList ? itemPrice * itemQuantity : itemPrice;
        return sum + total;
    }, 0);
  };
  
  const handleAddNewCategory = () => {
    if (!editableCampaign) return;

    const min = Number(newCategoryMin);
    const max = Number(newCategoryMax);

    if (!newCategoryName.trim()) {
        toast({ title: 'Invalid Name', description: 'Category name cannot be empty.', variant: 'destructive' });
        return;
    }
    if (isNaN(min) || min < 1 || isNaN(max) || max < min) {
        toast({ title: 'Invalid Range', description: 'Please enter valid positive numbers for min/max members, with min <= max.', variant: 'destructive' });
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
    if (!editableCampaign || !categoryToEdit) return;

    const min = Number(categoryToEdit.minMembers);
    const max = Number(categoryToEdit.maxMembers);

    if (!categoryToEdit.name.trim()) {
        toast({ title: 'Invalid Name', description: 'Category name cannot be empty.', variant: 'destructive' });
        return;
    }
     if (isNaN(min) || min < 1 || isNaN(max) || max < min) {
        toast({ title: 'Invalid Range', description: 'Please enter valid positive numbers for min/max members, with min <= max.', variant: 'destructive' });
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

    // More precise dependency check
    const dependents = beneficiaries.filter(beneficiary => {
        const members = beneficiary.members;
        if (members === undefined || members === null) return false;
        
        // Find the specific category this beneficiary uses for kit amount calculation
        const matchingCategory = sanitizedEditableRationLists.find(
            cat => cat.name !== 'General Item List' && members >= cat.minMembers && members <= cat.maxMembers
        );
        
        const appliedCategory = matchingCategory || generalCategory;
        
        // The beneficiary is dependent *only* if their applied category is the one being deleted.
        return appliedCategory?.id === categoryToDelete.id;
    });
    
    setCategoryToDelete(categoryToDelete);
    setDependentBeneficiaries(dependents);
    setTargetCategoryId(null);
    setIsDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategoryConfirm = async () => {
      if (!firestore || !canUpdate || !categoryToDelete || !editableCampaign) return;

      if (dependentBeneficiaries.length > 0 && !targetCategoryId) {
          toast({ title: 'Error', description: 'Please select a category to move beneficiaries to.', variant: 'destructive'});
          return;
      }

      setIsDeletingCategory(true);
      
      try {
          const batch = writeBatch(firestore);
          const targetCategory = sanitizedEditableRationLists.find(c => c.id === targetCategoryId);
          const newKitAmountForDependents = (dependentBeneficiaries.length > 0 && targetCategory)
            ? calculateTotal(targetCategory.items, false)
            : 0;

          if (dependentBeneficiaries.length > 0 && targetCategoryId) {
              if (!targetCategory) throw new Error("Target category not found.");
              
              for (const beneficiary of dependentBeneficiaries) {
                  const beneficiaryRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
                  batch.update(beneficiaryRef, { kitAmount: newKitAmountForDependents });
              }
          }

          const newRationLists = sanitizedEditableRationLists.filter(cat => cat.id !== categoryToDelete.id);
          
          let newTotalRequiredAmount = 0;
          if (beneficiaries) {
              const dependentIds = new Set(dependentBeneficiaries.map(b => b.id));
              newTotalRequiredAmount = beneficiaries.reduce((sum, beneficiary) => {
                  if (dependentIds.has(beneficiary.id)) {
                      return sum + newKitAmountForDependents;
                  }
                  return sum + (beneficiary.kitAmount || 0);
              }, 0);
          }
          
          if(campaignDocRef) {
              batch.update(campaignDocRef, { 
                rationLists: newRationLists,
                targetAmount: newTotalRequiredAmount
              });
          }
        
          await batch.commit();

          toast({ title: 'Category Deleted', description: `Successfully deleted '${categoryToDelete.name}'.`, variant: 'success' });
          
          setIsDeleteCategoryDialogOpen(false);
          setCategoryToDelete(null);

      } catch (error: any) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `campaigns/${campaignId}`,
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
    if (!editableCampaign || !copyTargetCategory || selectedItemsToCopy.length === 0) {
        toast({ title: 'Nothing Selected', description: 'Please select items to copy.', variant: 'destructive' });
        return;
    }

    const sourceCategory = sanitizedEditableRationLists.find(c => c.id === copySourceCategoryId);
    if (!sourceCategory) return;
    
    const itemsToProcess = sourceCategory.items.filter(item => selectedItemsToCopy.includes(item.id));
    
    const targetItems = [...(copyTargetCategory.items || [])];
    
    let updatedCount = 0;
    let addedCount = 0;

    itemsToProcess.forEach(sourceItem => {
        const existingItemIndex = targetItems.findIndex(
            targetItem => targetItem.name.trim().toLowerCase() === sourceItem.name.trim().toLowerCase()
        );

        if (existingItemIndex > -1) {
            // Replace/Update existing item
            targetItems[existingItemIndex] = {
                ...targetItems[existingItemIndex], // Keep original ID and other properties of target
                quantity: sourceItem.quantity,
                quantityType: sourceItem.quantityType,
                price: sourceItem.price,
                notes: sourceItem.notes,
            };
            updatedCount++;
        } else {
            // Add new item
            targetItems.push({
                ...sourceItem,
                id: `${copyTargetCategory.id}-item-${Date.now()}-${Math.random()}`
            });
            addedCount++;
        }
    });

    const newRationLists = sanitizedEditableRationLists.map(cat => {
        if (cat.id === copyTargetCategory.id) {
            return { ...cat, items: targetItems };
        }
        return cat;
    });

    handleFieldChange('rationLists', newRationLists);
    
    toast({ 
        title: 'Items Copied', 
        description: `${addedCount} items added and ${updatedCount} items updated in '${copyTargetCategory.name}'.` 
    });
    setIsCopyItemsOpen(false);
  };

    const renderRationTable = (category: RationCategory) => {
    const isGeneralList = category.name === 'General Item List';
    const total = calculateTotal(category.items, isGeneralList);

    return (
      <Card className="animate-fade-in-zoom">
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>{isGeneralList ? 'Item Master List' : 'Items for this category'}</CardTitle>
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
             {isGeneralList && <CardDescription>This list defines the unit price for all items across all categories.</CardDescription>}
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
                        <TableHead className="text-right min-w-[150px]">Total Price (₹)</TableHead>
                        {canUpdate && editMode && <TableHead className="w-[50px] text-center">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {category.items.map((item, index) => {
                        const masterItem = !isGeneralList ? masterPriceList[item.name.trim().toLowerCase()] : null;
                        const unitPrice = isGeneralList ? item.price : (masterItem?.price || 0);
                        const totalPrice = isGeneralList ? (item.price || 0) * (item.quantity || 0) : (item.price || 0);

                        return (
                            <TableRow key={item.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                    <Input value={item.name || ''} onChange={e => handleItemChange(category.id, item.id, 'name', e.target.value)} placeholder="Item name" disabled={!editMode || !canUpdate} />
                                </TableCell>
                                <TableCell>
                                    <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(category.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="e.g. 1" disabled={!editMode || !canUpdate} />
                                </TableCell>
                                <TableCell>
                                    <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(category.id, item.id, 'quantityType', value)} disabled={!editMode || !canUpdate || !isGeneralList}>
                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                        <SelectContent>
                                            {quantityTypes.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={unitPrice || ''}
                                        onChange={(e) => handleItemChange(category.id, item.id, 'price', parseFloat(e.target.value) || 0)}
                                        className="text-right"
                                        disabled={!editMode || !canUpdate || !isGeneralList}
                                    />
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    ₹{totalPrice.toFixed(2)}
                                </TableCell>
                                {canUpdate && editMode && (
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(category.id, item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        )
                    })}
                    {category.items.length === 0 && (
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
    );
  };


  if (isLoading || !editableCampaign) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Skeleton className="h-10 w-44" />
            </div>
            <Skeleton className="h-9 w-64 mb-4" />
            <div className="flex flex-wrap gap-2 border-b mb-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-28" />
            </div>
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

  if (!campaign) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <p className="text-lg text-muted-foreground">Campaign not found.</p>
            <Button asChild className="mt-4">
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
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
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
                </Link>
            </Button>
        </div>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">{editableCampaign.name}</h1>
        </div>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/summary` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/summary`}>Summary</Link>
                        </Button>
                    )}
                    {canReadRation && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}`}>{editableCampaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                        </Button>
                    )}
                    {canReadBeneficiaries && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                        </Button>
                    )}
                     {canReadDonations && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/donations`}>Donations</Link>
                        </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom">
          <CardHeader>
             <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <CardTitle>{editableCampaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</CardTitle>
                    {editableCampaign.category === 'Ration' && (
                        <div className="text-sm text-muted-foreground mt-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="priceDate">Price Date</Label>
                                    <Input
                                    id="priceDate"
                                    type="date"
                                    value={editableCampaign.priceDate || ''}
                                    onChange={(e) => handleFieldChange( 'priceDate', e.target.value )}
                                    disabled={!editMode || !canUpdate}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="shopName">Shop Name</Label>
                                    <Input
                                    id="shopName"
                                    value={editableCampaign.shopName || ''}
                                    onChange={(e) => handleFieldChange( 'shopName', e.target.value )}
                                    placeholder="Shop Name"
                                    disabled={!editMode || !canUpdate}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="shopContact">Shop Contact</Label>
                                    <Input
                                    id="shopContact"
                                    value={editableCampaign.shopContact || ''}
                                    onChange={(e) => handleFieldChange( 'shopContact', e.target.value )}
                                    placeholder="Contact Number"
                                    disabled={!editMode || !canUpdate}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="shopAddress">Shop Address</Label>
                                    <Input
                                    id="shopAddress"
                                    value={editableCampaign.shopAddress || ''}
                                    onChange={(e) => handleFieldChange( 'shopAddress', e.target.value )}
                                    placeholder="Shop Address"
                                    disabled={!editMode || !canUpdate}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => {}}>Download as CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download as Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download as PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {canUpdate && editMode && editableCampaign.category === 'Ration' && (
                        <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Category
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Add New Ration Category</DialogTitle>
                                    <DialogDescription>
                                        Define a named category for a range of family members.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="cat-name">Category Name</Label>
                                        <Input
                                            id="cat-name"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g., 'Small Family', 'Members 5-10'"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="min-members">Min Members</Label>
                                            <Input
                                                id="min-members"
                                                type="number"
                                                value={newCategoryMin}
                                                onChange={(e) => setNewCategoryMin(e.target.value)}
                                                placeholder="e.g., 1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="max-members">Max Members</Label>
                                            <Input
                                                id="max-members"
                                                type="number"
                                                value={newCategoryMax}
                                                onChange={(e) => setNewCategoryMax(e.target.value)}
                                                placeholder="e.g., 4"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancel</Button>
                                    <Button type="submit" onClick={handleAddNewCategory}>Add Category</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
             </div>
          </CardHeader>
            <CardContent>
                {editableCampaign.category === 'Ration' ? (
                (sanitizedEditableRationLists.length > 0) ? (
                    <Tabs defaultValue={sanitizedEditableRationLists[0]?.id} className="w-full">
                        <ScrollArea>
                            <TabsList>
                                {sanitizedEditableRationLists.map(category => {
                                    const categoryName = category.name === 'General Item List'
                                    ? 'General Item List'
                                    : category.minMembers === category.maxMembers
                                        ? `${category.name} (${category.minMembers})`
                                        : `${category.name} (${category.minMembers}-${category.maxMembers})`;
                                    return (
                                        <div key={category.id} className="flex items-center gap-1 p-1">
                                            <TabsTrigger value={category.id}>{categoryName}</TabsTrigger>
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
                                    )
                                })}
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
                    <div className="text-center text-muted-foreground py-10">
                        No ration categories defined for this campaign yet.
                        {canUpdate && editMode && " Click 'Add Category' to begin."}
                    </div>
                )
            ) : (
                <div className="mt-4">
                {sanitizedEditableRationLists.find(c => c.name === 'General Item List') &&
                    renderRationTable(sanitizedEditableRationLists.find(c => c.name === 'General Item List')!)
                }
                </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Edit Category: {categoryToEdit?.name}</DialogTitle>
                <DialogDescription>Update the category name and member range.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-cat-name">Category Name</Label>
                    <Input
                        id="edit-cat-name"
                        value={categoryToEdit?.name || ''}
                        onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, name: e.target.value} : null)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-min-members">Min Members</Label>
                        <Input
                            id="edit-min-members"
                            type="number"
                            value={categoryToEdit?.minMembers || ''}
                             onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, minMembers: Number(e.target.value) || 0} : null)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-max-members">Max Members</Label>
                        <Input
                            id="edit-max-members"
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
                             <Label htmlFor="target-category">Move Beneficiaries To</Label>
                             <Select onValueChange={setTargetCategoryId} value={targetCategoryId || ''}>
                                 <SelectTrigger id="target-category">
                                     <SelectValue placeholder="Select a new category..." />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {sanitizedEditableRationLists.filter(cat => cat.id !== categoryToDelete?.id).map(cat => (
                                         <SelectItem key={cat.id} value={cat.id}>
                                             {cat.name}
                                             {cat.name !== 'General Item List' && ` (${cat.minMembers}-${cat.maxMembers})`}
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
                        Select items from a source category to copy or replace in the current category.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="source-category-copy">Copy items from</Label>
                        <Select onValueChange={id => { setCopySourceCategoryId(id); setSelectedItemsToCopy([]); }} value={copySourceCategoryId || ''}>
                            <SelectTrigger id="source-category-copy">
                                <SelectValue placeholder="Select a source category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sanitizedEditableRationLists.filter(cat => cat.id !== copyTargetCategory?.id).map(cat => {
                                    const categoryName = cat.name === 'General Item List'
                                    ? 'General Item List'
                                    : cat.minMembers === cat.maxMembers
                                        ? `${cat.name} ${cat.minMembers}`
                                        : `${cat.name} (${cat.minMembers}-${cat.maxMembers})`;
                                    return <SelectItem key={cat.id} value={cat.id}>{categoryName}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {sourceCategoryForCopy && (
                        <div className="space-y-2 pt-2">
                             <h4 className="font-medium text-sm">Select Items to Copy/Replace</h4>
                            <ScrollArea className="h-64 border rounded-md p-2">
                               <div className="p-2">
                                     <div className="flex items-center space-x-2 mb-2 p-2">
                                        <Checkbox
                                            id="select-all-copy"
                                            checked={sourceCategoryForCopy.items.length > 0 && selectedItemsToCopy.length === sourceCategoryForCopy.items.length}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedItemsToCopy(sourceCategoryForCopy.items.map(item => item.id));
                                                } else {
                                                    setSelectedItemsToCopy([]);
                                                }
                                            }}
                                        />
                                        <Label htmlFor="select-all-copy" className="font-semibold">Select All</Label>
                                    </div>
                                    <Separator />
                               </div>
                                <div className="space-y-1 p-2">
                                {sourceCategoryForCopy.items.length > 0 ? sourceCategoryForCopy.items.map(item => (
                                    <div key={item.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`copy-item-${item.id}`}
                                            checked={selectedItemsToCopy.includes(item.id)}
                                            onCheckedChange={(checked) => {
                                                setSelectedItemsToCopy(prev => 
                                                    checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                                                );
                                            }}
                                        />
                                        <Label htmlFor={`copy-item-${item.id}`} className="font-normal flex-1 cursor-pointer">
                                            <div className="flex justify-between items-center">
                                                <span>{item.name}</span>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {item.quantity} {item.quantityType} @ ₹{item.price.toFixed(2)}
                                                </span>
                                            </div>
                                        </Label>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center">No items in this category.</p>}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCopyItemsOpen(false)}>Cancel</Button>
                    <Button onClick={handleCopyItemsConfirm} disabled={!copySourceCategoryId || selectedItemsToCopy.length === 0}>
                        <Copy className="mr-2 h-4 w-4" /> Copy ({selectedItemsToCopy.length}) Items
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

    


