
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useStorage, useFirestore, useAuth, useMemoFirebase } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Edit, Trash2, ShieldAlert, Users } from 'lucide-react';
import type { OrganizationMember, OrganizationSettings } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const GROUPS = [
    { id: 'founder', name: 'Founders' },
    { id: 'co-founder', name: 'Co-Founders' },
    { id: 'finance', name: 'Finance Team' },
    { id: 'member', name: 'Members' },
] as const;

type GroupId = typeof GROUPS[number]['id'];

interface MemberFormDialogProps {
    member: OrganizationMember | null;
    onSave: (member: OrganizationMember, file?: File) => void;
    isSaving: boolean;
}

function MemberFormDialog({ member, onSave, isSaving }: MemberFormDialogProps) {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [group, setGroup] = useState<GroupId>('member');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        if (member) {
            setName(member.name);
            setRole(member.role);
            setGroup(member.group);
            setImagePreview(member.imageUrl || null);
            setImageFile(null);
        } else {
            setName('');
            setRole('');
            setGroup('member');
            setImagePreview(null);
            setImageFile(null);
        }
    }, [member]);

    useEffect(() => {
        if (imageFile) {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(imageFile);
        }
    }, [imageFile]);
    
    const handleSubmit = () => {
        const memberData: OrganizationMember = {
            id: member?.id || `member_${Date.now()}`,
            name,
            role,
            group,
            imageUrl: member?.imageUrl, // Keep old URL until new one is uploaded
        };
        onSave(memberData, imageFile || undefined);
    };

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="role">Role / Position</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="group">Group</Label>
                <Select value={group} onValueChange={(v) => setGroup(v as GroupId)} disabled={isSaving}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        {GROUPS.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="image">Profile Image</Label>
                <Input id="image" type="file" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} accept="image/*" disabled={isSaving} />
                {imagePreview && <Avatar className="w-24 h-24 mt-2"><AvatarImage src={imagePreview} /><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isSaving || !name || !role}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Member
                </Button>
            </DialogFooter>
        </div>
    );
}

export default function OrganizationMembersPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();
    const auth = useAuth();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<OrganizationMember | null>(null);
    
    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.members?.update;

    const settingsDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'organization');
    }, [firestore]);
    
    const { data: orgSettings, isLoading: isSettingsLoading } = useDoc<OrganizationSettings>(settingsDocRef);
    const members = useMemo(() => orgSettings?.members || [], [orgSettings]);

    const membersByGroup = useMemo(() => {
        return members.reduce((acc, member) => {
            (acc[member.group] = acc[member.group] || []).push(member);
            return acc;
        }, {} as Record<GroupId, OrganizationMember[]>);
    }, [members]);

    const handleAddNew = () => {
        setEditingMember(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (member: OrganizationMember) => {
        setEditingMember(member);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (member: OrganizationMember) => {
        setMemberToDelete(member);
    };
    
    const handleConfirmDelete = async () => {
        if (!memberToDelete || !canUpdateSettings || !firestore) return;
        
        setIsSubmitting(true);
        
        const newMembers = members.filter(m => m.id !== memberToDelete.id);
        try {
            if (memberToDelete.imageUrl) {
                const imageRef = storageRef(storage!, memberToDelete.imageUrl);
                await deleteObject(imageRef).catch(err => console.warn("Old image deletion failed, it might not exist.", err));
            }
            await setDoc(doc(firestore, 'settings', 'organization'), { members: newMembers });
            toast({ title: 'Success', description: 'Member removed successfully.' });
        } catch(e: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `settings/organization`,
                operation: 'update',
            }));
        } finally {
            setMemberToDelete(null);
            setIsSubmitting(false);
        }
    };
    
    const handleSaveMember = async (memberData: OrganizationMember, file?: File) => {
        if (!canUpdateSettings || !firestore) return;
        
        setIsSubmitting(true);

        try {
            let imageUrl = memberData.imageUrl || '';
            if (file) {
                 if (memberData.imageUrl && memberData.imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
                    const oldImageRef = storageRef(storage!, memberData.imageUrl);
                    await deleteObject(oldImageRef).catch(err => console.warn("Old image deletion failed:", err));
                }
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(file, 256, 256, 'PNG', 90, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `organization_members/${memberData.id}.png`;
                const fileRef = storageRef(storage!, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
            }
            
            const finalMemberData = { ...memberData, imageUrl };
            const existingMemberIndex = members.findIndex(m => m.id === finalMemberData.id);

            let newMembers: OrganizationMember[] = [];
            if (existingMemberIndex > -1) {
                newMembers = [...members];
                newMembers[existingMemberIndex] = finalMemberData;
            } else {
                newMembers = [...members, finalMemberData];
            }
            
            await setDoc(doc(firestore, 'settings', 'organization'), { members: newMembers });
            toast({ title: 'Success', description: `Member ${isEditing ? 'updated' : 'added'}.`});
            setIsDialogOpen(false);
        } catch (e: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `settings/organization`,
                operation: 'write',
            }));
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isLoading = isSessionLoading || isSettingsLoading;

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
                            <CardDescription>Manage your organization's team members.</CardDescription>
                        </div>
                         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={handleAddNew}><UserPlus className="mr-2 h-4 w-4" /> Add Member</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
                                </DialogHeader>
                                <MemberFormDialog member={editingMember} onSave={handleSaveMember} isSaving={isSubmitting} />
                            </DialogContent>
                        </Dialog>
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
                                                        <AvatarImage src={member.imageUrl} />
                                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <p className="font-bold">{member.name}</p>
                                                        <p className="text-sm text-muted-foreground">{member.role}</p>
                                                    </div>
                                                     <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(member)}><Edit className="h-4 w-4"/></Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(member)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
            
            <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <strong>{memberToDelete?.name}</strong> from the organization list. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
