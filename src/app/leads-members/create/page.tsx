'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useStorage } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, ShieldAlert, UploadCloud, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Lead } from '@/lib/types';
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters } from '@/lib/modules';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const leadSchema = z.object({
  name: z.string().min(3, 'Lead name must be at least 3 characters.'),
  purpose: z.enum(['Relief', 'General', 'Education', 'Medical', 'Other']),
  purposeDetails: z.string().optional(),
  category: z.string().optional(),
  categoryDetails: z.string().optional(),
  status: z.enum(['Upcoming', 'Active', 'Completed']),
  authenticityStatus: z.enum(['Pending Verification', 'Verified', 'Rejected', 'On Hold', 'Need More Details']),
  publicVisibility: z.enum(['Hold', 'Ready to Publish', 'Published']),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  requiredAmount: z.coerce.number().min(0).optional(),
  targetAmount: z.coerce.number().min(0).optional(),
  allowedDonationTypes: z.array(z.string()).optional(),
  degree: z.string().optional(),
  year: z.string().optional(),
  semester: z.string().optional(),
  diseaseIdentified: z.string().optional(),
  diseaseStage: z.string().optional(),
  seriousness: z.enum(leadSeriousnessLevels).optional(),
  imageFile: z.any().optional(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
}).refine(data => {
    const selectedPurpose = leadPurposesConfig.find(p => p.id === data.purpose);
    if (selectedPurpose && selectedPurpose.categories.length > 0) {
      return !!data.category;
    }
    return true;
}, {
    message: 'Category is required for this purpose.',
    path: ['category'],
}).refine(data => data.purpose !== 'Other' || (data.purpose === 'Other' && data.purposeDetails && data.purposeDetails.trim().length > 0), {
  message: "Details for 'Other' purpose are required.",
  path: ['purposeDetails'],
}).refine(data => data.category !== 'Other' || (data.category === 'Other' && data.categoryDetails && data.categoryDetails.trim().length > 0), {
  message: "Details for 'Other' category are required.",
  path: ['categoryDetails'],
});

type LeadFormValues = z.infer<typeof leadSchema>;

export default function CreateLeadPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [leadDataToCreate, setLeadDataToCreate] = useState<LeadFormValues | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const leadsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.['leads-members']?.create;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      purpose: 'Relief',
      category: '',
      status: 'Upcoming',
      authenticityStatus: 'Pending Verification',
      publicVisibility: 'Hold',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      requiredAmount: 0,
      targetAmount: 0,
      allowedDonationTypes: [...donationCategories],
    },
  });

  const purpose = form.watch('purpose');
  const category = form.watch('category');

  const availableCategories = useMemo(() => {
    const selectedPurpose = leadPurposesConfig.find(p => p.id === purpose);
    return selectedPurpose?.categories || [];
  }, [purpose]);
  
  useEffect(() => {
    form.setValue('category', '');
  }, [purpose, form.setValue]);
  
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('imageFile', event.target.files);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    form.setValue('imageFile', null);
    setImagePreview(null);
  };

  const handleCreateLead = async (data: LeadFormValues) => {
    if (!firestore || !canCreate || !userProfile) return;
    setIsLoading(true);

    const { imageFile, ...leadCoreData } = data;
    const newLeadRef = doc(collection(firestore, 'leads'));
    const newLeadId = newLeadRef.id;

    let imageUrl = '';
    if (imageFile && imageFile.length > 0 && storage) {
        try {
            const file = imageFile[0];
            const { default: Resizer } = await import('react-image-file-resizer');
            const resizedBlob = await new Promise<Blob>((resolve) => {
                Resizer.imageFileResizer(file, 1280, 400, 'PNG', 85, 0, blob => resolve(blob as Blob), 'blob');
            });
            
            const filePath = `leads/${newLeadId}/background.png`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, resizedBlob);
            imageUrl = await getDownloadURL(fileRef);
        } catch (uploadError) {
            console.error("Image upload failed:", uploadError);
            toast({ title: 'Image Upload Failed', description: 'Lead was not created.', variant: 'destructive'});
            setIsLoading(false);
            return;
        }
    }

    const newLeadData = {
      ...leadCoreData,
      imageUrl,
      requiredAmount: data.requiredAmount || 0,
      targetAmount: data.targetAmount || 0,
      description: '',
      createdAt: serverTimestamp(),
      createdById: userProfile.id,
      createdByName: userProfile.name,
      priceDate: new Date().toISOString().split('T')[0],
      shopName: '',
      shopContact: '',
      shopAddress: '',
      itemCategories: data.category === 'Ration Kit' ? [{ id: 'general', name: 'General', items: [] }] : [],
    };

    setDoc(newLeadRef, newLeadData)
      .then(() => {
        toast({ title: 'Success', description: 'Lead created successfully.', variant: 'success' });
        router.push(`/leads-members`);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: 'leads',
            operation: 'create',
            requestResourceData: newLeadData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsLoading(false);
        setLeadDataToCreate(null);
        setIsDuplicateAlertOpen(false);
      });
  }

  const onSubmit = (data: LeadFormValues) => {
    if (leads && leads.some(c => c.name.trim().toLowerCase() === data.name.trim().toLowerCase())) {
        setLeadDataToCreate(data);
        setIsDuplicateAlertOpen(true);
    } else {
        handleCreateLead(data);
    }
  };

  if (isProfileLoading || areLeadsLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!canCreate) {
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
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to create a new lead.
                </AlertDescription>
            </Alert>
        </main>
    )
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
      <Card className="max-w-2xl mx-auto animate-fade-in-zoom">
        <CardHeader>
          <CardTitle>Create New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Lead for new initiative" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormItem>
                    <FormLabel>Header Image</FormLabel>
                    <FormControl>
                        <Input id="imageFile" type="file" accept="image/png, image/jpeg" onChange={handleImageFileChange} className="hidden" />
                    </FormControl>
                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                        {imagePreview ? (
                            <>
                                <Image src={imagePreview} alt="Preview" fill className="object-cover rounded-lg" />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleRemoveImage}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                <p className="mb-2 text-sm text-center text-muted-foreground">
                                    <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">PNG, JPG (1280x400 recommended)</p>
                            </div>
                        )}
                    </label>
                    <FormMessage />
                </FormItem>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {availableCategories.length > 0 && (
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              {purpose === 'Other' && (
                <FormField control={form.control} name="purposeDetails" render={({ field }) => (
                  <FormItem><FormLabel>Details for 'Other' Purpose</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              )}
              {category === 'Other' && (
                <FormField control={form.control} name="categoryDetails" render={({ field }) => (
                  <FormItem><FormLabel>Details for 'Other' Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              )}

              {purpose === 'Education' && (
                <div className="space-y-4 rounded-md border p-4 animate-fade-in-zoom">
                  <h3 className="text-lg font-semibold">Education Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="degree" render={({ field }) => (
                        <FormItem><FormLabel>Degree/Class</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Degree..."/></SelectTrigger></FormControl><SelectContent>{educationDegrees.map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem><FormLabel>Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Year..."/></SelectTrigger></FormControl><SelectContent>{educationYears.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="semester" render={({ field }) => (
                        <FormItem><FormLabel>Semester</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Semester..."/></SelectTrigger></FormControl><SelectContent>{educationSemesters.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                  </div>
                </div>
              )}

              {purpose === 'Medical' && (
                <div className="space-y-4 rounded-md border p-4 animate-fade-in-zoom">
                  <h3 className="text-lg font-semibold">Medical Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="diseaseIdentified" render={({ field }) => (
                        <FormItem><FormLabel>Disease Identified</FormLabel><FormControl><Input placeholder="e.g. Cataract" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="diseaseStage" render={({ field }) => (
                        <FormItem><FormLabel>Disease Stage</FormLabel><FormControl><Input placeholder="e.g. Initial" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField
                      control={form.control}
                      name="seriousness"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seriousness</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select level..."/></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {leadSeriousnessLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="requiredAmount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Required Amount (₹)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g. 125000" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="targetAmount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Target Amount (₹)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g. 100000" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <FormField
                  control={form.control}
                  name="allowedDonationTypes"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Donation Types for Fundraising</FormLabel>
                        <FormDescription>
                          Select which donation types should be counted towards the fundraising goal.
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-md">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-types-lead"
                            checked={form.watch('allowedDonationTypes')?.length === donationCategories.length}
                            onCheckedChange={(checked) => {
                              form.setValue('allowedDonationTypes', checked ? [...donationCategories] : []);
                            }}
                          />
                          <Label htmlFor="select-all-types-lead" className="font-bold">Any</Label>
                        </div>
                        {donationCategories.map((type) => (
                          <FormField
                            key={type}
                            control={form.control}
                            name="allowedDonationTypes"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={type}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(type)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), type])
                                          : field.onChange(
                                              (field.value || []).filter(
                                                (value) => value !== type
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {type}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>End Date *</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
              </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          <SelectItem value="Upcoming">Upcoming</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={form.control}
                  name="authenticityStatus"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Authenticity *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select authenticity" />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                              <SelectItem value="Verified">Verified</SelectItem>
                              <SelectItem value="On Hold">On Hold</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                              <SelectItem value="Need More Details">Need More Details</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
              </div>
              <FormField
                control={form.control}
                name="publicVisibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Visibility *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Hold">Hold (Private)</SelectItem>
                        <SelectItem value="Ready to Publish">Ready to Publish</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Lead
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
       <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Duplicate Lead Name</AlertDialogTitle>
                <AlertDialogDescription>
                    A lead with this name already exists. Are you sure you want to create another one?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setLeadDataToCreate(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    if (leadDataToCreate) {
                        handleCreateLead(leadDataToCreate);
                    }
                }}>
                    Create Anyway
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
