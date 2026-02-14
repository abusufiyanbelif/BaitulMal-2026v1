
'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useDoc, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, setDoc, DocumentReference, getDoc } from 'firebase/firestore';
import type { Beneficiary, Campaign, RationItem, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, Loader2, Upload, Download, Eye, ArrowUp, ArrowDown, RefreshCw, ZoomIn, ZoomOut, RotateCw, Check, ChevronsUpDown, X, Users, CheckCircle2, BadgeCheck, Hourglass, XCircle, Info, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { BeneficiaryImportDialog, type ProcessedRecord } from '@/components/beneficiary-import-dialog';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

const parseBoolean = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const lower = String(value).toLowerCase().trim();
    return lower === 'true' || lower === '1';
};

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
  const { data: campaign, isLoading: isCampaignLoading, forceRefetch: forceRefetchCampaign } = useDoc<Campaign>(campaignDocRef);
  
  const beneficiariesCollectionRef = useMemo(() => {
    if (!firestore || !campaignId) return null;
    return collection(firestore, 'campaigns', campaignId, 'beneficiaries');
  }, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading, forceRefetch } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ProcessedRecord[]>([]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState<string[]>([]);
  const [tempReferralFilter, setTempReferralFilter] = useState<string[]>([]);
  const [openReferralPopover, setOpenReferralPopover] = useState(false);
  const [zakatFilter, setZakatFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>({});
  
  const [isSyncing, setIsSyncing] = useState(false);

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
  
  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.delete', false);
  const canUpdateCampaign = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.update', false);

    const sanitizedItemCategories = useMemo(() => {
        if (!campaign?.itemCategories) return [];

        let lists: ItemCategory[] = [];
        if (Array.isArray(campaign.itemCategories)) {
          lists = campaign.itemCategories.map(cat => {
            if (cat.name === 'General Item List' || cat.name === 'General' || cat.name === 'Item Master List') {
              return { ...cat, name: 'Item Price List' };
            }
            return cat;
          });
        } else { // Hotfix for old object format
          lists = Object.keys(campaign.itemCategories).map(key => {
            const id = key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const items = (campaign.itemCategories as any)[key] || [];
            return {
              id: id,
              name: key === 'General Item List' ? 'Item Price List' : key,
              items: items,
            };
          });
        }
        
        // Sort to put "Item Price List" first, then by min members or name
        return lists.sort((a, b) => {
            if (a.name === 'Item Price List') return -1;
            if (b.name === 'Item Price List') return 1;
            if(a.minMembers !== undefined && b.minMembers !== undefined) {
                return a.minMembers - b.minMembers;
            }
            return a.name.localeCompare(b.name);
        });
    }, [campaign?.itemCategories]);

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
    if (zakatFilter !== 'All') {
        const isEligible = zakatFilter === 'Eligible';
        sortableItems = sortableItems.filter(b => !!b.isEligibleForZakat === isEligible);
    }
    if (referralFilter.length > 0) {
        sortableItems = sortableItems.filter(b => b.referralBy && referralFilter.includes(b.referralBy));
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
            if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                 return sortConfig.direction === 'ascending' ? (aValue === bValue ? 0 : aValue ? -1 : 1) : (aValue === bValue ? 0 : aValue ? 1 : -1);
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
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter, sortConfig]);

  const statusCounts = useMemo(() => {
    const listToCount = filteredAndSortedBeneficiaries || [];

    const counts = listToCount.reduce((acc, b) => {
      const status = b.status || 'Pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      Total: listToCount.length,
      Given: counts.Given || 0,
      Verified: counts.Verified || 0,
      Pending: counts.Pending || 0,
      Hold: counts.Hold || 0,
      'Need More Details': counts['Need More Details'] || 0,
    };
  }, [filteredAndSortedBeneficiaries]);

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
    if (!beneficiaryToDelete || !firestore || !storage || !campaignId || !canDelete || !beneficiaries || !campaign) return;

    const beneficiaryData = beneficiaries.find(b => b.id === beneficiaryToDelete);
    if (!beneficiaryData) return;

    setIsDeleteDialogOpen(false);

    const batch = writeBatch(firestore);
    const beneficiaryDocRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiaryToDelete);
    const masterBeneficiaryDocRef = doc(firestore, 'beneficiaries', beneficiaryToDelete);
    const campaignDocRef = doc(firestore, 'campaigns', campaignId);
    
    const amountToSubtract = beneficiaryData.kitAmount || 0;
    const newTargetAmount = (campaign.targetAmount || 0) - amountToSubtract;

    batch.delete(beneficiaryDocRef);
    // Note: We are not deleting from the master list on campaign-specific deletion.
    // batch.delete(masterBeneficiaryDocRef);

    batch.update(campaignDocRef, { targetAmount: newTargetAmount });

    if (beneficiaryData.idProofUrl) {
        const fileRef = storageRef(storage, beneficiaryData.idProofUrl);
        await deleteObject(fileRef).catch((err: any) => {
            if (err.code !== 'storage/object-not-found') {
                console.warn("Failed to delete ID proof from storage, but Firestore transaction will proceed:", err);
            }
        });
    }
    
    try {
        await batch.commit();
        toast({ title: 'Success', description: 'Beneficiary removed from campaign and campaign total updated.', variant: 'success' });
        forceRefetch();
        forceRefetchCampaign();
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `Batch operation on campaigns/${campaignId}`,
            operation: 'write'
        }));
    } finally {
        setBeneficiaryToDelete(null);
    }
  };
  
  const handleFormSubmit = async (data: BeneficiaryFormData, masterId?: string) => {
    if (!firestore || !storage || !userProfile || !campaign) return;
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
  
    setIsSubmitting(true);
  
    const batch = writeBatch(firestore);
    const campaignDocRef = doc(firestore, 'campaigns', campaignId);
    
    const newBeneficiaryId = masterId || (editingBeneficiary ? editingBeneficiary.id : doc(collection(firestore, 'beneficiaries')).id);
    const campaignBeneficiaryDocRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', newBeneficiaryId);
    const masterBeneficiaryDocRef = doc(firestore, 'beneficiaries', newBeneficiaryId);

    let finalData: Beneficiary;
  
    try {
      let idProofUrl = editingBeneficiary?.idProofUrl || (masterId ? (await getDoc(masterBeneficiaryDocRef)).data()?.idProofUrl : '');
      
      if (data.idProofDeleted && idProofUrl) {
          await deleteObject(storageRef(storage, idProofUrl)).catch((err: any) => {
              if (err.code !== 'storage/object-not-found') console.warn("Failed to delete old ID proof:", err);
          });
          idProofUrl = '';
      }
      
      const fileList = data.idProofFile as FileList | undefined;
      if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const { default: Resizer } = await import('react-image-file-resizer');
        const resizedBlob = await new Promise<Blob>((resolve) => {
          Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
        });
        const filePath = `beneficiaries/${newBeneficiaryId}/${Date.now()}.png`;
        const fileRef = storageRef(storage, filePath);
        const uploadResult = await uploadBytes(fileRef, resizedBlob);
        idProofUrl = await getDownloadURL(uploadResult.ref);
      }
  
      const { idProofFile, idProofDeleted, ...restData } = data;

      finalData = {
        ...restData,
        id: newBeneficiaryId,
        idProofUrl,
        ...(!editingBeneficiary && !masterId && {
          createdAt: serverTimestamp(),
          createdById: userProfile.id,
          createdByName: userProfile.name,
        }),
        ...(editingBeneficiary && {
          updatedAt: serverTimestamp(),
          updatedById: userProfile.id,
          updatedByName: userProfile.name,
        }),
      } as Beneficiary;

      const oldKitAmount = editingBeneficiary?.kitAmount || 0;
      const newKitAmount = data.kitAmount || 0;
      
      let amountDifference;
      if (masterId) { // Adding existing beneficiary
        amountDifference = newKitAmount;
      } else if (editingBeneficiary) { // Editing existing beneficiary in campaign
        amountDifference = newKitAmount - oldKitAmount;
      } else { // Adding brand new beneficiary
        amountDifference = newKitAmount;
      }

      const newTargetAmount = (campaign.targetAmount || 0) + amountDifference;

      batch.set(masterBeneficiaryDocRef, finalData, { merge: true });
      batch.set(campaignBeneficiaryDocRef, finalData, { merge: true });
      batch.update(campaignDocRef, { targetAmount: newTargetAmount });

      await batch.commit();
  
      toast({ title: 'Success', description: `Beneficiary ${editingBeneficiary ? 'updated' : 'added'} and campaign total updated.`, variant: 'success' });
      forceRefetch();
      forceRefetchCampaign();
      setIsFormOpen(false);
      setEditingBeneficiary(null);

    } catch (error: any) {
      console.warn("Error during form submission:", error);
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: `Batch operation on campaigns/${campaignId}`,
          operation: editingBeneficiary ? 'update' : 'create',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
      }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSelectExisting = async (beneficiaryToCopy: Beneficiary) => {
    if (!canCreate || !userProfile) return;

     const isDuplicate = beneficiaries && beneficiaries.some(b => b.id === beneficiaryToCopy.id);
     if(isDuplicate) {
         toast({ title: 'Already Exists', description: 'This beneficiary is already in the current campaign.', variant: 'destructive' });
         return;
     }

    setIsSearchOpen(false);
    
    // We pass the full beneficiary object including its original master ID
    await handleFormSubmit(beneficiaryToCopy as BeneficiaryFormData, beneficiaryToCopy.id);
  };

  const handleExportData = async () => {
    if (!beneficiaries || beneficiaries.length === 0) {
        toast({ title: 'No Data', description: 'There are no beneficiaries to export.' });
        return;
    }
    const XLSX = await import('xlsx');
    const headers = [
        'id', 'name', 'address', 'phone', 'occupation', 'members', 'earningMembers', 'male', 'female',
        'idProofType', 'idNumber', 'referralBy', 'kitAmount', 'status', 'notes',
        'isEligibleForZakat', 'zakatAllocation'
    ];

    const dataToExport = beneficiaries.map(b => ({
        id: b.id,
        name: b.name || '',
        address: b.address || '',
        phone: b.phone || '',
        occupation: b.occupation || '',
        members: b.members || 0,
        earningMembers: b.earningMembers || 0,
        male: b.male || 0,
        female: b.female || 0,
        idProofType: b.idProofType || '',
        idNumber: b.idNumber || '',
        referralBy: b.referralBy || '',
        kitAmount: b.kitAmount || 0,
        status: b.status || 'Pending',
        isEligibleForZakat: b.isEligibleForZakat || false,
        zakatAllocation: b.zakatAllocation || 0,
        notes: b.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.writeFile(wb, `${campaign?.name || 'beneficiaries'}_export.xlsx`);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        setSelectedFile(event.target.files[0]);
    }
  };

  const handleProcessImportFile = async () => {
    if (!selectedFile || !firestore || !campaignId || !canCreate || !userProfile || !beneficiaries) return;
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

            const validStatuses: BeneficiaryStatus[] = ['Given', 'Pending', 'Hold', 'Need More Details', 'Verified'];
            
            const processedRecords: ProcessedRecord[] = [];
            const existingBeneficiaryIds = new Set(beneficiaries.map(b => b.id));
            const existingNamePhoneSet = new Set(beneficiaries.map(b => `${(b.name || '').trim().toLowerCase()}|${(b.phone || '').trim()}`));

            json.forEach((row, index) => {
                const importedStatusString = String(row.status || '').trim();
                const status: BeneficiaryStatus = validStatuses.includes(importedStatusString as BeneficiaryStatus) ? importedStatusString as BeneficiaryStatus : 'Pending';

                const beneficiaryData: Partial<Beneficiary> = {
                    id: String(row.id || '').trim(),
                    name: String(row.name || '').trim(),
                    phone: String(row.phone || '').trim(),
                    address: String(row.address || '').trim(),
                    occupation: String(row.occupation || '').trim(),
                    members: Number(row.members || 0),
                    earningMembers: Number(row.earningMembers || 0),
                    male: Number(row.male || 0),
                    female: Number(row.female || 0),
                    idProofType: String(row.idProofType || '').trim(),
                    idNumber: String(row.idNumber || '').trim(),
                    referralBy: String(row.referralBy || '').trim(),
                    kitAmount: Number(row.kitAmount || 0),
                    status: status,
                    notes: String(row.notes || '').trim(),
                    isEligibleForZakat: parseBoolean(row.isEligibleForZakat),
                    zakatAllocation: Number(row.zakatAllocation || 0),
                };
                
                if (!beneficiaryData.name) {
                  processedRecords.push({ row: index + 2, data: beneficiaryData, status: 'invalid', reason: `Missing required 'name' field.` });
                  return;
                }
                if (!beneficiaryData.referralBy) {
                  processedRecords.push({ row: index + 2, data: beneficiaryData, status: 'invalid', reason: `Missing required 'referralBy' field.` });
                  return;
                }

                const recordKey = `${beneficiaryData.name?.toLowerCase()}|${beneficiaryData.phone}`;

                if (beneficiaryData.id && existingBeneficiaryIds.has(beneficiaryData.id)) {
                    processedRecords.push({ row: index + 2, data: beneficiaryData, status: 'duplicate-id', reason: `A beneficiary with this ID already exists.` });
                } else if (existingNamePhoneSet.has(recordKey)) {
                    processedRecords.push({ row: index + 2, data: beneficiaryData, status: 'duplicate-name-phone', reason: `A beneficiary with this Name & Phone already exists.` });
                } else {
                    processedRecords.push({ row: index + 2, data: beneficiaryData, status: 'new' });
                }
            });

            setImportData(processedRecords);

        } catch (error: any) {
             toast({ title: 'Import Failed', description: error.message || "An error occurred during import.", variant: 'destructive' });
        } finally {
            setIsImporting(false);
            setIsImportOpen(false); // Close the upload dialog
        }
    };
    reader.onerror = (error: any) => {
        toast({ title: 'File Error', description: 'Could not read the file.', variant: 'destructive'});
        setIsImporting(false);
    }
    reader.readAsArrayBuffer(selectedFile!);
  };
  
  const handleCommitImport = async (recordsToImport: ProcessedRecord[]) => {
    if (!recordsToImport || recordsToImport.length === 0 || !firestore || !campaignId || !userProfile || !campaign) return;

    setIsImporting(true);
    const batch = writeBatch(firestore);
    const campaignDocRef = doc(firestore, 'campaigns', campaignId);

    let totalAmountFromImport = 0;

    recordsToImport.forEach(record => {
        const newBeneficiaryId = doc(collection(firestore, 'beneficiaries')).id;
        const masterRef = doc(firestore, 'beneficiaries', newBeneficiaryId);
        const campaignRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, newBeneficiaryId);
        
        const { id, ...dataToSave } = record.data;
        const fullData = {
            ...dataToSave,
            id: newBeneficiaryId,
            addedDate: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp(),
            createdById: userProfile.id,
            createdByName: userProfile.name,
        };
        totalAmountFromImport += Number(fullData.kitAmount || 0);

        batch.set(masterRef, fullData);
        batch.set(campaignRef, fullData);
    });

    const newTargetAmount = (campaign.targetAmount || 0) + totalAmountFromImport;
    batch.update(campaignDocRef, { targetAmount: newTargetAmount });


    try {
        await batch.commit();
        toast({
            title: 'Import Successful',
            description: `${recordsToImport.length} new beneficiaries have been added.`,
            variant: 'success',
        });
        forceRefetch(); // Force a refetch of the beneficiary data
        forceRefetchCampaign(); // Refetch campaign data
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: `campaigns/${campaignId}/beneficiaries`,
            operation: 'write',
            requestResourceData: { note: `${recordsToImport.length} beneficiaries to import` }
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsImporting(false);
        setImportData([]);
        setSelectedFile(null);
    }
};

  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const groupedBeneficiaries = useMemo(() => {
    if (!filteredAndSortedBeneficiaries || !sanitizedItemCategories || sanitizedItemCategories.length === 0) return {};

    return filteredAndSortedBeneficiaries.reduce((acc, beneficiary) => {
        const members = beneficiary.members || 0;
        
        const matchingCategories = sanitizedItemCategories.filter(
            cat => cat.name !== 'Item Price List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999)
        );

        let appliedCategory: ItemCategory | undefined = undefined;

        if (matchingCategories.length > 1) {
            matchingCategories.sort((a, b) => {
                const rangeA = (a.maxMembers ?? 999) - (a.minMembers ?? 0);
                const rangeB = (b.maxMembers ?? 999) - (b.minMembers ?? 0);
                if (rangeA !== rangeB) {
                    return rangeA - rangeB;
                }
                return (b.minMembers ?? 0) - (a.minMembers ?? 0);
            });
            appliedCategory = matchingCategories[0];
        } else if (matchingCategories.length === 1) {
            appliedCategory = matchingCategories[0];
        }

        const categoryId = appliedCategory ? appliedCategory.id : 'uncategorized';
        const categoryForGroup = appliedCategory || { id: 'uncategorized', name: 'Uncategorized', items: [] };

        if (!acc[categoryId]) {
            acc[categoryId] = {
                category: categoryForGroup,
                beneficiariesByMemberCount: {},
            };
        }

        const memberCount = beneficiary.members || 0;
        if (!acc[categoryId].beneficiariesByMemberCount[memberCount]) {
            acc[categoryId].beneficiariesByMemberCount[memberCount] = [];
        }
        acc[categoryId].beneficiariesByMemberCount[memberCount].push(beneficiary);
        
        return acc;
    }, {} as Record<string, { category: ItemCategory, beneficiariesByMemberCount: Record<number, Beneficiary[]> }>);
}, [filteredAndSortedBeneficiaries, sanitizedItemCategories]);

const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedBeneficiaries).sort((a, b) => {
        const catA = groupedBeneficiaries[a].category;
        const catB = groupedBeneficiaries[b].category;
        if (catA.id === 'uncategorized') return 1;
        if (catB.id === 'uncategorized') return -1;
        if (catA.name === 'Item Price List') return -1;
        if (catB.name === 'Item Price List') return 1;
        return (catA.minMembers ?? 0) - (catB.minMembers ?? 0);
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
  
  const handleStatusChange = async (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !campaignId || !canUpdate) return;
    
    const beneficiaryDocRef = doc(firestore, `campaigns/${campaignId}/beneficiaries`, beneficiary.id);
    
    try {
      await updateDoc(beneficiaryDocRef, { status: newStatus });
      toast({
        title: 'Status Updated',
        description: `${beneficiary.name}'s status has been set to ${newStatus}.`,
        variant: 'success',
      });
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: beneficiaryDocRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      }));
    }
  };

  const handleZakatToggle = async (beneficiary: Beneficiary) => {
    if (!firestore || !campaignId || !canUpdate) return;

    const beneficiaryDocRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    const masterBeneficiaryDocRef = doc(firestore, 'beneficiaries', beneficiary.id);
    const newZakatStatus = !beneficiary.isEligibleForZakat;

    try {
        const batch = writeBatch(firestore);
        batch.update(beneficiaryDocRef, { isEligibleForZakat: newZakatStatus });
        batch.update(masterBeneficiaryDocRef, { isEligibleForZakat: newZakatStatus });
        await batch.commit();

        toast({
            title: 'Zakat Status Updated',
            description: `${beneficiary.name} is now ${newZakatStatus ? 'Eligible' : 'Not Eligible'} for Zakat.`,
            variant: 'success',
        });
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: beneficiaryDocRef.path,
        operation: 'update',
        requestResourceData: { isEligibleForZakat: newZakatStatus },
      }));
    }
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
                        <Button variant="ghost" asChild className={cn("shrink-0", pathname.startsWith(`/campaign-members/${campaignId}/donations`) ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
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
                        <Button variant="outline" onClick={handleExportData}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                        </Button>
                        <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import Data
                        </Button>
                        <Button variant="outline" onClick={() => setIsSearchOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add from Existing
                        </Button>
                        <Button onClick={handleAdd}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
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
                  <Select value={zakatFilter} onValueChange={setZakatFilter}>
                      <SelectTrigger className="w-auto md:w-[180px]">
                          <SelectValue placeholder="Filter by Zakat" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Zakat Status</SelectItem>
                          <SelectItem value="Eligible">Eligible</SelectItem>
                          <SelectItem value="Not Eligible">Not Eligible</SelectItem>
                      </SelectContent>
                  </Select>
                  <Popover open={openReferralPopover} onOpenChange={(isOpen) => {
                      setOpenReferralPopover(isOpen);
                      if (isOpen) {
                          setTempReferralFilter(referralFilter);
                      }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openReferralPopover}
                        className="w-auto md:w-[250px] justify-between"
                      >
                        <span className="truncate">
                          {referralFilter.length > 0
                            ? `${referralFilter.length} referral(s) selected`
                            : "Filter by referral..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0">
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
                                  setTempReferralFilter(prev => {
                                      const selected = prev.includes(currentValue);
                                      if (selected) {
                                          return prev.filter((r) => r !== currentValue);
                                      } else {
                                          return [...prev, currentValue];
                                      }
                                  });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    tempReferralFilter.includes(referral) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {referral}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                       <div className="p-2 border-t flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                                setTempReferralFilter([]);
                                setReferralFilter([]);
                            }}>Clear All</Button>
                            <Button size="sm" onClick={() => {
                                setReferralFilter(tempReferralFilter);
                                setOpenReferralPopover(false);
                            }}>Apply</Button>
                        </div>
                    </PopoverContent>
                  </Popover>
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
                            <SortableHeader sortKey="srNo" className="w-[120px]">#</SortableHeader>
                            <SortableHeader sortKey="name">Name & Phone</SortableHeader>
                            <SortableHeader sortKey="status">Status</SortableHeader>
                            <SortableHeader sortKey="isEligibleForZakat">Zakat</SortableHeader>
                            <SortableHeader sortKey="kitAmount" className="text-right">Kit Amount (₹)</SortableHeader>
                            <SortableHeader sortKey="referralBy">Referred By</SortableHeader>
                            {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {areBeneficiariesLoading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={`skeleton-${i}`}>
                                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    {(canUpdate || canDelete) && <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>}
                                </TableRow>
                            ))
                        ) : sortedGroupKeys.length > 0 ? (
                            sortedGroupKeys.map((categoryId) => {
                                const group = groupedBeneficiaries[categoryId];
                                if (!group) return null;
                                const { category, beneficiariesByMemberCount } = group;
                                const categoryIsCollapsed = collapsedGroups[categoryId];
                                const totalBeneficiariesInCategory = Object.values(beneficiariesByMemberCount).reduce((sum, benList) => sum + benList.length, 0);

                                const isRangedCategory = (category.minMembers ?? 0) !== (category.maxMembers ?? 0) && category.name !== 'Item Price List';
                                const categoryIsEffectivelyRanged = isRangedCategory && Object.keys(beneficiariesByMemberCount).length > 1;

                                const categoryName = category.name === 'Uncategorized' 
                                    ? category.name
                                    : category.name === 'Item Price List'
                                    ? category.name
                                    : (category.minMembers ?? 0) === (category.maxMembers ?? 0)
                                        ? `${category.name} (${category.minMembers})`
                                        : `${category.name} (${category.minMembers}-${category.maxMembers})`;

                                return (
                                    <React.Fragment key={categoryId}>
                                        <TableRow className="bg-muted hover:bg-muted cursor-pointer" onClick={() => toggleGroup(categoryId)}>
                                            <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="font-bold">
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
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSubGroup(subGroupKey);}}>
                                                        <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="font-medium">
                                                            <div className="flex items-center gap-2 pl-6">
                                                                {subGroupIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                <span>{memberCount} Members ({beneficiariesInSubGroup.length} beneficiaries)</span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>

                                                    {!subGroupIsCollapsed && beneficiariesInSubGroup.map((beneficiary, index) => (
                                                        <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} index={index + 1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} isSubRow={true} />
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                        {!categoryIsCollapsed && !categoryIsEffectivelyRanged && (
                                            Object.values(beneficiariesByMemberCount).flat().map((beneficiary, index) => (
                                                 <BeneficiaryRow key={beneficiary.id} beneficiary={beneficiary} index={index + 1} canUpdate={canUpdate} canDelete={canDelete} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onZakatToggle={handleZakatToggle} isSubRow={true} />
                                            ))
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                        <TableRow>
                            <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="text-center h-24 text-muted-foreground">
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{formMode === 'add' ? 'Add' : formMode === 'view' ? 'View' : 'Edit'} Beneficiary</DialogTitle>
            </DialogHeader>
            <BeneficiaryForm
                beneficiary={editingBeneficiary}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                itemCategories={sanitizedItemCategories}
                initialReadOnly={formMode === 'view'}
                isSubmitting={isSubmitting}
                isLoading={isLoading}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the beneficiary from this campaign, but their record will remain in the master list. This action cannot be undone.
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
                    Upload an Excel (.xlsx) file with beneficiary data. Duplicates will be detected and skipped.
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
                <Button onClick={handleProcessImportFile} disabled={!selectedFile || isImporting}>
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Process File
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <BeneficiaryImportDialog
        open={importData.length > 0}
        onOpenChange={(open) => { if (!open) setImportData([]); }}
        processedRecords={importData}
        onConfirm={handleCommitImport}
        isImporting={isImporting}
      />
      <BeneficiarySearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectBeneficiary={handleSelectExisting}
        currentLeadId={campaignId}
      />
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
    onStatusChange: (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => void;
    onZakatToggle: (beneficiary: Beneficiary) => void;
    isSubRow?: boolean;
}

const BeneficiaryRow: React.FC<BeneficiaryRowProps> = ({ beneficiary, index, canUpdate, canDelete, onView, onEdit, onDelete, onStatusChange, onZakatToggle, isSubRow = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</p>
            <p className="text-sm font-medium pt-1">{value || 'N/A'}</p>
        </div>
    );
    
    return (
        <>
            <TableRow className="bg-background hover:bg-accent/50 data-[state=open]:bg-accent/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} data-state={isOpen ? 'open' : 'closed'}>
                <TableCell className="w-[120px]">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 data-[state=open]:bg-accent" data-state={isOpen ? 'open' : 'closed'}>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className={cn(isSubRow && "pl-8")}>{index}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">
                    <div>{beneficiary.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{beneficiary.phone}</div>
                </TableCell>
                <TableCell>
                    <Badge variant={
                        beneficiary.status === 'Given' || beneficiary.status === 'Verified' ? 'success' :
                        beneficiary.status === 'Pending' ? 'secondary' :
                        beneficiary.status === 'Hold' ? 'destructive' : 'outline'
                    }>{beneficiary.status}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={beneficiary.isEligibleForZakat ? 'success' : 'outline'}>{beneficiary.isEligibleForZakat ? 'Eligible' : 'Not Eligible'}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">₹{(beneficiary.kitAmount || 0).toFixed(2)}</TableCell>
                <TableCell>{beneficiary.referralBy}</TableCell>

                {(canUpdate || canDelete) && (
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(beneficiary)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => onEdit(beneficiary)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            
                            {canUpdate && <DropdownMenuSeparator />}
                            
                            {canUpdate && beneficiary.status !== 'Given' && (
                                <DropdownMenuItem onClick={() => onStatusChange(beneficiary, 'Given')}>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-success-foreground" />
                                    <span>Mark as Given</span>
                                </DropdownMenuItem>
                            )}
                            {canUpdate && beneficiary.status === 'Given' && (
                                <DropdownMenuItem onClick={() => onStatusChange(beneficiary, 'Pending')}>
                                    <Hourglass className="mr-2 h-4 w-4" />
                                    <span>Mark as Pending</span>
                                </DropdownMenuItem>
                            )}
                            
                            {canUpdate && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ChevronsUpDown className="mr-2 h-4 w-4" />
                                        <span>Change Status</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup
                                                value={beneficiary.status}
                                                onValueChange={(newStatus) => onStatusChange(beneficiary, newStatus as BeneficiaryStatus)}
                                            >
                                                <DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2"/>Pending</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2"/>Verified</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2"/>Given</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Hold"><XCircle className="mr-2"/>Hold</DropdownMenuRadioItem>
                                                <DropdownMenuRadioItem value="Need More Details"><Info className="mr-2"/>Need More Details</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            )}

                            {canUpdate && (
                                <DropdownMenuItem onClick={() => onZakatToggle(beneficiary)}>
                                    {beneficiary.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    <span>{beneficiary.isEligibleForZakat ? 'Mark as Not Eligible' : 'Mark as Zakat Eligible'}</span>
                                </DropdownMenuItem>
                            )}
                            
                            {canDelete && <DropdownMenuSeparator />}
                            {canDelete && <DropdownMenuItem onClick={() => onDelete(beneficiary.id)} className="text-destructive focus:bg-destructive/20 focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            )}
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/20 hover:bg-muted/30">
                    <TableCell colSpan={(canUpdate || canDelete) ? 7 : 6} className="p-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 p-4">
                            <DetailItem label="Address" value={beneficiary.address} />
                            <DetailItem label="Occupation" value={beneficiary.occupation} />
                            <DetailItem label="Family" value={`Total: ${beneficiary.members}, Earning: ${beneficiary.earningMembers}, M: ${beneficiary.male}, F: ${beneficiary.female}`} />
                            <DetailItem label="ID Proof" value={`${beneficiary.idProofType || 'N/A'} - ${beneficiary.idNumber || 'N/A'}`} />
                            <DetailItem label="Date Added" value={beneficiary.addedDate} />
                             {beneficiary.isEligibleForZakat && (
                                <DetailItem label="Zakat Allocation" value={`₹${(beneficiary.zakatAllocation || 0).toFixed(2)}`} />
                             )}
                            {beneficiary.notes && <div className="sm:col-span-2 lg:col-span-3"><DetailItem label="Notes" value={<p className="whitespace-pre-wrap">{beneficiary.notes}</p>} /></div>}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

    

    

  

