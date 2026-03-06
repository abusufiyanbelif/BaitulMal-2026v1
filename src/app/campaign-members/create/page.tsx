'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useStorage, useMemoFirebase, useAuth, useDoc, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, serverTimestamp, setDoc } from 'firebase/firestore';
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
import { ArrowLeft, Loader2, ShieldAlert, UploadCloud, Trash2, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Campaign } from '@/lib/types';
import { donationCategories, priorityLevels } from '@/lib/modules';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';
import { BrandedLoader } from '@/components/branded-loader';

const campaignSchema = z.object({
  name: z.string().min(3, 'Campaign Name Must Be At Least 3 Characters.'),
  description: z.string().optional(),
  category: z.enum(['Ration', 'Relief', 'General']),
  status: z.enum(['Upcoming', 'Active', 'Completed']),
  priority: z.enum(priorityLevels),
  authenticityStatus: z.enum(['Pending Verification', 'Verified', 'Rejected', 'On Hold', 'Need More Details']),
  publicVisibility: z.enum(['Hold', 'Ready to Publish', 'Published']),
  startDate: z.string().min(1, 'Start Date Is Required.'),
  endDate: z.string().min(1, 'End Date Is Required.'),
  targetAmount: z.coerce.number().min(0, 'Target Amount Must Be A Positive Number.').optional(),
  allowedDonationTypes: z.array(z.string()).default([...donationCategories]),
  imageFile: z.any().optional(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "End Date Cannot Be Before The Start Date.",
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

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_config') : null, [firestore]);
  const { data: configSettings } = useDoc<any>(configRef);
  const mandatoryFields = useMemo(() => configSettings?.mandatoryFields || {}, [configSettings]);
  
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
      priority: 'Low',
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
    const missingFields: string[] = [];
    Object.entries(mandatoryFields).forEach(([field, isMandatory]) => {
        if (isMandatory && !data[field as keyof CampaignFormValues]) {
            missingFields.push(field);
        }
    });

    if (missingFields.length > 0) {
        toast({
            title: "Required Fields Missing",
            description: `Please Complete The Following: ${missingFields.join(', ')}`,
            variant: "destructive",
        });
        return;
    }

    if (!firestore || !canCreate || !userProfile || !storage) return;
    setIsLoading(true);
    setProgress(5);
    setLoadingMessage('Initializing creation hub...');

    const { imageFile, ...campaignCoreData } = data;
    
    const hasImageToUpload = imageFile && imageFile.length > 0;
    if ((hasImageToUpload || documentsToUpload.length > 0) && !auth?.currentUser) {
        toast({ title: 'Authentication Error', description: 'User Not Authenticated Yet. Please Wait.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    
    const newCampaignRef = doc(collection(firestore, 'campaigns'));
    const newCampaignId = newCampaignRef.id;

    let imageUrl = '';
    let imageUrlFilename = '';
    
    if (hasImageToUpload) {
        setProgress(15);
        setLoadingMessage('Optimizing header image...');
        try {
            const file = imageFile[0];
            const resizedBlob = await new Promise<Blob>((resolve) => {
                Resizer.imageFileResizer(file, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
            });
            
            setProgress(35);
            setLoadingMessage('Uploading background artifacts...');
            const filePath = `campaigns/${newCampaignId}/background.png`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, resizedBlob);
            imageUrl = await getDownloadURL(fileRef);
            const dateStr = new Date().toISOString().split('T')[0];
            imageUrlFilename = `campaign_${data.name.replace(/\s+/g, '_')}_${dateStr}.png`;
        } catch (uploadError: any) {
            console.error("Image Upload Failed:", uploadError);
            toast({ title: 'Image Upload Failed', description: 'Campaign was not created.', variant: 'destructive'});
            setIsLoading(false);
            return;
        }
    }
    
    setProgress(55);
    setLoadingMessage('Synchronizing campaign documents...');
    const documentUploadPromises = documentsToUpload.map(async (file, idx) => {
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fileRef = storageRef(storage, `campaigns/${newCampaignId}/documents/${safeFileName}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        const perDocProgress = 25 / Math.max(1, documentsToUpload.length);
        setProgress(prev => Math.min(prev + perDocProgress, 80));
        return { name: file.name, url: url, uploadedAt: new Date().toISOString(), isPublic: false };
    });

    const documents = await Promise.all(documentUploadPromises);

    setProgress(85);
    setLoadingMessage('Finalizing database registration...');
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
        setLoadingMessage('Creation successful.');
        toast({ title: 'Success', description: 'Campaign Created Successfully.', variant: 'success' });
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
    return <BrandedLoader message="Preparing Campaign Environment..." />;
  }

  if (!canCreate) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-primary">
            <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Campaigns</Link></Button></div>
            <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle className="font-bold">Access Denied</AlertTitle><AlertDescription className="font-normal">Missing Permissions To Create A New Initiative.</AlertDescription></Alert>
        </main>
    )
  }

  const renderLabel = (label: string, fieldName: string) => (
    <FormLabel className="font-bold text-primary">
        {label} {mandatoryFields[fieldName] ? '*' : ''}
    </FormLabel>
  );

  return (
    <>
      {isLoading && <BrandedLoader message={loadingMessage} progress={progress} />}
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
            <Link href="/campaign-members">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back To Campaigns
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl mx-auto animate-fade-in-zoom border-primary/10 bg-white">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="font-bold text-primary tracking-tight">Create New Campaign</CardTitle>
            <CardDescription className="font-normal text-primary/70">Define Initiative Details And Fundraising Goals.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-normal text-primary">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>{renderLabel('Campaign Name', 'name')}<FormControl><Input placeholder="e.g. Ration Kit Distribution Ramzan 2027" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>{renderLabel('Description', 'description')}<FormControl><Textarea placeholder="Objectives And Target Impact..." {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormItem>
                    <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">Header Image</FormLabel>
                    <FormControl>
                        <Input id="imageFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageFileChange} className="hidden" />
                    </FormControl>
                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                        {imagePreview ? (
                            <>
                                <Image src={imagePreview} alt="Preview" fill className="object-cover rounded-lg" />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 shadow-lg" onClick={handleRemoveImage}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                <p className="mb-2 text-sm text-center text-muted-foreground font-normal">
                                    <span className="font-bold text-primary">Click To Upload</span> Or Drag And Drop
                                </p>
                                <p className="text-[10px] text-muted-foreground font-normal uppercase tracking-tighter">PNG, JPG, WEBP (1280x400 Recommended)</p>
                            </div>
                        )}
                    </label>
                    <FormMessage />
                </FormItem>
                 <FormItem>
                    <FormLabel className="font-bold text-primary">Campaign Documents & Artifacts</FormLabel>
                    <FormControl>
                        <FileUploader
                            onFilesChange={setDocumentsToUpload}
                            multiple={true}
                            acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf"
                        />
                    </FormControl>
                    <FormDescription className="font-normal text-xs opacity-70 italic">Upload Proposals, Vetted Reports, Or Verification Photos.</FormDescription>
                </FormItem>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem>{renderLabel('Campaign Category', 'category')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Ration" className="font-bold">Ration</SelectItem><SelectItem value="Relief" className="font-bold">Relief</SelectItem><SelectItem value="General" className="font-bold">General</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem>{renderLabel('Priority Level', 'priority')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Priority" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{priorityLevels.map(p => <SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                </div>
                <FormField control={form.control} name="targetAmount" render={({ field }) => (
                    <FormItem>{renderLabel('Target Fundraising Goal (₹)', 'targetAmount')}<FormControl><Input type="number" placeholder="e.g. 100000" {...field} className="font-bold" /></FormControl><FormDescription className="font-normal text-xs opacity-70">The Combined Financial Target For All Verified Goal Contributions.</FormDescription><FormMessage /></FormItem>
                )}/>
                
                <div className="space-y-4">
                    <div>
                        <FormLabel className="text-base font-bold text-primary">Qualified Donation Types</FormLabel>
                        <FormDescription className="font-normal text-xs opacity-70">Select Which Fund Types Count Towards The Fundraising Goal Metrics.</FormDescription>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-xl bg-primary/5 border-primary/10">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="select-all-types" 
                                checked={form.watch('allowedDonationTypes')?.length === donationCategories.length} 
                                onCheckedChange={(checked) => { 
                                    form.setValue('allowedDonationTypes', checked ? [...donationCategories] : [], { shouldDirty: true, shouldValidate: true }); 
                                }} 
                            />
                            <Label htmlFor="select-all-types" className="font-bold text-[10px] uppercase cursor-pointer tracking-widest">Any</Label>
                        </div>
                        {donationCategories.map((type) => (
                            <div key={type} className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox 
                                    id={`type-${type}`}
                                    checked={form.watch('allowedDonationTypes')?.includes(type)} 
                                    onCheckedChange={(checked) => { 
                                        const current = form.getValues('allowedDonationTypes') || [];
                                        const updated = checked 
                                            ? [...current, type] 
                                            : current.filter((value) => value !== type);
                                        form.setValue('allowedDonationTypes', updated, { shouldDirty: true, shouldValidate: true });
                                    }} 
                                />
                                <Label htmlFor={`type-${type}`} className="font-bold text-[10px] uppercase cursor-pointer tracking-widest opacity-80">{type}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem>{renderLabel('Start Date', 'startDate')}<FormControl><Input type="date" {...field} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem>{renderLabel('End Date', 'endDate')}<FormControl><Input type="date" {...field} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem>{renderLabel('Status', 'status')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Completed" className="font-bold">Completed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="authenticityStatus" render={({ field }) => (
                        <FormItem>{renderLabel('Verification Level', 'authenticityStatus')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Authenticity" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Pending Verification" className="font-bold">Pending</SelectItem><SelectItem value="Verified" className="font-bold text-primary">Verified</SelectItem><SelectItem value="On Hold" className="font-bold">On Hold</SelectItem><SelectItem value="Rejected" className="font-bold text-destructive">Rejected</SelectItem><SelectItem value="Need More Details" className="font-bold">Need Details</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                </div>
              <FormField control={form.control} name="publicVisibility" render={({ field }) => (
                  <FormItem>{renderLabel('Public Visibility', 'publicVisibility')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Visibility" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Hold" className="font-bold">Hold (Private)</SelectItem><SelectItem value="Ready to Publish" className="font-bold">Ready To Publish</SelectItem><SelectItem value="Published" className="font-bold text-primary">Published</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}/>
              <div className="flex justify-end gap-3 pt-6 border-t mt-6 bg-background/80 backdrop-blur-sm sticky bottom-0 p-4 z-50">
                  <Button type="button" variant="outline" onClick={() => router.push('/campaign-members')} disabled={isLoading} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                  <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocumentsToUpload([]); }} disabled={isLoading} className="font-bold transition-transform active:scale-95"><RotateCcw className="mr-2 h-4 w-4"/> Reset Form</Button>
                  <Button type="submit" disabled={isLoading} className="font-bold shadow-md transition-transform active:scale-95">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Register Campaign
                  </Button>
              </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>

       <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-primary">Duplicate Campaign Name Detected</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    A Campaign With This Name Already Exists In The Institutional Records. Are You Certain You Want To Proceed With A New Entry?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCampaignDataToCreate(null)} className="font-bold border-primary/20 text-primary">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { if (campaignDataToCreate) { handleCreateCampaign(campaignDataToCreate); } }} className="font-bold bg-primary text-white hover:bg-primary/90">
                    Confirm Creation
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
