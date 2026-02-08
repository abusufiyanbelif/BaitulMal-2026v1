

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { doc, updateDoc, DocumentReference } from 'firebase/firestore';
import type { Campaign, RationItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save, Copy } from 'lucide-react';
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
import { get } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';



const quantityTypes = ['kg', 'litre', 'gram', 'ml', 'piece', 'packet', 'dozen'];

export default function CampaignDetailsPage() {
  const params = useParams();
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

  const [editMode, setEditMode] = useState(false);
  const [editableCampaign, setEditableCampaign] = useState<Campaign | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newMemberCount, setNewMemberCount] = useState('');
  const [activeTab, setActiveTab] = useState<string | undefined>();

  // Copy items state
  const [isCopyItemsOpen, setIsCopyItemsOpen] = useState(false);
  const [copyTargetCategory, setCopyTargetCategory] = useState<string | null>(null);
  const [copySourceCategory, setCopySourceCategory] = useState<string | null>(null);
  const [itemsToCopy, setItemsToCopy] = useState<RationItem[]>([]);

  // Reset local state if edit mode is cancelled or if the base data changes while NOT in edit mode.
  useEffect(() => {
    if (campaign && !editMode) {
      setEditableCampaign(JSON.parse(JSON.stringify(campaign)));
    }
  }, [editMode, campaign])

  const memberCategories = useMemo(() => {
    if (!editableCampaign?.rationLists) return [];
    return Object.keys(editableCampaign.rationLists).sort((a, b) => {
        const aIsGeneral = a.toLowerCase().includes('general');
        const bIsGeneral = b.toLowerCase().includes('general');
        if (aIsGeneral && !bIsGeneral) return -1;
        if (!aIsGeneral && bIsGeneral) return 1;
        if (aIsGeneral && bIsGeneral) return 0;
        
        const numA = Number(a);
        const numB = Number(b);
        
        if (isNaN(numA)) return 1; // Put non-numeric things last
        if (isNaN(numB)) return -1;

        return numB - numA; // Descending sort
    });
  }, [editableCampaign]);

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
  }, []);

  useEffect(() => {
    if (memberCategories.length > 0) {
      if (!activeTab || !memberCategories.includes(activeTab)) {
        setActiveTab(memberCategories[0]);
      }
    } else {
      setActiveTab(undefined);
    }
  }, [memberCategories, activeTab]);
  
  const getCategoryLabel = (category: string | null): string => {
    if (!category) return '';
    if (category === 'General Item List' || category === 'General') {
        return 'General Item List';
    }
    if (!isNaN(Number(category))) {
      return `${category} Members`;
    }
    return category;
  };

  const masterPriceList = useMemo(() => {
    const lists = editableCampaign?.rationLists;
    if (!lists) return {};
    
    const generalListKey = Object.keys(lists).find(k => k.toLowerCase().includes('general'));
    const generalList = generalListKey ? lists[generalListKey] : undefined;
    
    if (!generalList) {
        return {};
    }
    return generalList.reduce((acc, item) => {
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

  const isLoading = isCampaignLoading || isProfileLoading;

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
    memberCount: string,
    itemId: string,
    field: keyof RationItem,
    value: string | number
  ) => {
    if (!editableCampaign) return;
    
    let newRationLists = JSON.parse(JSON.stringify(editableCampaign.rationLists));
    const isGeneral = getCategoryLabel(memberCount) === 'General Item List';
    let changedItemName: string | null = null;
    let oldItemName: string | null = null;
    
    const updatedItems = newRationLists[memberCount].map((item: RationItem) => {
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
    newRationLists[memberCount] = updatedItems;

    // If a general list item's name or price changed, propagate to other lists
    if (isGeneral) {
        const changedItem = updatedItems.find((item: RationItem) => item.id === itemId);
        const searchName = field === 'name' ? oldItemName : changedItemName;
        
        if (changedItem && searchName) {
             const quantity = Number(changedItem.quantity) || 0;
             const price = Number(changedItem.price) || 0;
             const newMasterPrice = quantity > 0 ? price / quantity : price;
             const newMasterType = changedItem.quantityType || '';

            Object.keys(newRationLists).forEach(cat => {
                if (getCategoryLabel(cat) !== 'General Item List') {
                newRationLists[cat] = newRationLists[cat].map((item: RationItem) => {
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

  const handleAddItem = (memberCount: string) => {
    if (!editableCampaign) return;
    const newItem: RationItem = {
      id: `${memberCount}-${Date.now()}`,
      name: '',
      quantity: 0,
      quantityType: '',
      price: 0,
      notes: '',
    };
    const newRationLists = { ...editableCampaign.rationLists };
    newRationLists[memberCount] = [...(newRationLists[memberCount] || []), newItem];
    handleFieldChange('rationLists', newRationLists);
  };

  const handleDeleteItem = (memberCount: string, itemId: string) => {
    if (!editableCampaign) return;
    const newRationLists = { ...editableCampaign.rationLists };
    newRationLists[memberCount] = newRationLists[memberCount].filter(item => item.id !== itemId);
    handleFieldChange('rationLists', newRationLists);
  };

  const calculateTotal = (items: RationItem[]) => {
    return items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  };

  const handleDownload = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!campaign) {
      toast({
        title: 'No Data',
        description: 'There is no campaign data to export.',
        variant: 'destructive',
      });
      return;
    }
    
    const { rationLists, priceDate, shopName, shopContact, shopAddress } = campaign;
    const hasData = rationLists && Object.values(rationLists).some(list => list.length > 0);
    if (!hasData) {
      toast({
        title: 'No Data',
        description: 'There is no ration data to export.',
        variant: 'destructive',
      });
      return;
    }

    const sortedMemberCategories = Object.keys(rationLists).sort((a, b) => {
        const aIsGeneral = a.toLowerCase().includes('general');
        const bIsGeneral = b.toLowerCase().includes('general');
        if (aIsGeneral && !bIsGeneral) return -1;
        if (!aIsGeneral && bIsGeneral) return 1;
        return Number(b) - Number(a);
    });

    if (format === 'csv' || format === 'excel') {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        sortedMemberCategories.forEach((memberCount) => {
            const items = rationLists[memberCount];
            if (items.length > 0) {
                const isGeneral = getCategoryLabel(memberCount) === 'General Item List';
                const categoryTitle = getCategoryLabel(memberCount);
                const total = calculateTotal(items);

                const headers = isGeneral
                    ? ['#', 'Item Name', 'Quantity', 'Quantity Type', 'Price per Unit (₹)']
                    : ['#', 'Item Name', 'Quantity', 'Type', 'Total Price (₹)'];

                const body = items.map((item, index) => isGeneral ? [
                    index + 1, item.name, item.quantity, item.quantityType, item.price
                ] : [
                    index + 1, item.name, item.quantity, item.quantityType, item.price
                ]);

                const totalRow = isGeneral
                    ? []
                    : [['', '', '', 'Total', total]];
                
                const sheetData = [
                    [`Shop Name:`, shopName],
                    [`Shop Contact:`, shopContact],
                    [`Shop Address:`, shopAddress],
                    [`Price Date:`, priceDate],
                    [], 
                    [categoryTitle],
                    [],
                    headers,
                    ...body,
                    ...totalRow
                ];

                const ws = XLSX.utils.aoa_to_sheet(sheetData);
                ws['!cols'] = isGeneral
                    ? [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 15 }]
                    : [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
                XLSX.utils.book_append_sheet(wb, ws, categoryTitle.slice(0, 31));
            }
        });
        
        if (format === 'excel') {
            XLSX.writeFile(wb, `ration-details-${priceDate}.xlsx`);
        } else {
             // For CSV, we'll create a single sheet and stringify it.
            const firstSheetName = wb.SheetNames[0];
            if (firstSheetName) {
                const csvOutput = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheetName]);
                const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `ration-details-${priceDate}.csv`;
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

    } else if (format === 'pdf') {
        const doc = new jsPDF();
        let startY = 15;
        doc.setTextColor(10, 41, 19);

        if (brandingSettings?.logoUrl) {
            try {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                logoImg.src = brandingSettings.logoUrl;
                await new Promise<void>((resolve, reject) => {
                    logoImg.onload = () => resolve();
                    logoImg.onerror = () => reject();
                });
                doc.addImage(logoImg, 'PNG', 15, 5, 30, 10);
            } catch (e) {
                console.warn("Could not add logo to PDF", e);
            }
        }

        doc.setFontSize(14);
        doc.text(`${campaign.name} - Ration Details`, 14, startY);
        startY += 8;
        
        doc.setFontSize(10);
        doc.text(`Shop: ${shopName || ''} | Contact: ${shopContact || ''} | Address: ${shopAddress || ''}`, 14, startY);
        startY += 5;
        doc.text(`Price Date: ${priceDate || ''}`, 14, startY);
        startY += 10;
        
        sortedMemberCategories.forEach((memberCount) => {
            const items = rationLists[memberCount];
            if (items.length > 0) {
                const isGeneral = getCategoryLabel(memberCount) === 'General Item List';
                const total = calculateTotal(items);
                const categoryTitle = getCategoryLabel(memberCount);
                
                const headers = isGeneral
                    ? [['#', 'Item Name', 'Quantity', 'Quantity Type', 'Price per Unit']]
                    : [['#', 'Item Name', 'Qty', 'Type', 'Total Price']];

                const body: any[] = items.map((item, index) => isGeneral ? [
                    index + 1, item.name, item.quantity, item.quantityType || '', `₹${(item.price || 0).toFixed(2)}`
                ] : [
                    index + 1, item.name, item.quantity, item.quantityType || '', `₹${(item.price || 0).toFixed(2)}`
                ]);
                
                if (!isGeneral) {
                    body.push([
                        { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                        { content: `₹${total.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
                    ]);
                }
                
                (doc as any).autoTable({
                    head: [[categoryTitle]],
                    startY: startY,
                    theme: 'plain',
                    styles: { fontStyle: 'bold', fontSize: 12, textColor: [10, 41, 19] }
                });
                startY = (doc as any).lastAutoTable.finalY;

                (doc as any).autoTable({
                    head: headers,
                    body: body,
                    startY: startY,
                    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
                    styles: { textColor: [10, 41, 19] }
                });
                
                startY = (doc as any).lastAutoTable.finalY + 10;
            }
        });

        doc.save(`ration-details-${priceDate}.pdf`);
    }
  };

  const handleAddNewCategory = () => {
    if (!editableCampaign) return;
    if (!newMemberCount || isNaN(Number(newMemberCount)) || Number(newMemberCount) <= 0) {
        toast({
            title: 'Invalid Input',
            description: 'Please enter a valid positive number for members.',
            variant: 'destructive',
        });
        return;
    }
    const newCountStr = String(Math.floor(Number(newMemberCount)));
    if (editableCampaign.rationLists[newCountStr]) {
        toast({
            title: 'Category Exists',
            description: `A category for ${newCountStr} members already exists.`,
            variant: 'destructive',
        });
        return;
    }
    
    handleFieldChange('rationLists', { ...editableCampaign.rationLists, [newCountStr]: [] });
    setActiveTab(newCountStr);
    setNewMemberCount('');
    setIsAddCategoryOpen(false);
  };
  
  const sourceCategoriesForCopy = useMemo(() => {
    if (!editableCampaign || !copyTargetCategory) return [];
    return Object.keys(editableCampaign.rationLists).filter(
      (cat) => cat !== copyTargetCategory && editableCampaign.rationLists[cat].length > 0
    );
  }, [editableCampaign, copyTargetCategory]);
  
  const itemsAvailableToCopy = useMemo(() => {
    if (!editableCampaign || !copyTargetCategory || !copySourceCategory) return [];
    
    // Get names of items already in the target category list
    const currentItemNames = new Set(
        (editableCampaign.rationLists[copyTargetCategory] || [])
        .map(item => item.name.toLowerCase().trim())
        .filter(Boolean)
    );

    const sourceItems = editableCampaign.rationLists[copySourceCategory] || [];

    // Filter out items from the source that are already in the target
    return sourceItems.filter(item => {
        const trimmedName = item.name.toLowerCase().trim();
        return trimmedName && !currentItemNames.has(trimmedName);
    });
  }, [editableCampaign, copyTargetCategory, copySourceCategory]);

  const handleConfirmCopy = () => {
    if (!editableCampaign || !copyTargetCategory || itemsToCopy.length === 0) return;

    const newItems = itemsToCopy.map((item, index) => {
        const itemNameLower = String(item.name || '').trim().toLowerCase();
        const masterItem = masterPriceList[itemNameLower];

        const newItem: RationItem = {
            id: `${copyTargetCategory}-${Date.now()}-${index}`,
            name: item.name,
            notes: item.notes || '',
            quantity: item.quantity, 
            quantityType: masterItem ? masterItem.quantityType : '',
            price: masterItem ? parseFloat((masterItem.price * (Number(item.quantity) || 0)).toFixed(2)) : 0
        };
        return newItem;
    });

    const newRationLists = { ...editableCampaign.rationLists };
    const currentList = newRationLists[copyTargetCategory] || [];
    newRationLists[copyTargetCategory] = [...currentList, ...newItems];

    handleFieldChange('rationLists', newRationLists);

    // Reset all copy states
    setIsCopyItemsOpen(false);
    setCopyTargetCategory(null);
    setCopySourceCategory(null);
    setItemsToCopy([]);
  };

  const renderRationTable = (memberCount: string) => {
    const items = editableCampaign?.rationLists?.[memberCount] || [];
    const total = calculateTotal(items);
    const isGeneral = getCategoryLabel(memberCount) === 'General Item List';

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            {!isGeneral && <h4 className="text-lg font-bold">Total: <span className="font-mono">₹{total.toFixed(2)}</span></h4>}
            {isGeneral && <div />}
            {canUpdate && editMode && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleAddItem(memberCount)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
                {!isGeneral && (
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            setCopyTargetCategory(memberCount);
                            setCopySourceCategory(null);
                            setItemsToCopy([]);
                            setIsCopyItemsOpen(true);
                        }}
                    >
                        <Copy className="mr-2 h-4 w-4" /> Copy Items
                    </Button>
                )}
              </div>
            )}
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[180px]">Item Name</TableHead>
                        <TableHead className="min-w-[100px]">Quantity</TableHead>
                        <TableHead className="min-w-[150px]">Quantity Type</TableHead>
                        {isGeneral ? (
                            <TableHead className="text-right min-w-[120px]">Price per Unit (₹)</TableHead>
                        ) : (
                            <>
                                <TableHead className="text-right min-w-[120px]">Price per Unit (₹)</TableHead>
                                <TableHead className="text-right min-w-[150px]">Total Price (₹)</TableHead>
                            </>
                        )}
                        {canUpdate && editMode && <TableHead className="w-[50px] text-center">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => {
                        if (isGeneral) {
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <Input value={item.name || ''} onChange={e => handleItemChange(memberCount, item.id, 'name', e.target.value)} placeholder="Item name" disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(memberCount, item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="e.g. 1" disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    <TableCell>
                                        <Select value={item.quantityType || ''} onValueChange={value => handleItemChange(memberCount, item.id, 'quantityType', value)} disabled={!editMode || !canUpdate}>
                                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                            <SelectContent>
                                                {quantityTypes.map(type => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.price || ''} onChange={e => handleItemChange(memberCount, item.id, 'price', parseFloat(e.target.value) || 0)} className="text-right" disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    {canUpdate && editMode && (
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(memberCount, item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        } else {
                            const itemNameLower = String(item.name || '').trim().toLowerCase();
                            const masterItem = masterPriceList[itemNameLower];
                            const unitPrice = masterItem ? masterItem.price : 0;
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <Input value={item.name || ''} onChange={e => handleItemChange(memberCount, item.id, 'name', e.target.value)} placeholder="Item name" disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity || ''} onChange={e => handleItemChange(memberCount, item.id, 'quantity', parseFloat(e.target.value) || 0)} placeholder="e.g. 1" disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    <TableCell>{item.quantityType || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        ₹{unitPrice.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.price || ''} className="text-right" readOnly disabled={!editMode || !canUpdate} />
                                    </TableCell>
                                    {canUpdate && editMode && (
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(memberCount, item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        }
                    })}
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
                <div className="flex w-max space-x-4">
                    {canReadSummary && (
                      <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:shadow-none">
                          <Link href={`/campaign-members/${campaignId}/summary`}>Summary</Link>
                      </Button>
                    )}
                    {canReadRation && (
                      <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-primary text-primary shadow-none data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:shadow-none" data-active="true">
                          <Link href={`/campaign-members/${campaignId}`}>{editableCampaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                      </Button>
                    )}
                    {canReadBeneficiaries && (
                      <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:shadow-none">
                          <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                      </Button>
                    )}
                     {canReadDonations && (
                      <Button variant="ghost" asChild className="shrink-0 rounded-b-none border-b-2 border-transparent pb-3 pt-2 data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:shadow-none">
                          <Link href={`/campaign-members/${campaignId}/donations`}>Donations</Link>
                      </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card>
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
                            <DropdownMenuItem onClick={() => handleDownload('csv')}>Download as CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('excel')}>Download as Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('pdf')}>Download as PDF</DropdownMenuItem>
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
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Add New Member Category</DialogTitle>
                                    <DialogDescription>
                                        Enter the number of family members for the new ration list.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="member-count" className="text-right">
                                            Members
                                        </Label>
                                        <Input
                                            id="member-count"
                                            type="number"
                                            value={newMemberCount}
                                            onChange={(e) => setNewMemberCount(e.target.value)}
                                            className="col-span-3"
                                            placeholder="e.g. 4"
                                        />
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
                memberCategories.length > 0 ? (
                    <Tabs value={activeTab || ''} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 h-auto">
                            {memberCategories.map(count => (
                                <TabsTrigger key={count} value={count}>{getCategoryLabel(count)}</TabsTrigger>
                            ))}
                        </TabsList>
                        {memberCategories.map(count => (
                            <TabsContent key={count} value={count} className="mt-4">
                                {renderRationTable(count)}
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
                    {renderRationTable('General Item List')}
                </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog 
        open={isCopyItemsOpen} 
        onOpenChange={(isOpen) => {
            if (!isOpen) {
                setCopyTargetCategory(null);
                setCopySourceCategory(null);
                setItemsToCopy([]);
            }
            setIsCopyItemsOpen(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
                <DialogTitle>
                    {copySourceCategory 
                        ? `Copy from "${getCategoryLabel(copySourceCategory)}" to "${getCategoryLabel(copyTargetCategory)}"`
                        : `Copy items to "${getCategoryLabel(copyTargetCategory)}"`
                    }
                </DialogTitle>
                <DialogDescription>
                    {copySourceCategory
                        ? 'Select items to add to the current list.'
                        : 'First, select a category to copy items from.'
                    }
                </DialogDescription>
            </DialogHeader>

            {!copySourceCategory ? (
                <>
                    <div className="py-4 space-y-2 max-h-72 overflow-y-auto">
                        {sourceCategoriesForCopy.length > 0 ? (
                            sourceCategoriesForCopy.map(category => (
                                <Button
                                    key={category}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setCopySourceCategory(category)}
                                >
                                    {getCategoryLabel(category)}
                                </Button>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No other categories with items exist to copy from.</p>
                        )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCopyItemsOpen(false)}>Cancel</Button>
                    </DialogFooter>
                </>
            ) : (
                <>
                    <ScrollArea className="h-72 w-full rounded-md border p-4 mt-4">
                        <div className="space-y-4">
                            {itemsAvailableToCopy.length > 0 ? (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="copy-all"
                                            checked={
                                                itemsToCopy.length > 0 && itemsToCopy.length === itemsAvailableToCopy.length
                                                    ? true
                                                    : itemsToCopy.length > 0
                                                    ? 'indeterminate'
                                                    : false
                                            }
                                            onCheckedChange={(checked) => {
                                                setItemsToCopy(checked ? itemsAvailableToCopy : []);
                                            }}
                                        />
                                        <label
                                            htmlFor="copy-all"
                                            className="text-sm font-bold leading-none"
                                        >
                                            Select All ({itemsAvailableToCopy.length})
                                        </label>
                                    </div>
                                    <Separator />
                                </>
                            ) : null}
                            {itemsAvailableToCopy.map(item => (
                                <div key={item.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`copy-${item.id}`}
                                        checked={itemsToCopy.some(i => i.id === item.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setItemsToCopy(prev => [...prev, item]);
                                            } else {
                                                setItemsToCopy(prev => prev.filter(i => i.id !== item.id));
                                            }
                                        }}
                                    />
                                    <label htmlFor={`copy-${item.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {item.name} ({item.quantity} - ₹{item.price})
                                    </label>
                                </div>
                            ))}
                            {itemsAvailableToCopy.length === 0 && <p className="text-muted-foreground text-center">No new items to copy from this category.</p>}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 sm:justify-between">
                        <Button variant="ghost" onClick={() => setCopySourceCategory(null)}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsCopyItemsOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmCopy} disabled={itemsToCopy.length === 0}>
                                Add {itemsToCopy.length > 0 ? itemsToCopy.length : ''} Selected Item(s)
                            </Button>
                        </div>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
