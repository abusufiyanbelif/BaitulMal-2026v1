

'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2, User, Shield, Phone, KeyRound, CheckCircle, XCircle, LogIn, FileText, BadgeInfo, Hash, Eye, Edit, Save, Mail, ZoomIn, ZoomOut, RotateCw, RefreshCw, Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { processPortalProfileUpdateAction, checkPendingVerificationAction } from '@/app/verifications/actions';
import { supporterUpdatePasswordAction } from '@/app/portal-login/actions';
import type { PendingVerification } from '@/lib/types';
import { PendingUpdateWarning } from '@/components/pending-update-warning';
import { cn } from '@/lib/utils';

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
    const { userProfile, isLoading, forceRefetch: forceRefetchUser } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingPendingRequest, setExistingPendingRequest] = useState<PendingVerification | null>(null);
    
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    
    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name);
            setPhone(userProfile.phone || '');
            checkPendingVerificationAction(userProfile.id).then(setExistingPendingRequest);
        }
    }, [userProfile, isEditMode]);

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

    const handlePasswordSave = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast({ title: 'Invalid Password', description: 'Password must be at least 6 characters long.', variant: 'destructive'});
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: 'Mismatch', description: 'Passwords do not match.', variant: 'destructive'});
            return;
        }
        if (!userProfile) return;

        setIsSavingPassword(true);
        try {
            const res = await supporterUpdatePasswordAction(userProfile.id, userProfile.role, newPassword);
            if (res.success) {
                toast({ title: 'Success', description: res.message, variant: 'success' });
                setIsPasswordDialogOpen(false);
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast({ title: 'Error', description: res.message, variant: 'destructive' });
            }
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleSave = () => {
        if (!firestore || !userProfile || !isDirty) {
            toast({ title: 'No Changes', description: 'There are no changes to save.', variant: 'default'});
            return;
        }
        setIsSubmitting(true);

        const updateData: {name?: string, phone?: string } = {};
        if (name !== userProfile.name) updateData.name = name;
        if (phone !== (userProfile.phone || '')) updateData.phone = phone;

        const isSelfServicePortalUser = userProfile.role === 'Donor' || userProfile.role === 'Beneficiary';

        if (isSelfServicePortalUser) {
             processPortalProfileUpdateAction(userProfile.id, userProfile.name, updateData).then((result) => {
                 setIsSubmitting(false);
                 if (result.success) {
                     toast({ title: 'Approval Required', description: result.message, variant: 'success' });
                     setIsEditMode(false);
                 } else {
                     toast({ title: 'Failed to Submit', description: result.message, variant: 'destructive' });
                 }
             });
             return;
        }

        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userProfile.id);

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
        
        batch.commit()
            .then(() => {
                toast({ title: 'Success', description: 'Profile updated successfully.', variant: 'success' });
                forceRefetchUser();
                setIsEditMode(false);
            })
            .catch((serverError: any) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                }));
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };


    if (isLoading) {
        return (
             <div className="container mx-auto p-4 md:p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>

            <PendingUpdateWarning targetId={userProfile?.id || ''} module="users" />

            <Card className="max-w-2xl mx-auto animate-fade-in-zoom mt-6">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>This is your personal information as it appears in the system.</CardDescription>
                        </div>
                         {!isEditMode ? (
                            <Button 
                                onClick={handleEdit} 
                                disabled={!!existingPendingRequest}
                                className={cn(
                                    "font-bold shadow-md active:scale-95 transition-transform",
                                    existingPendingRequest ? "bg-muted text-muted-foreground" : ""
                                )}
                            >
                                <Edit className="mr-2 h-4 w-4" /> 
                                {existingPendingRequest ? "Approval Pending" : "Edit"}
                            </Button>
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

                            {userProfile.organizationGroup && (
                               <ProfileDetail icon={<Building />} label="Organization Group" value={<Badge variant="outline">{userProfile.organizationGroup}</Badge>} />
                            )}
                            {userProfile.organizationRole && (
                                <ProfileDetail icon={<BadgeInfo />} label="Organization Role" value={userProfile.organizationRole} />
                            )}
                            
                            <ProfileDetail 
                                icon={userProfile.status === 'Active' ? <CheckCircle className="text-success-foreground" /> : <XCircle className="text-destructive" />} 
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

                            {userProfile.aadhaarProofUrl && (
                                <ProfileDetail 
                                    icon={<FileText />} 
                                    label="Aadhaar Card" 
                                    value={
                                        <Button variant="outline" size="sm" onClick={() => handleViewImage(userProfile.aadhaarProofUrl!)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Aadhaar
                                        </Button>
                                    } 
                                />
                            )}
                            {userProfile.aadhaarNumber && <ProfileDetail icon={<Hash />} label="Aadhaar Number" value={userProfile.aadhaarNumber} />}
                            {userProfile.aadhaarName && <ProfileDetail icon={<BadgeInfo />} label="Name on Aadhaar" value={userProfile.aadhaarName} />}
                            {userProfile.aadhaarDob && <ProfileDetail icon={<BadgeInfo />} label="DOB" value={userProfile.aadhaarDob} />}
                            {userProfile.aadhaarGender && <ProfileDetail icon={<BadgeInfo />} label="Gender" value={userProfile.aadhaarGender} />}
                            {userProfile.aadhaarAddress && <ProfileDetail icon={<BadgeInfo />} label="Aadhaar Address" value={userProfile.aadhaarAddress} />}

                            <div className="pt-4 border-t border-primary/5">
                                <Button variant="outline" className="font-bold border-primary/20 text-primary" onClick={() => setIsPasswordDialogOpen(true)}>
                                    <KeyRound className="mr-2 h-4 w-4" /> Change Password
                                </Button>
                            </div>
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
                            <Image
                                src={`/api/image-proxy?url=${encodeURIComponent(imageToView)}`}
                                alt="ID Proof"
                                fill
                                sizes="100vw"
                                className="object-contain transition-transform duration-200 ease-out origin-center"
                                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                                unoptimized
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

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-primary/60" />
                            Update Portal Password
                        </DialogTitle>
                        <CardDescription>Keep your credential private. Ensure it is easily remembered.</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs">New Password</Label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                disabled={isSavingPassword}
                                className="font-normal"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs">Confirm Password</Label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                disabled={isSavingPassword}
                                className="font-normal"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex sm:justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)} disabled={isSavingPassword}>
                            Cancel
                        </Button>
                        <Button onClick={handlePasswordSave} disabled={isSavingPassword} className="font-bold active:scale-95 transition-transform">
                            {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Update Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
