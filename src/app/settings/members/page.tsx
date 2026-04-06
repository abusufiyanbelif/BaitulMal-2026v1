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
                                <DropdownMenuItem onClick={() => router.push('/users/create')} className="font-normal text-primary">Create new user</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsSearchOpen(true)} className="font-normal text-primary">Assign existing user</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full space-y-1.5">
                        {GROUPS.map((group) => (
                            <AccordionItem value={group.id} key={group.id} className="border rounded-lg bg-primary/[0.02] px-3">
                                <AccordionTrigger className="text-sm font-bold hover:no-underline tracking-tight py-3">{group.name} ({(membersByGroup[group.id] || []).length})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-1">
                                        {(membersByGroup[group.id] || []).map(member => (
                                            <Card key={member.id} className="group relative bg-white border-primary/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <CardContent className="p-2 flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border border-primary/5 transition-transform group-hover:scale-105">
                                                        <AvatarImage src={member.idProofUrl || undefined} />
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-[13px] truncate">{member.name}</p>
                                                        <p className="text-[10px] font-normal text-muted-foreground leading-tight">{member.organizationRole || 'Member'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                                        {member.phone && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`https://wa.me/91${member.phone!.replace(/\D/g, '')}`, '_blank');
                                                                }}
                                                                title="Message on WhatsApp"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.973L0 16l4.204-1.102a7.923 7.923 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                                                </svg>
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); router.push(`/users/${member.id}`); }}><Edit className="h-3.5 w-3.5"/></Button>
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
