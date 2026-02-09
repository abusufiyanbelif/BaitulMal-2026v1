
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { Beneficiary, RationCategory } from '@/lib/types';
import { Loader2, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  members: z.coerce.number().optional(),
  earningMembers: z.coerce.number().optional(),
  male: z.coerce.number().optional(),
  female: z.coerce.number().optional(),
  idProofType: z.string().optional(),
  idNumber: z.string().optional(),
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
  onSubmit: (data: BeneficiaryFormData) => void;
  onCancel: () => void;
  rationLists: RationCategory[];
  initialReadOnly?: boolean;
}

export function BeneficiaryForm({ beneficiary, onSubmit, onCancel, initialReadOnly = false }: BeneficiaryFormProps) {
    const isEditing = !!beneficiary;

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
            isEligibleForZakat: beneficiary?.isEligibleForZakat || false,
            zakatAllocation: beneficiary?.zakatAllocation || 0,
        },
    });

    const { control, handleSubmit, watch } = form;
    
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleFormSubmit = async (data: BeneficiaryFormData) => {
        setIsSubmitting(true);
        await onSubmit(data);
        setIsSubmitting(false);
    };

    const formIsDisabled = isReadOnly || isSubmitting;
  
    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">
                
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField control={control} name="referralBy" render={({ field }) => (<FormItem><FormLabel>Referred By *</FormLabel><FormControl><Input placeholder="e.g. Local NGO" {...field} disabled={formIsDisabled} /></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={control} name="kitAmount" render={({ field }) => (<FormItem><FormLabel>Kit Amount (₹) *</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={formIsDisabled} /></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={formIsDisabled}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need More Details</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                    </div>
                </div>
                
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
                
                <div className="flex justify-end gap-2 pt-4">
                    {isReadOnly ? (
                        <>
                            <Button type="button" variant="outline" onClick={onCancel}>Close</Button>
                            <Button type="button" onClick={() => setIsReadOnly(false)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'Saving...' : 'Save Beneficiary'}
                            </Button>
                        </>
                    )}
                </div>
            </form>
        </Form>
    );
}
