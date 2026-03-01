
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldAlert, MoreHorizontal, Trash2, Edit, Copy, HandHelping, CalendarIcon, X, Utensils, LifeBuoy } from 'lucide-react';
import { useFirestore, doc, updateDoc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
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
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CopyCampaignDialog } from '@/components/copy-campaign-dialog';
import { copyCampaignAction, deleteCampaignAction } from './actions';
import { cn, getNestedValue } from '@/lib/utils';
import Image from 'next/image';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { NewsTicker } from '@/components/news-ticker';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { usePublicData } from '@/hooks/use-public-data';

function CampaignCard({ 
    campaign, 
    index, 
    router, 
    canUpdate, 
    canCreate, 
    canDelete, 
    handleStatusUpdate, 
    handleCopyClick, 
    handleDeleteClick 
}: {
    campaign: Campaign & { collected: number; progress: number; };
    index: number;
    router: ReturnType<typeof useRouter>;
    canUpdate: boolean;
    canCreate: boolean;
    canDelete: boolean;
    handleStatusUpdate: (campaignToUpdate: Campaign, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => Promise<void>;
    handleCopyClick: (campaign: Campaign) => void;
    handleDeleteClick: (campaign: Campaign) => void;
}) {
    const FallbackIcon = campaign.category === 'Ration' ? Utensils : campaign.category === 'Relief' ? LifeBuoy : HandHelping;

    return (
        <Card 
            className="flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1 cursor-pointer animate-fade-in-up overflow-hidden active:scale-[0.98] h-full" 
            style={{ animationDelay: `${50 + index * 30}ms`, animationFillMode: 'backwards' }}
            onClick={() => router.push(`/campaign-members/${campaign.id}/summary`)}
        >
          <div className="relative h-32 w-full bg-secondary flex items-center justify-center">
            {campaign.imageUrl ? (
                <Image
                  src={`/api/image-proxy?url=${encodeURIComponent(campaign.imageUrl)}`}
                  alt={campaign.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                />
            ) : (
                <FallbackIcon className="h-16 w-16 text-muted-foreground/40" />
            )}
          </div>
          <CardHeader className="p-4">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="w-full break-words text-sm sm:text-base font-bold line-clamp-2">
                    {campaign.campaignNumber && <span className="text-primary">#{campaign.campaignNumber} </span>}{campaign.name}
                </CardTitle>
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
                                    <DropdownMenuRadioGroup value={campaign.status} onValueChange={(value) => handleStatusUpdate(campaign, 'status', value)}>
                                        <DropdownMenuRadioItem value="Upcoming">Upcoming</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Active">Active</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><span>Verification</span></DropdownMenuSubTrigger>
                                    <DropdownMenuRadioGroup value={campaign.authenticityStatus} onValueChange={(value) => handleStatusUpdate(campaign, 'authenticityStatus', value as string)}>
                                        <DropdownMenuRadioItem value="Pending Verification">Pending Verification</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="On Hold">On Hold</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Rejected">Rejected</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Need More Details">Need More Details</DropdownMenuRadioGroup>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger><span>Publication</span></DropdownMenuSubTrigger>
                                    <DropdownMenuRadioGroup value={campaign.publicVisibility} onValueChange={(value) => handleStatusUpdate(campaign, 'publicVisibility', value as string)}>
                                        <DropdownMenuRadioItem value="Hold">Hold (Private)</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Ready to Publish">Ready to Publish</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Published">Published</DropdownMenuRadioGroup>
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
            <CardDescription className="text-[10px] uppercase font-bold tracking-wider">{campaign.startDate} to {campaign.endDate}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 p-4 pt-0">
              <div className="flex justify-between items-center text-xs">
                <Badge variant="secondary" className="text-[10px]">{campaign.category}</Badge>
                <Badge 
                  variant={campaign.status === 'Active' ? 'success' : campaign.status === 'Completed' ? 'secondary' : 'outline'}
                  className={cn("text-[10px]", campaign.status === 'Active' && "animate-status-pulse")}
                >
                  {campaign.status}
                </Badge>
            </div>
            {(campaign.targetAmount || 0) > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                        <span>Collected: ₹{campaign.collected.toLocaleString('en-IN')}</span>
                        <span>{Math.round(campaign.progress)}%</span>
                    </div>
                    <Progress value={campaign.progress} className="h-1.5" />
                    <p className="text-center text-[10px] text-muted-foreground/70">Goal: ₹{(campaign.targetAmount || 0).toLocaleString('en-IN')}</p>
                </div>
            )}
        </CardContent>
        <CardFooter className="p-2 border-t bg-muted/5">
            <Button asChild className="w-full transition-transform active:scale-95 text-xs font-bold" size="sm" variant="ghost">
                <Link href={`/campaign-members/${campaign.id}/summary`}>
                    Manage Campaign
                </Link>
            </Button>
        </CardFooter>
        </Card>
    );
}

export default function CampaignPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [campaignToCopy, setCampaignToCopy] = useState<Campaign | null>(null);

  const { userProfile, isLoading: isProfileLoading } = useSession();
  const { campaignsWithProgress, leadsWithProgress, recentDonationsFormatted, isLoading: isDataLoading } = usePublicData();

  const activeTickerItems = useMemo(() => {
    const activeCampaigns = campaignsWithProgress
      .filter(c => c.status === 'Active')
      .map(c => {
          const pending = Math.max(0, (c.targetAmount || 0) - c.collected);
          return {
              id: c.id,
              text: `Campaign: ${c.name} (Goal: ₹${(c.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/campaign-members/${c.id}/summary`
          };
      });
    
    const activeLeads = leadsWithProgress
      .filter(l => l.status === 'Active')
      .map(l => {
          const pending = Math.max(0, (l.targetAmount || 0) - l.collected);
          return {
              id: l.id,
              text: `Lead: ${l.name} (Goal: ₹${(l.targetAmount || 0).toLocaleString('en-IN')} | Pending: ₹${pending.toLocaleString('en-IN')})`,
              href: `/leads-members/${l.id}/summary`
          };
      });

    return [...activeCampaigns, ...activeLeads];
  }, [campaignsWithProgress, leadsWithProgress]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    campaignsWithProgress.forEach(c => c.startDate && years.add(c.startDate.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [campaignsWithProgress]);
  
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.delete', false);
  const canViewCampaigns = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false);

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    setIsDeleting(true);
    const result = await deleteCampaignAction(campaignToDelete.id);
    toast({ title: result.success ? 'Campaign Deleted' : 'Deletion Failed', description: result.message, variant: result.success ? 'success' : 'destructive' });
    setIsDeleting(false);
    setCampaignToDelete(null);
  };
  
  const handleStatusUpdate = async (campaignToUpdate: Campaign, field: 'status' | 'authenticityStatus' | 'publicVisibility', value: string) => {
    if (!firestore || !canUpdate) return;
    const docRef = doc(firestore, 'campaigns', campaignToUpdate.id);
    const updateData = { [field]: value };
    updateDoc(docRef, updateData)
        .then(() => toast({ title: 'Success', description: `Campaign updated.`, variant: 'success' }))
        .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData })));
  };
  
  const filteredCampaigns = useMemo(() => {
    let items = campaignsWithProgress.filter(c => 
        (statusFilter === 'All' || c.status === statusFilter) &&
        (categoryFilter === 'All' || c.category === categoryFilter) &&
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        items = items.filter(c => {
            const d = parseISO(c.startDate);
            return d >= from && d <= to;
        });
    } else if (selectedYear !== 'All') {
        items = items.filter(c => c.startDate?.startsWith(selectedYear));
    }
    return items;
  }, [campaignsWithProgress, searchTerm, statusFilter, categoryFilter, dateRange, selectedYear]);

  const sections = [
    { id: 'active', title: 'Active Campaigns', items: filteredCampaigns.filter(c => c.status === 'Active') },
    { id: 'upcoming', title: 'Upcoming Campaigns', items: filteredCampaigns.filter(c => c.status === 'Upcoming') },
    { id: 'completed', title: 'Completed Campaigns', items: filteredCampaigns.filter(c => c.status === 'Completed') }
  ].filter(s => s.items.length > 0);

  const isLoading = isProfileLoading || isDeleting || isDataLoading;
  
  if (!isLoading && userProfile && !canViewCampaigns) {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link></Button></div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>Missing permissions.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="outline" asChild size="sm"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link></Button>
          {canCreate && !isLoading && <Button asChild size="sm" className="font-bold"><Link href="/campaign-members/create"><Plus className="mr-2 h-4 w-4" /> New Campaign</Link></Button>}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter">CAMPAIGN HUB</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">Manage community initiatives from this command center.</p>
        </div>

        <div className="space-y-2">
          <NewsTicker items={activeTickerItems} label="Live Updates" variant="active" />
          <NewsTicker items={recentDonationsFormatted} label="Donation Updates" variant="donation" />
        </div>

        <Card className="animate-fade-in-zoom shadow-md border-primary/5">
          <CardHeader className="p-4 sm:p-6 border-b bg-muted/5">
            <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search campaigns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs h-9 text-xs" disabled={isLoading}/>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem></SelectContent></Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading}><SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="All">All Categories</SelectItem><SelectItem value="Ration">Ration</SelectItem><SelectItem value="Relief">Relief</SelectItem><SelectItem value="General">General</SelectItem></SelectContent></Select>
                <div className="flex items-center gap-2 border-l pl-3 ml-1">
                    <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setDateRange(undefined); }} disabled={isLoading}><SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="All">Year</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                    <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-9 px-3 text-xs font-normal", !dateRange && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-3 w-3" /> Range</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" selected={dateRange} onSelect={(d) => { setDateRange(d); if (d?.from) { setSelectedYear('All'); } }} numberOfMonths={2} /></PopoverContent></Popover>
                    {(selectedYear !== 'All' || dateRange) && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedYear('All'); setDateRange(undefined); }}><X className="h-4 w-4" /></Button>}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
              </div>
            ) : sections.length > 0 ? (
              <Accordion type="multiple" defaultValue={['active']} className="space-y-4">
                {sections.map(section => (
                  <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4 bg-card/50">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold tracking-tight uppercase">{section.title}</span>
                        <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 text-[10px]">{section.items.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {section.items.map((campaign, idx) => (
                          <CampaignCard key={campaign.id} campaign={campaign} index={idx} router={router} canUpdate={canUpdate} canCreate={canCreate} canDelete={canDelete} handleStatusUpdate={handleStatusUpdate} handleCopyClick={setCampaignToCopy} handleDeleteClick={setCampaignToDelete}/>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed">
                  <HandHelping className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-medium">No campaigns found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Campaign?</AlertDialogTitle><AlertDialogDescription>Erase all data for '{campaignToDelete?.name}'?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <CopyCampaignDialog open={!!campaignToCopy} onOpenChange={() => setCampaignToCopy(null)} campaign={campaignToCopy} onCopyConfirm={async (opt) => { const res = await copyCampaignAction({ sourceCampaignId: campaignToCopy!.id, ...opt }); toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' }); setCampaignToCopy(null); }}/>
    </>
  );
}
