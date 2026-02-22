

'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase/firestore/use-collection';
import { errorEmitter, FirestorePermissionError } from '@/firebase/errors';
import { useSession } from '@/hooks/use-session';
import { doc, updateDoc, collection } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2, ShieldAlert, UserCheck, UserX, Database, ArrowUp, ArrowDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { deleteUserAction } from './actions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getNestedValue } from '@/lib/utils';

type SortKey = keyof UserProfile | 'srNo';

function SortableHeader({ sortKey, children, className, sortConfig, handleSort }: { sortKey: SortKey, children: React.ReactNode, className?: string, sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null, handleSort: (key: SortKey) => void }) {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-2">
                {children}
                {isSorted && (sortConfig?.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
            </div>
        </TableHead>
    );
};

export default function UsersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const { userProfile, isLoading: isProfileLoading } = useSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending'});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore || !userProfile || userProfile.role !== 'Admin') {
      return null;
    }
    return collection(firestore, 'users');
  }, [firestore, userProfile]);
  
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersCollectionRef);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const canCreate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.users.create', false);
  const canUpdate = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.users.update', false);
  const canDelete = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.users.delete', false);
  const canRead = userProfile?.role === 'Admin' || getNestedValue(userProfile, 'permissions.users.read', false);

  const handleAdd = () => {
    if (!canCreate) return;
    router.push('/users/create');
  };

  const handleEdit = (user: UserProfile) => {
    if (!canUpdate) return;
    router.push(`/users/${user.id}`);
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    setUserToDelete(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleToggleStatus = (userToUpdate: UserProfile) => {
    if (!firestore || !canUpdate) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to update users.', variant: 'destructive'});
        return;
    };
    if (userToUpdate.userKey === 'admin') {
        toast({ title: 'Action Forbidden', description: 'The default admin user cannot be deactivated.', variant: 'destructive' });
        return;
    }
    if (userToUpdate.id === userProfile?.id) {
        toast({ title: 'Action Forbidden', description: 'You cannot deactivate your own account.', variant: 'destructive' });
        return;
    }

    const newStatus = userToUpdate.status === 'Active' ? 'Inactive' : 'Active';
    const docRef = doc(firestore, 'users', userToUpdate.id);
    const updatedData = { status: newStatus };

    updateDoc(docRef, updatedData)
        .then(() => {
            toast({ title: 'Success', description: `${userToUpdate.name}'s account is now ${newStatus}.`, variant: 'success' });
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

  const handleDeleteConfirm = async () => {
    if (!userToDelete || !canDelete || !users) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to delete users.', variant: 'destructive'});
        return;
    };

    const userBeingDeleted = users.find(u => u.id === userToDelete);
    if (!userBeingDeleted) return;

    if (userBeingDeleted.userKey === 'admin') {
        toast({ title: 'Action Forbidden', description: 'The default admin user cannot be deleted.', variant: 'destructive' });
        setUserToDelete(null);
        setIsDeleteDialogOpen(false);
        return;
    }

    if (userBeingDeleted.id === userProfile?.id) {
        toast({ title: 'Action Forbidden', description: 'You cannot delete your own account.', variant: 'destructive' });
        setUserToDelete(null);
        setIsDeleteDialogOpen(false);
        return;
    }
    
    setIsDeleteDialogOpen(false);

    const result = await deleteUserAction(userToDelete);

    if (result.success) {
        toast({ title: 'User Deleted', description: result.message, variant: 'success' });
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
    setUserToDelete(null);
  };
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];
    let sortableItems = [...users];

    // Filtering
    if (statusFilter !== 'All') {
        sortableItems = sortableItems.filter(u => u.status === statusFilter);
    }
    if (roleFilter !== 'All') {
        sortableItems = sortableItems.filter(u => u.role === roleFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(u => 
            (u.name || '').toLowerCase().includes(lowercasedTerm) ||
            (u.email || '').toLowerCase().includes(lowercasedTerm) ||
            (u.phone || '').toLowerCase().includes(lowercasedTerm) ||
            (u.loginId || '').toLowerCase().includes(lowercasedTerm) ||
            (u.userKey || '').toLowerCase().includes(lowercasedTerm)
        );
    }

    // Sorting
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'srNo') return 0;
            const aValue = a[sortConfig.key as keyof UserProfile] ?? '';
            const bValue = b[sortConfig.key as keyof UserProfile] ?? '';
            
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }

    return sortableItems;
  }, [users, searchTerm, statusFilter, roleFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

  const isLoading = areUsersLoading || isProfileLoading;
  
  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                <CardContent>
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        </main>
    )
  }
  
  if (!canRead) {
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
                You do not have the required permissions to manage users.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

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

      <Card className="animate-fade-in-zoom">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
                <CardTitle>User Management ({filteredAndSortedUsers.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Input 
                        placeholder="Search name, email, phone..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="max-w-sm"
                    />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[150px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-auto md:w-[150px]">
                            <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Roles</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="User">User</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {userProfile?.role === 'Admin' && (
                      <Button variant="outline" asChild>
                        <Link href="/seed">
                            <Database className="mr-2 h-4 w-4" />
                            Database
                        </Link>
                    </Button>
                )}
                {canCreate && (
                    <Button onClick={handleAdd} disabled={areUsersLoading}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                          <SortableHeader sortKey="srNo" sortConfig={sortConfig} handleSort={handleSort}>#</SortableHeader>
                          <SortableHeader sortKey="name" sortConfig={sortConfig} handleSort={handleSort}>Name</SortableHeader>
                          <SortableHeader sortKey="email" sortConfig={sortConfig} handleSort={handleSort}>Email</SortableHeader>
                          <SortableHeader sortKey="phone" sortConfig={sortConfig} handleSort={handleSort}>Phone</SortableHeader>
                          <SortableHeader sortKey="loginId" sortConfig={sortConfig} handleSort={handleSort}>Login ID</SortableHeader>
                          <SortableHeader sortKey="userKey" sortConfig={sortConfig} handleSort={handleSort}>User Key</SortableHeader>
                          <SortableHeader sortKey="role" sortConfig={sortConfig} handleSort={handleSort}>Role</SortableHeader>
                          <SortableHeader sortKey="status" sortConfig={sortConfig} handleSort={handleSort}>Status</SortableHeader>
                            {(canUpdate || canDelete) && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {areUsersLoading ? (
                          [...Array(5)].map((_, i) => (
                              <TableRow key={`skeleton-${i}`}>
                                  <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                  {(canUpdate || canDelete) && <TableCell><Skeleton className="h-5 w-10 ml-auto" /></TableCell>}
                              </TableRow>
                          ))
                      ) : paginatedUsers.length > 0 ? (
                          paginatedUsers.map((user, index) => (
                          <TableRow key={user.id} onClick={() => handleEdit(user)} className="cursor-pointer">
                              <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.phone}</TableCell>
                              <TableCell>{user.loginId}</TableCell>
                              <TableCell>{user.userKey}</TableCell>
                              <TableCell>
                              <Badge variant={user.role === 'Admin' ? 'destructive' : 'secondary'}>{user.role}</Badge>
                              </TableCell>
                              <TableCell>
                              <Badge variant={user.status === 'Active' ? 'default' : 'outline'}>{user.status}</Badge>
                              </TableCell>
                              {(canUpdate || canDelete) && (
                              <TableCell className="text-right">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon">
                                              <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          {canUpdate && (
                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(user)}}>
                                                  <Edit className="mr-2 h-4 w-4" />
                                                  View / Edit
                                              </DropdownMenuItem>
                                          )}
                                          {canUpdate && canDelete && <DropdownMenuSeparator />}
                                          {canUpdate && user.status === 'Active' ? (
                                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleToggleStatus(user)}} disabled={user.userKey === 'admin' || user.id === userProfile?.id}>
                                                  <UserX className="mr-2 h-4 w-4" />
                                                  Deactivate
                                              </DropdownMenuItem>
                                          ) : canUpdate ? (
                                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleToggleStatus(user)}}>
                                                  <UserCheck className="mr-2 h-4 w-4" />
                                                  Activate
                                              </DropdownMenuItem>
                                          ) : null}
                                          {canDelete && (
                                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleDeleteClick(user.id)}} disabled={user.userKey === 'admin' || user.id === userProfile?.id} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                  Delete
                                              </DropdownMenuItem>
                                          )}
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </TableCell>
                              )}
                          </TableRow>
                      ))
                      ) : (
                      <TableRow>
                          <TableCell colSpan={canUpdate || canDelete ? 9 : 8} className="text-center h-24 text-muted-foreground">
                              No users found matching your criteria.
                          </TableCell>
                      </TableRow>
                      )}
                  </TableBody>
              </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                  Showing {paginatedUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the user's Auth account, their database profile, and all associated files from storage. This action is irreversible.
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
    </main>
  );
}
