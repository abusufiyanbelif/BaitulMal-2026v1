

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy } from 'lucide-react';
import { useCollection, useFirestore, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign, Beneficiary, Donation, DonationCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CopyCampaignDialog } from '@/components/copy-campaign-dialog';
import { copyCampaignAction } from './actions';
import { get } from '@/lib/utils';
import { donationCategories } from '@/lib/modules';


export default function CampaignPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [authenticityFilter, setAuthenticityFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [campaignToCopy, setCampaignToCopy] = useState<Campaign | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const campaignsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'campaigns');
  }, [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const donationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaignData = useMemo(() => {
    if (!campaigns || !donations) return [];

    return campaigns.map(campaign => {
      const collected = donations.reduce((sum, donation) => {
            let amountForThisCampaign = 0;

            const campaignLink = donation.linkSplit?.find(l => l.linkId === campaign.id && l.linkType === 'campaign');
            
            if (campaignLink) {
                amountForThisCampaign = campaignLink.amount;
            } else if ((!donation.linkSplit || donation.linkSplit.length === 0) && donation.campaignId === campaign.id) {
                // This is a legacy donation for this campaign
                amountForThisCampaign = donation.amount;
            } else {
                // This donation is not for this campaign
                return sum;
            }
            
            if (amountForThisCampaign === 0) {
                return sum;
            }

            const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
            
            const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
                ? donation.typeSplit
                : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);

            const applicableTypeTotal = typeSplits.reduce((acc, split) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (campaign.allowedDonationTypes?.includes(category)) {
                    return acc + split.amount;
                }
                return acc;
            }, 0);
            
            const proportionOfApplicableTypes = applicableTypeTotal / totalDonationAmount;
            const finalAmountForGoal = amountForThisCampaign * proportionOfApplicableTypes;

            return sum + finalAmountForGoal;
        }, 0);

      const progress = campaign.targetAmount && campaign.targetAmount > 0 ? (collected / campaign.targetAmount) * 100 : 0;
      
      return {
        ...campaign,
        collected,
        progress
      };
    });
  }, [campaigns, donations]);
  
  const canCreate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.campaigns.create', false);
  const canUpdate = userProfile?.role === 'Admin' || get(userProfile, 'permissions.campaigns.update', false);
  const canDelete = userProfile?.role === 'Admin' || get(userProfile, 'permissions.campaigns.delete', false);
  const canViewCampaigns = userProfile?.role === 'Admin' || canCreate || canUpdate || canDelete || Object.values(get(userProfile, 'permissions.campaigns', {})).some((perm: any) => perm?.read);

  const handleDeleteClick = (campaign: Campaign) => {
    if (!canDelete) return;
    setCampaignToDelete(campaign);
    setIsDeleteDialogOpen(true);
  };

  const handleCopyClick = (campaign: Campaign) => {
    if (!canCreate) return;
    setCampaignToCopy(campaign);
    setIsCopyDialogOpen(true);
  };

  const handleCopyConfirm = async (options: { newName: string; copyBeneficiaries: boolean; copyDonations: boolean; copyRationLists: boolean; }) => {
    if (!campaignToCopy || !canCreate) return;

    setIsCopyDialogOpen(false);
    
    const result = await copyCampaignAction({
        sourceCampaignId: campaignToCopy.id,
        ...options
    });

    if (result.success) {
        toast({ title: 'Campaign Copied', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Copy Failed', description: result.message, variant: 'destructive' });
    }

    setCampaignToCopy(null);
  };

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete || !firestore || !storage || !canDelete) {
        toast({ title: 'Error', description: 'Could not delete campaign.', variant: 'destructive'});
        return;
    };

    setIsDeleteDialogOpen(false);
    setIsDeleting(true);

    try {
        const campaignId = campaignToDelete.id;

        // --- Fetch all associated documents and file URLs ---
        const beneficiariesRef = collection(firestore, `campaigns/${campaignId}/beneficiaries`);
        const beneficiariesSnap = await getDocs(beneficiariesRef);

        const donationsQuery = query(collection(firestore, 'donations'), where('campaignId', '==', campaignId));
        const donationsSnap = await getDocs(donationsQuery);
        
        const storageUrls: string[] = [];
        beneficiariesSnap.forEach(doc => {
            const data = doc.data() as Beneficiary;
            if (data.idProofUrl) storageUrls.push(data.idProofUrl);
        });
        donationsSnap.forEach(doc => {
            const data = doc.data() as Donation;
            if (data.screenshotUrl) storageUrls.push(data.screenshotUrl);
        });

        // --- Step 1: Delete files from Storage ---
        const deleteFilePromises = storageUrls.map(url => {
            const fileRef = storageRef(storage, url);
            return deleteObject(fileRef).catch(error => {
                // Don't throw an error, just continue
                if (error.code !== 'storage/object-not-found') {
                    console.warn(`Failed to delete file ${url}`, error);
                }
            });
        });

        await Promise.all(deleteFilePromises);
        
        // --- Step 2: Delete documents from Firestore ---
        const batch = writeBatch(firestore);
        beneficiariesSnap.forEach(doc => batch.delete(doc.ref));
        donationsSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(firestore, 'campaigns', campaignId));

        await batch.commit();
        
        toast({ title: 'Success', description: `Campaign '${campaignToDelete.name}' was successfully deleted.`, variant: 'success' });

    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `campaigns/${campaignToDelete.id} and all sub-collections`, operation: 'delete' }));
    } finally {
        setIsDeleting(false);
        setCampaignToDelete(null);
    }
  };
  
  const handleStatusUpdate = async (campaignToUpdate: Campaign, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => {
    if (!firestore || !canUpdate) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to update campaigns.', variant: 'destructive'});
        return;
    };

    const docRef = doc(firestore, 'campaigns', campaignToUpdate.id);
    const updatedData = { [field]: value };

    updateDoc(docRef, updatedData)
        .then(() => {
            toast({ title: 'Success', description: `Campaign '${campaignToUpdate.name}' has been updated.`, variant: 'success' });
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updatedData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };
  
  const filteredAndSortedCampaigns = useMemo(() => {
    if (!campaignData) return [];
    let sortableItems = [...campaignData];
    
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(c => c.status === statusFilter);
    }
    if (categoryFilter !== 'All') {
        sortableItems = sortableItems.filter(c => c.category === categoryFilter);
    }
    if (authenticityFilter !== 'All') {
        sortableItems = sortableItems.filter(c => (c.authenticityStatus || 'Pending Verification') === authenticityFilter);
    }
    if (visibilityFilter !== 'All') {
        sortableItems = sortableItems.filter(c => (c.publicVisibility || 'Hold') === visibilityFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(c => 
            c.name.toLowerCase().includes(lowercasedTerm)
        );
    }

    const statusOrder: { [key: string]: number } = {
        'Active': 1,
        'Upcoming': 2,
        'Completed': 3
    };

    sortableItems.sort((a, b) => {
        const statusA = statusOrder[a.status] || 99;
        const statusB = statusOrder[b.status] || 99;
        if (statusA !== statusB) {
            return statusA - statusB;
        }
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    
    return sortableItems;
  }, [campaignData, searchTerm, statusFilter, categoryFilter, authenticityFilter, visibilityFilter]);

  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / itemsPerPage);
  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCampaigns, currentPage, itemsPerPage]);

  const isLoading = areCampaignsLoading || isProfileLoading || isDeleting || areDonationsLoading;
  
  if (!isLoading && userProfile && !canViewCampaigns) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to view campaigns.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      <main className="container mx-auto p-2 sm:p-4">
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
        <Card className="animate-fade-in-zoom">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="flex-1 space-y-2">
                <CardTitle>Campaigns ({filteredAndSortedCampaigns.length})</CardTitle>
                 <div className="flex flex-wrap items-center gap-2">
                    <Input 
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="max-w-xs"
                        disabled={isLoading}
                    />
                     <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setCurrentPage(1); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Categories</SelectItem>
                            <SelectItem value="Ration">Ration</SelectItem>
                            <SelectItem value="Relief">Relief</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={authenticityFilter} onValueChange={(value) => { setAuthenticityFilter(value); setCurrentPage(1); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Authenticity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Authenticity</SelectItem>
                            <SelectItem value="Pending Verification">Pending</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={visibilityFilter} onValueChange={(value) => { setVisibilityFilter(value); setCurrentPage(1); }} disabled={isLoading}>
                        <SelectTrigger className="w-auto text-xs sm:text-sm md:w-[150px]">
                            <SelectValue placeholder="Visibility" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Visibilities</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                            <SelectItem value="Ready to Publish">Ready</SelectItem>
                            <SelectItem value="Published">Published</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {isLoading && <Skeleton className="h-10 w-44" />}
            {!isLoading && canCreate && (
              <Button asChild>
                <Link href="/campaign-members/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
                )}
                {!isLoading && paginatedCampaigns.map((campaign, index) => {
                    return (
                    <Card key={campaign.id} className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-zoom" style={{ animationDelay: `${100 * index}ms` }} onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)}>
                        <CardHeader>
                            <div className="flex justify-between items-start gap-2">
                                <CardTitle className="w-full break-words text-base">{campaign.name}</CardTitle>
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)} className="cursor-pointer">
                                            <Edit className="mr-2 h-4 w-4" />
                                            View Details
                                        </DropdownMenuItem>
                                        {canUpdate && <DropdownMenuSeparator />}
                                        {canUpdate && (
                                            <>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger><span>Change Status</span></DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                        <DropdownMenuRadioGroup value={campaign.status} onValueChange={(value) => handleStatusUpdate(campaign, 'status', value)}>
                                                            <DropdownMenuRadioItem value="Upcoming">Upcoming</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Active">Active</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
                                                        </DropdownMenuRadioGroup>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger><span>Verification</span></DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                        <DropdownMenuRadioGroup value={campaign.authenticityStatus} onValueChange={(value) => handleStatusUpdate(campaign, 'authenticityStatus', value as string)}>
                                                            <DropdownMenuRadioItem value="Pending Verification">Pending Verification</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="On Hold">On Hold</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Rejected">Rejected</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Need More Details">Need More Details</DropdownMenuRadioItem>
                                                        </DropdownMenuRadioGroup>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger><span>Publication</span></DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                        <DropdownMenuRadioGroup value={campaign.publicVisibility} onValueChange={(value) => handleStatusUpdate(campaign, 'publicVisibility', value as string)}>
                                                            <DropdownMenuRadioItem value="Hold">Hold (Private)</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Ready to Publish">Ready to Publish</DropdownMenuRadioItem>
                                                            <DropdownMenuRadioItem value="Published">Published</DropdownMenuRadioItem>
                                                        </DropdownMenuRadioGroup>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                            </>
                                        )}
                                        <DropdownMenuSeparator />
                                        {canCreate && (
                                            <DropdownMenuItem onClick={() => handleCopyClick(campaign)} className="cursor-pointer">
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copy
                                            </DropdownMenuItem>
                                        )}
                                        {canDelete && (
                                            <>
                                                {canCreate && <DropdownMenuSeparator />}
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(campaign); }} className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <CardDescription className="text-xs">{campaign.startDate} to {campaign.endDate}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-2">
                             <div className="flex justify-between text-xs text-muted-foreground">
                                <Badge variant="outline">{campaign.category}</Badge>
                                <Badge variant={
                                    campaign.status === 'Active' ? 'success' :
                                    campaign.status === 'Completed' ? 'secondary' : 'outline'
                                }>{campaign.status}</Badge>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <Badge variant="outline">{campaign.authenticityStatus || 'N/A'}</Badge>
                                <Badge variant="outline">{campaign.publicVisibility || 'N/A'}</Badge>
                            </div>
                            {campaign.targetAmount > 0 && (
                                <div className="space-y-1 pt-1">
                                    <Progress value={campaign.progress} className="h-2" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>₹{campaign.collected.toLocaleString('en-IN')}</span>
                                        <span>Goal: ₹{campaign.targetAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="p-2">
                            <Button asChild className="w-full" size="sm">
                                <Link href={`/campaign-members/${campaign.id}/summary`}>
                                    View Details
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                )})}
            </div>
             {!isLoading && filteredAndSortedCampaigns.length === 0 && (
                 <div className="text-center py-16">
                    <p className="text-muted-foreground">No campaigns found matching your criteria.</p>
                    {canCreate && campaigns?.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                            <Link href="/campaign-members/create" className="text-primary underline">
                                Create one now
                            </Link>
                        </p>
                    )}
                </div>
            )}
          </CardContent>
           {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
            </CardFooter>
          )}
        </Card>
      </main>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the campaign '{campaignToDelete?.name}' and all of its associated data, including beneficiaries, donations, and uploaded files.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteConfirm} 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <CopyCampaignDialog
            open={isCopyDialogOpen}
            onOpenChange={setIsCopyDialogOpen}
            campaign={campaignToCopy}
            onCopyConfirm={handleCopyConfirm}
        />
    </>
  );
}
