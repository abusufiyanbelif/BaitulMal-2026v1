'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { getPublicMembersAction } from '@/app/users/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Edit, ShieldAlert, Users, ChevronDown } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { GROUPS, type GroupId } from '@/lib/modules';
import { UserSearchDialog } from '@/components/user-search-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePageHit } from '@/hooks/use-page-hit';
import { getInitials } from '@/lib/utils';

export default function OrganizationMembersPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const router = useRouter();
    usePageHit('org_members_settings');
    
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
        if (canUpdateSettings) fetchMembers();
    }, [canUpdateSettings]);

    const membersByGroup = useMemo(() => {
        if (!members) return {} as Record<GroupId, UserProfile[]>;
        return members.reduce((acc, member) => {
            const group = member.organizationGroup || 'member';
            (acc[group as GroupId] = acc[group as GroupId] || []).push(member as UserProfile);
            return acc;
        }, {} as Record<GroupId, UserProfile[]>);
    }, [members]);

    if (isSessionLoading || isMembersLoading) {
        return <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
    }
    
    if (!canUpdateSettings) {
        return <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access denied</AlertTitle><AlertDescription className="font-normal">Missing permissions to modify team members.</AlertDescription></Alert>;
    }
    
    return (
        <div className="space-y-6 text-primary font-normal">
            <Card className="animate-fade-in-zoom border-primary/10">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 space-y-1">
                            <CardTitle className="flex items-center gap-2 font-bold"><Users className="h-5 w-5"/> Organization members</CardTitle>
                            <CardDescription className="font-normal text-primary/60">Manage your organization's public-facing team members. Assign them via the User management module.</CardDescription>
                        </div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="font-bold shadow-md"><UserPlus className="mr-2 h-4 w-4" /> Assign member <ChevronDown className="ml-2 h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push('/users/create')} className="font-bold text-primary">Create new user</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsSearchOpen(true)} className="font-bold text-primary">Assign existing user</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full space-y-2">
                        {GROUPS.map((group) => (
                            <AccordionItem value={group.id} key={group.id} className="border rounded-lg bg-primary/[0.02] px-4">
                                <AccordionTrigger className="text-base font-bold hover:no-underline tracking-tight">{group.name} ({(membersByGroup[group.id] || []).length})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
                                        {(membersByGroup[group.id] || []).map(member => (
                                            <Card key={member.id} className="group relative bg-white border-primary/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <CardContent className="p-3 flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-primary/5 transition-transform group-hover:scale-105">
                                                        <AvatarImage src={member.idProofUrl || undefined} />
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs truncate">{member.name}</p>
                                                        <p className="text-[10px] font-normal text-muted-foreground leading-tight">{member.organizationRole || 'Member'}</p>
                                                    </div>
                                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => router.push(`/users/${member.id}`)}><Edit className="h-3.5 w-3.5"/></Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {(membersByGroup[group.id] || []).length === 0 && <p className="text-[10px] text-muted-foreground p-4 font-normal italic opacity-60">No members in this group yet.</p>}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
            <UserSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectUser={(u) => router.push(`/users/${u.id}`)} />
        </div>
    );
}