
'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useDoc, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, setDoc, DocumentReference } from 'firebase/firestore';
import type { Beneficiary, Campaign, RationItem, RationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, RefreshCw, ZoomIn, ZoomOut, RotateCw, Check, ChevronsUpDown, X, Users, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info, ChevronRight, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
    DialogDescription,
    DialogFooter,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type SortKey = keyof Beneficiary | 'srNo';

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState<string[]>([]);
  const [openReferralPopover, setOpenReferralPopover] = useState(false);
  const [kitAmountFilter, setKitAmountFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({
        ...prev,
        [groupKey]: !prev[groupKey],
    }));
  };

  const toggleSubGroup = (subGroupKey: string) => {
    setCollapsedSubGroups(prev => ({
        ...prev,
        [subGroupKey]: !prev[subGroupKey],
    }));
  };
  
  const canReadSummary = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.summary?.read;
  const canReadRation = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.ration?.read;
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.beneficiaries?.read;
  const canReadDonations = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.donations?.read;

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.beneficiaries?.create;
  const canUpdate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.beneficiaries?.update;
  const canDelete = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.beneficiaries?.delete;

    const sanitizedRationLists = useMemo(() => {
    if (!campaign?.rationLists) return [];
    if (Array.isArray(campaign.rationLists)) return campaign.rationLists;
    // Hotfix for old object format
    return [
      {
        id: 'general',
        name: 'General Item List',
        minMembers: 0,
        maxMembers: 0,
        items: (campaign.rationLists as any)['General Item List'] || []
      }
    ];
  }, [campaign?.rationLists]);

  const statusCounts = useMemo(() => {
    if (!beneficiaries) {
      return {
        Total: 0,
        Given: 0,
        Verified: 0,
        Pending: 0,
        Hold: 0,
        'Need More Details': 0,
      };
    }
    const counts = beneficiaries.reduce((acc, b) => {
      const status = b.status || 'Pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      Total: beneficiaries.length,
      Given: counts.Given || 0,
      Verified: counts.Verified || 0,
      Pending: counts.Pending || 0,
      Hold: counts.Hold || 0,
      'Need More Details': counts['Need More Details'] || 0,
    };
  }, [beneficiaries]);

  const handleAdd = () => {
    if (!canCreate) return;
    setEditingBeneficiary(null);
    setFormMode('add');
    setIsFormOpen(true);
  };

  const handleView = (beneficiary: Beneficiary) => {
    setEditingBeneficiary(beneficiary);
    setFormMode('view');
    setIsFormOpen(true);
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    if (!canUpdate) return;
    setEditingBeneficiary(beneficiary);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setBeneficiaryToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete || !firestore || !storage || !campaignId || !canDelete || !beneficiaries) return;

    const beneficiaryData = beneficiaries.find(b => b.id === beneficiaryToDelete);
    if (!beneficiaryData) return;
    
    const docRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiaryToDelete);
    const idProofUrl = beneficiaryData.idProofUrl;

    setIsDeleteDialogOpen(false);

    const deleteDocument = () => {
        deleteDoc(docRef)
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                toast({ title: 'Success', description: 'Beneficiary deleted successfully.', variant: 'success' });
                setBeneficiaryToDelete(null);
            });
    };

    if (idProofUrl) {
        const fileRef = storageRef(storage, idProofUrl);
        await deleteObject(fileRef).catch(err => {
            if (err.code !== 'storage/object-not-found') {
                console.warn("Failed to delete ID proof from storage:", err);
            }
        });
    }
    deleteDocument();
  };
  
  const handleFormSubmit = async (data: BeneficiaryFormData) => {
    if (!firestore || !userProfile || !campaign) return;
    if (editingBeneficiary && !canUpdate) return;
    if (!editingBeneficiary && !canCreate) return;

    if (!editingBeneficiary) {
        const isDuplicate = beneficiaries && beneficiaries.some(b => 
            b.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
            (b.phone || '') === (data.phone || '')
        );
        if (isDuplicate) {
            toast({
                title: 'Duplicate Beneficiary',
                description: 'A beneficiary with the same name and phone number already exists in this campaign.',
                variant: 'destructive',
            });
            return;
        }
    }

    setIsFormOpen(false);
    setEditingBeneficiary(null);

    const docRef = editingBeneficiary
        ? doc(firestore, `campaigns/${campaignId}/beneficiaries`, editingBeneficiary.id)
        : doc(collection(firestore, `campaigns/${campaignId}/beneficiaries`));
    
    let finalData: any;

    try {
        finalData = {
            ...data,
            ...(!editingBeneficiary && {
                addedDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
                createdById: userProfile.id,
                createdByName: userProfile.name,
            }),
            ...(editingBeneficiary && {
                updatedAt: serverTimestamp(),
                updatedById: userProfile.id,
                updatedByName: userProfile.name,
            }),
        };
        
        await setDoc(docRef, finalData, { merge: true });
        
        toast({ title: 'Success', description: `Beneficiary ${editingBeneficiary ? 'updated' : 'added'}.`, variant: 'success' });

    } catch (error: any) {
        console.warn("Error during form submission:", error);
        if (error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: editingBeneficiary ? 'update' : 'create',
                requestResourceData: finalData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
        }
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const headers = [
        'name', 'address', 'phone', 'members', 'earningMembers', 'male', 'female',
        'idProofType', 'idNumber', 'referralBy', 'kitAmount', 'status'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.writeFile(wb, 'beneficiary_import_template.xlsx');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        setSelectedFile(event.target.files[0]);
    }
  };

  const handleImportBeneficiaries = async () => {
    if (!selectedFile || !firestore || !campaignId || !canCreate || !userProfile) return;
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const XLSX = await import('xlsx');
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

            if (json.length === 0) throw new Error("The file is empty.");

            const requiredHeaders = ['name', 'referralBy'];
            const actualHeaders = Object.keys(json[0] || {});
            if (!requiredHeaders.every(h => actualHeaders.includes(h))) {
                 throw new Error(`File is missing required headers. Required: ${requiredHeaders.join(', ')}`);
            }
            
            const batch = writeBatch(firestore);
            const beneficiariesRef = collection(firestore, `campaigns/${campaignId}/beneficiaries`);
            
            const validBeneficiaries: Omit<Beneficiary, 'id'>[] = [];
            const invalidRows: number[] = [];
            const validStatuses = ['Given', 'Pending', 'Hold', 'Need More Details', 'Verified'];

            json.forEach((row, index) => {
                const name = String(row.name || '').trim();
                const referralBy = String(row.referralBy || '').trim();
                const members = Number(row.members || 0);
                const earningMembers = Number(row.earningMembers || 0);
                const male = Number(row.male || 0);
                const female = Number(row.female || 0);
                const kitAmount = Number(row.kitAmount || 0);
                const status = String(row.status || 'Pending').trim();

                if (!name || !referralBy || isNaN(members) || isNaN(earningMembers) || isNaN(male) || isNaN(female) || isNaN(kitAmount)) {
                    invalidRows.push(index + 2); // +2 because index is 0-based and header is row 1
                    return;
                }
                
                const beneficiaryData: Omit<Beneficiary, 'id'> = {
                    name,
                    address: String(row.address || '').trim(),
                    phone: String(row.phone || '').trim(),
                    members,
                    earningMembers,
                    male,
                    female,
                    idProofType: String(row.idProofType || '').trim(),
                    idNumber: String(row.idNumber || '').trim(),
                    referralBy,
                    kitAmount,
                    status: validStatuses.includes(status) ? status : 'Pending',
                    addedDate: new Date().toISOString().split('T')[0],
                    createdAt: serverTimestamp(),
                    createdById: userProfile.id,
                    createdByName: userProfile.name,
                };
                validBeneficiaries.push(beneficiaryData);
            });
            
            if (validBeneficiaries.length === 0) {
                throw new Error("No valid beneficiary data found in the file. Please check for missing names or referral info.");
            }

            validBeneficiaries.forEach(beneficiary => {
                const docRef = doc(beneficiariesRef);
                batch.set(docRef, beneficiary);
            });
            
            await batch.commit()
                .catch((serverError: any) => {
                    const permissionError = new FirestorePermissionError({
                        path: `campaigns/${campaignId}/beneficiaries`,
                        operation: 'write',
                        requestResourceData: { note: `${validBeneficiaries.length} beneficiaries to import` }
                    });
                    errorEmitter.emit('permission-error', permissionError);
                })

            if (invalidRows.length > 0) {
                    toast({ 
                    title: 'Partial Import Success',
                    description: `${validBeneficiaries.length} beneficiaries imported. ${invalidRows.length} rows were invalid and skipped (Rows: ${invalidRows.join(', ')}).`,
                    variant: 'success',
                    duration: 8000,
                    });
            } else {
                toast({ title: 'Success', description: `${validBeneficiaries.length} beneficiaries imported successfully.`, variant: 'success' });
            }

        } catch (error: any) {
             toast({ title: 'Import Failed', description: error.message || "An error occurred during import.", variant: 'destructive' });
        } finally {
            setIsImporting(false);
            setIsImportOpen(false);
            setSelectedFile(null);
        }
    };
    reader.onerror = (error) => {
        toast({ title: 'File Error', description: 'Could not read the file.', variant: 'destructive'});
        setIsImporting(false);
    }
    reader.readAsArrayBuffer(selectedFile);
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleSyncKitAmounts = async () => {
    if (!firestore || !campaign || !beneficiaries || !canUpdate) {
        toast({ title: 'Error', description: 'Cannot sync. Data is missing or you lack permissions.', variant: 'destructive'});
        return;
    };
    setIsSyncing(true);

    const rationLists = sanitizedRationLists;
    if (!rationLists || rationLists.length === 0) {
        toast({ title: 'Sync Canceled', description: 'No ration lists found for this campaign to calculate amounts.', variant: 'destructive' });
        setIsSyncing(false);
        return;
    }
    
    const generalCategory = rationLists.find(cat => cat.name === 'General Item List');
    if (!generalCategory) {
        toast({ title: 'Sync Canceled', description: 'A "General Item List" is required to determine unit prices.', variant: 'destructive' });
        setIsSyncing(false);
        return;
    }

    const masterPriceList = generalCategory.items.reduce((acc: Record<string, number>, item: RationItem) => {
        const itemName = (item.name || '').trim().toLowerCase();
        if (itemName) {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const unitPrice = quantity > 0 ? price / quantity : 0;
            acc[itemName] = unitPrice;
        }
        return acc;
    }, {} as Record<string, number>);
    
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
                expectedAmount = categoryToUse.items.reduce((sum: number, item: RationItem) => {
                    const unitPrice = masterPriceList[item.name.trim().toLowerCase()] || 0;
                    const quantity = Number(item.quantity) || 0;
                    return sum + (unitPrice * quantity);
                }, 0);
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


  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    const referrals = new Set(beneficiaries.map(b => b.referralBy).filter(Boolean));
    return [...Array.from(referrals).sort()];
  }, [beneficiaries]);
  
  const filteredAndSortedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let sortableItems = [...beneficiaries];
    
    // Filtering
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(b => b.status === statusFilter);
    }
    if (referralFilter.length > 0) {
        sortableItems = sortableItems.filter(b => b.referralBy && referralFilter.includes(b.referralBy));
    }
    if (kitAmountFilter) {
        sortableItems = sortableItems.filter(b => String(b.kitAmount) === kitAmountFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(b => 
            (b.name || '').toLowerCase().includes(lowercasedTerm) ||
            (b.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (b.address || '').toLowerCase().includes(lowercasedTerm) ||
            (b.referralBy || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    // Sorting
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0; // Keep original order for srNo
            const aValue = a[sortConfig.key as keyof Beneficiary] ?? '';
            const bValue = b[sortConfig.key as keyof Beneficiary] ?? '';
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                 if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }
            return 0;
        });
    }

    return sortableItems;
  }, [beneficiaries, searchTerm, statusFilter, referralFilter, kitAmountFilter, sortConfig]);

  const groupedBeneficiaries = useMemo(() => {
    if (!filteredAndSortedBeneficiaries || !sanitizedRationLists || sanitizedRationLists.length === 0) return {};

    const generalCategory = sanitizedRationLists.find(cat => cat.name === 'General Item List');

    const byCategory = filteredAndSortedBeneficiaries.reduce((acc, beneficiary) => {
      const members = beneficiary.members || 0;
      
      const specificCategory = sanitizedRationLists.find(
        cat => cat.name !== 'General Item List' && members >= cat.minMembers && members <= cat.maxMembers
      );
      
      const appliedCategory = specificCategory || generalCategory;

      if (appliedCategory) {
        const categoryId = appliedCategory.id;
        if (!acc[categoryId]) {
          acc[categoryId] = {
            category: appliedCategory,
            beneficiariesByMemberCount: {},
          };
        }

        const memberCount = beneficiary.members || 0;
        if (!acc[categoryId].beneficiariesByMemberCount[memberCount]) {
          acc[categoryId].beneficiariesByMemberCount[memberCount] = [];
        }
        acc[categoryId].beneficiariesByMemberCount[memberCount].push(beneficiary);
      }
      
      return acc;
    }, {} as Record<string, { category: RationCategory, beneficiariesByMemberCount: Record<number, Beneficiary[]> }>);

    return byCategory;

  }, [filteredAndSortedBeneficiaries, sanitizedRationLists]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedBeneficiaries).sort((a, b) => {
        const catA = groupedBeneficiaries[a].category;
        const catB = groupedBeneficiaries[b].category;
        if (catA.name === 'General Item List') return -1;
        if (catB.name === 'General Item List') return 1;
        return catA.minMembers - catB.minMembers;
    });
  }, [groupedBeneficiaries]);

  const totalKitAmount = useMemo(() => {
    return filteredAndSortedBeneficiaries.reduce((acc, b) => acc + (b.kitAmount || 0), 0);
  }, [filteredAndSortedBeneficiaries]);

  const isLoading = isCampaignLoading || areBeneficiariesLoading || isProfileLoading;
  
  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2 whitespace-nowrap">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
  };

  if (isLoading && !campaign) {
    return (
        <main className="container mx-auto p-4 md:p-8">
             <div className="mb-4">
                <Skeleton className="h-10 w-44" />
            </div>
            <Skeleton className="h-9 w-64 mb-4" />
             <div className="flex w-max space-x-4 border-b mb-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-36" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-5 w-1/3" />
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
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
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
                             <Link href={`/campaign-members/${campaignId}`}>{campaign.category === 'Ration' ? 'Ration Details' : 'Item List'}</Link>
                        </Button>
                    )}
                    {canReadBeneficiaries && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/beneficiaries` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/beneficiaries`}>Beneficiary List</Link>
                        </Button>
                    )}
                    {canReadDonations && (
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname === `/campaign-members/${campaignId}/donations` ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
                            <Link href={`/campaign-members/${campaignId}/donations`}>Donations</Link>
                        </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                    <CardTitle>Beneficiary List ({areBeneficiariesLoading ? '...' : filteredAndSortedBeneficiaries.length})</CardTitle>
                    <p className="text-muted-foreground">
                        Total amount for filtered beneficiaries: <span className="font-bold text-foreground">₹{totalKitAmount.toFixed(2)}</span>
                    </p>
                </div>
                {canCreate && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                        {canUpdate && (
                            <Button onClick={handleSyncKitAmounts} disabled={isSyncing} variant="secondary">
                                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Sync Beneficiary Kit Amounts
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Template
                        </Button>
                        <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                        </Button>
                        <Button onClick={handleAdd}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Total</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts.Total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Given</CardTitle><CheckCircle2 className="h-4 w-4 text-success-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts.Given}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Verified</CardTitle><BadgeCheck className="h-4 w-4 text-primary"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts.Verified}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Pending</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts.Pending}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Hold</CardTitle><XCircle className="h-4 w-4 text-destructive"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts.Hold}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-2 pb-0 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Need Details</CardTitle><Info className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="p-2"><div className="text-2xl font-bold">{statusCounts['Need More Details']}</div></CardContent>
                </Card>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                  <Input 
                      placeholder="Search by name, phone, address, referral..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Statuses</SelectItem>
                          <SelectItem value="Given">Given</SelectItem>
                          <SelectItem value="Verified">Verified</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Hold">Hold</SelectItem>
                          <SelectItem value="Need More Details">Need More Details</SelectItem>
                      </SelectContent>
                  </Select>
                  <Popover open={openReferralPopover} onOpenChange={setOpenReferralPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openReferralPopover}
                        className="w-auto md:w-[250px] justify-between"
                      >
                        <span className="truncate">
                          {referralFilter.length > 0
                            ? `${referralFilter.length} selected`
                            : "Filter by referral..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                      <Command>
                        <CommandInput placeholder="Search referrals..." />
                        <CommandList>
                          <CommandEmpty>No referral found.</CommandEmpty>
                          <CommandGroup>
                            {uniqueReferrals.map((referral) => (
                              <CommandItem
                                key={referral}
                                value={referral}
                                onSelect={(currentValue) => {
                                  const selected = referralFilter.includes(currentValue);
                                  if (selected) {
                                    setReferralFilter(referralFilter.filter((r) => r !== currentValue));
                                  } else {
                                    setReferralFilter([...referralFilter, currentValue]);
                                  }
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    referralFilter.includes(referral) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {referral}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                      placeholder="Filter by kit amount"
                      type="number"
                      value={kitAmountFilter}
                      onChange={(e) => setKitAmountFilter(e.target.value)}
                      className="w-auto md:w-[160px]"
                  />
              </div>
              {referralFilter.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1 items-center">
                      {referralFilter.map((referral) => (
                          <Badge
                              key={referral}
                              variant="secondary"
                              className="flex items-center gap-1"
                          >
                              {referral}
                              <button
                                  type="button"
                                  aria-label={`Remove ${referral} filter`}
                                  onClick={() => setReferralFilter(referralFilter.filter((r) => r !== referral))}
                                  className="ml-1 rounded-full p-0.5 hover:bg-background/50 focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                  <X className="h-3 w-3" />
                              </button>
                          </Badge>
                      ))}
                       <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto py-0.5 px-1 text-xs text-muted-foreground hover:bg-transparent"
                          onClick={() => setReferralFilter([])}
                      >
                          Clear all
                      </Button>
                  </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            {(canUpdate || canDelete) && <TableHead className="sticky left-0 z-10 bg-card text-center w-[100px] whitespace-nowrap">Actions</TableHead>}
                            <SortableHeader sortKey="srNo" className="w-[50px]">#</SortableHeader>
                            <SortableHeader sortKey="name">Name</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat">Eligible for Zakat</SortableHeader>
                            <SortableHeader sortKey="kitAmount" className="text-right">Kit Amount (₹)</SortableHeader>
                            <SortableHeader sortKey="phone">Phone</SortableHeader>
                            <SortableHeader sortKey="address">Address</SortableHeader>
                            <SortableHeader sortKey="referralBy">Referred By</SortableHeader>
                            <SortableHeader sortKey="status">Status</SortableHeader>
                            <SortableHeader sortKey="addedDate">Added Date</SortableHeader>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {areBeneficiariesLoading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={`skeleton-${i}`}>
                                    {(canUpdate || canDelete) && <TableCell className="sticky left-0 z-10 bg-card text-center"><Skeleton className="h-6 w-12 mx-auto" /></TableCell>}
                                    <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                </TableRow>
                            ))
                        ) : sortedGroupKeys.length > 0 ? (
                            sortedGroupKeys.map((categoryId) => {
                                const group = groupedBeneficiaries[categoryId];
                                if (!group) return null;
                                const { category, beneficiariesByMemberCount } = group;
                                const categoryIsCollapsed = collapsedGroups[categoryId];
                                const totalBeneficiariesInCategory = Object.values(beneficiariesByMemberCount).reduce((sum, benList) => sum + benList.length, 0);

                                const isRangedCategory = category.minMembers !== category.maxMembers && category.name !== 'General Item List';
                                const categoryIsEffectivelyRanged = isRangedCategory && Object.keys(beneficiariesByMemberCount).length > 1;

                                const categoryName = category.name === 'General Item List'
                                    ? category.name
                                    : category.minMembers === category.maxMembers
                                        ? `${category.name} ${category.minMembers}`
                                        : `${category.name} (${category.minMembers}-${category.maxMembers})`;

                                return (
                                    <React.Fragment key={categoryId}>
                                        <TableRow className="bg-muted hover:bg-muted cursor-pointer" onClick={() => toggleGroup(categoryId)}>
                                            <TableCell colSpan={(canUpdate || canDelete) ? 10 : 9} className="font-bold">
                                                <div className="flex items-center gap-2">
                                                    {categoryIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    <span>{categoryName} ({totalBeneficiariesInCategory} beneficiaries)</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        
                                        {!categoryIsCollapsed && categoryIsEffectivelyRanged && Object.keys(beneficiariesByMemberCount).sort((a, b) => Number(a) - Number(b)).map(memberCountStr => {
                                            const memberCount = Number(memberCountStr);
                                            const beneficiariesInSubGroup = beneficiariesByMemberCount[memberCount];
                                            const subGroupKey = `${categoryId}-${memberCount}`;
                                            const subGroupIsCollapsed = collapsedSubGroups[subGroupKey];
                                            
                                            return (
                                                <React.Fragment key={subGroupKey}>
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50 cursor-pointer" onClick={() => toggleSubGroup(subGroupKey)}>
                                                        <TableCell colSpan={(canUpdate || canDelete) ? 10 : 9} className="font-medium">
                                                            <div className="flex items-center gap-2 pl-6">
                                                                {subGroupIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                <span>{memberCount} Members ({beneficiariesInSubGroup.length} beneficiaries)</span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>

                                                    {!subGroupIsCollapsed && beneficiariesInSubGroup.map((beneficiary, index) => (
                                                        <BeneficiaryRow beneficiary={beneficiary} index={index + 1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} isSubRow={true} />
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                        {!categoryIsCollapsed && !categoryIsEffectivelyRanged && (
                                            Object.values(beneficiariesByMemberCount).flat().map((beneficiary, index) => (
                                                 <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} index={index + 1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} isSubRow={true} />
                                            ))
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                        <TableRow>
                            <TableCell colSpan={(canUpdate || canDelete) ? 10 : 9} className="text-center h-24 text-muted-foreground">
                                No beneficiaries found matching your criteria.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{formMode === 'add' ? 'Add' : formMode === 'view' ? 'View' : 'Edit'} Beneficiary</DialogTitle>
            </DialogHeader>
            <BeneficiaryForm
                beneficiary={editingBeneficiary}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                rationLists={sanitizedRationLists}
                initialReadOnly={formMode === 'view'}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the beneficiary record and its associated ID proof file from storage.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Import Beneficiaries</DialogTitle>
                <DialogDescription>
                    Upload an Excel (.xlsx) file with beneficiary data. Make sure it follows the provided template format.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Input
                    id="import-file"
                    type="file"
                    accept=".xlsx, .csv"
                    onChange={handleFileSelect}
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => { setIsImportOpen(false); setSelectedFile(null); }}>Cancel</Button>
                <Button onClick={handleImportBeneficiaries} disabled={!selectedFile || isImporting}>
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface BeneficiaryRowProps {
    beneficiary: Beneficiary;
    index: number;
    canUpdate?: boolean;
    canDelete?: boolean;
    onView: (beneficiary: Beneficiary) => void;
    onEdit: (beneficiary: Beneficiary) => void;
    onDelete: (id: string) => void;
    isSubRow?: boolean;
}

const BeneficiaryRow: React.FC<BeneficiaryRowProps> = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, isSubRow = false }) => {
    return (
        <TableRow className="bg-background hover:bg-accent/50">
            {(canUpdate || canDelete) && (
                <TableCell className="sticky left-0 z-10 bg-card text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive focus:bg-destructive/20 focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            )}
            <TableCell className={cn(isSubRow && "pl-12")}>{index}</TableCell>
            <TableCell className="font-medium">{beneficiary.name}</TableCell>
            <TableCell>
                {beneficiary.isEligibleForZakat ? (
                    <div className="flex flex-col items-start">
                        <Badge variant="success">Yes</Badge>
                        {beneficiary.zakatAllocation && beneficiary.zakatAllocation > 0 && (
                            <span className="text-xs text-muted-foreground mt-1">
                                ₹{beneficiary.zakatAllocation.toFixed(2)}
                            </span>
                        )}
                    </div>
                ) : <Badge variant="outline">No</Badge>}
            </TableCell>
            <TableCell className="text-right font-medium">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
            <TableCell>{beneficiary.phone}</TableCell>
            <TableCell>{beneficiary.address}</TableCell>
            <TableCell>{beneficiary.referralBy}</TableCell>
            <TableCell>
                <Badge variant={
                    beneficiary.status === 'Given' ? 'success' :
                    beneficiary.status === 'Verified' ? 'success' :
                    beneficiary.status === 'Pending' ? 'secondary' :
                    beneficiary.status === 'Hold' ? 'destructive' : 'outline'
                }>{beneficiary.status}</Badge>
            </TableCell>
             <TableCell>{beneficiary.addedDate}</TableCell>
        </TableRow>
    )
}
