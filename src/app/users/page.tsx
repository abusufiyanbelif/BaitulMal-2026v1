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
    ArrowRight,
    UserPlus,
    Activity,
    Shield,
    Lock,
    Key,
    IdCard,
    Smartphone,
    Mail,
    ChevronRight,
    Zap,
    Scale,
    Merge,
    X
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
import { SectionLoader } from '@/components/section-loader';

type SortKey = keyof UserProfile | 'srNo';

function StatCard({ title, count, description, icon: Icon, delay, onClick, colorClass }: { title: string, count: number | string, description: string, icon: any, delay: string, onClick?: () => void, colorClass?: string }) {
    return (
        <Card 
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-5 bg-white border-primary/5 shadow-sm animate-fade-in-up transition-all duration-500 hover:shadow-xl hover:-translate-y-1 overflow-hidden", 
                onClick && "cursor-pointer active:scale-95",
                colorClass
            )} 
            style={{ animationDelay: delay, animationFillMode: 'backwards' }}
        >
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                <Icon className="h-24 w-24" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 rounded-2xl bg-primary/[0.03] text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-40 mb-1">{title}</p>
                    <p className="text-3xl font-black text-primary tracking-tighter">{count}</p>
                </div>
            </div>
            <div className="relative z-10 mt-auto">
                <p className="text-[10px] font-bold text-muted-foreground/60 leading-tight">{description}</p>
            </div>
        </Card>
    );
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return users
        .filter(u => u.role === 'Admin' || u.role === 'User')
        .map(u => {
          const isDonor = donors?.some(d => d.id === u.id || (d.phone === u.phone && !!u.phone));
          const isBeneficiary = beneficiaries?.some(b => b.id === u.id || (b.phone === u.phone && !!u.phone));
          const multiRole = (isDonor ? 1 : 0) + (isBeneficiary ? 1 : 0) > 0;
          return { ...u, isDonor, isBeneficiary, multiRole };
        });
  }, [users, donors, beneficiaries]);

  // Cross-module identity gaps for Resolution Center
  const crossModuleGaps = useMemo(() => {
      const staffUsers = (users || []).filter(u => u.role === 'Admin' || u.role === 'User');
      const allDonors = donors || [];
      const allBens = beneficiaries || [];

      // Users without a linked Donor profile
      const usersWithoutDonor = staffUsers.filter(u => !allDonors.some(d => d.id === u.id));

      // Donors not linked to any User (orphaned donor profiles)
      const orphanedDonors = allDonors.filter(d => !staffUsers.some(u => u.id === d.id) && !staffUsers.some(u => u.phone === d.phone && !!d.phone));

      // Beneficiaries matching a User by phone but not by ID
      const unmatchedBeneficiaries = allBens.filter(b => {
          const matchByPhone = staffUsers.find(u => u.phone === b.phone && !!b.phone);
          const matchById = staffUsers.find(u => u.id === b.id);
          return matchByPhone && !matchById;
      });

      return { usersWithoutDonor, orphanedDonors, unmatchedBeneficiaries };
  }, [users, donors, beneficiaries]);

  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    let items = users.filter(u => u.role === 'Admin' || u.role === 'User');
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

  const stats = useMemo(() => {
      const allData = users || [];
      const totalGaps = duplicatesGroups.length + crossModuleGaps.usersWithoutDonor.length + crossModuleGaps.orphanedDonors.length + crossModuleGaps.unmatchedBeneficiaries.length;
      return {
          total: allData.length,
          active: allData.filter(u => u.status === 'Active').length,
          admins: allData.filter(u => u.role === 'Admin').length,
          unlinked: totalGaps,
      };
  }, [users, duplicatesGroups, crossModuleGaps]);

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

  const handleMirrorToDonor = async (id: string) => {
      if (!userProfile) return;
      setIsMirroring(id);
      try {
          const res = await mirrorIndividualUserToDonorAction(id, { id: userProfile.id, name: userProfile.name });
          if (res.success) toast({ title: "Mirroring Successful", description: res.message, variant: "success" });
          else toast({ title: "Mirroring Failed", description: res.message, variant: "destructive" });
      } finally {
          setIsMirroring(null);
      }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete || !canDelete) return;
    setIsSubmitting(true);
    try {
        const result = await deleteUserAction(userToDelete);
        if (result.success) {
            toast({ title: "Account Purged", description: result.message, variant: "success" });
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        } else {
            toast({ title: "Purge Failed", description: result.message, variant: "destructive" });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const isLoading = areUsersLoading || isProfileLoading;
  
  if (isLoading) return <SectionLoader label="Syncing Team Neural Network..." description="Retrieving Institutional Member Records." />;

  if (!canRead) return (
    <main className="container mx-auto p-8 text-primary font-normal">
        <Alert variant="destructive" className="rounded-3xl border-primary/10 shadow-2xl">
            <ShieldAlert className="h-4 w-4"/>
            <AlertTitle className="font-black tracking-tight">Access Restricted</AlertTitle>
            <AlertDescription className="font-bold opacity-70">Insufficient credentials to access the institutional member center.</AlertDescription>
        </Alert>
    </main>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div className="space-y-1.5">
                <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9 mb-2">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <Users className="h-5 w-5" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Identity & Team Center</h1>
                </div>
                <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Centralized institutional member registry, role authorization, and cross-module identity reconciliation hub.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" asChild size="sm" className="font-bold border-primary/10 text-primary h-11 rounded-2xl px-6 bg-white shadow-sm hover:bg-primary/5 transition-all">
                    <Link href="/seed"><Database className="mr-2 h-4 w-4 opacity-40"/> Database Console</Link>
                </Button>
                {canCreate && (
                    <Button onClick={() => router.push('/users/create')} size="sm" className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <UserPlus className="mr-2 h-4 w-4" /> Enroll New Member
                    </Button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up">
          <StatCard 
            title="Registry Total" 
            count={stats.total} 
            description="Verified Institutional Members" 
            icon={Users} 
            delay="100ms" 
          />
          <StatCard 
            title="Active Operational" 
            count={stats.active} 
            description="Members With Active Access" 
            icon={UserCheck} 
            delay="150ms" 
            colorClass="bg-emerald-500/[0.02] border-emerald-500/10"
          />
          <StatCard 
            title="Root Authorities" 
            count={stats.admins} 
            description="Members with Admin Privilege" 
            icon={Shield} 
            delay="200ms" 
            colorClass="bg-primary/[0.02] border-primary/10"
          />
          <StatCard 
            title="Identity Gaps" 
            count={stats.unlinked} 
            description="Competing Identity Clusters" 
            icon={Merge} 
            delay="250ms" 
            colorClass={stats.unlinked > 0 ? "bg-amber-500/[0.03] border-amber-500/10" : ""}
          />
      </div>

      <Tabs defaultValue="management" className="w-full space-y-10 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="bg-white/30 backdrop-blur-md p-1.5 rounded-[24px] border border-primary/5 shadow-sm inline-flex w-fit overflow-hidden">
            <TabsList className="flex flex-nowrap bg-transparent p-0 gap-1 h-auto">
                <TabsTrigger value="management" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
                    <Users className="h-3.5 w-3.5" /> Registry List
                </TabsTrigger>
                <TabsTrigger value="audit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
                    <ShieldCheck className="h-3.5 w-3.5" /> Identity Audit
                </TabsTrigger>
                <TabsTrigger value="duplicates" className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 data-[state=active]:shadow-lg", stats.unlinked > 0 ? "text-amber-600 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-amber-500/20" : "data-[state=active]:bg-primary data-[state=active]:text-white")}>
                    <DatabaseZap className={cn("h-3.5 w-3.5", stats.unlinked > 0 && "animate-pulse")} /> Resolution Center
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="management" className="animate-fade-in-up mt-0 space-y-8">
            <Card className="rounded-[32px] border border-primary/5 bg-white/30 backdrop-blur-md overflow-hidden shadow-none">
                <CardHeader className="p-4 sm:p-6 border-b bg-white/80 backdrop-blur-md sticky top-[73px] z-20">
                    <ScrollArea className="w-full">
                        <div className="flex flex-nowrap items-center gap-4 pb-3">
                            <div className="relative w-[350px] shrink-0">
                                <Input 
                                    placeholder="Search name, email, key..." 
                                    value={searchTerm} 
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                                    className="pl-11 h-11 text-sm border-primary/10 focus-visible:ring-primary font-bold text-primary rounded-2xl bg-white shadow-sm" 
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30">
                                    <Search className="h-4 w-4" />
                                </div>
                            </div>

                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[200px] shrink-0 h-11 text-sm border-primary/10 rounded-2xl bg-white font-bold shadow-sm">
                                    <SelectValue placeholder="System State" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                    <SelectItem value="All" className="font-bold text-xs p-3 rounded-xl">All System States</SelectItem>
                                    <SelectItem value="Active" className="font-bold text-xs p-3 rounded-xl text-emerald-600">Operational Active</SelectItem>
                                    <SelectItem value="Inactive" className="font-bold text-xs p-3 rounded-xl text-destructive">Account Disabled</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[200px] shrink-0 h-11 text-sm border-primary/10 rounded-2xl bg-white font-bold shadow-sm">
                                    <SelectValue placeholder="Authorization Level" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-dropdown border-primary/10 p-1.5">
                                    <SelectItem value="All" className="font-bold text-xs p-3 rounded-xl">All Privilege Levels</SelectItem>
                                    <SelectItem value="Admin" className="font-bold text-xs p-3 rounded-xl">Root Admin</SelectItem>
                                    <SelectItem value="User" className="font-bold text-xs p-3 rounded-xl">Standard Team</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <ScrollBar orientation="horizontal" className="h-1.5" />
                    </ScrollArea>
                </CardHeader>

                <CardContent className="p-0">
                    <ScrollArea className="w-full">
                        <div className="max-h-[60vh]">
                            <div className="hidden md:block">
                                <Table className="min-w-[1000px]">
                                    <TableHeader>
                                        <TableRow className="bg-primary/[0.02] border-b border-primary/5">
                                            <TableHead className="w-[80px] pl-8 text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14"># ID</TableHead>
                                            <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Member Identity</TableHead>
                                            <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Contact & Auth</TableHead>
                                            <TableHead className="text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">System Privilege</TableHead>
                                            <TableHead className="text-center text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Account State</TableHead>
                                            <TableHead className="text-right pr-8 text-[10px] font-black tracking-[0.15em] text-muted-foreground uppercase h-14">Modify</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedUsers.map((u, i) => (
                                            <TableRow key={u.id} className="cursor-pointer bg-white/40 border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-colors group" onClick={() => router.push(`/users/${u.id}`)}>
                                                <TableCell className="pl-8 font-mono text-[11px] font-bold opacity-30">{(currentPage-1)*itemsPerPage + i + 1}</TableCell>
                                                <TableCell className="py-5">
                                                    <div className="font-bold text-sm text-primary tracking-tight group-hover:text-primary transition-colors">{u.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono font-bold opacity-50 flex items-center gap-1.5 mt-0.5">
                                                        <Fingerprint className="h-3 w-3" /> {u.userKey}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="text-xs font-bold text-primary/80 flex items-center gap-1.5"><Mail className="h-3 w-3 opacity-40"/> {u.email}</div>
                                                        <div className="text-[10px] font-mono font-bold opacity-40 flex items-center gap-1.5"><Smartphone className="h-3 w-3"/> {u.phone || 'NO PHONE LOGGED'}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 h-6 rounded-full border-0 shadow-sm", u.role === 'Admin' ? "bg-primary text-white" : "bg-primary/5 text-primary")}>
                                                        {u.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={u.status === 'Active' ? 'eligible' : 'outline'} className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm", u.status === 'Active' ? "bg-emerald-500 text-white" : "opacity-40")}>
                                                        {u.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-8" onClick={e=>e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-90"><MoreHorizontal className="h-5 w-5"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-2xl border-primary/10 shadow-dropdown p-1.5 w-64">
                                                            <DropdownMenuItem onClick={()=>router.push(`/users/${u.id}`)} className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer"><Edit className="mr-3 h-4 w-4 opacity-40"/> Modify Full Profile</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={()=>handleMirrorToDonor(u.id)} disabled={!!isMirroring} className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer">
                                                                {isMirroring === u.id ? <Loader2 className="mr-3 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-3 h-4 w-4 opacity-40"/>} Mirror to Donor Registry
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger className="text-primary font-bold text-xs p-3 rounded-xl cursor-pointer"><UserCheck className="mr-3 h-4 w-4 opacity-40"/> Authentication State</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal>
                                                                    <DropdownMenuSubContent className="rounded-2xl shadow-dropdown border-primary/10 p-1.5 min-w-[180px]">
                                                                        <DropdownMenuRadioGroup value={u.status} onValueChange={v => handleStatusUpdate(u, v)}>
                                                                            <DropdownMenuRadioItem value="Active" className="font-bold text-xs p-3 rounded-xl text-emerald-600">Operational Active</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Inactive" className="font-bold text-xs p-3 rounded-xl text-destructive">Account Disabled</DropdownMenuRadioItem>
                                                                        </DropdownMenuRadioGroup>
                                                                    </DropdownMenuSubContent>
                                                                </DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                            {canDelete && (
                                                                <>
                                                                    <DropdownMenuSeparator className="my-1.5 opacity-10" />
                                                                    <DropdownMenuItem onClick={()=>{ setUserToDelete(u.id); setIsDeleteDialogOpen(true); }} className="text-destructive font-black text-xs p-3 rounded-xl hover:bg-destructive/10"><Trash2 className="mr-3 h-4 w-4 opacity-80"/> Hard Purge Account</DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="md:hidden flex flex-col">
                                {paginatedUsers.map((u, idx) => (
                                    <div key={u.id} className="p-5 border-b border-primary/5 bg-white/40 space-y-5 group/mobile" onClick={() => router.push(`/users/${u.id}`)}>
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1.5">
                                                <h3 className="font-black text-lg text-primary tracking-tighter group-hover/mobile:text-primary transition-colors leading-tight">{u.name}</h3>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold opacity-60">
                                                    <Fingerprint className="h-3 w-3" /> {u.userKey}
                                                </div>
                                            </div>
                                            <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full border-0 shadow-sm", u.role === 'Admin' ? "bg-primary text-white" : "bg-primary/5 text-primary")}>
                                                {u.role}
                                            </Badge>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-xs font-black text-primary/80 bg-primary/[0.03] w-full px-4 py-2.5 rounded-2xl border border-primary/5">
                                                <Mail className="h-4 w-4 opacity-40"/> {u.email}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-mono font-black text-primary/60 bg-white/50 w-full px-4 py-2.5 rounded-2xl border border-primary/5">
                                                <Smartphone className="h-4 w-4 opacity-40"/> {u.phone || 'NO PHONE LOGGED'}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                                            <Badge variant={u.status === 'Active' ? 'eligible' : 'outline'} className={cn("text-[9px] font-black uppercase px-2.5 h-6 rounded-full tracking-widest border-0 shadow-sm", u.status === 'Active' ? "bg-emerald-500 text-white" : "opacity-40")}>
                                                {u.status}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="h-9 text-[10px] font-black text-primary hover:bg-primary/5 px-4 rounded-xl transition-all group-hover/mobile:translate-x-1">
                                                Audit Control <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
                
                {totalPages > 1 && (
                    <CardFooter className="flex justify-between items-center p-8 border-t bg-primary/[0.01]">
                        <div className="bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-primary/5 shadow-sm">
                            <p className="text-xs font-black text-primary tracking-tight">Registry Page <span className="text-primary">{currentPage}</span> <span className="opacity-30">/ {totalPages}</span></p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="font-black text-[10px] uppercase tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm">Previous</Button>
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="font-black text-[10px] uppercase tracking-widest border-primary/10 h-10 rounded-xl px-6 bg-white transition-all active:scale-90 disabled:opacity-30 shadow-sm">Next</Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </TabsContent>

        <TabsContent value="audit" className="animate-fade-in-up mt-0 space-y-8">
            <Card className="rounded-[40px] border border-primary/5 bg-white/40 backdrop-blur-md overflow-hidden shadow-none p-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-primary tracking-tighter flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                <Scale className="h-6 w-6" />
                            </div>
                            Multi-Role Identity Audit
                        </h3>
                        <p className="text-sm font-bold opacity-60 text-primary max-w-xl">Comprehensive cross-module reconciliation of members holding concurrent organizational identities as Donors or Beneficiaries.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {auditData.map((u, uIdx) => (
                        <div key={u.id} className="group relative flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[32px] bg-white border border-primary/5 shadow-none hover:shadow-xl hover:-translate-y-1 transition-all duration-500 animate-fade-in-up" style={{ animationDelay: `${uIdx * 50}ms` }}>
                            <div className="flex items-center gap-6 flex-1 min-w-0">
                                <div className="h-14 w-14 rounded-full bg-primary/5 text-primary flex items-center justify-center font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                                    {u.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-black text-lg text-primary tracking-tighter truncate">{u.name}</h4>
                                        <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-[8px] font-black uppercase tracking-widest px-2 h-5 rounded-full border-0">{u.role}</Badge>
                                    </div>
                                    <p className="text-xs font-bold text-primary/40 truncate mt-0.5">{u.email}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3 flex-1">
                                <div className={cn("flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border transition-all", u.isDonor ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-primary/[0.02] border-primary/5 text-primary/30")}>
                                    <HeartHandshake className={cn("h-4 w-4", u.isDonor && "animate-pulse")} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Benefactor Registry</span>
                                    {u.isDonor ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3 w-3 opacity-30" />}
                                </div>
                                <div className={cn("flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border transition-all", u.isBeneficiary ? "bg-blue-500/5 border-blue-500/20 text-blue-600" : "bg-primary/[0.02] border-primary/5 text-primary/30")}>
                                    <IdCard className={cn("h-4 w-4", u.isBeneficiary && "animate-pulse")} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Recipient Registry</span>
                                    {u.isBeneficiary ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3 w-3 opacity-30" />}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pl-6 border-l border-primary/5">
                                {u.multiRole ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 text-amber-600 border border-amber-500/10 rounded-xl">
                                        <Zap className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Unified Profile</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary/40 rounded-xl">
                                        <UserCheck className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Single Entity</span>
                                    </div>
                                )}
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary/20 hover:text-primary hover:bg-primary/5 rounded-2xl" onClick={() => router.push(`/users/${u.id}`)}>
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="animate-fade-in-up mt-0 space-y-8">
            {/* --- Cross-Module: Users Without Donor Profile --- */}
            {crossModuleGaps.usersWithoutDonor.length > 0 && (
                <Card className="rounded-[32px] border border-emerald-500/10 bg-emerald-500/[0.02] overflow-hidden shadow-none p-8 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-emerald-500/10">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                                    <HeartHandshake className="h-5 w-5" />
                                </div>
                                <h3 className="text-xl font-black text-emerald-900 tracking-tighter">Missing Donor Profiles</h3>
                            </div>
                            <p className="text-sm font-bold text-emerald-800/50 pl-12">
                                {crossModuleGaps.usersWithoutDonor.length} team member(s) have no linked Donor record. Mirror to create their Donor identity.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {crossModuleGaps.usersWithoutDonor.map(u => (
                            <div key={u.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-emerald-500/5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0">{u.name.charAt(0)}</div>
                                    <div className="min-w-0">
                                        <p className="font-black text-sm text-primary tracking-tight truncate">{u.name}</p>
                                        <p className="text-[10px] font-bold text-primary/40 truncate">{u.email} · {u.phone || 'No phone'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-600 px-2 h-5 rounded-full">{u.role}</Badge>
                                    <Button
                                        size="sm"
                                        onClick={() => handleMirrorToDonor(u.id)}
                                        disabled={isMirroring === u.id}
                                        className="h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl active:scale-95 transition-all"
                                    >
                                        {isMirroring === u.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <HeartHandshake className="h-3 w-3 mr-1.5" />}
                                        Mirror
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* --- Cross-Module: Orphaned Donors (no User link) --- */}
            {crossModuleGaps.orphanedDonors.length > 0 && (
                <Card className="rounded-[32px] border border-blue-500/10 bg-blue-500/[0.02] overflow-hidden shadow-none p-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-blue-500/10">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                                    <Users className="h-5 w-5" />
                                </div>
                                <h3 className="text-xl font-black text-blue-900 tracking-tighter">Orphaned Donor Records</h3>
                            </div>
                            <p className="text-sm font-bold text-blue-800/50 pl-12">
                                {crossModuleGaps.orphanedDonors.length} donor(s) exist without a matching team member profile.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {crossModuleGaps.orphanedDonors.slice(0, 20).map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-blue-500/5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">{(d.name || '?').charAt(0)}</div>
                                    <div className="min-w-0">
                                        <p className="font-black text-sm text-primary tracking-tight truncate">{d.name || 'Unnamed Donor'}</p>
                                        <p className="text-[10px] font-bold text-primary/40 truncate">{d.email || 'No email'} · {d.phone || 'No phone'}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/donors/${d.id}`)}
                                    className="h-8 px-4 text-[10px] font-black uppercase tracking-widest border-blue-500/20 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white active:scale-95 transition-all shrink-0"
                                >
                                    <Eye className="h-3 w-3 mr-1.5" /> View Profile
                                </Button>
                            </div>
                        ))}
                        {crossModuleGaps.orphanedDonors.length > 20 && (
                            <p className="text-center text-xs font-bold text-blue-600/50 pt-2">+ {crossModuleGaps.orphanedDonors.length - 20} more orphaned donors</p>
                        )}
                    </div>
                </Card>
            )}

            {/* --- Cross-Module: Beneficiaries matched by phone but not ID --- */}
            {crossModuleGaps.unmatchedBeneficiaries.length > 0 && (
                <Card className="rounded-[32px] border border-violet-500/10 bg-violet-500/[0.02] overflow-hidden shadow-none p-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-violet-500/10">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
                                    <IdCard className="h-5 w-5" />
                                </div>
                                <h3 className="text-xl font-black text-violet-900 tracking-tighter">Unlinked Beneficiary Matches</h3>
                            </div>
                            <p className="text-sm font-bold text-violet-800/50 pl-12">
                                {crossModuleGaps.unmatchedBeneficiaries.length} beneficiary record(s) share a phone number with a team member but aren't ID-linked.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {crossModuleGaps.unmatchedBeneficiaries.map((b: any) => (
                            <div key={b.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-violet-500/5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-violet-500/10 text-violet-600 flex items-center justify-center font-black text-sm shrink-0">{(b.name || '?').charAt(0)}</div>
                                    <div className="min-w-0">
                                        <p className="font-black text-sm text-primary tracking-tight truncate">{b.name || 'Unnamed'}</p>
                                        <p className="text-[10px] font-bold text-primary/40 truncate">{b.phone || 'No phone'} · Status: {b.status || 'Unknown'}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-violet-500/20 text-violet-600 px-3 h-5 rounded-full shrink-0">Phone Match</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* --- Existing: User-to-User Duplicate Collisions --- */}
            <div className="grid gap-8">
                {duplicatesGroups.length === 0 && crossModuleGaps.usersWithoutDonor.length === 0 && crossModuleGaps.orphanedDonors.length === 0 && crossModuleGaps.unmatchedBeneficiaries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-primary/[0.01] rounded-[48px] border-2 border-dashed border-primary/5">
                        <ShieldCheck className="h-16 w-16 text-primary/10 mb-6" />
                        <h4 className="font-black text-lg text-primary/30 tracking-widest uppercase">Registry Integrity High</h4>
                        <p className="text-sm font-bold text-primary/20 mt-2">No identity gaps or collisions detected across User, Donor, and Beneficiary modules.</p>
                    </div>
                ) : duplicatesGroups.length > 0 && (
                    <>
                        <div className="flex items-center gap-3 pl-2 pt-4">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-amber-600">User-to-User Duplicate Collisions</h3>
                        </div>
                        {duplicatesGroups.map((group, gIdx) => (
                        <Card key={gIdx} className="group relative rounded-[40px] border border-amber-500/10 bg-amber-500/[0.02] overflow-hidden shadow-none p-10 animate-fade-in-up" style={{ animationDelay: `${gIdx * 100}ms` }}>
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10 pb-8 border-b border-amber-500/10">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-500/20">
                                            <AlertCircle className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-2xl font-black text-amber-900 tracking-tighter">Identity Collision: {group.key}</h3>
                                    </div>
                                    <p className="text-sm font-bold text-amber-800/60 pl-16 max-w-xl">{group.redundants.length + 1} competing profiles mapped to this identifier.</p>
                                </div>
                                <Button
                                    onClick={() => handleConsolidate(group.primary.id, group.redundants.map(r => r.id))}
                                    disabled={isConsolidating === group.primary.id}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-black h-14 rounded-2xl px-10 shadow-2xl shadow-amber-500/30 active:scale-95 transition-all w-full lg:w-auto"
                                >
                                    {isConsolidating === group.primary.id ? <Loader2 className="h-5 w-5 animate-spin mr-3"/> : <Merge className="h-5 w-5 mr-3" />}
                                    Neural Resolution & Merge
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pl-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Primary Preservation Target</Label>
                                    </div>
                                    <div className="relative p-8 rounded-[32px] bg-white border-2 border-emerald-500 shadow-2xl shadow-emerald-500/5">
                                        <Badge className="absolute -top-3 -right-3 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg border-4 border-white">Master Record</Badge>
                                        <div className="flex items-center gap-6">
                                            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center font-black text-emerald-600 text-2xl shadow-inner">{group.primary.name.charAt(0)}</div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-xl text-primary tracking-tighter truncate leading-tight">{group.primary.name}</h4>
                                                <p className="text-xs font-mono font-bold text-muted-foreground opacity-60 mt-1">UID: {group.primary.id.slice(0, 12)}...</p>
                                                <Badge variant="outline" className="mt-3 text-[10px] font-black uppercase tracking-widest border-primary/10 text-primary py-1 px-3 rounded-xl">{group.primary.role}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pl-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">Redundant Account Fragments</Label>
                                    </div>
                                    <div className="grid gap-4">
                                        {group.redundants.map(r => (
                                            <div key={r.id} className="p-5 rounded-[24px] bg-white/60 border border-amber-500/10 flex items-center justify-between group/row hover:bg-white hover:shadow-xl transition-all duration-500">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">{r.name.charAt(0)}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-primary/70 tracking-tight truncate">{r.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <Badge variant="secondary" className="text-[8px] font-black uppercase px-2 h-4 border-0">{r.role}</Badge>
                                                            <span className="text-[9px] font-mono text-muted-foreground opacity-40 italic"># {r.id.slice(0, 6)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-red-500/5 text-red-500 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all"><Trash2 className="h-4 w-4" /></div>
                                                    <ArrowRight className="h-5 w-5 text-amber-500 animate-pulse" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                    </>
                )}
            </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[40px] border-primary/10 shadow-2xl overflow-hidden p-0 animate-fade-in-zoom font-normal max-w-lg">
            <div className="bg-red-500 h-2 w-full" />
            <div className="p-10 space-y-8">
                <AlertDialogHeader className="space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-[24px] bg-red-100 flex items-center justify-center text-red-600 shadow-inner">
                        <Trash2 className="h-8 w-8"/>
                    </div>
                    <div className="space-y-2 text-center">
                        <AlertDialogTitle className="text-3xl font-black text-primary tracking-tighter">Authorize Hard Purge?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-bold text-primary opacity-60 leading-relaxed px-4">
                            You are about to permanently erase this member's neural footprint. This Action Will Irreversibly Expunge The Account, Profiles, And All Verification Context.
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col sm:flex-row gap-4 w-full pt-4">
                    <AlertDialogCancel className="font-black uppercase tracking-widest text-[10px] border-primary/10 text-primary flex-1 h-14 rounded-2xl bg-white shadow-sm hover:bg-primary/5 transition-all">Discard</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteConfirm} 
                        disabled={isSubmitting}
                        className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] flex-1 h-14 rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <ShieldAlert className="h-5 w-5 mr-3" />}
                        Expunge Identity
                    </AlertDialogAction>
                </AlertDialogFooter>
            </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
