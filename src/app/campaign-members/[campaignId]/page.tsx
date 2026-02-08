
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, Copy, RefreshCw } from 'lucide-react';
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
import { get, cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';



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
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Copy items state
  const [isCopyItemsOpen, setIsCopyItemsOpen] = useState(false);
  const [copyTargetCategory, setCopyTargetCategory] = useState<RationCategory | null>(null);
  const [copySourceCategory, setCopySourceCategory] = useState<RationCategory | null>(null);
  const [itemsToCopy, setItemsToCopy] = useState<RationItem[]>([]);

  // Reset local state if edit mode is cancelled or if the base data changes while NOT in edit mode.
  useEffect(() => {
    if (campaign && !editMode) {
      const campaignCopy = JSON.parse(JSON.stringify(campaign));
      // Hotfix for old data structure where rationLists might be an object
      if (campaignCopy.rationLists && !Array.isArray(campaignCopy.rationLists)) {
        campaignCopy.rationLists = [
          {
            id: 'general', // a stable id
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
  
  const masterPriceList = useMemo(() => {
    const generalCategory = editableCampaign?.rationLists?.find(
      cat => cat.name === 'General Item List'
    );
    if (!generalCategory?.items) {
      return {};
    }
    return generalCategory.items.reduce((acc, item) => {
        const itemName = (item.name || '').trim().toLowerCase();
        if (itemName) {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const unitPrice = quantity > 0 ? price / quantity : price;

            acc[itemName] = {
                price: unitPrice,
                quantityType: item.quantityType || '',
            };
        }
        return acc;
    }, {} as Record<string, { price: number; quantityType: string }>);
  }, [editableCampaign?.rationLists]);

  const canReadSummary = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.campaigns.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.campaigns.update', false) || get(userProfile, 'permissions.campaigns.ration.update', false);

  const isLoading = isCampaignLoading || isProfileLoading || areBeneficiariesLoading;

  const handleSave = () => {
    if (!campaignDocRef || !editableCampaign || !canUpdate) return;

    // Only send the fields that are editable on this page to respect granular security rules
    const saveData = {
        priceDate: editableCampaign.priceDate,
        shopName: editableCampaign.shopName,
        shopContact: editableCampaign.shopContact,
        shopAddress: editableCampaign.shopAddress,
        rationLists: editableCampaign.rationLists,
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
    
    const category = editableCampaign.rationLists.find(cat => cat.id === categoryId);
    const isGeneral = category?.name === 'General Item List';
    
    let changedItemName: string | null = null;
    let oldItemName: string | null = null;
    
    const newRationLists = editableCampaign.rationLists.map(cat => {
        if (cat.id !== categoryId) return cat;
        
        const updatedItems = cat.items.map(item => {
            if (item.id !== itemId) return item;
            
            if (field === 'name') {
                oldItemName = String(item.name || '').trim().toLowerCase();
            }
            
            const newItem = { ...item, [field]: value };
            
            if (isGeneral) {
                changedItemName = String(newItem.name || '').trim().toLowerCase();
            } else {
                const itemNameLower = String(newItem.name || '').trim().toLowerCase();
                const masterItem = masterPriceList[itemNameLower];

                if (masterItem) {
                    newItem.quantityType = masterItem.quantityType;
                    const newPrice = masterItem.price * (Number(newItem.quantity) || 0);
                    newItem.price = parseFloat(newPrice.toFixed(2));
                } else if (field === 'name') {
                    newItem.quantityType = '';
                    newItem.price = 0;
                }
            }
            return newItem;
        });

        return { ...cat, items: updatedItems };
    });

    if (isGeneral && (changedItemName || oldItemName)) {
        const changedItem = newRationLists.find(c => c.id === categoryId)?.items.find(i => i.id === itemId);
        const searchName = field === 'name' ? oldItemName : changedItemName;
        
        if (changedItem && searchName) {
            const quantity = Number(changedItem.quantity) || 0;
            const price = Number(changedItem.price) || 0;
            const newMasterPrice = quantity > 0 ? price / quantity : price;
            const newMasterType = changedItem.quantityType || '';

            newRationLists.forEach(cat => {
                if (cat.name !== 'General Item List') {
                    cat.items = cat.items.map(item => {
                        if (item.name.trim().toLowerCase() === searchName) {
                            const updatedItem = { ...item };
                            if (field === 'name') {
                                updatedItem.name = changedItem.name;
                            }
                            const newPrice = newMasterPrice * (Number(updatedItem.quantity) || 0);
                            updatedItem.quantityType = newMasterType;
                            updatedItem.price = parseFloat(newPrice.toFixed(2));
                            return updatedItem;
                        }
                        return item;
                    });
                }
            });
        }
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
    const newRationLists = editableCampaign.rationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: [...cat.items, newItem] };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    if (!editableCampaign || !editableCampaign.rationLists) return;
    const newRationLists = editableCampaign.rationLists.map(cat => {
        if (cat.id === categoryId) {
            return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
        }
        return cat;
    });
    handleFieldChange('rationLists', newRationLists);
  };

  const calculateTotal = (items: RationItem[]) => {
    return items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  };
  
  const handleAddNewCategory = () => {
    if (!editableCampaign) return;

    const min = Number(newCategoryMin);
    const max = Number(newCategoryMax);

    if (!newCategoryName.trim()) {
        toast({ title: 'Invalid Name', description: 'Category name cannot be empty.', variant: 'destructive' });
        return;
    }
    if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0 || min > max) {
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
    
    const newRationLists = [...(editableCampaign.rationLists || []), newCategory];
    handleFieldChange('rationLists', newRationLists);
    
    setNewCategoryName('');
    setNewCategoryMin('');
    setNewCategoryMax('');
    setIsAddCategoryOpen(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setIsDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategoryConfirm = () => {
      if (!editableCampaign || !categoryToDelete) return;

      const newRationLists = (editableCampaign.rationLists || []).filter(cat => cat.id !== categoryToDelete);
      handleFieldChange('rationLists', newRationLists);

      toast({ title: 'Category Removed', description: `The category has been removed.` });
      setIsDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
  };
  
  const handleSyncKitAmounts = async () => {
    if (!firestore || !campaign || !beneficiaries || !canUpdate) {
        toast({ title: 'Error', description: 'Cannot sync. Data is missing or you lack permissions.', variant: 'destructive'});
        return;
    };
    setIsSyncing(true);

    let rationLists = campaign.rationLists;
    if (rationLists && !Array.isArray(rationLists)) {
      rationLists = [
        {
          id: 'general',
          name: 'General Item List',
          minMembers: 0,
          maxMembers: 0,
          items: (rationLists as any)['General Item List'] || []
        }
      ];
    }
    
    if (!rationLists || rationLists.length === 0) {
        toast({ title: 'Sync Canceled', description: 'No ration lists found for this campaign to calculate amounts.', variant: 'destructive' });
        setIsSyncing(false);
        return;
    }
    
    const generalCategory = rationLists.find(cat => cat.name === 'General Item List');
    const calculateTotal = (items: RationItem[]) => items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    
    const batch = writeBatch(firestore);
    let updatesCount = 0;
    let totalRequiredAmount = 0;

    for (const beneficiary of beneficiaries) {
        let finalKitAmount = beneficiary.kitAmount || 0;
        
        if (beneficiary.status !== 'Given') {
            const members = beneficiary.members;
            const matchingCategory = rationLists.find(
                cat => members >= cat.minMembers && members <= cat.maxMembers && cat.name !== 'General Item List'
            );
            const categoryToUse = matchingCategory || generalCategory;
            
            let expectedAmount = 0;
            if (categoryToUse) {
                expectedAmount = calculateTotal(categoryToUse.items);
            }
            
            if (beneficiary.kitAmount !== expectedAmount) {
                const docRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
                batch.update(docRef, { kitAmount: expectedAmount });
                updatesCount++;
            }
            finalKitAmount = expectedAmount;
        }
        
        totalRequiredAmount += finalKitAmount;
    }

    const campaignTargetUpdated = campaign.targetAmount !== totalRequiredAmount;
    if (campaignTargetUpdated) {
        const campaignDocRef = doc(firestore, 'campaigns', campaignId);
        batch.update(campaignDocRef, { targetAmount: totalRequiredAmount });
    }

    if (updatesCount === 0 && !campaignTargetUpdated) {
        toast({ title: 'No Updates Needed', description: 'All amounts are already up to date.' });
        setIsSyncing(false);
        return;
    }

    try {
        await batch.commit();
        let description = '';
        if (updatesCount > 0) {
            description += `${updatesCount} beneficiary kit amounts were updated. `;
        }
        if (campaignTargetUpdated) {
            description += `Campaign target synced to ₹${totalRequiredAmount.toFixed(2)}.`;
        }
        toast({ title: 'Sync Complete', description: description.trim(), variant: 'success' });
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `campaigns/${campaignId}`,
            operation: 'update',
            requestResourceData: { note: `Batch update for sync kit amounts` }
        }));
    } finally {
        setIsSyncing(false);
    }
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
                <div className="flex w-max space-x-4">
                    {canReadSummary && (
                      <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === `/campaign-members/${campaignId}/summary` ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
                          <Link href={`/campaign-members/${campaignId}/summary`}>Summary</Link>
                      </Button>
                    )}
                    {canReadRation && (
                      <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === `/campaign-members/${campaignId}` ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
                          <Link href={`/campaign-members/${campaignId}`}>{editableCampaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                      </Button>
                    )}
                    {canReadBeneficiaries && (
                      <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
                          <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                      </Button>
                    )}
                     {canReadDonations && (
                      <Button variant="ghost" asChild className={cn("shrink-0 rounded-b-none border-b-2 pb-3 pt-2", pathname === `/campaign-members/${campaignId}/donations` ? "border-primary text-primary shadow-none" : "border-transparent text-muted-foreground hover:text-foreground")}>
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
                     <Button onClick={handleSyncKitAmounts} disabled={isSyncing} variant="secondary">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Kit Amounts
                    </Button>
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
                (editableCampaign.rationLists?.length || 0) > 0 ? (
                    <Accordion type="single" collapsible className="w-full" defaultValue={editableCampaign.rationLists[0]?.id}>
                       {editableCampaign.rationLists.map(category => (
                        <AccordionItem value={category.id} key={category.id}>
                          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                            <div className="flex items-center gap-4">
                                <span>{category.name}</span>
                                {category.name !== 'General Item List' && (
                                    <Badge variant="secondary">{`${category.minMembers}-${category.maxMembers} Members`}</Badge>
                                )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {/* Render Table for this category */}
                          </AccordionContent>
                        </AccordionItem>
                       ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground py-10">
                        No ration categories defined for this campaign yet.
                        {canUpdate && editMode && " Click 'Add Category' to begin."}
                    </div>
                )
            ) : (
                <div className="mt-4">
                  {/* Render general item list for non-ration campaigns */}
                </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete this category and all of its items. This action cannot be undone.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategoryConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
