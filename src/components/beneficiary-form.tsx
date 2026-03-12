'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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
import { Loader2, Edit, Trash2, FileIcon, Replace, ScanLine, Save, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import Resizer from 'react-image-file-resizer';
import { useFirestore, useMemoFirebase, useDoc, doc } from '@/firebase';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const numericOptional = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().optional()
);

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name Must Be At Least 2 Characters.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  age: numericOptional,
  occupation: z.string().optional(),
  members: numericOptional,
  earningMembers: numericOptional,
  male: numericOptional,
  female: numericOptional,
  idProofType: z.string().optional(),
  idNumber: z.string().optional(),
  idProofFile: z.any().optional(),
  idProofDeleted: z.boolean().optional(),
  referralBy: z.string().optional(),
  kitAmount: z.coerce.number().optional(),
  status: z.enum(['Given', 'Pending', 'Hold', 'Need More Details', 'Verified']).default('Pending'),
  notes: z.string().optional(),
  isEligibleForZakat: z.boolean().optional(),
  zakatAllocation: numericOptional,
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
  hideZakatAllocation?: boolean;
  isSessionLoading?: boolean;
  hideKitAmount?: boolean;
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
    hideZakatAllocation = false,
    isSessionLoading = false,
    hideKitAmount = false,
}: BeneficiaryFormProps) {
    const isEditing = !!beneficiary?.id;
    const { toast } = useToast();
    const firestore = useFirestore();

    const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
    const { data: configSettings } = useDoc<any>(configRef);
    const mandatoryFields = useMemo(() => configSettings?.mandatoryFields || {}, [configSettings]);

    const isMasterForm = hideKitAmount;
    const kitAmountLabel = kitAmountLabelProp || 'Required Amount (₹)';

    const form = useForm<BeneficiaryFormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: beneficiary?.name || '',
            address: beneficiary?.address || '',
            phone: beneficiary?.phone || '',
            age: beneficiary?.age || undefined,
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

    const { control, handleSubmit, watch, setValue, getValues, register, formState: { isDirty }, reset } = form;
    
    useEffect(() => {
        if (beneficiary) {
            reset({
                name: beneficiary.name || '',
                address: beneficiary.address || '',
                phone: beneficiary.phone || '',
                age: beneficiary.age || undefined,
                occupation: beneficiary.occupation || '',
                members: beneficiary.members || 1,
                earningMembers: beneficiary.earningMembers || 0,
                male: beneficiary.male || 0,
                female: beneficiary.female || 0,
                idProofType: beneficiary.idProofType || '',
                idNumber: beneficiary.idNumber || '',
                referralBy: beneficiary.referralBy || '',
                kitAmount: beneficiary.kitAmount ?? defaultKitAmount ?? 0,
                status: beneficiary.status || 'Pending',
                notes: beneficiary.notes || '',
                isEligibleForZakat: beneficiary.isEligibleForZakat || false,
                zakatAllocation: beneficiary.zakatAllocation || 0,
                idProofDeleted: false,
            });
        }
    }, [beneficiary, reset, defaultKitAmount]);

    const [isScanning, setIsScanning] = useState(false);
    const idProofFile = watch('idProofFile');
    const [preview, setPreview] = useState<string | null>(beneficiary?.idProofUrl || null);
    const membersValue = watch('members');
    const isEligibleForZakat = watch('isEligibleForZakat');

    useEffect(() => {
        if (!isEligibleForZakat && getValues('zakatAllocation') !== 0) {
            setValue('zakatAllocation', 0, { shouldDirty: true });
        }
    }, [isEligibleForZakat, setValue, getValues]);

    useEffect(() => {
        if (isReadOnly) return;
        const calculateTotal = (items: RationItem[]) => items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        const isRationStyle = itemCategories.some(cat => cat.minMembers !== undefined && cat.maxMembers !== undefined);
        if (isRationStyle && itemCategories.length > 0) {
            const members = membersValue || 0;
            const matchingCategories = itemCategories.filter(cat => cat.name !== 'Item Price List' && members >= (cat.minMembers ?? 0) && members <= (cat.maxMembers ?? 999));
            let appliedCategory: ItemCategory | undefined = undefined;
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
            if (appliedCategory) setValue('kitAmount', calculateTotal(appliedCategory.items), { shouldValidate: true, shouldDirty: true });
        } else if (itemCategories.length > 0) {
            const requirementList = itemCategories.find(cat => cat.name !== 'Item Price List') || itemCategories[0];
            if (requirementList) setValue('kitAmount', calculateTotal(requirementList.items), { shouldValidate: true, shouldDirty: true });
        }
    }, [membersValue, itemCategories, setValue, isReadOnly]);

    useEffect(() => {
        const fileList = idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
            setValue('idProofDeleted', false);
        } else if (!watch('idProofDeleted')) setPreview(beneficiary?.idProofUrl || null);
        else setPreview(null);
    }, [idProofFile, beneficiary?.idProofUrl, watch, setValue]);

    const handleDeleteProof = () => {
        setValue('idProofFile', null);
        setValue('idProofDeleted', true);
        setPreview(null);
        toast({ title: 'Image Marked For Deletion' });
    };

    const handleScanIdProof = async () => {
        const fileList = getValues('idProofFile') as FileList | undefined;
        if (!fileList || fileList.length === 0) {
            toast({ title: "No File", description: "Please Upload An ID Proof Document To Scan.", variant: "destructive" });
            return;
        }
        setIsScanning(true);
        const file = fileList[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUri = e.target?.result as string;
            if (!dataUri) { setIsScanning(false); return; }
            try {
                const apiResponse = await fetch('/api/scan-id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUri: dataUri }) });
                const response = await apiResponse.json();
                if (response) {
                    if (response.name) setValue('name', response.name, { shouldValidate: true });
                    if (response.aadhaarNumber) setValue('idNumber', response.aadhaarNumber, { shouldValidate:true });
                    if (response.address) setValue('address', response.address, { shouldValidate:true });
                    setValue('idProofType', 'Aadhaar', { shouldValidate: true });
                    toast({ title: "Autofill Successful", variant: "success" });
                }
            } catch (error: any) {
                toast({ title: "Scan Failed", variant: "destructive" });
            } finally { setIsScanning(false); }
        };
        reader.readAsDataURL(file);
    };

    const onFormSubmit = (data: BeneficiaryFormData) => {
        const missingFields: string[] = [];
        Object.entries(mandatoryFields).forEach(([field, isMandatory]) => {
            if (isMandatory && !data[field as keyof BeneficiaryFormData] && field !== 'idProofFile') missingFields.push(field);
        });
        if (missingFields.length > 0) {
            toast({ title: "Incomplete Form", description: `Please Fill Required Fields: ${missingFields.join(', ')}`, variant: "destructive" });
            return;
        }
        onSubmit(data);
    };

    const formIsDisabled = isReadOnly || isSubmitting || isLoading;
    const renderLabel = (label: string, fieldName: string) => <FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">{label} {mandatoryFields[fieldName] ? '*' : ''}</FormLabel>;
  
    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 min-h-0 relative">
                    <ScrollArea className="h-full w-full">
                        <div className="px-6 py-4 space-y-6 text-primary font-normal pb-10">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="name" render={({ field }) => (<FormItem>{renderLabel('Full Name', 'name')}<FormControl><Input placeholder="e.g. Saleem Khan" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={control} name="age" render={({ field }) => (<FormItem>{renderLabel('Age', 'age')}<FormControl><Input type="number" placeholder="e.g. 35" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="phone" render={({ field }) => (<FormItem>{renderLabel('Phone Number', 'phone')}<FormControl><Input placeholder="10-digit mobile number" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={control} name="occupation" render={({ field }) => (<FormItem>{renderLabel('Occupation', 'occupation')}<FormControl><Input placeholder="e.g. Daily Wage Laborer" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                </div>
                                <FormField control={control} name="address" render={({ field }) => (<FormItem>{renderLabel('Address', 'address')}<FormControl><Input placeholder="Full Residential Address" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Family Details</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <FormField control={control} name="members" render={({ field }) => (<FormItem>{renderLabel('Total Members', 'members')}<FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)} />
                                    <FormField control={control} name="earningMembers" render={({ field }) => (<FormItem>{renderLabel('Earning Members', 'earningMembers')}<FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)} />
                                    <FormField control={control} name="male" render={({ field }) => (<FormItem>{renderLabel('Male Members', 'male')}<FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)} />
                                    <FormField control={control} name="female" render={({ field }) => (<FormItem>{renderLabel('Female Members', 'female')}<FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)} />
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Identification & Financials</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="idProofType" render={({ field }) => (<FormItem>{renderLabel('Id Proof Type', 'idProofType')}<FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    <FormField control={control} name="idNumber" render={({ field }) => (<FormItem>{renderLabel('Id Number', 'idNumber')}<FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                </div>
                                <div className="space-y-2">
                                    {!isReadOnly && (
                                        <FormField control={control} name="idProofFile" render={() => (<FormItem>{renderLabel('Id Proof Document', 'idProofFile')}<FormControl><Input id="beneficiary-id-proof" type="file" accept="image/png, image/jpeg, image/webp, application/pdf" {...register('idProofFile')} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    )}
                                    {preview && (
                                        <div className="relative group w-full h-48 mt-2 rounded-xl border bg-white shadow-inner overflow-hidden">
                                            {preview.startsWith('data:application/pdf') || preview.endsWith('.pdf') ? (<div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center"><FileIcon className="w-12 h-12 mb-2" /><p className="text-sm font-bold">PDF Document Uploaded</p></div>) : (<Image src={preview} alt="Preview" fill sizes="100vw" className="object-contain" />)}
                                            {!isReadOnly && <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><Button type="button" size="icon" variant="outline" className="text-white border-white hover:bg-white/20" onClick={() => document.getElementById('beneficiary-id-proof')?.click()}><Replace className="h-5 w-5"/></Button><Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof}><Trash2 className="h-5 w-5"/></Button></div>}
                                        </div>
                                    )}
                                    {idProofFile?.length > 0 && !isReadOnly && (<Button type="button" className="w-full mt-2 font-bold shadow-md transition-transform active:scale-95" onClick={handleScanIdProof} disabled={isScanning || formIsDisabled}>{isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Scan & Autofill Details</Button>)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField control={control} name="referralBy" render={({ field }) => (<FormItem>{renderLabel('Referred By', 'referralBy')}<FormControl><Input placeholder="e.g. Local Volunteer" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage/></FormItem>)}/>
                                    {!hideKitAmount && (<FormField control={control} name="kitAmount" render={({ field }) => (<FormItem>{renderLabel(kitAmountLabel, 'kitAmount')}<FormControl><Input type="number" placeholder="0.00" {...field} disabled={formIsDisabled} className="bg-muted/30 font-normal" /></FormControl><FormMessage /></FormItem>)}/>)}
                                    <FormField control={control} name="status" render={({ field }) => (
                                        <FormItem>
                                            {renderLabel(isMasterForm ? 'Verification Status' : 'Disbursement Status', 'status')}
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={formIsDisabled}>
                                                <FormControl><SelectTrigger className="font-normal"><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                    <SelectItem value="Pending" className="font-normal">Pending</SelectItem>
                                                    {!isMasterForm && <SelectItem value="Given" className="font-normal">Given (Completed)</SelectItem>}
                                                    <SelectItem value="Verified" className="font-normal text-primary">Verified</SelectItem>
                                                    <SelectItem value="Hold" className="font-normal">Hold</SelectItem>
                                                    <SelectItem value="Need More Details" className="font-normal">Need Details</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage/>
                                        </FormItem>
                                    )}/>
                                </div>
                            </div>
                            {!hideZakatInfo && (
                                <>
                                    <Separator />
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-primary tracking-tight">Zakat Information</h3>
                                        <div className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/5">
                                            <div className="space-y-0.5"><Label htmlFor="isEligibleForZakat" className="text-base font-bold">Eligible For Zakat</Label><p className="text-xs text-muted-foreground font-normal">Can Recipient Receive Zakat Funds?</p></div>
                                            <FormField control={control} name="isEligibleForZakat" render={({ field }) => (<FormItem><FormControl><Checkbox checked={field.value === true} onCheckedChange={(val) => field.onChange(val === true)} disabled={formIsDisabled} /></FormControl></FormItem>)}/>
                                        </div>
                                        {watch('isEligibleForZakat') && !hideZakatAllocation && (
                                            <div className="animate-fade-in-zoom">
                                                <FormField control={control} name="zakatAllocation" render={({ field }) => (<FormItem>{renderLabel('Zakat Allocation (₹)', 'zakatAllocation')}<FormControl><Input type="number" placeholder="Reserved From Zakat" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl><FormDescription className="font-normal text-[10px] opacity-70 italic tracking-tighter">Amount Disbursed From Zakat Collections.</FormDescription></FormItem>)}/>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <Separator />
                            <div className="space-y-4 pb-10">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Institutional Notes</h3>
                                <FormField control={control} name="notes" render={({ field }) => (<FormItem>{renderLabel('Internal Notes', 'notes')}<FormControl><Textarea placeholder="Vetting Details, Background Checks, Etc." {...field} disabled={formIsDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                            </div>
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </div>
                {!isReadOnly && (
                    <div className="flex justify-end gap-2 pt-6 border-t mt-auto bg-background/80 backdrop-blur-sm p-4 z-50 shrink-0">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                        <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)} className="font-bold shadow-md transition-transform active:scale-95 px-8">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Securing...' : 'Save Beneficiary Record'}
                        </Button>
                    </div>
                )}
            </form>
        </Form>
    );
}