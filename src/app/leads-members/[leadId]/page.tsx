
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { doc, updateDoc, DocumentReference } from 'firebase/firestore';
import type { Lead, RationItem, RationCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Download, Loader2, Edit, Save } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { get } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


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

  const [editMode, setEditMode] = useState(false);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryMin, setNewCategoryMin] = useState('');
  const [newCategoryMax, setNewCategoryMax] = useState('');
  
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
    if (Array.isArray(editableLead.rationLists)) return editableLead.rationLists;
    // Hotfix for old object format
    return [
      {
        id: 'general',
        name: 'General Item List',
        minMembers: 0,
        maxMembers: 0,
        items: (editableLead.rationLists as any)['General Item List'] || []
      }
    ];
  }, [editableLead?.rationLists]);

  const canReadSummary = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.summary.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!get(userProfile, 'permissions.leads-members.donations.read', false);
  const canUpdate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.leads-members.update', false);

  const isLoading = isLeadLoading || isProfileLoading;

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
    
    const newRationLists = [...sanitizedEditableRationLists, newCategory];
    handleFieldChange('rationLists', newRationLists);
    
    setNewCategoryName('');
    setNewCategoryMin('');
    setNewCategoryMax('');
    setIsAddCategoryOpen(false);
  };
  
  const renderRationTable = (category: RationCategory) => {
    const total = calculateTotal(category.items);

    return (
      <Card className="animate-fade-in-zoom">
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>{category.name === 'General Item List' ? 'Item List' : 'Items for this category'}</CardTitle>
                {canUpdate && editMode && (
                    <Button onClick={() => handleAddItem(category.id)} size="sm">
                      <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
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
                                    <TabsTrigger key={category.id} value={category.id}>
                                        {category.name}
                                        {category.name !== 'General Item List' && ` (${category.minMembers}-${category.maxMembers} Members)`}
                                    </TabsTrigger>
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
    </main>
  );
}
