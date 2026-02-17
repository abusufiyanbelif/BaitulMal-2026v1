
'use client';

import { z } from 'zod';
import { useForm, useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useMemo } from 'react';
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
import type { Donation, DonationCategory, Campaign, Lead, TransactionDetail as TransactionDetailType } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Loader2, ScanLine, Replace, Trash2, Plus, DollarSign, ZoomIn, ZoomOut, RotateCw, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSession } from '@/hooks/use-session';

const linkSplitSchema = z.array(z.object({
    linkId: z.string(),
    amount: z.coerce.number().min(0, { message: "Allocation amount cannot be negative." }),
})).optional();

const formSchema = z.object({
  donorName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  donorPhone: z.string().length(10, { message: "Phone must be exactly 10 digits." }).optional().or(z.literal('')),
  receiverName: z.string().min(2, { message: "Receiver name must be at least 2 characters." }),
  referral: z.string().min(1, { message: "Referral is required." }),
  amount: z.coerce.number(), // This is calculated
  typeSplit: z.array(z.object({
    category: z.enum(donationCategories),
    amount: z.coerce.number().min(0, { message: 'Amount cannot be negative.' }),
  })).min(1, { message: 'At least one donation category is required.'}),
  donationType: z.enum(['Cash', 'Online Payment', 'Check', 'Other']),
  donationDate: z.string().min(1, { message: "Donation date is required."}),
  status: z.enum(['Verified', 'Pending', 'Canceled']),
  comments: z.string().optional(),
  suggestions: z.string().optional(),
  isTypeSplit: z.boolean().default(false),
  transactions: z.array(z.object({
      id: z.string(),
      amount: z.coerce.number().min(0, "Transaction amount can't be negative."),
      transactionId: z.string().optional(),
      screenshotUrl: z.string().optional(),
      screenshotIsPublic: z.boolean().optional(),
      screenshotFile: z.any().optional(),
  })).min(1, "At least one transaction is required."),
  isSplit: z.boolean().default(false),
  linkSplit: linkSplitSchema,
});

export type DonationFormData = z.infer<typeof formSchema>;

interface DonationFormProps {
  donation?: Donation | null;
  onSubmit: (data: DonationFormData) => void;
  onCancel: () => void;
  campaigns?: Campaign[];
  leads?: Lead[];
  defaultLinkId?: string;
}

const TransactionItem = ({ control, index, remove, register, setValue, canRemove }: { control: Control<DonationFormData>, index: number, remove: (index: number) => void, register: UseFormRegister<DonationFormData>, setValue: UseFormSetValue<DonationFormData>, canRemove: boolean }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const fileList = useWatch({ control, name: `transactions.${index}.screenshotFile` });
    const existingUrl = useWatch({ control, name: `transactions.${index}.screenshotUrl` });

    useEffect(() => {
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else if (existingUrl) {
            setPreview(existingUrl);
        } else {
            setPreview(null);
        }
    }, [fileList, existingUrl]);
    
    const handleRemoveImage = () => {
        setValue(`transactions.${index}.screenshotFile`, null, { shouldDirty: true });
        setValue(`transactions.${index}.screenshotUrl`, '', { shouldDirty: true });
        setPreview(null);
        setIsViewerOpen(false);
    };

    return (
        <div className="space-y-4 rounded-md border bg-muted/50 p-3 relative">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7"
                onClick={() => remove(index)}
                disabled={!canRemove}
            >
                <Trash2 className="h-4 w-4 text-destructive"/>
                <span className="sr-only">Remove Transaction</span>
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name={`transactions.${index}.amount`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount (₹)</FormLabel>
                            <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={`transactions.${index}.transactionId`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transaction ID</FormLabel>
                            <FormControl><Input placeholder="UPI ID, Check No., etc." {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label>Screenshot</Label>
                {preview ? (
                    <>
                        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                            <DialogTrigger asChild>
                                <div className="relative group w-full h-32 rounded-md border bg-secondary/30 cursor-pointer">
                                    <Image
                                        src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview}
                                        alt={`Screenshot preview ${index + 1}`}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="object-contain"
                                    />
                                </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                    <DialogTitle>Screenshot Viewer</DialogTitle>
                                </DialogHeader>
                                <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                                    <Image
                                        src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview}
                                        alt="Screenshot"
                                        fill
                                        sizes="(max-width: 896px) 100vw, 896px"
                                        className="object-contain transition-transform duration-200 ease-out origin-center"
                                        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                                        unoptimized
                                    />
                                </div>
                                <DialogFooter className="sm:justify-center pt-4 flex-wrap">
                                    <Button variant="outline" onClick={() => setZoom(z => z * 1.2)}><ZoomIn className="mr-2"/> Zoom In</Button>
                                    <Button variant="outline" onClick={() => setZoom(z => z / 1.2)}><ZoomOut className="mr-2"/> Zoom Out</Button>
                                    <Button variant="outline" onClick={() => setRotation(r => r + 90)}><RotateCw className="mr-2"/> Rotate</Button>
                                    <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }}><RefreshCw className="mr-2"/> Reset View</Button>
                                    <Separator orientation="vertical" className="h-auto hidden sm:block"/>
                                    <Button variant="outline" onClick={() => document.getElementById(`tx-screenshot-upload-${index}`)?.click()}><Replace className="mr-2"/> Replace</Button>
                                    <Button variant="destructive" onClick={handleRemoveImage}><Trash2 className="mr-2"/> Remove</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Input id={`tx-screenshot-upload-${index}`} type="file" className="hidden" {...register(`transactions.${index}.screenshotFile`)} />
                    </>
                ) : (
                    <FormField
                        control={control}
                        name={`transactions.${index}.screenshotFile`}
                        render={() => (
                            <FormItem>
                                <FormControl>
                                    <Input type="file" accept="image/*" {...register(`transactions.${index}.screenshotFile`)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
        </div>
    )
}


export function DonationForm({ donation, onSubmit, onCancel, campaigns = [], leads = [], defaultLinkId }: DonationFormProps) {
  const isEditing = !!donation;
  const { userProfile } = useSession();
  
  const form = useForm<DonationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      donorName: donation?.donorName || '',
      donorPhone: donation?.donorPhone || '',
      receiverName: donation?.receiverName || '',
      referral: donation?.referral || '',
      amount: donation?.amount || 0,
      donationType: donation?.donationType || 'Online Payment',
      donationDate: donation?.donationDate || new Date().toISOString().split('T')[0],
      status: donation?.status || 'Pending',
      comments: donation?.comments || '',
      suggestions: donation?.suggestions || '',
      isTypeSplit: (donation?.typeSplit?.length ?? 0) > 1,
      typeSplit: donation?.typeSplit && donation.typeSplit.length > 0 ? donation.typeSplit : [{ category: 'Sadaqah', amount: donation?.amount || 0 }],
      transactions: donation?.transactions && donation.transactions.length > 0 ? donation.transactions.map(tx => ({...tx, amount: Number(tx.amount) })) : [{ id: `tx_${Date.now()}`, amount: donation?.amount || 0, transactionId: (donation as any)?.transactionId }],
      isSplit: (donation?.linkSplit?.length ?? 0) > 1,
      linkSplit: donation?.linkSplit?.map(l => ({ linkId: `${l.linkType}_${l.linkId}`, amount: l.amount })) || (defaultLinkId ? [{linkId: defaultLinkId, amount: donation?.amount || 0}] : []),
    },
  });

  const { control, watch, setValue, getValues, register, formState: { isDirty, errors, isSubmitting } } = form;

  const { fields: transactionFields, append: appendTransaction, remove: removeTransaction } = useFieldArray({ control, name: "transactions" });
  const { fields: typeSplitFields, append: appendTypeSplit, remove: removeTypeSplit, replace: replaceTypeSplit } = useFieldArray({ control, name: "typeSplit" });
  const { fields: linkSplitFields, append: appendLinkSplit, remove: removeLinkSplit, replace: replaceLinkSplit } = useFieldArray({ control, name: "linkSplit" });

  const watchedTransactions = useWatch({
    control,
    name: 'transactions',
  });
  const isTypeSplit = watch('isTypeSplit');
  const isLinkSplit = watch('isSplit');

  // Calculate total amount from transactions
  useEffect(() => {
    const total = watchedTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    setValue('amount', total, { shouldValidate: true, shouldDirty: true });
  }, [watchedTransactions, setValue]);

  const totalAmount = watch('amount');

  // Handle single vs multiple category splits
  useEffect(() => {
    if (!isTypeSplit) {
      const currentSplits = getValues('typeSplit');
      const firstCategory = currentSplits.length > 0 ? currentSplits[0].category : 'Sadaqah';
      replaceTypeSplit([{ category: firstCategory, amount: totalAmount }]);
    }
  }, [isTypeSplit, totalAmount, replaceTypeSplit, getValues]);
  
  // Handle single vs multiple initiative linking
  useEffect(() => {
    if (!isLinkSplit) {
      const currentLinks = getValues('linkSplit') || [];
      const firstLink = currentLinks.length > 0 ? currentLinks[0].linkId : (defaultLinkId || 'unlinked');
      replaceLinkSplit([{ linkId: firstLink, amount: totalAmount }]);
    }
  }, [isLinkSplit, totalAmount, replaceLinkSplit, getValues, defaultLinkId]);

  const allInitiatives = useMemo(() => ([
    ...campaigns.map(c => ({ id: `campaign_${c.id}`, name: c.name, type: 'Campaigns' })),
    ...leads.map(l => ({ id: `lead_${l.id}`, name: l.name, type: 'Leads' })),
  ]), [campaigns, leads]);
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <FormField
              control={control}
              name="amount"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Total Donation Amount (Rupee)</FormLabel>
                  <FormControl>
                      <Input type="number" {...field} readOnly className="bg-muted/50 font-bold" />
                  </FormControl>
                  <FormDescription>This is the sum of all transaction amounts below.</FormDescription>
                  <FormMessage />
                  </FormItem>
              )}
          />

        <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-base font-semibold">Transaction Details</h3>
            <FormField
                control={control}
                name="donationType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
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
            <FormDescription>
                Add one or more transactions that make up the total donation amount.
            </FormDescription>
            <div className="space-y-4">
               {transactionFields.map((field, index) => (
                    <TransactionItem 
                        key={field.id}
                        control={control}
                        index={index}
                        register={register}
                        setValue={setValue}
                        remove={removeTransaction}
                        canRemove={transactionFields.length > 1}
                    />
               ))}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendTransaction({ id: `tx_${Date.now()}`, amount: 0, transactionId: '' })}
            >
                <Plus className="mr-2 h-4 w-4"/> Add another transaction
            </Button>
        </div>
        
        <Separator />
        
        {/* All other fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                  control={control}
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
                  control={control}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={control}
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
                control={control}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={control}
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
                control={control}
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
        
        {/* Category Split */}
        <div className="space-y-3 rounded-md border p-4">
             <FormField
              control={control}
              name="isTypeSplit"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Split donation by category (Zakat, Sadaqah, etc.)</FormLabel>
                  </FormItem>
              )}
          />
          {isTypeSplit ? (
            <div className="space-y-3 pl-6">
                {typeSplitFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <FormField control={control} name={`typeSplit.${index}.category`} render={({ field }) => (
                            <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></FormItem>
                        )}/>
                        <FormField control={control} name={`typeSplit.${index}.amount`} render={({ field }) => (
                            <FormItem><FormControl><Input type="number" placeholder="Amount" {...field}/></FormControl></FormItem>
                        )}/>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTypeSplit(index)} disabled={typeSplitFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendTypeSplit({ category: 'Sadaqah', amount: 0 })}><Plus className="mr-2 h-4 w-4"/> Add Category</Button>
                <FormMessage>{errors.typeSplit?.root?.message}</FormMessage>
            </div>
          ) : (
            <FormField control={control} name={`typeSplit.0.category`} render={({ field }) => (
                <FormItem className="pl-6"><FormLabel>Category *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
          )}
        </div>

        {/* Initiative Split */}
        <div className="space-y-3 rounded-md border p-4">
             <FormField
              control={control}
              name="isSplit"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Split donation across multiple initiatives</FormLabel>
                  </FormItem>
              )}
          />
          {isLinkSplit ? (
            <div className="space-y-3 pl-6">
                {linkSplitFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <FormField control={control} name={`linkSplit.${index}.linkId`} render={({ field }) => (
                            <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select initiative..."/></SelectTrigger></FormControl><SelectContent><SelectGroup><SelectLabel>Campaigns</SelectLabel>{campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name}</SelectItem>)}</SelectGroup><SelectGroup><SelectLabel>Leads</SelectLabel>{leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select></FormItem>
                        )}/>
                        <FormField control={control} name={`linkSplit.${index}.amount`} render={({ field }) => (
                            <FormItem><FormControl><Input type="number" placeholder="Amount" {...field}/></FormControl></FormItem>
                        )}/>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLinkSplit(index)} disabled={linkSplitFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendLinkSplit({ linkId: 'unlinked', amount: 0 })}><Plus className="mr-2 h-4 w-4"/> Add Allocation</Button>
                <FormMessage>{errors.linkSplit?.root?.message || errors.linkSplit?.message}</FormMessage>
            </div>
          ) : (
             <FormField control={control} name={`linkSplit.0.linkId`} render={({ field }) => (
                <FormItem className="pl-6"><FormLabel>Link to Initiative</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an initiative..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="unlinked">-- Do not link --</SelectItem><SelectGroup><SelectLabel>Campaigns</SelectLabel>{campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name}</SelectItem>)}</SelectGroup><SelectGroup><SelectLabel>Leads</SelectLabel>{leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select><FormMessage /></FormItem>
            )}/>
          )}
        </div>

        <div className="space-y-4">
            <FormField
                control={control}
                name="comments"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Any comments from the donor or staff..." {...field} />
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
                        <Textarea placeholder="Any suggestions for improvement..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Save Donation'}
            </Button>
        </div>
      </form>
    </Form>
  );
}

    

    