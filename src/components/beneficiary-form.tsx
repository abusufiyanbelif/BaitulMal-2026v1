

'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Beneficiary, ItemCategory, RationItem } from '@/lib/types';
import { Loader2, Edit, Trash2, FileIcon, Replace, ScanLine } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import Resizer from 'react-image-file-resizer';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  occupation: z.string().optional(),
  members: z.coerce.number().optional(),
  earningMembers: z.coerce.number().optional(),
  male: z.coerce.number().optional(),
  female: z.coerce.number().optional(),
  idProofType: z.string().optional(),
  idNumber: z.string().optional(),
  idProofFile: z.any().optional(),
  idProofDeleted: z.boolean().optional(),
  referralBy: z.string().min(1, { message: 'Referral is required.' }),
  kitAmount: z.coerce.number(),
  status: z.enum(['Given', 'Pending', 'Hold', 'Need More Details', 'Verified']),
  notes: z.string().optional(),
  isEligibleForZakat: z.boolean().optional(),
  zakatAllocation: z.coerce.number().optional(),
});

export type BeneficiaryFormData = z.infer<typeof formSchema>;


interface BeneficiaryFormProps {
  beneficiary?: Beneficiary | null;
  onSubmit: (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => void;
  onCancel: () => void;
  itemCategories: ItemCategory[];
  kitAmountLabel?: string;
  defaultKitAmount?: number;
  isReadOnly?: boolean;
  isSubmitting?: boolean;
  isLoading?: boolean;
  hideZakatInfo?: boolean;
  isSessionLoading?: boolean;
}

export function BeneficiaryForm({ 
    beneficiary, 
    onSubmit, 
    onCancel, 
    itemCategories, 
    kitAmountLabel: kitAmountLabelProp,
    defaultKitAmount,
    isReadOnly = false, 
    isSubmitting = false, 
    isLoading = false, 
    hideZakatInfo = false,
    isSessionLoading = false,
}: BeneficiaryFormProps) {
    const isEditing = !!beneficiary?.id;
    const { toast } = useToast();

    const kitAmountLabel = kitAmountLabelProp || 'Required Amount (₹)';

    const form = useForm<BeneficiaryFormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: beneficiary?.name || '',
            address: beneficiary?.address || '',
            phone: beneficiary?.phone || '',
            occupation: beneficiary?.occupation || '',
            members: beneficiary?.members || 1,
            earningMembers: beneficiary?.earningMembers || 0,
            male: beneficiary?.male || 0,
            female: beneficiary?.female || 0,
            idProofType: beneficiary?.idProofType || '',
            idNumber: beneficiary?.idNumber || '',
            referralBy: beneficiary?.referralBy || '',
            kitAmount: beneficiary?.kitAmount ?? defaultKitAmount ?? 0,
            status: beneficiary?.status || 'Pending',
            notes: beneficiary?.notes || '',
            isEligibleForZakat: beneficiary?.isEligibleForZakat || false,
            zakatAllocation: beneficiary?.zakatAllocation || 0,
            idProofDeleted: false,
        },
    });

    const { control, handleSubmit, watch, setValue, getValues, register, formState: { isDirty } } = form;
    
    const [isScanning, setIsScanning] = useState(false);
    
    const idProofFile = watch('idProofFile');
    const [preview, setPreview] = useState<string | null>(beneficiary?.idProofUrl || null);
    
    const membersValue = watch('members');

    useEffect(() => {
        const isRationStyle = itemCategories.some(cat => cat.minMembers !== undefined && cat.maxMembers !== undefined);
        if (isReadOnly || !isRationStyle || itemCategories.length === 0) return;

        const calculateTotal = (items: RationItem[]) => {
            return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        };
        
        const members = membersValue || 0;

        const matchingCategories = itemCategories.filter(
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

        if (appliedCategory) {
            const kitAmount = calculateTotal(appliedCategory.items);
            setValue('kitAmount', kitAmount, { shouldValidate: true, shouldDirty: true });
        }
    }, [membersValue, itemCategories, setValue, isReadOnly]);

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

    const handleDeleteProof = () => {
        setValue('idProofFile', null);
        setValue('idProofDeleted', true);
        setPreview(null);
        toast({ title: 'Image Marked for Deletion', description: 'The ID proof will be permanently deleted when you save.', variant: 'default' });
    };

    const handleScanIdProof = async () => {
        const fileList = getValues('idProofFile') as FileList | undefined;
        if (!fileList || fileList.length === 0) {
            toast({ title: "No File", description: "Please upload an ID proof document to scan.", variant: "destructive" });
            return;
        }
        
        setIsScanning(true);
        toast({ title: "Scanning document...", description: "Please wait while the AI extracts the details." });

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
                if (!apiResponse.ok) throw new Error('API request failed');

                const response = await apiResponse.json();
                if (response) {
                    if (response.name) setValue('name', response.name, { shouldValidate: true });
                    if (response.aadhaarNumber) setValue('idNumber', response.aadhaarNumber, { shouldValidate:true });
                    if (response.address) setValue('address', response.address, { shouldValidate:true });
                    setValue('idProofType', 'Aadhaar', { shouldValidate: true });
                    toast({ title: "Autofill Successful", description: "Beneficiary details populated.", variant: "success" });
                }
            } catch (error: any) {
                toast({ title: "Scan Failed", description: "Could not automatically read the document.", variant: "destructive" });
            } finally {
                setIsScanning(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const formIsDisabled = isReadOnly || isSubmitting || isLoading;
    const hasFileSelected = idProofFile && idProofFile.length > 0;
  
    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
                
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Personal Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="e.g. Saleem Khan" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="10-digit mobile number" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <FormField control={control} name="occupation" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Occupation</FormLabel>
                            <FormControl><Input placeholder="e.g. Daily Wage Laborer" {...field} disabled={formIsDisabled} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={control} name="address" render={({ field }) => (
                        <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="Full residential address" {...field} disabled={formIsDisabled} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Family Details</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <FormField control={control} name="members" render={({ field }) => (<FormItem><FormLabel>Members</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)} />
                        <FormField control={control} name="earningMembers" render={({ field }) => (<FormItem><FormLabel>Earning</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)} />
                        <FormField control={control} name="male" render={({ field }) => (<FormItem><FormLabel>Male</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)} />
                        <FormField control={control} name="female" render={({ field }) => (<FormItem><FormLabel>Female</FormLabel><FormControl><Input type="number" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)} />
                    </div>
                </div>

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Identification & Financials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name="idProofType" render={({ field }) => (<FormItem><FormLabel>ID Proof Type</FormLabel><FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} disabled={formIsDisabled} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)}/>
                    </div>
                    
                    <div className="space-y-2">
                        <FormField
                            control={control}
                            name="idProofFile"
                            render={() => (
                                <FormItem>
                                    <FormLabel>ID Proof Document</FormLabel>
                                    <FormControl>
                                        <Input id="beneficiary-id-proof" type="file" accept="image/png, image/jpeg, image/webp, application/pdf" {...register('idProofFile')} disabled={formIsDisabled}/>
                                    </FormControl>
                                    <FormDescription>Supported formats: PNG, JPG, WEBP, PDF.</FormDescription>
                                </FormItem>
                            )}
                        />
                        {preview && (
                            <div className="relative group w-full h-48 mt-2 rounded-md overflow-hidden border bg-secondary/20">
                                {preview.startsWith('data:application/pdf') || preview.endsWith('.pdf') ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                                        <FileIcon className="w-12 h-12 mb-2" />
                                        <p className="text-sm text-center">PDF Document Uploaded</p>
                                    </div>
                                ) : (
                                    <Image src={preview} alt="ID Proof Preview" fill sizes="(max-width: 896px) 100vw, 896px" className="object-contain" />
                                )}
                                {!isReadOnly && 
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById('beneficiary-id-proof')?.click()}>
                                          <Replace className="h-5 w-5"/>
                                      </Button>
                                      <Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof}>
                                          <Trash2 className="h-5 w-5"/>
                                      </Button>
                                  </div>
                                }
                            </div>
                        )}
                        {idProofFile?.length > 0 && !isReadOnly && (
                            <Button type="button" className="w-full mt-2" onClick={handleScanIdProof} disabled={isScanning || formIsDisabled}>
                                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                                Scan & Autofill Details
                            </Button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField control={control} name="referralBy" render={({ field }) => (<FormItem><FormLabel>Referred By *</FormLabel><FormControl><Input placeholder="e.g. Local NGO" {...field} disabled={formIsDisabled} /></FormControl><FormMessage/></FormItem>)}/>
                        <FormField
                            control={control}
                            name="kitAmount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{kitAmountLabel} *</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0.00" {...field} disabled={formIsDisabled} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={formIsDisabled}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need More Details</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                    </div>
                </div>
                
                {!hideZakatInfo && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Zakat Information</h3>
                            <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                    <Label htmlFor="isEligibleForZakat" className="text-base">Eligible for Zakat</Label>
                                    <p className="text-xs text-muted-foreground">Can this beneficiary receive funds from Zakat?</p>
                                </div>
                                <FormField
                                    control={control}
                                    name="isEligibleForZakat"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={formIsDisabled} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {watch('isEligibleForZakat') && (
                                <div className="animate-fade-in-zoom">
                                    <FormField control={control} name="zakatAllocation" render={({ field }) => (<FormItem><FormLabel>Zakat Allocation (₹)</FormLabel><FormControl><Input type="number" placeholder="Amount from Zakat" {...field} disabled={formIsDisabled} /></FormControl></FormItem>)}/>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <FormField control={control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any internal notes..." {...field} disabled={formIsDisabled} /></FormControl></FormItem>)}/>
                </div>
                
                {isEditing && beneficiary?.createdAt && (
                    <div className="pt-4 text-xs text-muted-foreground space-y-1">
                        <p>Created by {beneficiary.createdByName || 'N/A'} on {new Date(beneficiary.createdAt.seconds * 1000).toLocaleString()}</p>
                        {beneficiary.updatedAt && <p>Last updated by {beneficiary.updatedByName || 'N/A'} on {new Date(beneficiary.updatedAt.seconds * 1000).toLocaleString()}</p>}
                    </div>
                )}
                
                {!isReadOnly && (
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || (hasFileSelected && isSessionLoading) || (isEditing && !isDirty)}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? 'Saving...' : 'Save Beneficiary'}
                        </Button>
                    </div>
                )}
            </form>
        </Form>
    );
}
