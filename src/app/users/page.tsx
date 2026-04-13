'use client';
import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
    useFirestore, 
    useMemoFirebase, 
    useCollection, 
    collection,
    doc,
    updateDoc
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSession } from '@/hooks/use-session';
import type { UserProfile, Donor, Beneficiary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, 
    Edit, 
    MoreHorizontal, 
    PlusCircle, 
    Trash2, 
    ShieldAlert, 
    UserCheck, 
    UserX, 
    Database, 
    ArrowUp, 
    ArrowDown, 
    RefreshCw, 
    ShieldCheck, 
    Loader2, 
    Eye,
    Fingerprint,
    HeartHandshake,
    Users,
    Search,
    AlertCircle,
    CheckCircle2,
    DatabaseZap,
    ArrowRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { deleteUserAction, mirrorIndividualUserToDonorAction, consolidateIdentitiesAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getNestedValue } from '@/lib/utils';
import { usePageHit } from '@/hooks/use-page-hit';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

type SortKey = keyof UserProfile | 'srNo';

export default function UsersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  usePageHit('user_management');

  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [isMirroring, setIsMirroring] = useState<string | null>(null);
  const [isConsolidating, setIsConsolidating] = useState<string | null>(null);

  const usersRef = useMemoFirebase(() => (firestore && userProfile) ? collection(firestore, 'users') : null, [firestore, userProfile]);
  const donorsRef = useMemoFirebase(() => (firestore && userProfile) ? collection(firestore, 'donors') : null, [firestore, userProfile]);
  const beneficiariesRef = useMemoFirebase(() => (firestore && userProfile) ? collection(firestore, 'beneficiaries') : null, [firestore, userProfile]);
  
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersRef);
  const { data: donors } = useCollection<Donor>(donorsRef);
  const { data: beneficiaries } = useCollection<Beneficiary>(beneficiariesRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.delete', false);
  const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.read', false);

  const duplicatesGroups = useMemo(() => {
      if (!users) return [];
      const groups: Record<string, UserProfile[]> = {};
      users.forEach(u => {
          const phone = u.phone?.replace(/\D/g, '');
          const email = u.email?.toLowerCase().trim();
          
          if (phone && phone.length >= 10) {
              if (!groups[phone]) groups[phone] = [];
              if (!groups[phone].find(x => x.id === u.id)) groups[phone].push(u);
          }
          if (email && !email.includes('donor.demo.local')) {
              if (!groups[email]) groups[email] = [];
              if (!groups[email].find(x => x.id === u.id)) groups[email].push(u);
          }
      });
      return Object.entries(groups)
        .filter(([_, list]) => list.length > 1)
        .map(([key, list]) => {
            const sorted = [...list].sort((a, b) => {
                const priority: Record<string, number> = { Admin: 0, User: 1, Donor: 2, Beneficiary: 3 };
                return (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
            });
            return { key, primary: sorted[0], redundants: sorted.slice(1) };
        });
  }, [users]);

  const auditData = useMemo(() => {
      if (!users) return [];
      return users.map(u => {
          const isDonor = donors?.some(d => d.id === u.id || (d.phone === u.phone && !!u.phone));
          const isBeneficiary = beneficiaries?.some(b => b.id === u.id || (b.phone === u.phone && !!u.phone));
          const multiRole = (isDonor ? 1 : 0) + (isBeneficiary ? 1 : 0) > 0;
          return { ...u, isDonor, isBeneficiary, multiRole };
      });
  }, [users, donors, beneficiaries]);

  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    let items = [...users];
    if (statusFilter !== 'All') items = items.filter(u => u.status === statusFilter);
    if (roleFilter !== 'All') items = items.filter(u => u.role === roleFilter);
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(u => 
            (u.name || '').toLowerCase().includes(lower) || 
            (u.email || '').toLowerCase().includes(lower) || 
            (u.phone || '').includes(searchTerm) ||
            (u.userKey || '').toLowerCase().includes(lower)
        );
    }
    if (sortConfig) {
        items.sort((a, b) => {
            const aVal = (a[sortConfig.key as keyof UserProfile] ?? '').toString().toLowerCase();
            const bVal = (b[sortConfig.key as keyof UserProfile] ?? '').toString().toLowerCase();
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }
    return items;
  }, [users, searchTerm, statusFilter, roleFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleStatusUpdate = (u: UserProfile, newStatus: string) => {
      if (!firestore || !canUpdate) return;
      const ref = doc(firestore, 'users', u.id);
      updateDoc(ref, { status: newStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleConsolidate = async (primaryId: string, redundantIds: string[]) => {
      if (!userProfile) return;
      setIsConsolidating(primaryId);
      const res = await consolidateIdentitiesAction(primaryId, redundantIds, { id: userProfile.id, name: userProfile.name });
      if (res.success) toast({ title: "Unified Identity Secured", description: res.message, variant: "success" });
      else toast({ title: "Consolidation Failed", description: res.message, variant: "destructive" });
      setIsConsolidating(null);
  };

  const isLoading = areUsersLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Retrieving Member Registry..." description="Synchronizing Identity Records." />;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
      <div className="flex flex-col gap-2">
          <Button variant="outline" asChild className="w-fit font-bold border-primary/10 text-primary transition-transform active:scale-95"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link></Button>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Member & Identity Center</h1>
            <div className="flex gap-2">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary"><Link href="/seed"><Database className="mr-2 h-4 w-4"/> Database Hub</Link></Button>
                {canCreate && <Button onClick={() => router.push('/users/create')} className="font-bold shadow-md rounded-[12px]"><PlusCircle className="mr-2 h-4 w-4" /> Register Member</Button>}
            </div>
          </div>
      </div>

      <Tabs defaultValue="management" className="w-full space-y-6">
        <TabsList className="bg-primary/5 p-1 border border-primary/10 rounded-xl">
            <TabsTrigger value="management" className="font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Member Registry</TabsTrigger>
            <TabsTrigger value="audit" className="font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Multi-Role Audit</TabsTrigger>
            <TabsTrigger value="duplicates" className="font-bold text-amber-700 data-[state=active]:bg-amber-100"><DatabaseZap className="mr-2 h-4 w-4"/> Resolution Center</TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="animate-fade-in-up mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
                <Input placeholder="Search Name, Email, Phone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-xs h-10 text-sm border-primary/10 focus-visible:ring-primary rounded-[12px] bg-white font-normal" />
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}><SelectTrigger className="w-[160px] h-10 font-bold border-primary/10 bg-white rounded-[12px]"><SelectValue placeholder="All Statuses"/></SelectTrigger><SelectContent className="rounded-[12px]"><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active" className="text-primary font-bold">Active Only</SelectItem><SelectItem value="Inactive" className="text-destructive">Inactive Only</SelectItem></SelectContent></Select>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}><SelectTrigger className="w-[160px] h-10 font-bold border-primary/10 bg-white rounded-[12px]"><SelectValue placeholder="Role Filter"/></SelectTrigger><SelectContent className="rounded-[12px]"><SelectItem value="All">All Roles</SelectItem><SelectItem value="Admin">Admin</SelectItem><SelectItem value="User">User</SelectItem><SelectItem value="Donor">Donor</SelectItem><SelectItem value="Beneficiary">Beneficiary</SelectItem></SelectContent></Select>
            </div>

            <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm">
                <CardContent className="p-0">
                    <ScrollArea className="w-full">
                        <div className="min-w-[1000px]">
                            <Table>
                                <TableHeader className="bg-primary/5">
                                    <TableRow>
                                        <TableHead className="w-[60px] pl-6 font-bold text-[10px] tracking-widest uppercase">#</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Member Identity</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Contact</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Role</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">Registry Status</TableHead>
                                        <TableHead className="text-right pr-6 font-bold text-[10px] tracking-widest uppercase">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedUsers.map((u, i) => (
                                        <TableRow key={u.id} className="hover:bg-primary/[0.02] cursor-pointer border-b border-primary/5 last:border-0" onClick={() => router.push(`/users/${u.id}`)}>
                                            <TableCell className="pl-6 font-mono text-xs opacity-60">{(currentPage-1)*itemsPerPage + i + 1}</TableCell>
                                            <TableCell className="py-4">
                                                <div className="font-bold text-sm text-primary">{u.name}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono opacity-60">{u.userKey}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-medium text-primary/80">{u.email}</div>
                                                <div className="text-[10px] font-mono opacity-60">{u.phone || 'No Phone Recorded'}</div>
                                            </TableCell>
                                            <TableCell><Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-[9px] font-black uppercase tracking-tighter">{u.role}</Badge></TableCell>
                                            <TableCell><Badge variant={u.status === 'Active' ? 'eligible' : 'outline'} className="text-[9px] font-bold">{u.status}</Badge></TableCell>
                                            <TableCell className="text-right pr-6" onClick={e=>e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary active:scale-90 transition-transform"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                                        <DropdownMenuItem onClick={()=>router.push(`/users/${u.id}`)} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4 opacity-60"/> Modify Profile</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={()=>handleMirrorToDonor(u.id)} disabled={!!isMirroring} className="text-primary font-normal"><ShieldCheck className="mr-2 h-4 w-4 opacity-60"/> Mirror to Donor Registry</DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-primary/5"/>
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger className="text-primary font-normal"><UserCheck className="mr-2 h-4 w-4 opacity-60"/> Set Status</DropdownMenuSubTrigger>
                                                            <DropdownMenuPortal>
                                                                <DropdownMenuSubContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                                    <DropdownMenuRadioGroup value={u.status} onValueChange={v => handleStatusUpdate(u, v)}>
                                                                        <DropdownMenuRadioItem value="Active" className="text-primary font-bold">Active</DropdownMenuRadioItem>
                                                                        <DropdownMenuRadioItem value="Inactive" className="text-destructive">Inactive</DropdownMenuRadioItem>
                                                                    </DropdownMenuRadioGroup>
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuPortal>
                                                        </DropdownMenuSub>
                                                        {canDelete && (
                                                            <DropdownMenuItem onClick={()=>{ setUserToDelete(u.id); setIsDeleteDialogOpen(true); }} className="text-destructive font-normal"><Trash2 className="mr-2 h-4 w-4"/> Purge Account</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {paginatedUsers.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-primary/40 font-bold italic bg-primary/[0.01]">No Profiles Found Matching Criteria.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex justify-between items-center py-4 border-t bg-primary/5 px-6">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Registry Page {currentPage} Of {totalPages}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="font-bold h-8 border-primary/10 active:scale-95 transition-transform">Previous</Button>
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="font-bold h-8 border-primary/10 active:scale-95 transition-transform">Next</Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </TabsContent>

        <TabsContent value="audit" className="animate-fade-in-up mt-0 space-y-6">
            <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b px-6 py-4">
                    <CardTitle className="flex items-center gap-2 font-bold text-primary"><ShieldCheck className="h-5 w-5"/> Multi-Profile Identity Audit</CardTitle>
                    <CardDescription className="font-normal text-primary/70">Cross-collection reconciliation of members serving multiple organizational roles.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="w-full">
                        <div className="min-w-[1000px]">
                            <Table>
                                <TableHeader className="bg-primary/5">
                                    <TableRow>
                                        <TableHead className="pl-6 font-bold text-[10px] tracking-widest uppercase">Institutional Member</TableHead>
                                        <TableHead className="font-bold text-[10px] tracking-widest uppercase">System Access</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] tracking-widest uppercase">Donor Footprint</TableHead>
                                        <TableHead className="text-center font-bold text-[10px] tracking-widest uppercase">Beneficiary Map</TableHead>
                                        <TableHead className="text-right pr-6 font-bold text-[10px] tracking-widest uppercase">Identity Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditData.map(u => (
                                        <TableRow key={u.id} className="hover:bg-primary/[0.02] border-b border-primary/5 bg-white">
                                            <TableCell className="pl-6 py-4">
                                                <p className="font-bold text-sm text-primary">{u.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono opacity-60">{u.email}</p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-[9px] font-black uppercase">{u.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {u.isDonor ? <Badge variant="eligible" className="text-[8px] font-bold"><CheckCircle2 className="h-2.5 w-2.5 mr-1"/> Mirrored</Badge> : <Badge variant="outline" className="text-[8px] opacity-30">None</Badge>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {u.isBeneficiary ? <Badge variant="eligible" className="text-[8px] font-bold"><CheckCircle2 className="h-2.5 w-2.5 mr-1"/> Mirrored</Badge> : <Badge variant="outline" className="text-[8px] opacity-30">None</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {u.multiRole ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-bold">Unified Identity</Badge> : <Badge variant="secondary" className="text-[9px] font-bold">Single Account</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="animate-fade-in-up mt-0 space-y-6">
            <div className="grid gap-6">
                {duplicatesGroups.length === 0 ? (
                    <Card className="border-dashed border-primary/20 bg-primary/[0.01] rounded-2xl">
                        <CardContent className="flex flex-col items-center justify-center py-20 opacity-40">
                            <CheckCircle2 className="h-12 w-12 mb-4 text-primary" />
                            <p className="text-lg font-bold tracking-tight">Registry Integrity Confirmed</p>
                            <p className="text-sm font-normal">No fragmented identities detected by Phone or Email matching.</p>
                        </CardContent>
                    </Card>
                ) : (
                    duplicatesGroups.map((group, gIdx) => (
                        <Card key={gIdx} className="border-amber-200 bg-amber-50/30 overflow-hidden shadow-md rounded-2xl">
                            <CardHeader className="bg-amber-100/50 border-b border-amber-200 flex flex-row items-center justify-between p-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                        <CardTitle className="text-lg font-bold text-amber-900 tracking-tight">Identity Conflict: {group.key}</CardTitle>
                                    </div>
                                    <CardDescription className="text-amber-800/60 font-medium">Found {group.redundants.length + 1} competing profiles for this identifier.</CardDescription>
                                </div>
                                <Button 
                                    onClick={() => handleConsolidate(group.primary.id, group.redundants.map(r => r.id))}
                                    disabled={isConsolidating === group.primary.id}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    {isConsolidating === group.primary.id ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <DatabaseZap className="h-4 w-4 mr-2" />}
                                    Resolve & Merge All
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800/40">Primary Target (Golden Record)</Label>
                                        <div className="p-4 rounded-2xl bg-white border-2 border-primary shadow-sm relative transition-all hover:shadow-md">
                                            <Badge className="absolute -top-2 -right-2 bg-primary text-white font-black text-[8px] uppercase px-2 shadow-sm">Preserved</Badge>
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-lg shadow-inner">
                                                    {group.primary.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-primary truncate text-base">{group.primary.name}</p>
                                                    <p className="text-[10px] font-mono text-muted-foreground opacity-60">UID: {group.primary.id.slice(0, 12)}...</p>
                                                    <Badge variant="outline" className="mt-1 text-[9px] font-bold border-primary/20 text-primary uppercase">{group.primary.role}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800/40">Redundant Fragments (To Be Purged)</Label>
                                        <div className="space-y-2">
                                            {group.redundants.map(r => (
                                                <div key={r.id} className="p-3 rounded-xl bg-white/50 border border-amber-200 flex items-center justify-between group/row">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                                                            {r.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-primary/70">{r.name}</p>
                                                            <Badge variant="secondary" className="text-[8px] h-4 font-black uppercase px-1.5">{r.role}</Badge>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-amber-400 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[24px] border-primary/10 shadow-2xl overflow-hidden p-0 animate-fade-in-zoom font-normal">
            <div className="bg-red-500 h-1.5 w-full" />
            <div className="p-8 space-y-6">
                <AlertDialogHeader className="space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                        <Trash2 className="h-6 w-6"/>
                    </div>
                    <AlertDialogTitle className="text-2xl font-bold text-primary tracking-tight text-center">Confirm Permanent Deletion?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-normal text-primary/70 text-center leading-relaxed">
                        This Action Will Permanently Erase The Member's Account, Institutional Profile, And All Verification Artifacts. Financial Records Will Be Preserved As Unlinked Logs.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                    <AlertDialogCancel className="font-bold border-primary/10 text-primary flex-1 h-11 rounded-xl">Discard</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteConfirm} 
                        className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-11 rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                        Purge Account
                    </AlertDialogAction>
                </AlertDialogFooter>
            </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
