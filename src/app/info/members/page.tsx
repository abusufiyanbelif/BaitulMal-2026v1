
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { GROUPS, type GroupId } from '@/lib/modules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PublicOrganizationMembersPage() {
    const firestore = useFirestore();
    
    const membersCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('organizationGroup', 'in', ['founder', 'co-founder', 'finance', 'member']), where('status', '==', 'Active'));
    }, [firestore]);
    
    const { data: members, isLoading: isMembersLoading } = useCollection<UserProfile>(membersCollectionRef);

    const membersByGroup = useMemo(() => {
        if (!members) {
            return {} as Record<GroupId, UserProfile[]>;
        }
        return members.reduce((acc, member) => {
            const group = member.organizationGroup || 'member';
            (acc[group] = acc[group] || []).push(member);
            return acc;
        }, {} as Record<GroupId, UserProfile[]>);
    }, [members]);

    if (isMembersLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        );
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
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-3xl"><Users /> Our Team</CardTitle>
                    <CardDescription>The dedicated members of our organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full">
                        {GROUPS.map((group) => (
                            <AccordionItem value={group.id} key={group.id}>
                                <AccordionTrigger className="text-xl font-semibold">{group.name} ({(membersByGroup[group.id] || []).length})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                        {(membersByGroup[group.id] || []).map(member => (
                                            <Card key={member.id} className="group">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <Avatar className="h-20 w-20">
                                                        <AvatarImage src={member.idProofUrl} />
                                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-lg">{member.name}</p>
                                                        <p className="text-sm text-muted-foreground">{member.organizationRole}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {(membersByGroup[group.id] || []).length === 0 && <p className="text-sm text-muted-foreground p-4">No members in this group.</p>}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </main>
    );
}
