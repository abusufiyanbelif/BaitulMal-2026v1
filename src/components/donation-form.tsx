
'use client';

import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import Image from 'next/image';
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
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Donation, DonationCategory, Campaign, Lead } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Loader2, ScanLine, Replace, Trash2, Plus, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';

const formSchema = z.object({
  donorName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  donorPhone: z.string().length(10, { message: "Phone must be exactly 10 digits." }).optional().or(z.literal('')),
  receiverName: z.string().min(2, { message: "Receiver name must be at least 2 characters." }),
  referral: z.string().min(1, { message: "Referral is required." }),
  amount: z.coerce.number().min(1, { message: "Amount must be at least 1." }),
  typeSplit: z.array(z.object({
    category: z.enum(donationCategories),
    amount: z.coerce.number().min(0, { message: 'Amount cannot be negative.' }),
  })).min(1, { message: 'At least one donation category is required.'}),
  donationType: z.enum(['Cash', 'Online Payment', 'Check', 'Other']),
  transactionId: z.string().optional(),
  donationDate: z.string().min(1, { message: "Donation date is required."}),
  status: z.enum(['Verified', 'Pending', 'Canceled']),
  screenshotFile: z.any().optional(),
  screenshotDeleted: z.boolean().optional(),
  screenshotIsPublic: z.boolean().optional(),
  isTransactionIdRequired: z.boolean().default(true),
  comments: z.string().optional(),
  suggestions: z.string().optional(),
  isSplit: z.boolean().default(false),
  linkId: z.string().optional(),
}).refine(data => {
    if (data.donationType === 'Online Payment' && data.isTransactionIdRequired) {
        return data.transactionId && data.transactionId.trim().length > 0;
    }
    return true;
}, {
    message: "Transaction ID is required for online payments.",
    path: ['transactionId'],
}).refine(data => {
    if (data.isSplit && data.typeSplit.length > 0) {
        const totalSplit = data.typeSplit.reduce((sum, split) => sum + split.amount, 0);
        return Math.abs(totalSplit - data.amount) < 0.01; // Compare with a tolerance for floating point
    }
    return true;
}, {
    message: "The sum of split amounts must equal the total donation amount.",
    path: ['typeSplit'],
});

export type DonationFormData = z.infer<typeof formSchema>;

interface DonationFormProps {
  donation?: Donation | null;
  onSubmit: (data: DonationFormData) => void;
  onCancel: () => void;
  campaigns?: Campaign[];
  leads?: Lead[];
}

export function DonationForm({ donation, onSubmit, onCancel, campaigns = [], leads = [] }: DonationFormProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const isEditing = !!donation;

  const form = useForm<DonationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      donorName: donation?.donorName || '',
      donorPhone: donation?.donorPhone || '',
      receiverName: donation?.receiverName || '',
      referral: donation?.referral || '',
      amount: donation?.amount || 0,
      donationType: donation?.donationType || 'Online Payment',
      transactionId: donation?.transactionId || '',
      donationDate: donation?.donationDate || new Date().toISOString().split('T')[0],
      status: donation?.status || 'Pending',
      screenshotDeleted: false,
      screenshotIsPublic: donation?.screenshotIsPublic || false,
      isTransactionIdRequired: true,
      comments: donation?.comments || '',
      suggestions: donation?.suggestions || '',
      isSplit: donation?.typeSplit ? donation.typeSplit.length > 1 : false,
      typeSplit: donation?.typeSplit && donation.typeSplit.length > 0 ? donation.typeSplit : [{ category: 'Sadaqah', amount: donation?.amount || 0 }],
      linkId: donation?.campaignId ? `campaign_${donation.campaignId}` : '',
    },
  });

  const { formState: { isSubmitting, isDirty }, register, watch, setValue, getValues, control } = form;
  const [preview, setPreview] = useState<string | null>(donation?.screenshotUrl || null);
  const screenshotFile = watch('screenshotFile');
  const donationTypeValue = watch('donationType');
  const isSplit = watch('isSplit');
  const totalAmount = watch('amount');

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "typeSplit",
  });
  
  useEffect(() => {
    if (!isSplit) {
      const currentSplits = getValues('typeSplit');
      const firstCategory = currentSplits.length > 0 ? currentSplits[0].category : 'Sadaqah';
      replace([{ category: firstCategory, amount: totalAmount }]);
    } else {
        const currentSplits = getValues('typeSplit');
        if (currentSplits.length === 1 && currentSplits[0].amount === 0) {
            setValue('typeSplit.0.amount', totalAmount);
        }
    }
  }, [isSplit, totalAmount, setValue, getValues, replace]);

  useEffect(() => {
    const fileList = screenshotFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setValue('screenshotDeleted', false);
    } else if (!watch('screenshotDeleted')) {
        setPreview(donation?.screenshotUrl || null);
    } else {
        setPreview(null);
    }
  }, [screenshotFile, donation?.screenshotUrl, watch, setValue]);
  
  const handleDeleteScreenshot = () => {
    setValue('screenshotFile', null);
    setValue('screenshotDeleted', true);
    setPreview(null);
    toast({ title: 'Image Marked for Deletion', description: 'The screenshot will be permanently deleted when you save the changes.', variant: 'default' });
  };
  
  const handleScanScreenshot = async () => {
    const fileList = getValues('screenshotFile') as FileList | undefined;
    if (!fileList || fileList.length === 0) {
        toast({ title: "No File", description: "Please upload a screenshot to scan.", variant: "destructive" });
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
            const apiResponse = await fetch('/api/scan-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoDataUri: dataUri }),
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.error || 'The server returned an error.');
            }
            
            const response = await apiResponse.json();
            
            const filledFields: string[] = [];
            if (response.receiverName) {
                setValue('receiverName', response.receiverName, { shouldValidate: true });
                filledFields.push('Receiver Name');
            }
            if (response.amount) {
                setValue('amount', response.amount, { shouldValidate: true });
                filledFields.push('Amount');
            }
            if (response.transactionId) {
                setValue('transactionId', response.transactionId, { shouldValidate: true });
                filledFields.push('Transaction ID');
            }
            if (response.date && /^\d{4}-\d{2}-\d{2}$/.test(response.date)) {
                setValue('donationDate', response.date, { shouldValidate: true });
                filledFields.push('Donation Date');
            }

            if (filledFields.length > 0) {
                toast({
                    title: "Autofill Successful",
                    description: `Filled: ${filledFields.join(', ')}.`,
                    variant: "success",
                });
            } else {
                toast({
                    title: "No Details Found",
                    description: "Could not find any details to autofill from the image.",
                    variant: "default",
                });
            }

        } catch (error: any) {
             console.warn("Screenshot scan failed:", error);
             toast({
                title: "Scan Failed",
                description: error.message || "Could not automatically read the screenshot.",
                variant: "destructive",
            });
        } finally {
            setIsScanning(false);
        }
    };
    reader.onerror = () => {
        toast({ title: "File Error", description: "An error occurred while reading the file.", variant: "destructive" });
        setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };
  
  const isGlobalCreate = !isEditing && !donation?.campaignId;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pt-3">
           {isGlobalCreate && (
                <FormField
                    control={control}
                    name="linkId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Link to Campaign/Lead (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a campaign or lead..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="unlinked">-- Do not link --</SelectItem>
                                <SelectGroup>
                                    <SelectLabel>Campaigns</SelectLabel>
                                    {campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name}</SelectItem>)}
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>Leads</SelectLabel>
                                    {leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <FormDescription>Link this donation to a specific initiative.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                  control={form.control}
                  name="donorName"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Donor Name *</FormLabel>
                      <FormControl>
                          <Input placeholder="e.g. John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="donorPhone"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Donor Phone</FormLabel>
                      <FormControl>
                          <Input placeholder="10-digit mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
              />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                  control={form.control}
                  name="receiverName"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Receiver Name *</FormLabel>
                      <FormControl>
                          <Input placeholder="e.g. Asif Shaikh" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="referral"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Referral *</FormLabel>
                      <FormControl>
                          <Input placeholder="Referred by..." {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
              />
          </div>


          <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Amount (Rupee) *</FormLabel>
                  <FormControl>
                      <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
          />
        
          <FormField
              control={form.control}
              name="isSplit"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                          <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                          />
                      </FormControl>
                      <FormLabel className="font-normal">
                          Split donation into multiple categories
                      </FormLabel>
                  </FormItem>
              )}
          />
          
          {isSplit ? (
            <div className="space-y-3 rounded-md border p-3">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <FormField
                            control={control}
                            name={`typeSplit.${index}.category`}
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={control}
                            name={`typeSplit.${index}.amount`}
                            render={({ field }) => (
                                <FormItem>
                                     <FormControl>
                                        <Input type="number" placeholder="Amount" {...field}/>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ category: 'Sadaqah', amount: 0 })}>
                    <Plus className="mr-2 h-4 w-4"/> Add Category
                </Button>
                 <FormMessage>{form.formState.errors.typeSplit?.root?.message}</FormMessage>
            </div>
          ) : (
            <FormField
                control={control}
                name={`typeSplit.0.category`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
          )}

          <FormField
              control={form.control}
              name="donationType"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Donation Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Select donation type" />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="Online Payment">Online Payment</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                  </Select>
                  <FormMessage />
                  </FormItem>
              )}
          />

          {donationTypeValue === 'Online Payment' && (
              <div className="space-y-3 rounded-md border p-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Online Payment Details</h3>
                  <Separator />
                  <FormField
                      control={form.control}
                      name="screenshotFile"
                      render={() => (
                          <FormItem>
                              <FormLabel>Screenshot</FormLabel>
                              <FormControl>
                                  <Input id="screenshot-file-input" type="file" accept="image/*" {...register('screenshotFile')} />
                              </FormControl>
                              <FormDescription>
                                  Upload a screenshot of the transaction.
                              </FormDescription>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  {preview && (
                      <div className="relative group w-full h-48 mt-2 rounded-md overflow-hidden border">
                          <Image src={preview} alt="Donation screenshot preview" fill className="object-contain" unoptimized />
                           <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById('screenshot-file-input')?.click()}>
                                    <Replace className="h-5 w-5"/>
                                    <span className="sr-only">Replace Image</span>
                                </Button>
                                <Button type="button" size="icon" variant="destructive" onClick={handleDeleteScreenshot}>
                                    <Trash2 className="h-5 w-5"/>
                                    <span className="sr-only">Delete Image</span>
                                </Button>
                            </div>
                      </div>
                  )}
                  {screenshotFile?.length > 0 && (
                    <Button 
                        type="button" 
                        className="w-full"
                        onClick={handleScanScreenshot}
                        disabled={isScanning}
                    >
                        {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                        Scan Screenshot
                    </Button>
                  )}
                  <FormField
                      control={form.control}
                      name="screenshotIsPublic"
                      render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                  <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                  />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                  Make screenshot public
                              </FormLabel>
                          </FormItem>
                      )}
                  />
                  <FormField
                    control={form.control}
                    name="isTransactionIdRequired"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    id="isTransactionIdRequired"
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel htmlFor="isTransactionIdRequired">
                                    Require & Verify Transaction ID
                                </FormLabel>
                                <FormDescription>
                                    If checked, the ID is mandatory and checked for duplicates.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                    />
                  <FormField
                      control={form.control}
                      name="transactionId"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Transaction ID {watch('isTransactionIdRequired') && <span className="text-destructive">*</span>}</FormLabel>
                              <FormControl>
                                  <Input 
                                      placeholder="e.g., UPI ID" 
                                      {...field} 
                                      value={field.value ?? ''}
                                  />
                              </FormControl>
                              <FormDescription>
                                  Helps prevent duplicate entries. Can be auto-filled by scanning.
                              </FormDescription>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
              <FormField
                  control={form.control}
                  name="donationDate"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Donation Date *</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                              <SelectItem value="Canceled">Canceled</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
              />
          </div>
          
           <FormField
              control={control}
              name="comments"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                      <Textarea placeholder="Any comments from the donor or about the donation..." {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />
            <FormField
              control={control}
              name="suggestions"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Suggestions</FormLabel>
                  <FormControl>
                      <Textarea placeholder="Any suggestions for the organization..." {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />

          <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Saving...' : 'Save Donation'}
              </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
