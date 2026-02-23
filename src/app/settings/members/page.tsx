
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { getPublicMembersAction } from '@/app/users/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus, Edit, ShieldAlert, Users, ChevronDown } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { GROUPS, type GroupId } from '@/lib/modules';
import { UserSearchDialog } from '@/components/user-search-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function OrganizationMembersPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const router = useRouter();
    
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    
    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.members?.update;

    const [members, setMembers] = useState<Partial<UserProfile>[] | null>(null);
    const [isMembersLoading, setIsMembersLoading] = useState(true);

    useEffect(() => {
        async function fetchMembers() {
            setIsMembersLoading(true);
            const result = await getPublicMembersAction();
            setMembers(result);
            setIsMembersLoading(false);
        }
        if (canUpdateSettings) {
            fetchMembers();
        }
    }, [canUpdateSettings]);


    const membersByGroup = useMemo(() => {
        if (!members) {
            return {} as Record<GroupId, UserProfile[]>;
        }
        return members.reduce((acc, member) => {
            const group = member.organizationGroup || 'member';
            (acc[group as GroupId] = acc[group as GroupId] || []).push(member as UserProfile);
            return acc;
        }, {} as Record<GroupId, UserProfile[]>);
    }, [members]);

    const handleSelectUser = (user: UserProfile) => {
        router.push(`/users/${user.id}`);
    };
    
    const handleEdit = (member: UserProfile) => {
        router.push(`/users/${member.id}`);
    };
    
    const isLoading = isSessionLoading || isMembersLoading;

     if (isLoading) {
        return (
            <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        );
    }
    
    if (!canUpdateSettings) {
        return (
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to modify these settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                            <CardTitle className="flex items-center gap-2"><Users /> Organization Members</CardTitle>
                            <CardDescription>Manage your organization's public-facing team members. Add, edit, or remove them via the main User Management page.</CardDescription>
                        </div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Add Member
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => router.push('/users/create')}>
                                Create New User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsSearchOpen(true)}>
                                Assign Existing User
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full">
                        {GROUPS.map((group) => (
                            <AccordionItem value={group.id} key={group.id}>
                                <AccordionTrigger className="text-lg font-semibold">{group.name} ({(membersByGroup[group.id] || []).length})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                        {(membersByGroup[group.id] || []).map(member => (
                                            <Card key={member.id} className="group relative">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <Avatar className="h-16 w-16">
                                                        <AvatarImage src={member.idProofUrl || undefined} />
                                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <p className="font-bold">{member.name}</p>
                                                        <p className="text-sm text-muted-foreground">{member.organizationRole}</p>
                                                    </div>
                                                    <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(member)}><Edit className="h-4 w-4"/></Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {(membersByGroup[group.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No members in this group yet.</p>}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>

            <UserSearchDialog
                open={isSearchOpen}
                onOpenChange={setIsSearchOpen}
                onSelectUser={handleSelectUser}
            />
        </>
    );
}
