'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useStorage, useMemoFirebase, useAuth } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Resizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, ShieldAlert, UploadCloud, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Campaign, CampaignDocument } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';
import { BrandedLoader } from '@/components/branded-loader';

const campaignSchema = z.object({
  name: z.string().min(3, 'Campaign name must be at least 3 characters.'),
  description: z.string().optional(),
  category: z.enum(['Ration', 'Relief', 'General']),
  status: z.enum(['Upcoming', 'Active', 'Completed']),
  authenticityStatus: z.enum(['Pending Verification', 'Verified', 'Rejected', 'On Hold', 'Need More Details']),
  publicVisibility: z.enum(['Hold', 'Ready to Publish', 'Published']),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  targetAmount: z.coerce.number().min(0, 'Target amount must be a positive number.').optional(),
  allowedDonationTypes: z.array(z.enum(donationCategories)).optional(),
  imageFile: z.any().optional(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

export default function CreateCampaignPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [campaignDataToCreate, setCampaignDataToCreate] = useState<CampaignFormValues | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);

  const campaignsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'campaigns');
  }, [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.campaigns?.create;

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'Ration',
      status: 'Upcoming',
      authenticityStatus: 'Pending Verification',
      publicVisibility: 'Hold',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      targetAmount: 0,
      allowedDonationTypes: [...donationCategories],
    },
  });

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

  const handleCreateCampaign = async (data: CampaignFormValues) => {
    if (!firestore || !canCreate || !userProfile || !storage) return;
    setIsLoading(true);
    setProgress(5);
    setLoadingMessage('Initializing creation...');

    const { imageFile, ...campaignCoreData } = data;
    
    const hasImageToUpload = imageFile && imageFile.length > 0;
    if ((hasImageToUpload || documentsToUpload.length > 0) && !auth?.currentUser) {
        toast({ title: 'Authentication Error', description: 'User not authenticated yet. Please wait.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    
    const newCampaignRef = doc(collection(firestore, 'campaigns'));
    const newCampaignId = newCampaignRef.id;

    let imageUrl = '';
    let imageUrlFilename = '';
    
    // Resize image
    if (hasImageToUpload) {
        setProgress(15);
        setLoadingMessage('Optimizing header image...');
        try {
            const file = imageFile[0];
            const resizedBlob = await new Promise<Blob>((resolve) => {
                Resizer.imageFileResizer(file, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
            });
            
            setProgress(30);
            setLoadingMessage('Uploading background...');
            const filePath = `campaigns/${newCampaignId}/background.png`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, resizedBlob);
            imageUrl = await getDownloadURL(fileRef);
            const dateStr = new Date().toISOString().split('T')[0];
            imageUrlFilename = `campaign_${data.name.replace(/\s+/g, '_')}_${dateStr}.png`;
        } catch (uploadError: any) {
            console.error("Image upload failed:", uploadError);
            toast({ title: 'Image Upload Failed', description: 'Campaign was not created.', variant: 'destructive'});
            setIsLoading(false);
            return;
        }
    }
    
    // Handle document uploads
    setProgress(50);
    setLoadingMessage('Syncing attachments...');
    const documentUploadPromises = documentsToUpload.map(async (file, idx) => {
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fileRef = storageRef(storage, `campaigns/${newCampaignId}/documents/${safeFileName}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        // Increment progress slightly per doc
        const perDocProgress = 30 / documentsToUpload.length;
        setProgress(prev => Math.min(prev + perDocProgress, 80));
        
        return { name: file.name, url: url, uploadedAt: new Date().toISOString(), isPublic: false };
    });

    const documents = await Promise.all(documentUploadPromises);

    setProgress(85);
    setLoadingMessage('Finalizing database record...');
    const newCampaignData: Partial<Campaign> = {
      ...campaignCoreData,
      targetAmount: data.targetAmount || 0,
      description: data.description || '',
      createdAt: serverTimestamp(),
      createdById: userProfile.id,
      createdByName: userProfile.name,
      priceDate: new Date().toISOString().split('T')[0],
      shopName: '',
      shopContact: '',
      shopAddress: '',
      itemCategories: data.category === 'Ration' ? [{ id: 'item-price-list', name: 'Item Price List', items: [] }] : [],
    };
    
    if (imageUrl) {
      newCampaignData.imageUrl = imageUrl;
      newCampaignData.imageUrlFilename = imageUrlFilename;
    }

    if (documents && documents.length > 0) {
        newCampaignData.documents = documents;
    }

    setDoc(newCampaignRef, newCampaignData)
      .then(() => {
        setProgress(100);
        toast({ title: 'Success', description: 'Campaign created successfully.', variant: 'success' });
        router.push(`/campaign-members`);
      })
      .catch((serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: 'campaigns',
            operation: 'create',
            requestResourceData: { ...newCampaignData, createdAt: '[SERVER_TIMESTAMP]' },
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsLoading(false);
        setCampaignDataToCreate(null);
        setIsDuplicateAlertOpen(false);
      });
  }

  const onSubmit = (data: CampaignFormValues) => {
    if (campaigns && campaigns.some(c => c.name.trim().toLowerCase() === data.name.trim().toLowerCase())) {
        setCampaignDataToCreate(data);
        setIsDuplicateAlertOpen(true);
    } else {
        handleCreateCampaign(data);
    }
  };

  if (isProfileLoading || areCampaignsLoading) {
    return (
      <main className="container mx-auto p-4 md:p-8">
          <BrandedLoader message="Preparing campaign environment..." />
      </main>
    );
  }

  if (!canCreate) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/campaign-members">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Campaigns
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-bold">Access denied</AlertTitle>
                <AlertDescription className="font-normal">
                You do not have the required permissions to create a new campaign.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      {isLoading && <BrandedLoader message={loadingMessage} progress={progress} />}
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
            <Link href="/campaign-members">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl mx-auto animate-fade-in-zoom border-primary/10 bg-white">
          <CardHeader>
            <CardTitle className="font-bold text-primary">Create new campaign</CardTitle>
            <CardDescription className="font-normal">Define initiative details and fundraising goals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-normal text-primary">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Campaign name *</FormLabel><FormControl><Input placeholder="e.g. Ration Kit Distribution Ramzan 2027" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Description</FormLabel><FormControl><Textarea placeholder="Objectives and target impact..." {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormItem>
                    <FormLabel className="font-bold text-xs uppercase text-muted-foreground">Header image</FormLabel>
                    <FormControl>
                        <Input id="imageFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageFileChange} className="hidden" />
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
                                <p className="mb-2 text-sm text-center text-muted-foreground font-normal">
                                    <span className="font-bold text-primary">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-[10px] text-muted-foreground font-normal uppercase">PNG, JPG, WEBP (1280x400 recommended)</p>
                            </div>
                        )}
                    </label>
                    <FormMessage />
                </FormItem>
                 <FormItem>
                    <FormLabel className="font-bold">Campaign documents & artifacts</FormLabel>
                    <FormControl>
                        <FileUploader
                            onFilesChange={setDocumentsToUpload}
                            multiple={true}
                            acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf"
                        />
                    </FormControl>
                    <FormDescription className="font-normal text-xs">Upload proposals, vetted reports, or verification photos.</FormDescription>
                </FormItem>
                 <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Campaign category *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Ration" className="font-bold">Ration</SelectItem><SelectItem value="Relief" className="font-bold">Relief</SelectItem><SelectItem value="General" className="font-bold">General</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="targetAmount" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Target goal (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 100000" {...field} className="font-bold" /></FormControl><FormDescription className="font-normal">The overall fundraising goal for verified collections.</FormDescription><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="allowedDonationTypes" render={() => (
                    <FormItem className="space-y-4">
                      <div><FormLabel className="text-base font-bold">Donation types for tracking</FormLabel><FormDescription className="font-normal">Select which fund types count towards the fundraising goal.</FormDescription></div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-primary/5 border-primary/10">
                        <div className="flex items-center space-x-2"><Checkbox id="select-all-types" checked={form.watch('allowedDonationTypes')?.length === donationCategories.length} onCheckedChange={(checked) => { form.setValue('allowedDonationTypes', checked ? [...donationCategories] : []); }} /><Label htmlFor="select-all-types" className="font-bold text-xs uppercase cursor-pointer">Any</Label></div>
                        {donationCategories.map((type) => (
                          <FormField key={type} control={form.control} name="allowedDonationTypes" render={({ field }) => (
                            <FormItem key={type} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value?.includes(type)} onCheckedChange={(checked) => { return checked ? field.onChange([...(field.value || []), type]) : field.onChange((field.value || []).filter((value) => value !== type))}} /></FormControl>
                                <FormLabel className="font-bold text-xs uppercase cursor-pointer">{type}</FormLabel>
                            </FormItem>
                          )} />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                )}/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Start date *</FormLabel><FormControl><Input type="date" {...field} className="font-bold"/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">End date *</FormLabel><FormControl><Input type="date" {...field} className="font-bold"/></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel className="font-bold">Status *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Completed" className="font-bold">Completed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="authenticityStatus" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Verification *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select authenticity" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending Verification" className="font-bold">Pending</SelectItem><SelectItem value="Verified" className="font-bold">Verified</SelectItem><SelectItem value="On Hold" className="font-bold">On hold</SelectItem><SelectItem value="Rejected" className="font-bold text-destructive">Rejected</SelectItem><SelectItem value="Need More Details" className="font-bold">Need details</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                </div>
              <FormField control={form.control} name="publicVisibility" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Public visibility *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select visibility" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Hold" className="font-bold">Hold (Private)</SelectItem><SelectItem value="Ready to Publish" className="font-bold">Ready to publish</SelectItem><SelectItem value="Published" className="font-bold text-primary">Published</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}/>
              <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => router.push('/campaign-members')} disabled={isLoading} className="font-bold border-primary/20 text-primary">Cancel</Button>
                  <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocumentsToUpload([]); }} disabled={isLoading} className="font-bold"><RotateCcw className="mr-2 h-4 w-4"/> Reset</Button>
                  <Button type="submit" disabled={isLoading} className="font-bold bg-primary text-white hover:bg-primary/90">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Create campaign
                  </Button>
              </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>

       <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold">Duplicate campaign name</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    A campaign with this name already exists. Are you sure you want to create another one?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCampaignDataToCreate(null)} className="font-bold">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    if (campaignDataToCreate) {
                        handleCreateCampaign(campaignDataToCreate);
                    }
                }} className="font-bold bg-primary text-white">
                    Create anyway
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
