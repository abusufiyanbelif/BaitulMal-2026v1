
'use client';

import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/provider';
import { createAdminPermissions, type UserPermissions, GROUPS, GROUP_IDS } from '@/lib/modules';
import type { UserProfile } from '@/lib/types';
import { userFormSchema, type UserFormData } from '@/lib/schemas';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, Send, Replace, Trash2, FileIcon, ScanLine } from 'lucide-react';
import { PermissionsTable } from './permissions-table';
import { set } from '@/lib/utils';
import { useSession as useCurrentUserSession } from '@/hooks/use-session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface UserFormProps {
  user?: UserProfile | null;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  isLoading: boolean;
  isReadOnly?: boolean;
}

export function UserForm({ user, onSubmit, onCancel, isSubmitting, isLoading, isReadOnly = false }: UserFormProps) {
  const isEditing = !!user;
  const { userProfile: currentUser } = useCurrentUserSession();
  const isCurrentUserAdmin = currentUser?.role === 'Admin';
  
  const { toast } = useToast();
  const auth = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(user?.permissions || {});
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email?.includes('@docdataextract.app') ? '' : user?.email || '',
      phone: user?.phone || '',
      userKey: user?.userKey || '',
      loginId: user?.loginId || '',
      role: user?.role || 'User',
      status: user?.status || 'Active',
      password: '',
      idProofType: user?.idProofType || '',
      idNumber: user?.idNumber || '',
      organizationGroup: user?.organizationGroup || 'none',
      organizationRole: user?.organizationRole || '',
      _isEditing: isEditing,
      idProofDeleted: false,
    },
  });

  const { watch, setValue, register, control, handleSubmit, getValues, formState: { isDirty }, reset } = form;
  const nameValue = watch('name');
  const roleValue = watch('role');
  const idProofFile = watch('idProofFile');

  const [preview, setPreview] = useState<string | null>(user?.idProofUrl || null);
  
  useEffect(() => {
    if (user) {
      const orgGroupValue: 'founder' | 'co-founder' | 'finance' | 'member' | 'none' = user.organizationGroup || 'none';
      
      const defaultValues = {
        name: user.name || '',
        email: user.email?.includes('@docdataextract.app') ? '' : user.email || '',
        phone: user.phone || '',
        userKey: user.userKey || '',
        loginId: user.loginId || '',
        role: user.role || 'User',
        status: user.status || 'Active',
        password: '',
        idProofType: user.idProofType || '',
        idNumber: user.idNumber || '',
        organizationGroup: orgGroupValue,
        organizationRole: user.organizationRole || '',
        _isEditing: isEditing,
        idProofDeleted: false,
      };
      reset(defaultValues);
      setPermissions(user.permissions || {});
      setPreview(user.idProofUrl || null);
    }
  }, [user, reset, isEditing]);

  useEffect(() => {
    if (!isEditing && !getValues('userKey')) {
        setValue('userKey', `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    }
  }, [isEditing, getValues, setValue]);

  useEffect(() => {
    if (!isEditing && nameValue && !getValues('loginId')) {
        const generatedId = nameValue.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        setValue('loginId', generatedId, { shouldValidate: true });
    }
  }, [nameValue, isEditing, setValue, getValues]);
  
  useEffect(() => {
    if (roleValue === 'Admin') {
      setPermissions(createAdminPermissions());
    } else if (isEditing && user) {
        setPermissions(user.permissions || {});
    } else {
        setPermissions({});
    }
  }, [roleValue, user, isEditing]);

  useEffect(() => {
    const initialPermissions = user?.permissions || {};
    setPermissionsChanged(JSON.stringify(permissions) !== JSON.stringify(initialPermissions));
  }, [permissions, user?.permissions]);

  useEffect(() => {
    const fileList = idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setValue('idProofDeleted', false);
    } else if (!watch('idProofDeleted')) {
        setPreview(user?.idProofUrl || null);
    } else {
        setPreview(null);
    }
  }, [idProofFile, user?.idProofUrl, watch, setValue]);
  
  const handleDeleteProof = () => {
    setValue('idProofFile', null);
    setValue('idProofDeleted', true);
    setPreview(null);
    toast({ title: 'Image Marked for Deletion', description: 'The ID proof will be permanently deleted when you save the changes.', variant: 'default' });
  };

  const handleSendPasswordReset = async () => {
    if (!auth || !user?.email) {
        toast({ title: "Error", description: "Cannot send password reset. User email or auth service is not available.", variant: "destructive"});
        return;
    }
    if (user.email.includes('@docdataextract.app')) {
        toast({
            title: "Action Not Possible for Phone-Only User",
            description: "This user was created with a phone number and does not have a real email for resets.",
            variant: "destructive",
            duration: 10000,
        });
        return;
    }

    const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false, 
    };

    try {
        await sendPasswordResetEmail(auth, user.email, actionCodeSettings);
        toast({ 
            title: "Email Sent", 
            description: `A password reset link has been sent to ${user.email}. The user will be prompted to return to the login page after a successful reset.`, 
            variant: "success",
            duration: 10000
        });
    } catch (error: any) {
        console.error("Password reset error:", error);
        toast({ title: "Failed to Send", description: `Could not send password reset email. Error: ${error.message}`, variant: "destructive"});
    }
  };
  
  const handlePermissionChange = (path: string, checked: boolean) => {
      setPermissions(prevPermissions => {
        const newPermissions = JSON.parse(JSON.stringify(prevPermissions));
        set(newPermissions, path, checked);
        return newPermissions;
      });
  };
  
  const handleScanIdProof = async () => {
    const fileList = getValues('idProofFile') as FileList | undefined;

    if (!fileList || fileList.length === 0) {
        toast({ title: "No File", description: "Please upload an ID proof document to scan.", variant: "destructive" });
        return;
    }
    
    setIsScanning(true);
    toast({ title: "Scanning document...", description: "Please wait while the AI extracts the details." });

    const file = fileList[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        if (!dataUri) {
            toast({ title: "Read Error", description: "Could not read the uploaded file.", variant: "destructive" });
            setIsScanning(false);
            return;
        }

        try {
            const apiResponse = await fetch('/api/scan-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoDataUri: dataUri }),
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.error || 'The server returned an error.');
            }
            
            const response = await apiResponse.json();

            if (response) {
                if (response.name) setValue('name', response.name, { shouldValidate: true });
                if (response.aadhaarNumber) setValue('idNumber', response.aadhaarNumber, { shouldValidate:true });
                setValue('idProofType', 'Aadhaar', { shouldValidate: true });
                
                toast({
                    title: "Autofill Successful",
                    description: "User details have been populated from the scanned document.",
                    variant: "success",
                });
            } else {
                 toast({
                    title: "Autofill Incomplete",
                    description: "Could not extract all details from the document. Please fill them manually.",
                    variant: "default",
                });
            }
        } catch (error: any) {
            console.warn("ID Proof scan failed:", error);
            toast({
                title: "Scan Failed",
                description: error.message || "Could not automatically read the document.",
                variant: "destructive",
            });
        } finally {
            setIsScanning(false);
        }
    };
    reader.onerror = () => {
        toast({ title: "File Error", description: "An error occurred while reading the file.", variant: "destructive" });
        setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const finalSubmitHandler = (formData: z.infer<typeof userFormSchema>) => {
      const dataWithPermissions: UserFormData = {
          ...formData,
          permissions: permissions,
      };
      onSubmit(dataWithPermissions);
  };
  
  const isFormDisabled = isSubmitting || isLoading || isReadOnly;
  const isSaveDisabled = isSubmitting || (isEditing && !isDirty && !permissionsChanged);
  
  return (
    <Form {...form}>
        <form onSubmit={handleSubmit(finalSubmitHandler)} className="space-y-4 pt-4">
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="organization">Organization</TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="mt-6">
                    <div className="space-y-6">
                        <FormField
                            control={control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Full Name *</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Moosa Shaikh" {...field} disabled={isFormDisabled} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Contact Email *</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="user@example.com" {...field} disabled={isFormDisabled || (isEditing && !isCurrentUserAdmin)} />
                                </FormControl>
                                <FormDescription>
                                    Either Email or Phone is required. This is the user's contact and authentication email. Cannot be changed by non-admins after creation.
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Phone Number *</FormLabel>
                                <FormControl>
                                    <Input placeholder="10-digit mobile number" {...field} disabled={isFormDisabled} />
                                </FormControl>
                                <FormDescription>Either Email or Phone is required. Can be used for login if provided.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                            control={control}
                            name="loginId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Login ID *</FormLabel>
                                <FormControl>
                                    <Input placeholder="auto-generated from name" {...field} disabled={isFormDisabled || (!isCurrentUserAdmin && isEditing)} />
                                </FormControl>
                                <FormDescription>Unique ID for signing in. Can only be changed by an Admin.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={control}
                            name="userKey"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>User Key (System ID)</FormLabel>
                                <FormControl>
                                    <Input placeholder="System-generated" {...field} readOnly disabled={true} />
                                </FormControl>
                                <FormDescription>This is a system-generated unique ID. It cannot be changed.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        {isEditing ? (
                            <div className="space-y-2">
                                <FormLabel>Password</FormLabel>
                                <div className="flex items-center gap-2">
                                    <Input type="password" value="••••••••••" readOnly disabled className="flex-1"/>
                                    <Button type="button" variant="secondary" onClick={handleSendPasswordReset} disabled={isSubmitting}>
                                        <Send className="mr-2 h-4 w-4"/> Send Password Reset
                                    </Button>
                                </div>
                                <FormDescription>
                                    An administrator cannot set a password directly. Click the button to send a secure reset link to the user's email.
                                </FormDescription>
                            </div>
                        ) : (
                            <FormField
                                control={control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password *</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="Minimum 6 characters" {...field} value={field.value ?? ''} disabled={isFormDisabled} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        
                        <Separator />

                        <div className="space-y-4 rounded-md border p-3">
                            <h3 className="text-sm font-medium text-muted-foreground">ID Proof Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={control} name="idProofType" render={({ field }) => (<FormItem><FormLabel>ID Proof Type</FormLabel><FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} disabled={isFormDisabled}/></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} disabled={isFormDisabled}/></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <FormItem>
                                <FormLabel>ID Proof Document</FormLabel>
                                <FormControl>
                                    <Input id="user-id-proof-file-input" type="file" accept="image/png, image/jpeg, image/webp, application/pdf" {...register('idProofFile')} disabled={isFormDisabled}/>
                                </FormControl>
                                <FormDescription>Supported formats: PNG, JPG, WEBP, PDF.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            {preview && (
                                <div className="relative group w-full h-48 mt-2 rounded-md overflow-hidden border">
                                    {preview.startsWith('data:application/pdf') ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                                            <FileIcon className="w-12 h-12 mb-2" />
                                            <p className="text-sm text-center">PDF Document Uploaded</p>
                                        </div>
                                    ) : (
                                        <Image src={preview} alt="ID Proof Preview" fill sizes="(max-width: 896px) 100vw, 896px" className="object-contain" />
                                    )}
                                    {!isReadOnly && 
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById('user-id-proof-file-input')?.click()}><Replace className="h-5 w-5"/><span className="sr-only">Replace Image</span></Button>
                                        <Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof}><Trash2 className="h-5 w-5"/><span className="sr-only">Delete Image</span></Button>
                                    </div>
                                    }
                                </div>
                            )}
                            {idProofFile?.length > 0 && !isReadOnly && (
                                <Button type="button" className="w-full" onClick={handleScanIdProof} disabled={isScanning || isFormDisabled}>
                                    {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                                    Scan ID Proof & Autofill
                                </Button>
                            )}
                        </div>

                        <Separator />
                        <FormField
                            control={control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Status *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Inactive users cannot log in.
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </TabsContent>
                <TabsContent value="organization" className="mt-6">
                    <div className="space-y-6">
                        <FormField
                            control={control}
                            name="organizationGroup"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization Group</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isFormDisabled}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Not a member" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {GROUPS.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormDescription>Assigning a group makes this user a public-facing organization member.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="organizationRole"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Organization Role/Position</FormLabel>
                                <FormControl><Input placeholder="e.g. President, Treasurer" {...field} value={field.value || ''} disabled={isFormDisabled} /></FormControl>
                                <FormDescription>The title they hold in the organization.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </TabsContent>
                <TabsContent value="permissions" className="mt-6">
                     <div className="space-y-6">
                        <FormField
                            control={control}
                            name="role"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-full">
                                    <div className="space-y-0.5">
                                        <FormLabel>Administrator Privileges *</FormLabel>
                                        <FormDescription>
                                            Grants full access to all modules.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value === 'Admin'}
                                            onCheckedChange={(checked) => field.onChange(checked ? 'Admin' : 'User')}
                                            disabled={isFormDisabled}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <FormLabel>Module Permissions</FormLabel>
                            <FormDescription>Set granular permissions for the user. These are ignored if the user has Administrator Privileges.</FormDescription>
                            <PermissionsTable 
                                permissions={permissions}
                                onPermissionChange={handlePermissionChange}
                                role={roleValue}
                                disabled={isFormDisabled}
                            />
                        </div>
                     </div>
                </TabsContent>
            </Tabs>
            {!isReadOnly && (
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSaveDisabled}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Saving...' : 'Save User'}
                </Button>
              </div>
            )}
        </form>
    </Form>
  );
}
