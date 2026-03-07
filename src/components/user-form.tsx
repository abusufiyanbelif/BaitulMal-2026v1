'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
import { useAuth, useFirestore, useMemoFirebase, useDoc, doc } from '@/firebase';
import { createAdminPermissions, type UserPermissions, GROUPS, GROUP_IDS } from '@/lib/modules';
import type { UserProfile } from '@/lib/types';
import { userFormSchema, type UserFormData } from '@/lib/schemas';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, Send, Replace, Trash2, FileIcon, ScanLine, Save, X } from 'lucide-react';
import { PermissionsTable } from './permissions-table';
import { set } from '@/lib/utils';
import { useSession as useCurrentUserSession } from '@/hooks/use-session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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
  const firestore = useFirestore();

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'user_config') : null, [firestore]);
  const { data: configSettings } = useDoc<any>(configRef);
  const mandatoryFields = useMemo(() => configSettings?.mandatoryFields || {}, [configSettings]);

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
    toast({ title: 'Image Marked For Deletion', description: 'The ID Proof Will Be Permanently Removed Upon Saving.', variant: 'default' });
  };

  const handleSendPasswordReset = async () => {
    if (!auth || !user?.email) {
        toast({ title: "Operation Error", description: "User Email Or Authentication Service Unavailable.", variant: "destructive"});
        return;
    }
    const actionCodeSettings = { url: `${window.location.origin}/login`, handleCodeInApp: false };
    try {
        await sendPasswordResetEmail(auth, user.email, actionCodeSettings);
        toast({ title: "Reset Email Dispatched", description: `A Secure Password Reset Link Has Been Sent To ${user.email}.`, variant: "success", duration: 10000 });
    } catch (error: any) {
        toast({ title: "Dispatch Failed", description: `Could Not Send Reset Link: ${error.message}`, variant: "destructive"});
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
        toast({ title: "No File Selected", description: "Please Upload An ID Proof Document To Proceed.", variant: "destructive" });
        return;
    }
    setIsScanning(true);
    toast({ title: "Scanning Document..." });
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        if (!dataUri) { setIsScanning(false); return; }
        try {
            const apiResponse = await fetch('/api/scan-id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUri: dataUri }) });
            if (!apiResponse.ok) throw new Error('API request failed');
            const response = await apiResponse.json();
            if (response) {
                if (response.name) setValue('name', response.name, { shouldValidate: true });
                if (response.aadhaarNumber) setValue('idNumber', response.aadhaarNumber, { shouldValidate:true });
                setValue('idProofType', 'Aadhaar', { shouldValidate: true });
                toast({ title: "Autofill Successful", variant: "success" });
            }
        } catch (error: any) {
            toast({ title: "Scan Failed", description: error.message || "Could Not Read Document.", variant: "destructive" });
        } finally { setIsScanning(false); }
    };
    reader.readAsDataURL(file);
  };

  const onFormSubmit = (formData: z.infer<typeof userFormSchema>) => {
      const dataWithPermissions: UserFormData = { ...formData, permissions: permissions };
      const missingFields: string[] = [];
      Object.entries(mandatoryFields).forEach(([field, isMandatory]) => {
          if (isMandatory && !dataWithPermissions[field as keyof UserFormData]) {
              missingFields.push(field);
          }
      });

      if (missingFields.length > 0) {
          toast({
              title: "Required Fields Missing",
              description: `Please Complete The Profile: ${missingFields.join(', ')}`,
              variant: "destructive",
          });
          return;
      }
      onSubmit(dataWithPermissions);
  };

  const renderLabel = (label: string, fieldName: string) => (
    <FormLabel className="font-bold text-primary">
        {label} {mandatoryFields[fieldName] ? '*' : ''}
    </FormLabel>
  );
  
  const isFormDisabled = isSubmitting || isLoading || isReadOnly;
  const isSaveDisabled = isSubmitting || (isEditing && !isDirty && !permissionsChanged);
  
  return (
    <Form {...form}>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 pt-4 text-primary font-normal">
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-primary/5 p-1 rounded-xl">
                    <TabsTrigger value="profile" className="font-bold data-[state=active]:shadow-sm">Profile</TabsTrigger>
                    <TabsTrigger value="organization" className="font-bold data-[state=active]:shadow-sm">Organization</TabsTrigger>
                    <TabsTrigger value="permissions" className="font-bold data-[state=active]:shadow-sm">Permissions</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="mt-6 space-y-6 animate-fade-in-up">
                    <FormField control={control} name="name" render={({ field }) => (<FormItem>{renderLabel('Full Name', 'name')}<FormControl><Input placeholder="e.g. Moosa Shaikh" {...field} disabled={isFormDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="email" render={({ field }) => (<FormItem>{renderLabel('Email Address', 'email')}<FormControl><Input type="email" placeholder="user@example.com" {...field} disabled={isFormDisabled || (isEditing && !isCurrentUserAdmin)} className="font-normal" /></FormControl><FormDescription className="font-normal text-xs opacity-70">Primary institutional contact and authentication identity.</FormDescription><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="phone" render={({ field }) => (<FormItem>{renderLabel('Phone Number', 'phone')}<FormControl><Input placeholder="10-digit mobile number" {...field} disabled={isFormDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name="loginId" render={({ field }) => (<FormItem>{renderLabel('Login ID', 'loginId')}<FormControl><Input placeholder="Auto-generated from name" {...field} disabled={isFormDisabled || (!isCurrentUserAdmin && isEditing)} className="font-normal" /></FormControl><FormDescription className="font-normal text-xs opacity-70">Unique identifier for account access.</FormDescription><FormMessage /></FormItem>)}/>
                        <FormField control={control} name="userKey" render={({ field }) => (<FormItem><FormLabel className="font-bold text-primary opacity-60">System ID (User Key)</FormLabel><FormControl><Input placeholder="System-generated" {...field} readOnly disabled={true} className="bg-muted/30 font-mono opacity-60 font-normal" /></FormControl></FormItem>)}/>
                    </div>
                    {isEditing ? (
                        <div className="space-y-2 rounded-xl border p-4 bg-muted/5">
                            <FormLabel className="font-bold text-primary">Password Management</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input type="password" value="••••••••••" readOnly disabled className="flex-1 opacity-50 font-normal"/>
                                <Button type="button" variant="secondary" onClick={handleSendPasswordReset} disabled={isSubmitting} className="font-bold text-xs"><Send className="mr-2 h-4 w-4"/> Dispatch Reset Link</Button>
                            </div>
                            <FormDescription className="font-normal text-xs opacity-70 italic">Administrators cannot set passwords directly. Dispatch a secure reset link to the member's email.</FormDescription>
                        </div>
                    ) : (
                        <FormField control={control} name="password" render={({ field }) => (<FormItem><FormLabel className="font-bold text-primary">Initial Password *</FormLabel><FormControl><Input type="password" placeholder="Minimum 6 Characters" {...field} value={field.value ?? ''} disabled={isFormDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                    )}
                    
                    <Separator className="bg-primary/10" />

                    <div className="space-y-4 rounded-xl border border-primary/5 p-4 bg-primary/[0.02]">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Verifiable Identification</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={control} name="idProofType" render={({ field }) => (<FormItem>{renderLabel('ID Proof Type', 'idProofType')}<FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                            <FormField control={control} name="idNumber" render={({ field }) => (<FormItem>{renderLabel('ID Number', 'idNumber')}<FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                        </div>
                        <FormItem>
                            {renderLabel('ID Proof Document', 'idProofFile')}
                            <FormControl><Input id="user-id-proof-file-input" type="file" accept="image/png, image/jpeg, image/webp, application/pdf" {...register('idProofFile')} disabled={isFormDisabled} className="font-normal" /></FormControl>
                        </FormItem>
                        {preview && (
                            <div className="relative group w-full h-48 mt-2 rounded-xl overflow-hidden border bg-white shadow-inner">
                                {preview.startsWith('data:application/pdf') || preview.endsWith('.pdf') ? ( <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4"><FileIcon className="w-12 h-12 mb-2" /><p className="text-sm text-center font-bold">PDF ARTIFACT UPLOADED</p></div> ) : ( <Image src={preview} alt="ID Proof Preview" fill sizes="100vw" className="object-contain" /> )}
                                {!isReadOnly && <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><Button type="button" size="icon" variant="outline" className="text-white border-white hover:bg-white/20" onClick={() => document.getElementById('user-id-proof-file-input')?.click()}><Replace className="h-5 w-5"/></Button><Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof}><Trash2 className="h-5 w-5"/></Button></div>}
                            </div>
                        )}
                        {idProofFile?.length > 0 && !isReadOnly && (
                            <Button type="button" className="w-full font-bold shadow-md active:scale-95 transition-transform" onClick={handleScanIdProof} disabled={isScanning || isFormDisabled}>{isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Scan ID Artifact & Autofill</Button>
                        )}
                    </div>

                    <Separator className="bg-primary/10" />
                    <FormField control={control} name="status" render={({ field }) => (<FormItem>{renderLabel('Account Status', 'status')}<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}><FormControl><SelectTrigger className="font-normal"><SelectValue/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Active" className="font-normal text-primary">Active</SelectItem><SelectItem value="Inactive" className="font-normal text-destructive">Inactive</SelectItem></SelectContent></Select><FormDescription className="font-normal text-xs opacity-70">Inactive Members Are Immediately Restricted From All System Access.</FormDescription></FormItem>)}/>
                </TabsContent>
                <TabsContent value="organization" className="mt-6 space-y-6 animate-fade-in-up">
                    <FormField control={control} name="organizationGroup" render={({ field }) => (<FormItem>{renderLabel('Organization Group', 'organizationGroup')}<Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isFormDisabled}><FormControl><SelectTrigger className="font-normal"><SelectValue/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="none" className="font-normal italic">-- Not A Public Member --</SelectItem>{GROUPS.map(g => <SelectItem key={g.id} value={g.id} className="font-normal">{g.name}</SelectItem>)}</SelectContent></Select><FormDescription className="font-normal text-xs opacity-70">Determines Visibility In The Public Team Directory.</FormDescription></FormItem>)}/>
                    <FormField control={control} name="organizationRole" render={({ field }) => (<FormItem>{renderLabel('Institutional Title', 'organizationRole')}<FormControl><Input placeholder="e.g. President, Treasurer" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                </TabsContent>
                <TabsContent value="permissions" className="mt-6 space-y-6 animate-fade-in-up">
                    <FormField control={control} name="role" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 bg-primary/[0.02] shadow-sm"><div className="space-y-0.5"><FormLabel className="font-bold text-primary text-base">Administrative Superuser</FormLabel><FormDescription className="font-normal text-xs opacity-70">Grant Unrestricted Global Access To All System Modules And Settings.</FormDescription></div><FormControl><Switch checked={field.value === 'Admin'} onCheckedChange={(checked) => field.onChange(checked ? 'Admin' : 'User')} disabled={isFormDisabled} /></FormControl></FormItem>)}/>
                    <div className="space-y-2">
                        <FormLabel className="font-bold text-primary">Granular Module Permissions</FormLabel>
                        <FormDescription className="font-normal text-xs opacity-70">Define Specific Access Levels Per Module. (Ignored If Superuser Status Is Active).</FormDescription>
                        <PermissionsTable permissions={permissions} onPermissionChange={handlePermissionChange} role={roleValue} disabled={isFormDisabled} />
                    </div>
                </TabsContent>
            </Tabs>
            {!isReadOnly && (
              <div className="flex justify-end gap-2 pt-6 border-t mt-6 bg-background/80 backdrop-blur-sm sticky bottom-0 p-4 z-50">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                <Button type="submit" disabled={isSaveDisabled} className="font-bold shadow-md transition-transform active:scale-95 px-8">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? 'Securing...' : 'Save Member Account'}
                </Button>
              </div>
            )}
        </form>
    </Form>
  );
}
