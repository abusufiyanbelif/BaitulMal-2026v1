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
import { cn } from '@/lib/utils';
import { VerificationRequestDialog } from './verification-request-dialog';
import { useSession } from '@/hooks/use-session';

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
  isEligibleForZakat: z.boolean().default(false),
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

    const { userProfile } = useSession();
    const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<BeneficiaryFormData | null>(null);

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
 
         // Verification Check for Edits
         if (isEditing && configSettings?.verificationMode && configSettings.verificationMode !== 'Disabled' && userProfile) {
             setPendingFormData(data);
             setIsVerificationDialogOpen(true);
             return;
         }
 
         onSubmit(data);
     };

    const formIsDisabled = isReadOnly || isSubmitting || isLoading;
    const renderLabel = (label: string, fieldName: string) => <FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight capitalize">{label} {mandatoryFields[fieldName] ? '*' : ''}</FormLabel>;
  
    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full overflow-hidden bg-white">
                <div className="flex-1 min-h-0 relative flex flex-col">
                    <ScrollArea className="flex-1 w-full">
                        <div className="px-6 py-4 space-y-6 text-primary font-normal pb-24">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-primary tracking-tight">Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="name" render={({ field }) => (<FormItem>{renderLabel('Full Name', 'name')}<FormControl><Input placeholder="e.g. Saleem Khan" {...field} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={control} name="age" render={({ field }) => (<FormItem>{renderLabel('Age', 'age')}<FormControl><Input type="number" placeholder="e.g. 35" {...field} value={field.value ?? ''} disabled={formIsDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="phone" render={({ field }) => (
                                        <FormItem>
                                            {renderLabel('Phone Number', 'phone')}
                                            <div className="flex gap-2">
                                                <FormControl><Input placeholder="10-digit mobile number" {...field} disabled={formIsDisabled} className="font-normal flex-1" /></FormControl>
                                                {field.value && (
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="shrink-0 border-green-200 text-green-600 hover:bg-green-50"
                                                        onClick={() => window.open(`https://wa.me/91${String(field.value || '').replace(/\D/g, '')}`, '_blank')}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.973L0 16l4.204-1.102a7.923 7.923 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                                        </svg>
                                                    </Button>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
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
                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t mt-auto bg-background/80 backdrop-blur-sm p-4 z-50 shrink-0">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                        <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)} className="w-full sm:w-auto font-bold shadow-md transition-transform active:scale-95 px-8">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Securing...' : 'Save Beneficiary Record'}
                        </Button>
                    </div>
                )}
            </form>

            {userProfile && pendingFormData && (
                <VerificationRequestDialog
                    isOpen={isVerificationDialogOpen}
                    onOpenChange={setIsVerificationDialogOpen}
                    user={{ id: userProfile.id, name: userProfile.name }}
                    isOptional={configSettings?.verificationMode === 'Optional'}
                    onBypass={() => {
                        setIsVerificationDialogOpen(false);
                        onSubmit(pendingFormData);
                    }}
                    onSuccess={() => {
                        onCancel(); // Close form on success
                    }}
                    payload={{
                        module: 'beneficiaries',
                        targetId: beneficiary?.id || '',
                        targetCollection: 'beneficiaries',
                        description: `Update beneficiary profile for ${pendingFormData.name}`,
                        originalValue: beneficiary || {},
                        newValue: pendingFormData,
                        revalidatePath: '/beneficiaries'
                    }}
                />
            )}
        </Form>
    );
}