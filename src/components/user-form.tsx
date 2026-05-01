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
import { useAuth, useFirestore, useMemoFirebase, useDoc, doc, sendPasswordResetEmail } from '@/firebase';
import { createAdminPermissions, type UserPermissions, GROUPS } from '@/lib/modules';
import type { UserProfile } from '@/lib/types';
import { userFormSchema, type UserFormData } from '@/lib/schemas';
import { Loader2, Send, Replace, Trash2, FileIcon, ScanLine, Save, X, MessageCircle, HelpCircle, Info, Landmark, Plus, SmartphoneNfc } from 'lucide-react';
import { PermissionsTable } from './permissions-table';
import { set, getInitials } from '@/lib/utils';
import { useSession as useCurrentUserSession } from '@/hooks/use-session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { sendTelegramAction, sendWhatsAppAction, writeInAppNotificationAction } from '@/app/messages/actions';
import { BellRing } from 'lucide-react';
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
  const [isSendingTelegramTest, setIsSendingTelegramTest] = useState(false);
  const [isSendingWhatsAppTest, setIsSendingWhatsAppTest] = useState(false);
  const [isSendingPushTest, setIsSendingPushTest] = useState(false);
  
  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email?.includes('@donor.demo.local') ? '' : user?.email || '',
      phone: user?.phone || '',
      userKey: user?.userKey || '',
      loginId: user?.loginId || '',
      role: (user?.role || 'User') as any,
      status: user?.status || 'Active',
      password: isEditing ? '' : 'password',
      telegramChatId: user?.telegramChatId || '',
      notificationsEnabled: user?.notificationsEnabled ?? true,
      whatsappNotificationsEnabled: user?.whatsappNotificationsEnabled ?? true,
      idProofType: user?.idProofType || '',
      idNumber: user?.idNumber || '',
      organizationGroup: (user?.organizationGroup as string) || 'none',
      organizationRole: user?.organizationRole || '',
      aadhaarNumber: user?.aadhaarNumber || '',
      aadhaarName: user?.aadhaarName || '',
      aadhaarDob: user?.aadhaarDob || '',
      gender: user?.gender || '',
      dob: user?.dob || '',
      address: user?.address || '',
      panNumber: user?.panNumber || '',
      familyDetails: user?.familyDetails || {
        members: 1,
        earningMembers: 0,
        male: 0,
        female: 0,
        occupation: '',
      },
      bankDetails: user?.bankDetails || [{ bankName: '', accountNumber: '', ifscCode: '' }],
      upiIds: user?.upiIds || [''],
      _isEditing: isEditing,
      idProofDeleted: false,
    },
  });

  const { control, watch, setValue, register, handleSubmit, getValues, formState: { isDirty }, reset } = form;
  const nameValue = watch('name');
  const roleValue = watch('role');
  const idProofFile = watch('idProofFile');

  const [preview, setPreview] = useState<string | null>(user?.idProofUrl || null);
  
  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        email: user.email?.includes('@donor.demo.local') ? '' : user.email || '',
        phone: user.phone || '',
        userKey: user.userKey || '',
        loginId: user.loginId || '',
        role: (user.role || 'User') as any,
        status: user.status || 'Active',
        password: '',
        telegramChatId: user.telegramChatId || '',
        notificationsEnabled: user.notificationsEnabled ?? true,
        whatsappNotificationsEnabled: user.whatsappNotificationsEnabled ?? true,
        idProofType: user.idProofType || '',
        idNumber: user.idNumber || '',
        organizationGroup: (user.organizationGroup as string) || 'none',
        organizationRole: user.organizationRole || '',
        aadhaarNumber: user.aadhaarNumber || '',
        aadhaarName: user.aadhaarName || '',
        aadhaarDob: user.aadhaarDob || '',
        aadhaarGender: user.aadhaarGender || '',
        aadhaarAddress: user.aadhaarAddress || '',
        gender: user.gender || '',
        dob: user.dob || '',
        address: user.address || '',
        panNumber: user.panNumber || '',
        phone: user.phone ? user.phone.replace(/\D/g, '').slice(-10) : '',
        familyDetails: user.familyDetails || {
            members: 1,
            earningMembers: 0,
            male: 0,
            female: 0,
            occupation: '',
        },
        bankDetails: user.bankDetails || [{ bankName: '', accountNumber: '', ifscCode: '' }],
        upiIds: user.upiIds || [''],
        _isEditing: isEditing,
        idProofDeleted: false,
      });
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
  
  const aadhaarProofFile = watch('aadhaarProofFile');

  useEffect(() => {
    const fileList = aadhaarProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setAadhaarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAadhaarPreview(user?.aadhaarProofUrl || null);
    }
  }, [aadhaarProofFile, user?.aadhaarProofUrl]);
  const handleTestTelegram = async (chatId: string) => {
      if (!chatId) {
          toast({ title: "Test Failed", description: "Please enter a valid Telegram Chat ID.", variant: "destructive" });
          return;
      }
      try {
          setIsSendingTelegramTest(true);
          const res = await sendTelegramAction({ 
              message: `🔔 Test Notification from BaitulMal Admin Panel.\nYour Telegram alerts are now active for Chat ID: ${chatId}.`, 
              chatId, 
              bypassAutoCheck: true 
          });
          if (res.success) {
              toast({ title: "Telegram Test Sent", description: "The message was successfully transmitted.", variant: "success" });
          } else {
              toast({ 
                  title: "Telegram Test Failed", 
                  description: res.message || "Ensure you have clicked /start on the designated bot first.", 
                  variant: "destructive" 
              });
          }
      } catch (err: any) {
          toast({ title: "Error", description: err.message || "Failed to transmit test message.", variant: "destructive" });
      } finally {
          setIsSendingTelegramTest(false);
      }
  };

  const handleTestWhatsApp = async (phone: string) => {
      if (!phone) {
          toast({ title: "Test Failed", description: "Please enter a valid Phone Number.", variant: "destructive" });
          return;
      }
      try {
          setIsSendingWhatsAppTest(true);
          const res = await sendWhatsAppAction({ 
              to: phone, 
              customMessage: `🔔 Test Notification from BaitulMal Admin Panel.\nYour WhatsApp alerts are now active for Phone: ${phone}.`, 
              bypassAutoCheck: true 
          });
          if (res.success) {
              toast({ title: "WhatsApp Test Sent", description: "The message was successfully transmitted.", variant: "success" });
          } else {
              toast({ title: "WhatsApp Test Failed", description: res.message || "Failed to transmit WhatsApp test.", variant: "destructive" });
          }
      } catch (err: any) {
          toast({ title: "Error", description: err.message || "Failed to transmit WhatsApp test.", variant: "destructive" });
      } finally {
          setIsSendingWhatsAppTest(false);
      }
  };

  const handleTestPushNotification = async () => {
      if (!user?.id) {
          toast({ title: "Test Failed", description: "User ID missing for push notification.", variant: "destructive" });
          return;
      }
      try {
          setIsSendingPushTest(true);
          await writeInAppNotificationAction({ 
              userId: user.id, 
              title: "🔔 Test Notification", 
              body: "Your system push notifications are operational.", 
              module: "system" 
          });
          toast({ title: "Push Notification Sent", description: "The test notification was generated successfully.", variant: "success" });
      } catch (err: any) {
          toast({ title: "Error", description: err.message || "Failed to trigger push notification.", variant: "destructive" });
      } finally {
          setIsSendingPushTest(false);
      }
  };

  const handleDeleteProof = () => {
    setValue('idProofFile', null);
    setValue('idProofDeleted', true);
    setPreview(null);
    toast({ title: 'Image Marked For Deletion' });
  };

  const handleSendPasswordReset = async () => {
    if (!auth || !user?.email) {
        toast({ title: "Operation Error", description: "User Email Or Auth Service Unavailable.", variant: "destructive"});
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
  
  const [isScanningAadhaar, setIsScanningAadhaar] = useState(false);
  const [aadhaarPreview, setAadhaarPreview] = useState<string | null>(user?.aadhaarProofUrl || null);

  const handleScanAadhaarCard = async () => {
    const fileList = getValues('aadhaarProofFile') as FileList | undefined;
    
    // Scan existing uploaded URL if no new file is selected
    if ((!fileList || fileList.length === 0) && aadhaarPreview) {
        setIsScanningAadhaar(true);
        toast({ title: "Analyzing Existing Aadhaar..." });
        try {
            const apiResponse = await fetch('/api/scan-aadhaar', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ photoDataUri: aadhaarPreview }) 
            });
            if (!apiResponse.ok) throw new Error('API Request Failed');
            const response = await apiResponse.json();
            if (response) {
                if (response.aadhaarNumber) setValue('aadhaarNumber', response.aadhaarNumber, { shouldValidate: true });
                if (response.aadhaarName) setValue('aadhaarName', response.aadhaarName, { shouldValidate: true });
                if (response.aadhaarDob) setValue('aadhaarDob', response.aadhaarDob, { shouldValidate: true });
                if (response.aadhaarGender) setValue('aadhaarGender', response.aadhaarGender, { shouldValidate: true });
                if (response.aadhaarAddress) setValue('aadhaarAddress', response.aadhaarAddress, { shouldValidate: true });
                toast({ title: "Aadhaar Extracted Successfully", variant: "success" });
            }
        } catch (error: any) {
            toast({ title: "Extraction Failed", description: error.message || "Could Not Analyze Aadhaar.", variant: "destructive" });
        } finally { 
            setIsScanningAadhaar(false); 
        }
        return;
    }

    if (!fileList || fileList.length === 0) {
        toast({ title: "No File Selected", description: "Please Upload An Aadhaar Card Image To Proceed.", variant: "destructive" });
        return;
    }

    setIsScanningAadhaar(true);
    toast({ title: "Analyzing Aadhaar..." });
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        if (!dataUri) { setIsScanningAadhaar(false); return; }
        try {
            const apiResponse = await fetch('/api/scan-aadhaar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUri: dataUri }) });
            if (!apiResponse.ok) throw new Error('API Request Failed');
            const response = await apiResponse.json();
            if (response) {
                if (response.aadhaarNumber) setValue('aadhaarNumber', response.aadhaarNumber, { shouldValidate: true });
                if (response.aadhaarName) setValue('aadhaarName', response.aadhaarName, { shouldValidate: true });
                if (response.aadhaarDob) setValue('aadhaarDob', response.aadhaarDob, { shouldValidate: true });
                if (response.aadhaarGender) setValue('aadhaarGender', response.aadhaarGender, { shouldValidate: true });
                if (response.aadhaarAddress) setValue('aadhaarAddress', response.aadhaarAddress, { shouldValidate: true });
                toast({ title: "Aadhaar Extracted Successfully", variant: "success" });
            }
        } catch (error: any) {
            toast({ title: "Extraction Failed", description: error.message || "Could Not Analyze Aadhaar.", variant: "destructive" });
        } finally { setIsScanningAadhaar(false); }
    };
    reader.readAsDataURL(file);
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
            if (!apiResponse.ok) throw new Error('API Request Failed');
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
        <form onSubmit={handleSubmit(onFormSubmit as any)} className="flex flex-col h-full overflow-hidden bg-white">
            <div className="flex-1 min-h-0 relative flex flex-col">
                <ScrollArea className="flex-1 w-full">
                    <div className="px-6 py-4 space-y-6 text-primary font-normal pb-24">
                        <Tabs defaultValue="profile" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-primary/5 p-1 rounded-xl">
                                <TabsTrigger value="profile" className="font-bold data-[state=active]:shadow-sm">Profile</TabsTrigger>
                                <TabsTrigger value="organization" className="font-bold data-[state=active]:shadow-sm">Organization</TabsTrigger>
                                <TabsTrigger value="permissions" className="font-bold data-[state=active]:shadow-sm">Permissions</TabsTrigger>
                            </TabsList>
                            <TabsContent value="profile" className="mt-6 space-y-6 animate-fade-in-up">
                                <FormField control={control as any} name="name" render={({ field }) => (<FormItem>{renderLabel('Full Name', 'name')}<FormControl><Input placeholder="e.g. Moosa Shaikh" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={control as any} name="email" render={({ field }) => (<FormItem>{renderLabel('Email Address', 'email')}<FormControl><Input type="email" placeholder="user@example.com" {...field} value={field.value || ''} disabled={isFormDisabled || (isEditing && !isCurrentUserAdmin)} className="font-normal" /></FormControl><FormDescription className="font-normal text-xs opacity-70">Primary Institutional Contact And Authentication Identity.</FormDescription><FormMessage /></FormItem>)}/>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control as any} name="gender" render={({ field }) => (
                                        <FormItem>
                                            {renderLabel('Gender', 'gender')}
                                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={isFormDisabled}>
                                                <FormControl><SelectTrigger className="font-normal"><SelectValue placeholder="Select Gender"/></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={control as any} name="dob" render={({ field }) => (
                                        <FormItem>
                                            {renderLabel('Date of Birth', 'dob')}
                                            <FormControl><Input type="date" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <FormField control={control as any} name="address" render={({ field }) => (
                                    <FormItem>
                                        {renderLabel('Residential Address', 'address')}
                                        <FormControl><Input placeholder="Full Address" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={control as any} name="panNumber" render={({ field }) => (
                                    <FormItem>
                                        {renderLabel('PAN Number', 'panNumber')}
                                        <FormControl><Input placeholder="ABCDE1234F" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-mono font-normal" /></FormControl>
                                        <FormDescription className="font-normal text-[10px] opacity-70 italic tracking-tighter">Required For 80G Tax Exemption Certificates.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                 <FormField control={control as any} name="phone" render={({ field }) => (
                                     <FormItem>
                                         {renderLabel('Phone Number', 'phone')}
                                         <div className="flex gap-2">
                                             <div className="w-28 shrink-0">
                                                 <Select 
                                                     defaultValue="+91" 
                                                     disabled={isFormDisabled}
                                                 >
                                                     <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold">
                                                         <SelectValue placeholder="+91" />
                                                     </SelectTrigger>
                                                     <SelectContent className="rounded-xl shadow-dropdown border-primary/10">
                                                         <SelectItem value="+91" className="font-bold">🇮🇳 +91</SelectItem>
                                                         <SelectItem value="+1" className="font-bold">🇺🇸 +1</SelectItem>
                                                         <SelectItem value="+44" className="font-bold">🇬🇧 +44</SelectItem>
                                                         <SelectItem value="+971" className="font-bold">🇦🇪 +971</SelectItem>
                                                         <SelectItem value="+966" className="font-bold">🇸🇦 +966</SelectItem>
                                                     </SelectContent>
                                                 </Select>
                                             </div>
                                             <FormControl>
                                                 <Input 
                                                     placeholder="10-Digit Mobile Number" 
                                                     {...field} 
                                                     maxLength={10}
                                                     onChange={(e) => {
                                                         const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                         field.onChange(val);
                                                     }}
                                                     disabled={isFormDisabled} 
                                                     className="h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl font-bold flex-1" 
                                                 />
                                             </FormControl>
                                             {field.value && field.value.length === 10 && (
                                                 <Button 
                                                     type="button" 
                                                     variant="outline" 
                                                     size="icon" 
                                                     className="h-12 w-12 shrink-0 border-green-200 text-green-600 hover:bg-green-50 rounded-xl"
                                                     onClick={() => {
                                                         window.open(`https://wa.me/91${field.value}`, '_blank');
                                                     }}
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                         <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.973L0 16l4.204-1.102a7.923 7.923 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                                     </svg>
                                                 </Button>
                                             )}
                                         </div>
                                         <FormMessage />
                                     </FormItem>
                                 )}/>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={control as any} name="loginId" render={({ field }) => (<FormItem>{renderLabel('Login ID', 'loginId')}<FormControl><Input placeholder="Auto-generated from name" {...field} value={field.value || ''} disabled={isFormDisabled || (!isCurrentUserAdmin && isEditing)} className="font-normal" /></FormControl><FormDescription className="font-normal text-xs opacity-70">Unique Identifier For Account Access.</FormDescription><FormMessage /></FormItem>)}/>
                                    <FormField control={control as any} name="userKey" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-primary opacity-60">System ID (User Key)</FormLabel>
                                            <FormControl><Input placeholder="System-Generated" {...field} value={field.value || ''} readOnly disabled={true} className="bg-muted/30 font-mono opacity-60 font-normal" /></FormControl>
                                        </FormItem>
                                    )}/>
                                </div>
                                <FormField 
                                    control={control as any} 
                                    name="password" 
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-primary">
                                                {isEditing ? 'Reset Password' : 'Initial Password *'}
                                            </FormLabel>
                                            <div className="flex gap-2">
                                                <FormControl>
                                                    <Input 
                                                        type="password" 
                                                        placeholder={isEditing ? "Enter new password to reset" : "Minimum 6 Characters"} 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        disabled={isFormDisabled} 
                                                        className="font-normal flex-1" 
                                                    />
                                                </FormControl>
                                                {isEditing && (
                                                    <Button 
                                                        type="button" 
                                                        variant="secondary" 
                                                        onClick={handleSendPasswordReset} 
                                                        disabled={isSubmitting} 
                                                        className="font-bold text-xs shrink-0"
                                                    >
                                                        <Send className="mr-2 h-4 w-4"/> Dispatch Reset Link
                                                    </Button>
                                                )}
                                            </div>
                                            <FormDescription className="font-normal text-xs opacity-70">
                                                {isEditing 
                                                    ? "Leave blank to keep current password. Typing a value will directly reset it." 
                                                    : "Primary credential for first-time authentication."}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <Separator className="bg-primary/10" />

                                <div className="space-y-4 rounded-xl border border-primary/5 p-4 bg-blue-500/[0.02]">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle className="h-4 w-4 text-blue-500" />
                                        <h3 className="text-sm font-bold text-primary capitalize tracking-widest">Telegram Notifications</h3>
                                    </div>
                                    <FormField control={control as any} name="telegramChatId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-primary">Telegram Chat ID</FormLabel>
                                            <div className="bg-white/80 p-4 rounded-xl border border-blue-100 shadow-sm space-y-3 text-xs mb-3 mt-1">
                                                 <p className="font-bold text-blue-900 flex items-center gap-1">
                                                     <HelpCircle className="h-4 w-4 text-blue-600" /> How to find your Telegram Chat ID?
                                                 </p>
                                                 <ol className="list-decimal list-inside space-y-2 text-primary/80 font-normal leading-relaxed">
                                                     <li>Open <span className="font-bold text-blue-600">Telegram</span> on your mobile or PC.</li>
                                                     <li>Search for the bot <span className="font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-mono select-all">@userinfobot</span> or <span className="font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-mono select-all font-normal">@GetMyChatID_Bot</span>.</li>
                                                     <li>Click <span className="font-bold text-blue-800">START</span> or send any message.</li>
                                                     <li>The bot will instantly reply with your <span className="font-bold text-blue-800">Id</span> (a numeric string like <span className="font-mono">87452695</span>).</li>
                                                     <li><span className="font-bold">Copy</span> that number and paste it below.</li>
                                                 </ol>
                                                 <div className="bg-amber-50 border border-amber-200/50 p-2 rounded-lg text-[11px] text-amber-800 font-medium flex items-start gap-2">
                                                     <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                                     <span><strong>IMPORTANT:</strong> You MUST click <strong>START</strong> on our institutional notification bot before testing or receiving live updates.</span>
                                                 </div>
                                             </div>
                                            <FormControl>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        placeholder="e.g. 123456789" 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        disabled={isFormDisabled} 
                                                        className="font-mono font-normal flex-1" 
                                                    />
                                                    <Button 
                                                        type="button"
                                                        variant="outline"
                                                        size="default"
                                                        disabled={isFormDisabled || !field.value || isSendingTelegramTest}
                                                        onClick={() => handleTestTelegram(field.value)}
                                                        className="font-bold text-xs shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        {isSendingTelegramTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                                        Test
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormDescription className="font-normal text-xs opacity-70">
                                                Personal Telegram Chat ID for receiving direct alerts. Message @userinfobot on Telegram to get your ID.
                                            </FormDescription>
                                        </FormItem>
                                    )}/>
                                </div>

                                <Separator className="bg-primary/10" />

                                {roleValue === 'Beneficiary' && (
                                    <div className="space-y-6 rounded-xl border border-primary/5 p-4 bg-primary/[0.02] animate-fade-in-up">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-primary" />
                                            <h3 className="text-sm font-bold text-primary capitalize tracking-widest">Family & Occupation</h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <FormField control={control as any} name="familyDetails.members" render={({ field }) => (
                                                <FormItem>
                                                    {renderLabel('Total Members', 'familyDetails.members')}
                                                    <FormControl><Input type="number" {...field} value={field.value ?? 1} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                                </FormItem>
                                            )}/>
                                            <FormField control={control as any} name="familyDetails.earningMembers" render={({ field }) => (
                                                <FormItem>
                                                    {renderLabel('Earning Members', 'familyDetails.earningMembers')}
                                                    <FormControl><Input type="number" {...field} value={field.value ?? 0} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                                </FormItem>
                                            )}/>
                                            <FormField control={control as any} name="familyDetails.male" render={({ field }) => (
                                                <FormItem>
                                                    {renderLabel('Male', 'familyDetails.male')}
                                                    <FormControl><Input type="number" {...field} value={field.value ?? 0} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                                </FormItem>
                                            )}/>
                                            <FormField control={control as any} name="familyDetails.female" render={({ field }) => (
                                                <FormItem>
                                                    {renderLabel('Female', 'familyDetails.female')}
                                                    <FormControl><Input type="number" {...field} value={field.value ?? 0} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                                </FormItem>
                                            )}/>
                                        </div>
                                        <FormField control={control as any} name="familyDetails.occupation" render={({ field }) => (
                                            <FormItem>
                                                {renderLabel('Primary Occupation', 'familyDetails.occupation')}
                                                <FormControl><Input placeholder="e.g. Daily Wage Laborer" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                            </FormItem>
                                        )}/>
                                    </div>
                                )}

                                <Separator className="bg-primary/10" />

                                <div className="space-y-4 rounded-xl border border-primary/5 p-4 bg-primary/[0.02]">
                                    <h3 className="text-sm font-bold text-primary capitalize tracking-widest">Identification Evidence</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={control as any} name="idProofType" render={({ field }) => (<FormItem>{renderLabel('ID Proof Type', 'idProofType')}<FormControl><Input placeholder="Aadhaar, PAN, etc." {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                        <FormField control={control as any} name="idNumber" render={({ field }) => (<FormItem>{renderLabel('ID Number', 'idNumber')}<FormControl><Input placeholder="e.g. XXXX XXXX 1234" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    </div>
                                    <FormItem>
                                        {renderLabel('ID Proof Document', 'idProofFile')}
                                        <FormControl><Input id="user-id-proof-file-input" type="file" accept="image/png, image/jpeg, image/webp, application/pdf" {...register('idProofFile')} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                    </FormItem>
                                    {preview && (
                                        <div className="relative group w-full h-48 mt-2 rounded-xl overflow-hidden border bg-white shadow-inner">
                                            {preview.startsWith('data:application/pdf') || preview.endsWith('.pdf') ? ( <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4"><FileIcon className="w-12 h-12 mb-2" /><p className="text-sm text-center font-bold">PDF Artifact Uploaded</p></div> ) : ( <Image src={preview} alt="ID Proof Preview" fill sizes="100vw" className="object-contain" /> )}
                                            {!isReadOnly && <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><Button type="button" size="icon" variant="outline" className="text-white border-white hover:bg-white/20" onClick={() => document.getElementById('user-id-proof-file-input')?.click()}><Replace className="h-5 w-5"/></Button><Button type="button" size="icon" variant="destructive" onClick={handleDeleteProof}><Trash2 className="h-5 w-5"/></Button></div>}
                                        </div>
                                    )}
                                    {idProofFile && idProofFile.length > 0 && !isReadOnly && (
                                        <Button type="button" className="w-full font-bold shadow-md active:scale-95 transition-transform" onClick={handleScanIdProof} disabled={isScanning || isFormDisabled}>{isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Scan ID Artifact & Autofill</Button>
                                    )}
                                </div>

                                <div className="space-y-4 rounded-xl border border-primary/5 p-4 bg-primary/[0.02]">
                                    <h3 className="text-sm font-bold text-primary capitalize tracking-widest flex items-center gap-2">
                                        <ScanLine className="h-4 w-4" /> Aadhaar Card Verification
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={control as any} name="aadhaarNumber" render={({ field }) => (<FormItem>{renderLabel('Aadhaar Number', 'aadhaarNumber')}<FormControl><Input placeholder="12 Digit Number" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-mono" /></FormControl></FormItem>)}/>
                                        <FormField control={control as any} name="aadhaarName" render={({ field }) => (<FormItem>{renderLabel('Name on Aadhaar', 'aadhaarName')}<FormControl><Input placeholder="Full Name" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={control as any} name="aadhaarDob" render={({ field }) => (<FormItem>{renderLabel('Date of Birth', 'aadhaarDob')}<FormControl><Input placeholder="YYYY-MM-DD" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                        <FormField control={control as any} name="aadhaarGender" render={({ field }) => (<FormItem>{renderLabel('Gender', 'aadhaarGender')}<FormControl><Input placeholder="Male / Female" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    </div>
                                    <FormField control={control as any} name="aadhaarAddress" render={({ field }) => (<FormItem>{renderLabel('Address on Aadhaar', 'aadhaarAddress')}<FormControl><Input placeholder="Full Residential Address" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                                    
                                    <FormItem>
                                        {renderLabel('Aadhaar Card Document', 'aadhaarProofFile')}
                                        <FormControl><Input id="user-aadhaar-proof-file-input" type="file" accept="image/png, image/jpeg, image/webp" {...register('aadhaarProofFile')} disabled={isFormDisabled} className="font-normal" /></FormControl>
                                    </FormItem>

                                    {aadhaarPreview && (
                                        <div className="relative group w-full h-48 mt-2 rounded-xl overflow-hidden border bg-white shadow-inner">
                                            <Image src={aadhaarPreview} alt="Aadhaar Preview" fill sizes="100vw" className="object-contain" />
                                            {!isReadOnly && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <Button type="button" size="icon" variant="outline" className="text-white border-white hover:bg-white/20" onClick={() => document.getElementById('user-aadhaar-proof-file-input')?.click()}><Replace className="h-5 w-5"/></Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(aadhaarPreview || (aadhaarProofFile && aadhaarProofFile.length > 0)) && !isReadOnly && (
                                        <Button type="button" className="w-full font-bold shadow-md active:scale-95 transition-transform" onClick={handleScanAadhaarCard} disabled={isScanningAadhaar || isFormDisabled}>
                                            {isScanningAadhaar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Scan Aadhaar & Autofill
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-4 rounded-xl border border-primary/5 p-4 bg-amber-500/[0.02]">
                                    <div className="flex items-center gap-2">
                                        <BellRing className="h-4 w-4 text-amber-500" />
                                        <h3 className="text-sm font-bold text-primary capitalize tracking-widest">Cross-Channel Notifications</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField 
                                            control={control as any} 
                                            name="notificationsEnabled" 
                                            render={({ field }) => (
                                                <FormItem className="flex items-center justify-between rounded-xl border border-primary/5 p-4 bg-white shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="font-bold text-sm text-primary">Push Alerts</FormLabel>
                                                        <FormDescription className="text-xs font-normal">Enable in-app/system tray alerts.</FormDescription>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            disabled={isFormDisabled || isSendingPushTest}
                                                            onClick={handleTestPushNotification}
                                                            className="font-bold text-xs shrink-0 h-8 border-primary/10 text-primary"
                                                        >
                                                            {isSendingPushTest ? <Loader2 className="h-3 w-3 animate-spin"/> : <Send className="h-3 w-3 mr-1"/>}
                                                            Test
                                                        </Button>
                                                        <FormControl>
                                                            <Switch 
                                                                checked={field.value} 
                                                                onCheckedChange={field.onChange} 
                                                                disabled={isFormDisabled} 
                                                            />
                                                        </FormControl>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField 
                                            control={control as any} 
                                            name="whatsappNotificationsEnabled" 
                                            render={({ field }) => (
                                                <FormItem className="flex items-center justify-between rounded-xl border border-primary/5 p-4 bg-white shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="font-bold text-sm text-primary">WhatsApp Alerts</FormLabel>
                                                        <FormDescription className="text-xs font-normal">Enable automated WhatsApp updates.</FormDescription>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            disabled={isFormDisabled || !getValues('phone') || isSendingWhatsAppTest}
                                                            onClick={() => handleTestWhatsApp(getValues('phone') || '')}
                                                            className="font-bold text-xs shrink-0 h-8 border-green-100 text-green-600 hover:bg-green-50"
                                                        >
                                                            {isSendingWhatsAppTest ? <Loader2 className="h-3 w-3 animate-spin"/> : <Send className="h-3 w-3 mr-1"/>}
                                                            Test
                                                        </Button>
                                                        <FormControl>
                                                            <Switch 
                                                                checked={field.value} 
                                                                onCheckedChange={field.onChange} 
                                                                disabled={isFormDisabled} 
                                                            />
                                                        </FormControl>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-primary/10" />
                                <FormField control={control as any} name="status" render={({ field }) => (
                                    <FormItem>
                                        {renderLabel('Account Status', 'status')}
                                        <Select onValueChange={field.onChange} value={field.value || 'Active'} disabled={isFormDisabled}>
                                            <FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-[12px] shadow-dropdown">
                                                <SelectItem value="Active" className="font-normal text-primary">Active</SelectItem>
                                                <SelectItem value="Inactive" className="font-normal text-destructive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="font-normal text-xs opacity-70">Inactive Members Are Immediately Restricted From All System Access.</FormDescription>
                                    </FormItem>
                                )}/>

                                 <Separator className="bg-primary/10" />
                                 
                                 <div className="space-y-6">
                                     <div className="flex items-center justify-between">
                                         <h3 className="text-sm font-bold text-primary capitalize tracking-widest flex items-center gap-2">
                                             <Landmark className="h-4 w-4" /> Settlement & Bank Accounts
                                         </h3>
                                         <Button type="button" variant="outline" size="sm" onClick={() => setValue('bankDetails', [...(watch('bankDetails') || []), { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-8 text-[10px] font-bold uppercase rounded-xl border-primary/10">
                                             <Plus className="h-3 w-3 mr-1" /> Add Account
                                         </Button>
                                     </div>
                                     <div className="space-y-4">
                                         {(watch('bankDetails') || []).map((_, idx) => (
                                             <div key={idx} className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 relative group">
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                     <FormField control={control as any} name={`bankDetails.${idx}.bankName`} render={({ field }) => (
                                                         <FormItem>
                                                             <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Name</FormLabel>
                                                             <FormControl><Input {...field} placeholder="e.g. HDFC Bank" className="h-10 text-xs font-bold rounded-xl border-primary/5 bg-white" /></FormControl>
                                                         </FormItem>
                                                     )}/>
                                                     <FormField control={control as any} name={`bankDetails.${idx}.accountNumber`} render={({ field }) => (
                                                         <FormItem>
                                                             <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Number</FormLabel>
                                                             <FormControl><Input {...field} placeholder="Account No" className="h-10 text-xs font-bold rounded-xl border-primary/5 bg-white" /></FormControl>
                                                         </FormItem>
                                                     )}/>
                                                 </div>
                                                 <FormField control={control as any} name={`bankDetails.${idx}.ifscCode`} render={({ field }) => (
                                                     <FormItem>
                                                         <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IFSC Code</FormLabel>
                                                         <FormControl><Input {...field} placeholder="IFSC" className="h-10 text-xs font-bold rounded-xl border-primary/5 bg-white font-mono uppercase" /></FormControl>
                                                     </FormItem>
                                                 )}/>
                                                 {(watch('bankDetails') || []).length > 1 && (
                                                     <Button type="button" variant="ghost" size="icon" onClick={() => setValue('bankDetails', (watch('bankDetails') || []).filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-red-100 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <X className="h-3 w-3" />
                                                     </Button>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 </div>

                                 <Separator className="bg-primary/10" />

                                 <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                         <h3 className="text-sm font-bold text-primary capitalize tracking-widest flex items-center gap-2">
                                             <SmartphoneNfc className="h-4 w-4" /> UPI Identities
                                         </h3>
                                         <Button type="button" variant="outline" size="sm" onClick={() => setValue('upiIds', [...(watch('upiIds') || []), ''])} className="h-8 text-[10px] font-bold uppercase rounded-xl border-primary/10">
                                             <Plus className="h-3 w-3 mr-1" /> Add UPI
                                         </Button>
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         {(watch('upiIds') || []).map((_, idx) => (
                                             <FormField key={idx} control={control as any} name={`upiIds.${idx}`} render={({ field }) => (
                                                 <FormItem className="relative group">
                                                     <FormControl>
                                                         <div className="flex gap-2">
                                                            <Input {...field} placeholder="handle@upi" className="h-11 text-xs font-bold rounded-xl border-primary/5 bg-white font-mono" />
                                                            {(watch('upiIds') || []).length > 1 && (
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => setValue('upiIds', (watch('upiIds') || []).filter((_, i) => i !== idx))} className="h-11 w-11 rounded-xl text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                         </div>
                                                     </FormControl>
                                                 </FormItem>
                                             )}/>
                                         ))}
                                     </div>
                                 </div>
                            </TabsContent>
                            <TabsContent value="organization" className="mt-6 space-y-6 animate-fade-in-up">
                                <FormField control={control as any} name="role" render={({ field }: any) => (
                                    <FormItem>
                                        {renderLabel('Access Role', 'role')}
                                        <Select onValueChange={field.onChange} value={field.value || 'User'} disabled={isFormDisabled}>
                                            <FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-[12px] shadow-dropdown">
                                                <SelectItem value="Admin" className="font-bold text-red-600">Admin (Superuser)</SelectItem>
                                                <SelectItem value="User" className="font-normal">User (Standard)</SelectItem>
                                                <SelectItem value="Donor" className="font-normal">Donor (Portal only)</SelectItem>
                                                <SelectItem value="Beneficiary" className="font-normal">Beneficiary (Portal only)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}/>
                                <FormField control={control as any} name="organizationGroup" render={({ field }) => (
                                    <FormItem>
                                        {renderLabel('Organization Group', 'organizationGroup')}
                                        <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isFormDisabled}>
                                            <FormControl><SelectTrigger className="font-normal"><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-[12px] shadow-dropdown">
                                                <SelectItem value="none" className="font-normal italic">-- Not A Public Member --</SelectItem>
                                                {GROUPS.map(g => <SelectItem key={g.id} value={g.id} className="font-normal">{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="font-normal text-xs opacity-70">Determines Visibility In The Public Team Directory.</FormDescription>
                                    </FormItem>
                                )}/>
                                <FormField control={control as any} name="organizationRole" render={({ field }: any) => (<FormItem>{renderLabel('Institutional Title', 'organizationRole')}<FormControl><Input placeholder="e.g. President, Treasurer" {...field} value={field.value || ''} disabled={isFormDisabled} className="font-normal" /></FormControl></FormItem>)}/>
                            </TabsContent>
                            <TabsContent value="permissions" className="mt-6 space-y-6 animate-fade-in-up">
                                <div className="space-y-2">
                                    <FormLabel className="font-bold text-primary">Granular Module Permissions</FormLabel>
                                    <FormDescription className="font-normal text-xs opacity-70">Define Specific Access Levels Per Module. (Ignored If Admin Status Is Active).</FormDescription>
                                    <PermissionsTable permissions={permissions} onPermissionChange={handlePermissionChange} role={roleValue === 'Admin' ? 'Admin' : 'User'} disabled={isFormDisabled} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </div>
            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t mt-auto bg-background/80 backdrop-blur-sm sticky bottom-0 p-4 z-50 shrink-0">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                <Button type="submit" disabled={isSaveDisabled} className="w-full sm:w-auto font-bold shadow-md transition-transform active:scale-95 px-8">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? 'Securing...' : 'Save Member Account'}
                </Button>
              </div>
            )}
        </form>
    </Form>
  );
}