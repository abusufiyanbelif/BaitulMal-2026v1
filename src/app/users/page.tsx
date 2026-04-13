
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

type SortKey = keyof UserProfile | 'srNo';

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-[hsl(var(--table-row-hover))] text-[hsl(var(--table-header-fg))] font-semibold", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
};

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
  const [itemsPerPage, setItemsPerPage] = useState(10);
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

  const handleEdit = (user: UserProfile) => {
    if (!canUpdate) return;
    router.push(`/users/${user.id}`);
  };

  const handleMirrorToDonor = async (userId: string) => {
    if (!userProfile) return;
    setIsMirroring(userId);
    const res = await mirrorIndividualUserToDonorAction(userId, userProfile.id, userProfile.name);
    if (res.success) {
        toast({ title: "Mirroring Complete", description: res.message, variant: "success" });
    } else {
        toast({ title: "Mirroring Failed", description: res.message, variant: "destructive" });
    }
    setIsMirroring(null);
  };

  const handleConsolidate = async (primaryId: string, redundantIds: string[]) => {
      if (!userProfile) return;
      setIsConsolidating(primaryId);
      const res = await consolidateIdentitiesAction(primaryId, redundantIds, { id: userProfile.id, name: userProfile.name });
      if (res.success) {
          toast({ title: "Unified Identity Secured", description: res.message, variant: "success" });
      } else {
          toast({ title: "Consolidation Failed", description: res.message, variant: "destructive" });
      }
      setIsConsolidating(null);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setUserToDelete(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleToggleStatus = (userToUpdate: UserProfile) => {
    if (!firestore || !canUpdate) return;
    const newStatus = userToUpdate.status === 'Active' ? 'Inactive' : 'Active';
    const docRef = doc(firestore, 'users', userToUpdate.id);
    updateDoc(docRef, { status: newStatus }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { status: newStatus } })));
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete || !canDelete) return;
    setIsDeleteDialogOpen(false);
    const result = await deleteUserAction(userToDelete);
    if (result.success) toast({ title: 'User Deleted', description: result.message, variant: 'success' });
    else toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    setUserToDelete(null);
  };
  
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    let items = [...users];
    if (statusFilter !== 'All') items = items.filter(u => u.status === statusFilter);
    if (roleFilter !== 'All') items = items.filter(u => u.role === roleFilter);
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter(u => (u.name || '').toLowerCase().includes(lower) || (u.email || '').toLowerCase().includes(lower) || (u.phone || '').includes(searchTerm));
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

  const duplicatesGroups = useMemo(() => {
      if (!users) return [];
      const groups: Record<string, UserProfile[]> = {};
      users.forEach(u => {
          const phone = u.phone?.replace(/\D/g, '');
          const email = u.email?.toLowerCase().trim();
          if (phone) {
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
            // Sort by priority for primary pick
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

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage);

  const isLoading = areUsersLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Retrieving Member Registry..." description="Synchronizing Identity Records." />;
  if (!canRead) return <main className="container mx-auto p-8"><Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertTitle className="font-bold">Access Denied</AlertTitle><AlertDescription className="font-normal">Missing Permissions To Manage Users.</AlertDescription></Alert></main>;

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

        <TabsContent value="management" className="animate-fade-in-up mt-0">
            <Card className="rounded-[16px] border border-primary/10 bg-white overflow-hidden shadow-sm">
                <CardHeader className="bg-primary/5 border-b pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Input placeholder="Search Name, Email..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-xs h-9 text-xs" />
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status"/></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>
                        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Role"/></SelectTrigger><SelectContent><SelectItem value="All">All Roles</SelectItem><SelectItem value="Admin">Admin</SelectItem><SelectItem value="User">User</SelectItem><SelectItem value="Donor">Donor</SelectItem><SelectItem value="Beneficiary">Beneficiary</SelectItem></SelectContent></Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="w-full">
                        <div className="min-w-[1000px]">
                            <Table>
                                <TableHeader className="bg-primary/5"><TableRow><TableHead className="pl-4">#</TableHead><TableHead>Name</TableHead><TableHead>Identity</TableHead><TableHead>Contact</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-4">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {paginatedUsers.map((u, i) => (
                                        <TableRow key={u.id} className="hover:bg-primary/[0.02] cursor-pointer" onClick={() => handleEdit(u)}>
                                            <TableCell className="pl-4 font-mono text-xs opacity-60">{(currentPage-1)*itemsPerPage + i + 1}</TableCell>
                                            <TableCell className="font-bold text-sm text-primary">{u.name}</TableCell>
                                            <TableCell className="text-xs font-mono opacity-60">{u.userKey}</TableCell>
                                            <TableCell className="text-xs">{u.email}<br/><span className="font-mono text-[10px] opacity-60">{u.phone}</span></TableCell>
                                            <TableCell><Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-[9px] font-bold">{u.role}</Badge></TableCell>
                                            <TableCell><Badge variant={u.status === 'Active' ? 'eligible' : 'outline'} className="text-[9px] font-bold">{u.status}</Badge></TableCell>
                                            <TableCell className="text-right pr-4" onClick={e=>e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown"><DropdownMenuItem onClick={()=>handleEdit(u)} className="text-primary font-normal"><Edit className="mr-2 h-4 w-4 opacity-60"/> Edit Profile</DropdownMenuItem><DropdownMenuItem onClick={()=>handleMirrorToDonor(u.id)} disabled={!!isMirroring} className="text-primary font-normal"><ShieldCheck className="mr-2 h-4 w-4 opacity-60"/> Mirror to Donor</DropdownMenuItem><DropdownMenuSeparator className="bg-primary/5"/><DropdownMenuItem onClick={()=>handleToggleStatus(u)} className="text-amber-600 font-normal">{u.status === 'Active' ? <UserX className="mr-2 h-4 w-4"/> : <UserCheck className="mr-2 h-4 w-4"/>} {u.status === 'Active' ? 'Deactivate' : 'Activate'}</DropdownMenuItem>{canDelete && <DropdownMenuItem onClick={()=>handleDeleteClick(u.id)} className="text-destructive font-normal"><Trash2 className="mr-2 h-4 w-4"/> Delete Permanently</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex justify-between items-center py-4 border-t bg-primary/5 px-4"><p className="text-[10px] font-bold text-muted-foreground">Registry Page {currentPage} Of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="font-bold h-8 border-primary/10">Previous</Button><Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="font-bold h-8 border-primary/10">Next</Button></div></CardFooter>
                )}
            </Card>
        </TabsContent>

        <TabsContent value="audit" className="animate-fade-in-up mt-0 space-y-6">
            <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b">
                    <CardTitle className="flex items-center gap-2 font-bold text-primary"><ShieldCheck className="h-5 w-5"/> Multi-Profile Identity Audit</CardTitle>
                    <CardDescription className="font-normal text-primary/70">Cross-collection reconciliation of members serving multiple organizational roles.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="w-full">
                        <div className="min-w-[1000px]">
                            <Table>
                                <TableHeader className="bg-primary/5">
                                    <TableRow>
                                        <TableHead className="pl-6">Institutional Member</TableHead>
                                        <TableHead>System Access</TableHead>
                                        <TableHead className="text-center">Donor Footprint</TableHead>
                                        <TableHead className="text-center">Beneficiary Map</TableHead>
                                        <TableHead className="text-right pr-6">Identity Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditData.map(u => (
                                        <TableRow key={u.id} className="hover:bg-primary/[0.02] border-b border-primary/5 bg-white">
                                            <TableCell className="pl-6 py-4">
                                                <p className="font-bold text-sm text-primary">{u.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">{u.email}</p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-[9px] font-black">{u.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {u.isDonor ? <Badge variant="eligible" className="text-[8px] font-bold"><CheckCircle2 className="h-2.5 w-2.5 mr-1"/> Mirrored</Badge> : <Badge variant="outline" className="text-[8px] opacity-30">None</Badge>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {u.isBeneficiary ? <Badge variant="eligible" className="text-[8px] font-bold"><CheckCircle2 className="h-2.5 w-2.5 mr-1"/> Mirrored</Badge> : <Badge variant="outline" className="text-[8px] opacity-30">None</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {u.multiRole ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-bold">Unified Identity</Badge> : <Badge variant="secondary" className="text-[9px] font-bold">Member Only</Badge>}
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
                    <Card className="border-dashed border-primary/20 bg-primary/[0.01]">
                        <CardContent className="flex flex-col items-center justify-center py-20 opacity-40">
                            <CheckCircle2 className="h-12 w-12 mb-4 text-primary" />
                            <p className="text-lg font-bold">Registry Is Clean</p>
                            <p className="text-sm font-normal">No Fragmented Identities Detected By Phone Or Email.</p>
                        </CardContent>
                    </Card>
                ) : (
                    duplicatesGroups.map((group, gIdx) => (
                        <Card key={gIdx} className="border-amber-200 bg-amber-50/30 overflow-hidden shadow-md">
                            <CardHeader className="bg-amber-100/50 border-b border-amber-200 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                        <CardTitle className="text-lg font-bold text-amber-900 tracking-tight">Identity Conflict Detected: {group.key}</CardTitle>
                                    </div>
                                    <CardDescription className="text-amber-800/60 font-medium">Found {group.redundants.length + 1} Competing Profiles For This Phone/Email.</CardDescription>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-amber-800/40">Primary Target (Golden Record)</Label>
                                        <div className="p-4 rounded-2xl bg-white border-2 border-primary shadow-sm relative">
                                            <Badge className="absolute -top-2 -right-2 bg-primary text-white font-black text-[8px] uppercase">Preserved</Badge>
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-lg">
                                                    {group.primary.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-primary truncate">{group.primary.name}</p>
                                                    <p className="text-[10px] font-mono text-muted-foreground">{group.primary.id}</p>
                                                    <Badge variant="outline" className="mt-1 text-[9px] font-bold border-primary/20 text-primary">{group.primary.role}</Badge>
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
                                                            <Badge variant="secondary" className="text-[8px] h-4">{r.role}</Badge>
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
        <AlertDialogContent className="rounded-[16px] border-border shadow-dropdown"><AlertDialogHeader><AlertDialogTitle className="font-bold text-destructive">Confirm Permanent Deletion?</AlertDialogTitle><AlertDialogDescription className="font-normal text-primary/70">This Action Will Permanently Erase The Member's Account, Institutional Profile, And All Verification Artifacts. This Process Cannot Be Undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="font-bold border-border">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 text-white font-bold shadow-lg transition-transform active:scale-95 rounded-[12px]">Confirm Deletion</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
