

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
import { copyCampaignAction, deleteCampaignAction } from './actions';
import { getNestedValue } from '@/lib/utils';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';


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
    
    const collectedAmounts = new Map<string, number>();
    const campaignsById = new Map(campaigns.map(c => [c.id, c]));

    donations.forEach(donation => {
        const links = (donation.linkSplit && donation.linkSplit.length > 0)
            ? donation.linkSplit
            : (donation as any).campaignId ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] : [];
        
        links.forEach(link => {
            if (link.linkType !== 'campaign') return;

            const campaign = campaignsById.get(link.linkId);
            if (!campaign) return;

            const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
            const proportionForThisCampaign = link.amount / totalDonationAmount;

            const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
                ? donation.typeSplit
                : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);
            
            const applicableAmount = typeSplits.reduce((acc, split) => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (campaign.allowedDonationTypes?.includes(category as DonationCategory)) {
                    return acc + split.amount;
                }
                return acc;
            }, 0);

            const currentCollected = collectedAmounts.get(link.linkId) || 0;
            collectedAmounts.set(link.linkId, currentCollected + (applicableAmount * proportionForThisCampaign));
        });
    });

    return campaigns.map(campaign => {
      const collected = collectedAmounts.get(campaign.id) || 0;
      const targetAmount = campaign.targetAmount || 0;
      const progress = targetAmount > 0 ? (collected / targetAmount) * 100 : 0;
      
      return {
        ...campaign,
        collected,
        progress
      };
    });
  }, [campaigns, donations]);
  
  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.campaigns.delete', false);
  const canViewCampaigns = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false);


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
    if (!campaignToDelete || !canDelete) {
        toast({ title: 'Error', description: 'Could not delete campaign.', variant: 'destructive'});
        return;
    };

    setIsDeleteDialogOpen(false);
    setIsDeleting(true);

    const result = await deleteCampaignAction(campaignToDelete.id);

    if (result.success) {
        toast({ title: 'Campaign Deleted', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
    setIsDeleting(false);
    setCampaignToDelete(null);
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
        .catch(async (serverError: any) => {
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
    
    return sortableItems;
  }, [campaignData, searchTerm, statusFilter, categoryFilter, authenticityFilter, visibilityFilter]);

  const activeCampaigns = useMemo(() => filteredAndSortedCampaigns.filter(c => c.status === 'Active').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedCampaigns]);
  const upcomingCampaigns = useMemo(() => filteredAndSortedCampaigns.filter(c => c.status === 'Upcoming').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedCampaigns]);
  const completedCampaigns = useMemo(() => filteredAndSortedCampaigns.filter(c => c.status === 'Completed').sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [filteredAndSortedCampaigns]);
  

  const isLoading = areCampaignsLoading || isProfileLoading || isDeleting || areDonationsLoading;
  
  const CampaignCard = ({ campaign }: { campaign: Campaign & { collected: number; progress: number; }}) => (
    <Card className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-zoom overflow-hidden" onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)}>
       <div className="relative h-32 w-full bg-secondary">
        <Image
          src={campaign.imageUrl || placeholderImages.campaign_fallback}
          alt={campaign.name}
          fill
          sizes="100vw"
          className="object-cover"
          data-ai-hint="campaign background"
        />
      </div>
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
        {(campaign.targetAmount || 0) > 0 && (
            <div className="space-y-1 pt-1">
                <Progress value={campaign.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>₹{campaign.collected.toLocaleString('en-IN')}</span>
                    <span>Goal: ₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</span>
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
  );

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
                        onChange={(e) => { setSearchTerm(e.target.value); }}
                        className="max-w-xs"
                        disabled={isLoading}
                    />
                     <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); }} disabled={isLoading}>
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
                     <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); }} disabled={isLoading}>
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
                    <Select value={authenticityFilter} onValueChange={(value) => { setAuthenticityFilter(value); }} disabled={isLoading}>
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
                    <Select value={visibilityFilter} onValueChange={(value) => { setVisibilityFilter(value); }} disabled={isLoading}>
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
          <CardContent className="space-y-8">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
              </div>
            ) : (
              <>
                {(statusFilter === 'All' || statusFilter === 'Active') && activeCampaigns.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Active Campaigns ({activeCampaigns.length})</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activeCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
                        </div>
                    </section>
                )}
                {(statusFilter === 'All' || statusFilter === 'Upcoming') && upcomingCampaigns.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Upcoming Campaigns ({upcomingCampaigns.length})</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {upcomingCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
                        </div>
                    </section>
                )}
                {(statusFilter === 'All' || statusFilter === 'Completed') && completedCampaigns.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Completed Campaigns ({completedCampaigns.length})</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {completedCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
                        </div>
                    </section>
                )}
                {filteredAndSortedCampaigns.length === 0 && (
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
              </>
            )}
          </CardContent>
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

