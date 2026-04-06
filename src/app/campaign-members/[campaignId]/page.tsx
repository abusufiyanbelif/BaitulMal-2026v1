'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { 
    useFirestore, 
    useDoc, 
    errorEmitter, 
    FirestorePermissionError, 
    useCollection, 
    useMemoFirebase, 
    collection, 
    doc 
} from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { updateDoc, DocumentReference, writeBatch } from 'firebase/firestore';
import type { Campaign, RationItem, Beneficiary, ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, Copy, RefreshCw, ShieldAlert, Info, Database, X } from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BrandedLoader } from '@/components/branded-loader';
import { SectionLoader } from '@/components/section-loader';
import { VerificationRequestDialog } from '@/components/verification-request-dialog';
import { PendingUpdateWarning } from '@/components/pending-update-warning';

const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen', 'month', 'year', 'semester', 'unit', 'day', 'treatment'];

export default function CampaignDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { brandingSettings } = useBranding();
  
  const campaignDocRef = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign>;
  }, [firestore, campaignId]);

  const { data: campaign, isLoading: isCampaignLoading, forceRefetch: forceRefetchCampaign } = useDoc<Campaign>(campaignDocRef);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return collection(firestore, `campaigns/${campaignId}/beneficiaries`);
  }, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch: forceRefetchBeneficiaries } = useCollection<Beneficiary>(beneficiariesCollectionRef);
 
   const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_config') : null, [firestore]);
   const { data: configSettings } = useDoc<any>(configRef);

  const [editMode, setEditMode] = useState(false);
  const [editableCampaign, setEditableCampaign] = useState<Campaign | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryMin, setNewCategoryMin] = useState('');
  const [newCategoryMax, setNewCategoryMax] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ItemCategory | null>(null);
  const [dependentBeneficiaries, setDependentBeneficiaries] = useState<Beneficiary[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const [isCopyItemsOpen, setIsCopyItemsOpen] = useState(false);
  const [copyTargetCategory, setCopyTargetCategory] = useState<ItemCategory | null>(null);
  const [copySourceCategoryId, setCopySourceCategoryId] = useState<string | null>(null);
  const [selectedItemsToCopy, setSelectedItemsToCopy] = useState<string[]>([]);
  
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ItemCategory | null>(null);

  const [itemToDelete, setItemToDelete] = useState<{ categoryId: string; itemId: string; itemName: string } | null>(null);
   const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
 
   const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
   const [pendingUpdates, setPendingUpdates] = useState<any>(null);

  const syncAllCategoriesFromMaster = useCallback((itemCategories: ItemCategory[]): ItemCategory[] => {
    const masterList = itemCategories.find(cat => cat.name === 'Item Price List');
    if (!masterList) return itemCategories;

    const masterPriceMap = new Map<string, { price: number; quantityType: string }>();
    masterList.items.forEach((item: RationItem) => {
        masterPriceMap.set(item.name.trim().toLowerCase(), {
            price: Number(item.price) || 0,
            quantityType: item.quantityType || '',
        });
    });

    return itemCategories.map(cat => {
        if (cat.name === 'Item Price List') {
            return cat;
        }
        const updatedItems = cat.items.map(item => {
            const masterItem = masterPriceMap.get(item.name.trim().toLowerCase());
            if (masterItem) {
                return {
                    ...item,
                    price: masterItem.price * (Number(item.quantity) || 0),
                    quantityType: masterItem.quantityType,
                };
            }
            return {
                ...item,
                price: 0,
                quantityType: '',
            };
        });
        return { ...cat, items: updatedItems };
    });
  }, []);

  useEffect(() => {
    if (campaign && !editMode) {
        const campaignCopy = JSON.parse(JSON.stringify(campaign));
        setEditableCampaign(campaignCopy);
    }
  }, [editMode, campaign]);

  useEffect(() => {
    if (!isCopyItemsOpen) {
        setCopySourceCategoryId(null);
        setSelectedItemsToCopy([]);
    }
  }, [isCopyItemsOpen]);

  const sanitizedEditableItemCategories = useMemo(() => {
    if (!editableCampaign || !editableCampaign.itemCategories) return [];
    
    let lists: ItemCategory[] = editableCampaign.itemCategories.map(cat => {
        if (cat.name === 'General' || cat.name === 'Item Master List' || cat.name === 'General Item List') {
            return { ...cat, name: 'Item Price List' };
        }
        return cat;
    });
    
    return lists.sort((a, b) => {
        if (a.name === 'Item Price List') return -1;
        if (b.name === 'Item Price List') return 1;
        if(a.minMembers !== undefined && b.minMembers !== undefined) {
            return a.minMembers - b.minMembers;
        }
        return a.name.localeCompare(b.name);
    });
  }, [editableCampaign?.itemCategories]);

  const isLegacyData = useMemo(() => {
    return !!(campaign && !campaign.itemCategories && (campaign as any).rationLists);
  }, [campaign]);

  const sourceCategoryForCopy = useMemo(() => {
    if (!copySourceCategoryId) return null;
    return sanitizedEditableItemCategories.find(c => c.id === copySourceCategoryId);
  }, [copySourceCategoryId, sanitizedEditableItemCategories]);
  
  const masterPriceList = useMemo(() => {
    const masterCategory = sanitizedEditableItemCategories.find(
      cat => cat.name === 'Item Price List'
    );
    if (!masterCategory?.items) {
      return {};
    }
    return masterCategory.items.reduce((acc, item) => {
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
  }, [sanitizedEditableItemCategories]);

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.update', false) || !!getNestedValue(userProfile, 'permissions.campaigns.ration.update', false);

  const isLoading = isCampaignLoading || isProfileLoading || areBeneficiariesLoading;

  const handleSave = () => {
    if (!campaignDocRef || !editableCampaign || !canUpdate) return;

    const saveData = {
         priceDate: editableCampaign.priceDate,
         shopName: editableCampaign.shopName,
         shopContact: editableCampaign.shopContact,
         shopAddress: editableCampaign.shopAddress,
         itemCategories: sanitizedEditableItemCategories,
     };
 
     if (configSettings?.isVerificationRequired) {
         setPendingUpdates(saveData);
         setIsVerificationDialogOpen(true);
         return;
     }
     
     updateDoc(campaignDocRef, saveData)
         .catch(async (serverError: any) => {
            const permissionError = new FirestorePermissionError({
                path: campaignDocRef.path,
                operation: 'update',
                requestResourceData: saveData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            toast({ title: 'Success', description: 'Campaign Details Secured.', variant: 'success' });
            setEditMode(false);
        });
  };

  const handleCancel = () => {
      setEditMode(false);
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
    if (!editableCampaign || !editableCampaign.itemCategories) return;

    let newitemCategories = JSON.parse(JSON.stringify(sanitizedEditableItemCategories));
    const categoryToUpdate = newitemCategories.find((cat: ItemCategory) => cat.id === categoryId);
    if (!categoryToUpdate) return;
    
    const itemToUpdate = categoryToUpdate.items.find((item: RationItem) => item.id === itemId);
    if (!itemToUpdate) return;

    const oldItemName = (itemToUpdate.name || '').trim().toLowerCase();

    (itemToUpdate as any)[field] = value;
    
    if (categoryToUpdate.name === 'Item Price List') {
        if (field === 'name' && oldItemName) {
            const newName = (value as string).trim();
            newitemCategories = newitemCategories.map((cat: ItemCategory) => {
                if (cat.name !== 'Item Price List') {
                    return {
                        ...cat,
                        items: cat.items.map((item: RationItem) => {
                            if (item.name.trim().toLowerCase() === oldItemName) {
                                return { ...item, name: newName };
                            }
                            return item;
                        })
                    };
                }
                return cat;
            });
        }
        newitemCategories = syncAllCategoriesFromMaster(newitemCategories);
    } else {
        const masterList = newitemCategories.find((cat: ItemCategory) => cat.name === 'Item Price List');
        const masterPriceMap = new Map<string, { price: number; quantityType: string }>();
        if (masterList) {
            masterList.items.forEach((item: RationItem) => {
                masterPriceMap.set(item.name.trim().toLowerCase(), {
                    price: Number(item.price) || 0,
                    quantityType: item.quantityType || '',
                });
            });
        }
        const masterItem = masterPriceMap.get(itemToUpdate.name.trim().toLowerCase());
        if (masterItem) {
            itemToUpdate.price = masterItem.price * (Number(itemToUpdate.quantity) || 0);
            itemToUpdate.quantityType = masterItem.quantityType;
        } else {
            itemToUpdate.price = 0;
            itemToUpdate.quantityType = '';
        }
    }

    handleFieldChange('itemCategories', newitemCategories);
  };

  const handleAddItem = (categoryId: string) => {
    if (!editableCampaign || !editableCampaign.itemCategories) return;
    const newItem: RationItem = {
      id: `${categoryId}-${Date.now()}`,
      name: '',
      quantity: 0,
      quantityType: '',
      price: 0,
      notes: '',
    };
    const newitemCategories = sanitizedEditableItemCategories.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: [...cat.items, newItem] };
        }
        return cat;
    });
    handleFieldChange('itemCategories', newitemCategories);
  };

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    if (!editableCampaign || !editableCampaign.itemCategories) return;

    let newitemCategories = sanitizedEditableItemCategories.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
        }
        return cat;
    });
    
    const category = sanitizedEditableItemCategories.find(cat => cat.id === categoryId);
    if (category?.name === 'Item Price List') {
        newitemCategories = syncAllCategoriesFromMaster(newitemCategories);
    }

    handleFieldChange('itemCategories', newitemCategories);
  };

  const handleDeleteItemClick = (categoryId: string, itemId: string, itemName: string) => {
    if (!editableCampaign || !editableCampaign.itemCategories || !editMode) return;
    setItemToDelete({ categoryId, itemId, itemName });
    setIsDeleteItemDialogOpen(true);
  };

  const handleDeleteItemConfirm = () => {
    if (!itemToDelete) return;
    handleDeleteItem(itemToDelete.categoryId, itemToDelete.itemId);
    setIsDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };

  const calculateTotal = (items: RationItem[]) => {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  };
  
  const handleAddNewCategory = () => {
    if (!editableCampaign) return;

    const min = Number(newCategoryMin);
    const max = Number(newCategoryMax);

    if (!newCategoryName.trim()) {
        toast({ title: 'Invalid Name', description: 'Category Name Cannot Be Empty.', variant: 'destructive' });
        return;
    }
    if (editableCampaign.category === 'Ration' && (isNaN(min) || min < 1 || isNaN(max) || max < min)) {
        toast({ title: 'Invalid Range', description: 'Please Enter Valid Positive Numbers For Min/Max Members.', variant: 'destructive' });
        return;
    }
    
    const newCategory: ItemCategory = {
        id: `cat-${Date.now()}`,
        name: newCategoryName,
        items: [],
        ...(editableCampaign.category === 'Ration' && { minMembers: min, maxMembers: max }),
    };
    
    const newitemCategories = [...sanitizedEditableItemCategories, newCategory];
    handleFieldChange('itemCategories', newitemCategories);
    
    setNewCategoryName('');
    setNewCategoryMin('');
    setNewCategoryMax('');
    setIsAddCategoryOpen(false);
  };

  const handleEditCategoryClick = (category: ItemCategory) => {
    if (!canUpdate || !editMode || category.name === 'Item Price List') return;
    setCategoryToEdit(JSON.parse(JSON.stringify(category)));
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!editableCampaign || !categoryToEdit) return;

    const min = Number(categoryToEdit.minMembers);
    const max = Number(categoryToEdit.maxMembers);

    if (!categoryToEdit.name.trim()) {
        toast({ title: 'Invalid Name', description: 'Category Name Cannot Be Empty.', variant: 'destructive' });
        return;
    }
     if (editableCampaign.category === 'Ration' && (isNaN(min) || min < 1 || isNaN(max) || max < min)) {
        toast({ title: 'Invalid Range', description: 'Please Enter Valid Positive Numbers For Min/Max Members.', variant: 'destructive' });
        return;
    }

    const newitemCategories = sanitizedEditableItemCategories.map(cat => 
        cat.id === categoryToEdit.id ? categoryToEdit : cat
    );
    handleFieldChange('itemCategories', newitemCategories);
    
    setIsEditCategoryOpen(false);
    setCategoryToEdit(null);
  };

  const handleDeleteCategoryClick = (categoryToDelete: ItemCategory) => {
    if (!beneficiaries || !canUpdate || !editMode || categoryToDelete.name === 'Item Price List') return;
    
    const dependents = beneficiaries.filter(b => b.itemCategoryId === categoryToDelete.id);
    
    setCategoryToDelete(categoryToDelete);
    setDependentBeneficiaries(dependents);
    setTargetCategoryId(null);
    setIsDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategoryConfirm = async () => {
      if (!firestore || !canUpdate || !categoryToDelete || !editableCampaign) return;

      if (dependentBeneficiaries.length > 0 && !targetCategoryId) {
          toast({ title: 'Error', description: 'Please Select A Category To Move Beneficiaries To.', variant: 'destructive'});
          return;
      }

      setIsDeletingCategory(true);
      
      try {
          const batch = writeBatch(firestore);
          const targetCategory = sanitizedEditableItemCategories.find(c => c.id === targetCategoryId);
          const newKitAmountForDependents = (dependentBeneficiaries.length > 0 && targetCategory)
            ? calculateTotal(targetCategory.items)
            : 0;

          if (dependentBeneficiaries.length > 0 && targetCategoryId) {
              if (!targetCategory) throw new Error("Target Category Not Found.");
              
              for (const beneficiary of dependentBeneficiaries) {
                  const beneficiaryRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
                  batch.update(beneficiaryRef, { 
                    kitAmount: newKitAmountForDependents,
                    itemCategoryId: targetCategory.id,
                    itemCategoryName: targetCategory.name,
                  });
              }
          }

          const newitemCategories = sanitizedEditableItemCategories.filter(cat => cat.id !== categoryToDelete.id);
          
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
                itemCategories: newitemCategories,
                targetAmount: newTotalRequiredAmount
              });
          }
        
          await batch.commit();

          toast({ title: 'Category Deleted', description: `Successfully Deleted '${categoryToDelete.name}'.`, variant: 'success' });
          
          setIsDeleteCategoryDialogOpen(false);
          setCategoryToDelete(null);

      } catch (error: any) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `campaigns/${campaignId}`,
              operation: 'write',
              requestResourceData: { note: `Batch Delete Category Operation For ${categoryToDelete.name}` }
          }));
      } finally {
          setIsDeletingCategory(false);
      }
  };
  
  const handleCopyItemsClick = (category: ItemCategory) => {
    setCopyTargetCategory(category);
    setCopySourceCategoryId(null);
    setIsCopyItemsOpen(true);
  };

  const handleCopyItemsConfirm = () => {
    if (!editableCampaign || !copyTargetCategory || selectedItemsToCopy.length === 0) {
        toast({ title: 'Nothing Selected', description: 'Please Select Items To Copy.', variant: 'destructive' });
        return;
    }

    const sourceCategory = sanitizedEditableItemCategories.find(c => c.id === copySourceCategoryId);
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
            targetItems[existingItemIndex] = {
                ...targetItems[existingItemIndex],
                quantity: sourceItem.quantity,
                quantityType: sourceItem.quantityType,
                price: sourceItem.price,
                notes: sourceItem.notes,
            };
            updatedCount++;
        } else {
            targetItems.push({
                ...sourceItem,
                id: `${copyTargetCategory.id}-item-${Date.now()}-${Math.random()}`
            });
            addedCount++;
        }
    });

    const newitemCategories = sanitizedEditableItemCategories.map(cat => {
        if (cat.id === copyTargetCategory.id) {
            return { ...cat, items: targetItems };
        }
        return cat;
    });

    handleFieldChange('itemCategories', newitemCategories);
    
    toast({ 
        title: 'Items Copied', 
        description: `${addedCount} Items Added And ${updatedCount} Items Updated.` 
    });
    setIsCopyItemsOpen(false);
  };
  
  const handleSyncKitAmounts = async () => {
    if (!firestore || !canUpdate || !beneficiaries || !editableCampaign) {
      toast({ title: "Sync Error", description: "Missing Data Or Permissions For Batch Sync.", variant: 'destructive' });
      return;
    }
    
    if(editMode){
        toast({ title: "Save Required", description: "Please Secure Inventory Edits Before Batch Syncing.", variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    toast({ title: "Syncing...", description: "Recalculating Allocations Across Registry." });

    const batch = writeBatch(firestore);
    let newTotalRequiredAmount = 0;
    
    for (const beneficiary of beneficiaries) {
      let newKitAmount = 0;
      let appliedCategoryName = '';
      let appliedCategoryId = '';
      
      if (editableCampaign.category === 'Ration') {
        const members = beneficiary.members || 0;
        
        const matchingCategories = sanitizedEditableItemCategories.filter(
          cat => cat.name !== 'Item Price List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999)
        );

        let appliedCategory: ItemCategory | null = null;
        if (matchingCategories.length > 1) {
            matchingCategories.sort((a, b) => {
                const rangeA = (a.maxMembers ?? 999) - (a.minMembers ?? 0);
                const rangeB = (b.maxMembers ?? 999) - (b.minMembers ?? 0);
                if(rangeA !== rangeB) return rangeA - rangeB;
                return (b.minMembers ?? 0) - (a.minMembers ?? 0);
            });
            appliedCategory = matchingCategories[0];
        } else if (matchingCategories.length === 1) {
            appliedCategory = matchingCategories[0];
        }
        
        if (appliedCategory) {
           newKitAmount = calculateTotal(appliedCategory.items);
           appliedCategoryName = appliedCategory.name;
           appliedCategoryId = appliedCategory.id;
        } else {
           newKitAmount = 0;
           appliedCategoryName = 'Uncategorized';
           appliedCategoryId = 'uncategorized';
        }
      } else {
        const generalCategory = sanitizedEditableItemCategories.find(c => c.name !== 'Item Price List');
        if (generalCategory) {
            newKitAmount = calculateTotal(generalCategory.items);
            appliedCategoryName = generalCategory.name;
            appliedCategoryId = generalCategory.id;
        }
      }

      const beneficiaryRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
      batch.update(beneficiaryRef, { kitAmount: newKitAmount, itemCategoryId: appliedCategoryId, itemCategoryName: appliedCategoryName });
      newTotalRequiredAmount += newKitAmount;
    }

    if (campaignDocRef) {
        batch.update(campaignDocRef, { targetAmount: newTotalRequiredAmount });
    }

    try {
        await batch.commit();
        toast({ title: "Sync Complete!", description: `Successfully Updated ${beneficiaries.length} Recipients.`, variant: 'success' });
        forceRefetchCampaign();
        forceRefetchBeneficiaries();
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `campaigns/${campaignId}`,
            operation: 'write',
            requestResourceData: { note: `Batch Sync For ${beneficiaries.length} Beneficiaries` }
        }));
    } finally {
        setIsSyncing(false);
    }
};

    const renderItemTable = (category: ItemCategory) => {
    const isPriceList = category.name === 'Item Price List';
    const total = calculateTotal(category.items);

    return (
      <Card className="animate-fade-in-zoom border-primary/10 shadow-none bg-white">
        <CardHeader className="bg-primary/5 border-b">
            <div className="flex justify-between items-center">
                <CardTitle className="text-primary font-bold tracking-tight">{isPriceList ? 'Item Master Price List' : 'Category Requirement Breakdown'}</CardTitle>
                {canUpdate && editMode && (
                    <div className="flex gap-2">
                        <Button onClick={() => handleCopyItemsClick(category)} size="sm" variant="outline" className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                          <Copy className="mr-2 h-4 w-4" /> Copy Items
                        </Button>
                        <Button onClick={() => handleAddItem(category.id)} size="sm" className="font-bold shadow-md transition-transform active:scale-95">
                          <Plus className="mr-2 h-4 w-4" /> Add Line Item
                        </Button>
                    </div>
                )}
            </div>
             {isPriceList && <CardDescription className="font-normal text-primary/70">Definitive Unit Prices Used For All Category Calculations.</CardDescription>}
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h4 className="text-lg font-bold text-primary">Calculated Kit Value: <span className="font-mono text-xl">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></h4>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[800px] border rounded-xl overflow-hidden shadow-inner">
                <Table>
                    <TableHeader className="bg-primary/5">
                        <TableRow>
                            <TableHead className="w-[50px] font-bold text-primary text-[10px] capitalize tracking-widest">#</TableHead>
                            <TableHead className="min-w-[180px] font-bold text-primary text-[10px] capitalize tracking-widest">Item Name</TableHead>
                            <TableHead className="min-w-[100px] font-bold text-primary text-[10px] capitalize tracking-widest">Quantity</TableHead>
                            <TableHead className="min-w-[150px] font-bold text-primary text-[10px] capitalize tracking-widest">Unit Type</TableHead>
                            <TableHead className="min-w-[120px] font-bold text-primary text-[10px] capitalize tracking-widest">Price / Unit (₹)</TableHead>
                            <TableHead className="text-right min-w-[150px] font-bold text-primary text-[10px] capitalize tracking-widest">Line Total (₹)</TableHead>
                            {canUpdate && editMode && <TableHead className="w-[50px] text-center font-bold text-primary text-[10px] capitalize tracking-widest">Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="font-normal">
                        {category.items.map((item, index) => {
                            const masterItem = !isPriceList ? masterPriceList[item.name.trim().toLowerCase()] : null;
                            const unitPrice = isPriceList ? item.price : (masterItem?.price || 0);
                            const totalPrice = (isPriceList ? unitPrice : item.price) || 0;

                            return (
                                <TableRow key={item.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                    <TableCell className="font-mono text-xs opacity-60">{index + 1}</TableCell>
                                    <TableCell>
                                        <Input value={item.name || ''} onChange={e => handleItemChange(category.id, item.id, 'name', e.target.value)} placeholder="Item Name..." disabled={!editMode || !canUpdate} className="font-bold text-primary h-8" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(category.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="0" disabled={!editMode || !canUpdate} className="font-bold h-8" />
                                    </TableCell>
                                    <TableCell>
                                        <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(category.id, item.id, 'quantityType', value)} disabled={!editMode || !canUpdate || !isPriceList}>
                                            <SelectTrigger className="font-normal h-8"><SelectValue placeholder="Select Type..." /></SelectTrigger>
                                            <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                {quantityTypes.map(type => (
                                                    <SelectItem key={type} value={type} className="font-normal">{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={unitPrice || ''}
                                            onChange={(e: any) => handleItemChange(category.id, item.id, 'price', parseFloat(e.target.value) || 0)}
                                            className="text-right font-mono font-bold h-8"
                                            disabled={!editMode || !canUpdate || !isPriceList}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-primary">
                                        ₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    {canUpdate && editMode && (
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteItemClick(category.id, item.id, item.name)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        })}
                        {category.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={canUpdate && editMode ? 7 : 6} className="text-center h-32 text-muted-foreground italic font-normal opacity-60">
                                    No Line Items Defined.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };


  if (isLoading || !editableCampaign) {
    return <SectionLoader label="Retrieving Campaign Inventory..." description="Synchronizing Price Lists And Category Costing." />;
  }

  if (!campaign) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-center text-primary">
            <p className="text-lg font-bold opacity-60">Campaign Not Found.</p>
            <Button asChild className="mt-4 font-bold active:scale-95 transition-transform" variant="outline">
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back To Campaigns
                </Link>
            </Button>
        </main>
    );
  }

  return (
    <>
      {isSyncing && <BrandedLoader message="Synchronizing Registry Amounts..." />}
      <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal relative">
        <div className="mb-4">
            <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                <Link href="/campaign-members">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back To Campaigns
                </Link>
            </Button>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-primary">{editableCampaign.name}</h1>
         
         <PendingUpdateWarning targetId={campaignId} module="campaigns" />
 
         <div className="border-b border-primary/10 mb-4">
            <ScrollArea className="w-full">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full bg-transparent p-0 border-b border-primary/10 pb-4">
                    {canReadSummary && (
                        <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}/summary` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                    )}
                    <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/campaign-members/${campaignId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Item Lists</Link>
                    {canReadBeneficiaries && (
                        <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiary List</Link>
                    )}
                     {canReadDonations && (
                        <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donations</Link>
                    )}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
        </div>

        {isLegacyData && (
            <Alert variant="destructive" className="animate-fade-in-up">
              <Database className="h-4 w-4" />
              <AlertTitle className="font-bold">System Migration Required</AlertTitle>
              <AlertDescription className="font-normal text-xs opacity-80">
                This Project Uses An Outdated Data Structure. Please Request A System Administrator To Run Data Migration.
              </AlertDescription>
            </Alert>
        )}

        <Card className="animate-fade-in-zoom border-primary/10 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
                <div className="flex justify-between items-start flex-wrap gap-4">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold tracking-tight text-primary">Inventory & Procurement Costing</CardTitle>
                    <CardDescription className="font-normal text-primary/70">Manage Sourcing Dates, Shop Details, And Calculated Category Requirements.</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                    {canUpdate && (
                        <Button onClick={handleSyncKitAmounts} disabled={isSyncing || editMode} variant="secondary" className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Sync All Allotments
                        </Button>
                    )}
                    {canUpdate && (
                        !editMode ? (
                            <Button onClick={() => setEditMode(true)} disabled={isLegacyData} className="font-bold shadow-md transition-transform active:scale-95">
                                <Edit className="mr-2 h-4 w-4" /> Modify Procurement
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleCancel} className="font-bold border-primary/20 text-primary">Cancel</Button>
                                <Button onClick={handleSave} className="font-bold shadow-md bg-primary text-white">
                                    <Save className="mr-2 h-4 w-4" /> Secure Procurement
                                </Button>
                            </div>
                        )
                    )}
                </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 font-normal">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-primary">
                    <div className="space-y-1.5">
                        <Label htmlFor="priceDate" className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Vetting Date</Label>
                        <Input
                            id="priceDate"
                            type="date"
                            value={editableCampaign.priceDate || ''}
                            onChange={(e) => handleFieldChange( 'priceDate', e.target.value )}
                            disabled={!editMode || !canUpdate}
                            className="font-bold h-9 border-primary/10 bg-primary/[0.02]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="shopName" className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Supplier Store</Label>
                        <Input
                            id="shopName"
                            value={editableCampaign.shopName || ''}
                            onChange={(e) => handleFieldChange( 'shopName', e.target.value )}
                            placeholder="Supplier Name"
                            disabled={!editMode || !canUpdate}
                            className="font-normal h-9 border-primary/10 bg-primary/[0.02]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="shopContact" className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Supplier Phone</Label>
                        <Input
                            id="shopContact"
                            value={editableCampaign.shopContact || ''}
                            onChange={(e) => handleFieldChange( 'shopContact', e.target.value )}
                            placeholder="Phone Number"
                            disabled={!editMode || !canUpdate}
                            className="font-mono h-9 border-primary/10 bg-primary/[0.02]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="shopAddress" className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Procurement Hub</Label>
                        <Input
                            id="shopAddress"
                            value={editableCampaign.shopAddress || ''}
                            onChange={(e) => handleFieldChange( 'shopAddress', e.target.value )}
                            placeholder="Store Address"
                            disabled={!editMode || !canUpdate}
                            className="font-normal h-9 border-primary/10 bg-primary/[0.02]"
                        />
                    </div>
                </div>

                {(sanitizedEditableItemCategories.length > 0) ? (
                    <Tabs defaultValue={sanitizedEditableItemCategories[0]?.id} className="w-full">
                        <div className="flex items-center justify-between mb-4 border-b border-primary/10 pb-2">
                            <ScrollArea className="flex-1">
                                <TabsList className="bg-transparent h-auto p-0 gap-2 flex flex-nowrap">
                                    {sanitizedEditableItemCategories.map(category => {
                                        const categoryNameDisplay = category.name === 'Item Price List'
                                        ? 'Price Master'
                                        : (editableCampaign?.category === 'Ration' && category.minMembers !== undefined && category.maxMembers !== undefined)
                                            ? `${category.name} (${category.minMembers}-${category.maxMembers})`
                                            : category.name;
                                        return (
                                            <div key={category.id} className="flex items-center gap-1 group">
                                                <TabsTrigger 
                                                    value={category.id} 
                                                    className="font-bold data-[state=active]:bg-primary data-[state=active]:text-white rounded-[10px] border border-primary/5 shadow-none transition-all active:scale-95"
                                                >
                                                    {categoryNameDisplay}
                                                </TabsTrigger>
                                                {editMode && canUpdate && category.name !== 'Item Price List' && (
                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10" onClick={() => handleEditCategoryClick(category)}><Edit className="h-3 w-3" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCategoryClick(category)} disabled={isDeletingCategory}><Trash2 className="h-3 w-3" /></Button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </TabsList>
                                <ScrollBar orientation="horizontal" className="hidden" />
                            </ScrollArea>
                            {canUpdate && editMode && (
                                <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="font-bold border-primary/20 text-primary ml-4 shrink-0 transition-transform active:scale-95 shadow-sm">
                                            <Plus className="mr-2 h-4 w-4" /> Add Category
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md rounded-[16px] border-primary/10">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-bold text-primary tracking-tight">Create New Item Category</DialogTitle>
                                            <DialogDescription className="font-normal text-primary/70">Define A Named Subset Of Items.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="cat-name" className="font-bold text-xs capitalize text-muted-foreground tracking-widest">Category Name</Label>
                                                <Input id="cat-name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Large Family Kit" className="font-normal" />
                                            </div>
                                            {editableCampaign.category === 'Ration' && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="min-members" className="font-bold text-xs capitalize text-muted-foreground tracking-widest">Min Family Members</Label>
                                                        <Input id="min-members" type="number" value={newCategoryMin} onChange={(e) => setNewCategoryMin(e.target.value)} placeholder="1" className="font-normal" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="max-members" className="font-bold text-xs capitalize text-muted-foreground tracking-widest">Max Family Members</Label>
                                                        <Input id="max-members" type="number" value={newCategoryMax} onChange={(e) => setNewCategoryMax(e.target.value)} placeholder="4" className="font-normal" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddCategoryOpen(false)} className="font-bold border-primary/20 text-primary">Cancel</Button><Button type="submit" onClick={handleAddNewCategory} className="font-bold shadow-md">Create Category</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        {sanitizedEditableItemCategories.map(category => (
                            <TabsContent key={category.id} value={category.id} className="mt-4 focus-visible:outline-none">
                                {renderItemTable(category)}
                            </TabsContent>
                        ))}
                    </Tabs>
                ) : (
                    <div className="text-center py-20 bg-primary/[0.02] border-2 border-dashed border-primary/10 rounded-2xl">
                        <Info className="h-12 w-12 mx-auto text-primary/20 mb-4" />
                        <p className="text-sm font-bold text-primary/60 tracking-widest">No Categories Configured.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>

      <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-destructive capitalize">Remove Line Item?</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    Permanently Erase "{itemToDelete?.itemName}" From This List?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteItemConfirm} className="bg-destructive hover:bg-destructive/90 text-white font-bold transition-transform active:scale-95 rounded-[12px] shadow-md">Confirm Deletion</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md rounded-[16px] border-primary/10">
            <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary tracking-tight">Modify Category</DialogTitle>
                <DialogDescription className="font-normal text-primary/70">Update Labeling And Eligibility Logic.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-cat-name" className="font-bold text-[10px] capitalize text-muted-foreground tracking-widest">Category Name</Label>
                    <Input id="edit-cat-name" value={categoryToEdit?.name || ''} onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, name: e.target.value} : null)} className="font-normal" />
                </div>
                 {editableCampaign?.category === 'Ration' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-min-members" className="font-bold text-[10px] capitalize text-muted-foreground tracking-widest">Min Family Size</Label>
                            <Input id="edit-min-members" type="number" value={categoryToEdit?.minMembers || ''} onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, minMembers: Number(e.target.value) || 0} : null)} className="font-normal" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-max-members" className="font-bold text-[10px] capitalize text-muted-foreground tracking-widest">Max Family Size</Label>
                            <Input id="edit-max-members" type="number" value={categoryToEdit?.maxMembers || ''} onChange={(e) => setCategoryToEdit(prev => prev ? {...prev, maxMembers: Number(e.target.value) || 0} : null)} className="font-normal" />
                        </div>
                    </div>
                 )}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditCategoryOpen(false)} className="font-bold border-primary/20 text-primary">Cancel</Button><Button type="submit" onClick={handleUpdateCategory} className="font-bold shadow-md transition-transform active:scale-95">Save Modifications</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
          <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown">
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-bold text-destructive capitalize">Delete Category: '{categoryToDelete?.name}'?</AlertDialogTitle>
                  <AlertDialogDescription className="font-normal text-primary/70">
                      This Category Is Linked To {dependentBeneficiaries.length} Active Records.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              {dependentBeneficiaries.length > 0 && (
                <div className="py-4 space-y-2">
                    <Label htmlFor="target-category" className="font-bold text-xs capitalize text-muted-foreground tracking-widest">Move Dependents To</Label>
                    <Select onValueChange={setTargetCategoryId} value={targetCategoryId || ''}>
                        <SelectTrigger id="target-category" className="font-normal"><SelectValue placeholder="Select Destination Category..." /></SelectTrigger>
                        <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                            {sanitizedEditableItemCategories.filter(c => c.id !== categoryToDelete?.id && c.name !== 'Item Price List').map(cat => (
                                 <SelectItem key={cat.id} value={cat.id} className="font-normal">{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              )}
              <AlertDialogFooter><AlertDialogCancel className="font-bold border-primary/10 text-primary">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCategoryConfirm} disabled={isDeletingCategory || (dependentBeneficiaries.length > 0 && !targetCategoryId)} className="bg-destructive hover:bg-destructive/90 text-white font-bold transition-transform active:scale-95 rounded-[12px] shadow-md">{isDeletingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}Confirm & Purge</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

        <Dialog open={isCopyItemsOpen} onOpenChange={setIsCopyItemsOpen}>
            <DialogContent className="max-w-xl rounded-[16px] border-primary/10">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-primary tracking-tight">Replicate Inventory</DialogTitle>
                    <DialogDescription className="font-normal text-primary/70">Batch-Copy Checked Items.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="source-category-copy" className="font-bold text-xs capitalize text-muted-foreground tracking-widest">Source Group</Label>
                        <Select onValueChange={id => { setCopySourceCategoryId(id); setSelectedItemsToCopy([]); }} value={copySourceCategoryId || ''}>
                            <SelectTrigger id="source-category-copy" className="font-normal"><SelectValue placeholder="Select Source Template..." /></SelectTrigger>
                            <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                {sanitizedEditableItemCategories.filter(cat => cat.id !== copyTargetCategory?.id).map(cat => {
                                    const currentCatName = cat.name === 'Item Price List' ? 'Price Master' : cat.name;
                                    return <SelectItem key={cat.id} value={cat.id} className="font-normal">{currentCatName}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {sourceCategoryForCopy && (
                        <div className="space-y-3 pt-2">
                             <h4 className="font-bold text-sm text-primary tracking-tight flex items-center gap-2"><Plus className="h-4 w-4 opacity-40"/> Select Inventory</h4>
                            <div className="border border-primary/10 rounded-xl overflow-hidden bg-white shadow-inner">
                                <ScrollArea className="h-64 w-full">
                                    <div className="p-2 space-y-1">
                                        <div className="flex items-center space-x-2 mb-2 p-2 bg-primary/5 rounded-lg">
                                            <Checkbox
                                                id="select-all-copy"
                                                checked={sourceCategoryForCopy.items.length > 0 && selectedItemsToCopy.length === sourceCategoryForCopy.items.length}
                                                onCheckedChange={(checked) => { if (checked === true) setSelectedItemsToCopy(sourceCategoryForCopy.items.map(item => item.id)); else setSelectedItemsToCopy([]); }}
                                                className="border-primary/40 data-[state=checked]:bg-primary"
                                            />
                                            <Label htmlFor="select-all-copy" className="font-bold text-xs cursor-pointer text-primary capitalize tracking-tighter">Check All</Label>
                                        </div>
                                        {sourceCategoryForCopy.items.map(item => (
                                            <div key={item.id} className="flex items-center space-x-2 p-2 hover:bg-primary/[0.02] rounded-md transition-colors border-b border-primary/5 last:border-0">
                                                <Checkbox
                                                    id={`copy-item-${item.id}`}
                                                    checked={selectedItemsToCopy.includes(item.id)}
                                                    onCheckedChange={(checked) => { setSelectedItemsToCopy(prev => checked === true ? [...prev, item.id] : prev.filter(id => id !== item.id)); }}
                                                    className="border-primary/40 data-[state=checked]:bg-primary"
                                                />
                                                <Label htmlFor={`copy-item-${item.id}`} className="font-normal flex-1 cursor-pointer">
                                                    <div className="flex justify-between items-center pr-2">
                                                        <span className="text-sm font-bold text-primary">{item.name}</span>
                                                        <span className="text-[10px] font-mono opacity-60">
                                                            {item.quantity} {item.quantityType} @ ₹{item.price.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    <ScrollBar orientation="vertical" />
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="bg-primary/5 p-4 rounded-b-[16px] -mx-6 -mb-6 border-t"><Button variant="outline" onClick={() => setIsCopyItemsOpen(false)} className="font-bold border-primary/20 text-primary">Discard</Button><Button onClick={handleCopyItemsConfirm} disabled={!copySourceCategoryId || selectedItemsToCopy.length === 0} className="font-bold shadow-md px-8 transition-transform active:scale-95"><Copy className="mr-2 h-4 w-4" /> Replicate Items</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}