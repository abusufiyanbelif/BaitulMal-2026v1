
'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2, User, Shield, Phone, KeyRound, CheckCircle, XCircle, LogIn, FileText, BadgeInfo, Hash, Eye, Edit, Save, Mail, ZoomIn, ZoomOut, RotateCw, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function ProfileDetail({ icon, label, value, children, isEditing }: { icon: React.ReactNode, label: string, value?: React.ReactNode, children?: React.ReactNode, isEditing?: boolean }) {
    return (
        <div className="flex items-start space-x-4">
            <div className="text-muted-foreground mt-1">{icon}</div>
            <div className="w-full">
                <p className="text-sm text-muted-foreground">{label}</p>
                {isEditing ? children : <div className="font-medium">{value}</div>}
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const { userProfile, isLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    
    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name);
            setPhone(userProfile.phone || '');
        }
    }, [userProfile]);

    const isDirty = useMemo(() => {
        if (!isEditMode || !userProfile) return false;
        return name !== userProfile.name || phone !== (userProfile.phone || '');
    }, [name, phone, userProfile, isEditMode]);


    const handleViewImage = (url: string) => {
        setImageToView(url);
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const handleEdit = () => {
        if (userProfile) {
            setName(userProfile.name);
            setPhone(userProfile.phone || '');
            setIsEditMode(true);
        }
    };

    const handleCancel = () => {
        if (userProfile) {
            setName(userProfile.name);
            setPhone(userProfile.phone || '');
        }
        setIsEditMode(false);
    };

    const handleSave = async () => {
        if (!firestore || !userProfile || !isDirty) {
            toast({ title: 'Error', description: 'No changes to save or services are unavailable.', variant: 'destructive'});
            return;
        }
        setIsSubmitting(true);

        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userProfile.id);

        const updateData: {name?: string, phone?: string } = {};
        if (name !== userProfile.name) updateData.name = name;
        if (phone !== (userProfile.phone || '')) updateData.phone = phone;

        batch.update(userDocRef, updateData);

        if ((userProfile.phone || '') !== phone) {
            if (userProfile.phone) {
                const oldLookupRef = doc(firestore, 'user_lookups', userProfile.phone);
                batch.delete(oldLookupRef);
            }
            if (phone) {
                const newLookupRef = doc(firestore, 'user_lookups', phone);
                batch.set(newLookupRef, { email: userProfile.email, userKey: userProfile.userKey });
            }
        }
        
        try {
            await batch.commit();
            toast({ title: 'Success', description: 'Profile updated successfully.', variant: 'success' });
            setIsEditMode(false);
        } catch(serverError: any) {
            if (serverError.code === 'permission-denied') {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                }));
            } else {
                toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive'});
            }
        } finally {
            setIsSubmitting(false);
        }
    };


    if (isLoading) {
        return (
             <main className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            <Card className="max-w-2xl mx-auto animate-fade-in-zoom">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>This is your personal information as it appears in the system.</CardDescription>
                        </div>
                         {!isEditMode ? (
                            <Button onClick={handleEdit}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                         ) : (
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>Cancel</Button>
                                <Button onClick={handleSave} disabled={isSubmitting || !isDirty}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Save
                                </Button>
                            </div>
                         )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {userProfile ? (
                        <>
                            <ProfileDetail icon={<User />} label="Full Name" value={userProfile.name} isEditing={isEditMode}>
                                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting}/>
                            </ProfileDetail>
                            <ProfileDetail icon={<Mail />} label="Email Address" value={userProfile.email} />
                            <ProfileDetail icon={<LogIn />} label="Login ID" value={userProfile.loginId} />
                            <ProfileDetail icon={<Phone />} label="Phone Number" value={userProfile.phone} isEditing={isEditMode}>
                                 <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isSubmitting}/>
                            </ProfileDetail>
                            <ProfileDetail icon={<KeyRound />} label="User Key (System ID)" value={userProfile.userKey} />
                            
                            <ProfileDetail 
                                icon={<Shield />} 
                                label="Role" 
                                value={<Badge variant={userProfile.role === 'Admin' ? 'destructive' : 'secondary'}>{userProfile.role}</Badge>} 
                            />
                            
                            <ProfileDetail 
                                icon={userProfile.status === 'Active' ? <CheckCircle className="text-success" /> : <XCircle className="text-destructive" />} 
                                label="Status" 
                                value={<Badge variant={userProfile.status === 'Active' ? 'default' : 'outline'}>{userProfile.status}</Badge>} 
                            />

                            {userProfile.idProofUrl && (
                                <ProfileDetail 
                                    icon={<FileText />} 
                                    label="ID Proof" 
                                    value={
                                        <Button variant="outline" size="sm" onClick={() => handleViewImage(userProfile.idProofUrl!)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Document
                                        </Button>
                                    } 
                                />
                            )}
                            {userProfile.idProofType && <ProfileDetail icon={<BadgeInfo />} label="ID Type" value={userProfile.idProofType} />}
                            {userProfile.idNumber && <ProfileDetail icon={<Hash />} label="ID Number" value={userProfile.idNumber} />}
                        </>
                    ) : (
                         <p className="text-center text-muted-foreground">Could not load user profile.</p>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>ID Proof</DialogTitle>
                    </DialogHeader>
                    {imageToView && (
                        <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border rounded-md">
                            <img
                                src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                                alt="ID Proof"
                                className="transition-transform duration-200 ease-out origin-center"
                                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}
                    <DialogFooter className="sm:justify-center pt-4">
                        <Button variant="outline" onClick={() => setZoom(z => z * 1.2)}><ZoomIn className="mr-2"/> Zoom In</Button>
                        <Button variant="outline" onClick={() => setZoom(z => z / 1.2)}><ZoomOut className="mr-2"/> Zoom Out</Button>
                        <Button variant="outline" onClick={() => setRotation(r => r + 90)}><RotateCw className="mr-2"/> Rotate</Button>
                        <Button variant="outline" onClick={() => { setZoom(1); setRotation(0); }}><RefreshCw className="mr-2"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
