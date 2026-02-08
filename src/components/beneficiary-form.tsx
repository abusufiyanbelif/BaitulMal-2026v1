
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Beneficiary, RationCategory, RationItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Loader2, ScanLine, Trash2, Replace, FileIcon, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  address: z.string().optional(),
  phone: z.string().length(10, { message: "Phone must be exactly 10 digits." }).optional().or(z.literal('')),
  members: z.coerce.number().int().optional(),
  earningMembers: z.coerce.number().int().optional(),
  male: z.coerce.number().int().optional(),
  female: z.coerce.number().int().optional(),
  idProofType: z.string().optional(),
  idNumber: z.string().optional(),
  referralBy: z.string().min(2, { message: "Referral is required." }),
  kitAmount: z.coerce.number().min(0),
  status: z.enum(['Given', 'Pending', 'Hold', 'Need More Details', 'Verified']),
  notes: z.string().optional(),
  idProofFile: z.any().optional(),
  idProofDeleted: z.boolean().optional(),
  idProofIsPublic: z.boolean().optional(),
  isEligibleForZakat: z.boolean().optional(),
  zakatAllocation: z.coerce.number().optional(),
});

export type BeneficiaryFormData = z.infer<typeof formSchema>;

interface BeneficiaryFormProps {
  beneficiary?: Beneficiary | null;
  onSubmit: (data: BeneficiaryFormData) => void;
  onCancel: () => void;
  rationLists: RationCategory[];
  initialReadOnly?: boolean;
}

export function BeneficiaryForm({ beneficiary, onSubmit, onCancel, rationLists, initialReadOnly = false }: BeneficiaryFormProps) {
  const { toast } = useToast();
  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: beneficiary?.name || '',
      address: beneficiary?.address || '',
      phone: beneficiary?.phone || '',
      members: beneficiary?.members || 1,
      earningMembers: beneficiary?.earningMembers || 0,
      male: beneficiary?.male || 0,
      female: beneficiary?.female || 0,
      idProofType: beneficiary?.idProofType || '',
      idNumber: beneficiary?.idNumber || '',
      referralBy: beneficiary?.referralBy || '',
      kitAmount: beneficiary?.kitAmount || 0,
      status: beneficiary?.status || 'Pending',
      notes: beneficiary?.notes || '',
      idProofDeleted: false,
      idProofIsPublic: beneficiary?.idProofIsPublic || false,
      isEligibleForZakat: beneficiary?.isEligibleForZakat || false,
      zakatAllocation: beneficiary?.zakatAllocation || 0,
    },
  });

  const {
    control,
    watch,
    setValue,
    register,
    getValues,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = form;
  
  const isEditing = !!beneficiary;

  const [isScanning, setIsScanning] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
  const [preview, setPreview] = useState<string | null>(beneficiary?.idProofUrl || null);

  const idProofFile = watch('idProofFile');
  const membersValue = watch('members');
  const isEligibleForZakat = watch('isEligibleForZakat');

  useEffect(() => {
    const fileList = idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setValue('idProofDeleted', false);
    } else if (!watch('idProofDeleted')) {
        setPreview(beneficiary?.idProofUrl || null);
    } else {
        setPreview(null);
    }
  }, [idProofFile, beneficiary?.idProofUrl, watch, setValue]);

  useEffect(() => {
    if (membersValue && membersValue > 0 && rationLists && rationLists.length > 0) {
      
      const generalCategory = rationLists.find(cat => cat.name === 'General Item List');
      
      const masterPriceList = (generalCategory?.items || []).reduce((acc, item) => {
        const itemName = (item.name || '').trim().toLowerCase();
        if (itemName) {
          acc[itemName] = Number(item.price) || 0;
        }
        return acc;
      }, {} as Record<string, number>);

      const matchingCategory = rationLists.find(
        (cat) => membersValue >= cat.minMembers && membersValue <= cat.maxMembers && cat.name !== 'General Item List'
      );
      
      const categoryToUse = matchingCategory || generalCategory;

      if (categoryToUse) {
        const total = categoryToUse.items.reduce((sum, item) => {
          const unitPrice = masterPriceList[item.name.trim().toLowerCase()] || 0;
          const quantity = Number(item.quantity) || 0;
          return sum + (unitPrice * quantity);
        }, 0);
        
        setValue('kitAmount', total, { shouldValidate: true });
      } else {
        setValue('kitAmount', 0, { shouldValidate: true });
      }
    } else {
      setValue('kitAmount', 0, { shouldValidate: true });
    }
  }, [membersValue, rationLists, setValue]);
  
  const isKitAmountReadOnly = useMemo(() => {
    if (membersValue && membersValue > 0 && rationLists) {
        const hasMatchingCategory = rationLists.some(
            (cat) => membersValue >= cat.minMembers && membersValue <= cat.maxMembers
        );
        return hasMatchingCategory;
    }
    return false;
  }, [membersValue, rationLists]);

  const handleDeleteProof = () => {
    setValue('idProofFile', null);
    setValue('idProofDeleted', true);
    setPreview(null);
    toast({ title: 'Image Marked for Deletion', description: 'The ID proof will be permanently deleted when you save the changes.', variant: 'default' });
  };
  
  const handleScanIdProof = async () => {
    const fileList = getValues('idProofFile') as FileList | undefined;
    if (!fileList || fileList.length === 0) {
        toast({ title: "No File", description: "Please upload an ID proof document to scan.", variant: "destructive" });
        return;
    }
    setIsScanning(true);
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        if (!dataUri) {
            toast({ title: "Read Error", description: "Could not read the uploaded file.", variant: "destructive" });
            setIsScanning(false);
            return;
        }
        try {
             const apiResponse = await fetch('/api/scan-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoDataUri: dataUri }),
            });
            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.error || 'The server returned an error.');
            }
            const response = await apiResponse.json();
            if (response) {
                if (response.name) setValue('name', response.name, { shouldValidate: true });
                if (response.address) setValue('address', response.address, { shouldValidate: true });
                if (response.aadhaarNumber) setValue('idNumber', response.aadhaarNumber, { shouldValidate:true });
                setValue('idProofType', 'Aadhaar', { shouldValidate: true });
                toast({ title: "Autofill Successful", description: "Beneficiary details populated.", variant: "success"});
            } else {
                 toast({ title: "Autofill Incomplete", description: "Could not extract all details.", variant: "default" });
            }
        } catch (error: any) {
            toast({ title: "Scan Failed", description: error.message || "Could not read document.", variant: "destructive" });
        } finally {
            setIsScanning(false);
        }
    };
    reader.onerror = () => {
        toast({ title: "File Error", description: "Error reading the file.", variant: "destructive" });
        setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const formIsDisabled = isReadOnly || isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="e.g. Saleem Khan" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="10-digit mobile number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
        </div>
        <FormField control={control} name="address" render={({ field }) => (
            <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="Full residential address" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
        )}/>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField control={control} name="members" render={({ field }) => (
                <FormItem><FormLabel>Members</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="earningMembers" render={({ field }) => (
                <FormItem><FormLabel>Earning</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="male" render={({ field }) => (
                <FormItem><FormLabel>Male</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={control} name="female" render={({ field }) => (
                <FormItem><FormLabel>Female</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
        </div>

        <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-sm font-medium text-muted-foreground">ID Proof Details</h3>
            <Separator />
            <FormItem>
                <FormLabel>ID Proof Document</FormLabel>
                <FormControl>
                    <Input id="id-proof-file-input" type="file" accept="image/*,application/pdf" {...register('idProofFile')} disabled={formIsDisabled} />
                </FormControl>
                <FormDescription>Optional. Upload an image or PDF of the ID proof.</FormDescription>
                <FormMessage />
            </FormItem>
            
            {preview && (
                <div className="relative group w-full h-48 mt-2 rounded-md overflow-hidden border">
                    {preview.startsWith('data:application/pdf') ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                            <FileIcon className="w-12 h-12 mb-2" />
                            <p className="text-sm text-center">PDF Document Uploaded</p>
                        </div>
                    ) : (
                        <img src={`/api/image-proxy?url=${encodeURIComponent(preview)}`} alt="ID Proof Preview" className="object-contain w-full h-full" crossOrigin="anonymous"/>
                    )}
                    {!isReadOnly && <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById('id-proof-file-input')?.click()} disabled={formIsDisabled}><Replace className="h-5 w-5"/><span className="sr-only">Replace Image</span></Button>
                        <Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof} disabled={formIsDisabled}><Trash2 className="h-5 w-5"/><span className="sr-only">Delete Image</span></Button>
                    </div>}
                </div>
            )}
            
            {!isReadOnly && idProofFile?.length > 0 && (
                <Button type="button" className="w-full" onClick={handleScanIdProof} disabled={isScanning || formIsDisabled}>
                    {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Scan ID Proof & Autofill
                </Button>
            )}
            <FormField control={control} name="idProofIsPublic" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formIsDisabled} /></FormControl><FormLabel className="text-sm font-normal">Make ID Proof public</FormLabel></FormItem>
            )}/>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="idProofType" render={({ field }) => (
                <FormItem><FormLabel>ID Proof Type</FormLabel><FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="idNumber" render={({ field }) => (
                <FormItem><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField control={control} name="referralBy" render={({ field }) => (
                <FormItem><FormLabel>Referred By *</FormLabel><FormControl><Input placeholder="e.g. Local NGO" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="kitAmount" render={({ field }) => (
                <FormItem><FormLabel>Kit Amount (₹) *</FormLabel><FormControl><Input type="number" placeholder="Auto-calculated" {...field} readOnly={isKitAmountReadOnly || formIsDisabled} className={cn((isKitAmountReadOnly) && "bg-muted/50 focus:ring-0 cursor-not-allowed")} /></FormControl><FormDescription>Auto-calculated if ration list exists.</FormDescription><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={formIsDisabled}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need More Details</SelectItem></SelectContent></Select><FormMessage /></FormItem>
            )}/>
        </div>

        <FormField control={control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Any internal notes..." {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
        )}/>
        <Separator />
        <FormField control={control} name="isEligibleForZakat" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Eligible for Zakat</FormLabel><FormDescription>Can this beneficiary receive funds from Zakat?</FormDescription></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formIsDisabled} /></FormControl></FormItem>
        )}/>
        {isEligibleForZakat && (
            <FormField control={control} name="zakatAllocation" render={({ field }) => (
                <FormItem className="animate-fade-in-zoom"><FormLabel>Zakat Allocation (₹)</FormLabel><FormControl><Input type="number" {...field} placeholder="Amount from Zakat" disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
            )}
        />
        )}
        
        {isEditing && beneficiary?.createdAt && (
             <div className="pt-4 text-xs text-muted-foreground space-y-1">
                <p>Created by {beneficiary.createdByName || 'N/A'} on {format(beneficiary.createdAt.toDate(), 'PPpp')}</p>
                {beneficiary.updatedAt && <p>Last updated by {beneficiary.updatedByName || 'N/A'} on {format(beneficiary.updatedAt.toDate(), 'PPpp')}</p>}
             </div>
        )}
        
        <DialogFooter className="pt-4">
            {isReadOnly ? (
                <>
                    <Button type="button" variant="outline" onClick={onCancel}>Close</Button>
                    <Button type="button" onClick={() => setIsReadOnly(false)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                </>
            ) : (
                <>
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Saving...' : 'Save Beneficiary'}
                    </Button>
                </>
            )}
        </DialogFooter>
      </form>
    </Form>
  );
}
