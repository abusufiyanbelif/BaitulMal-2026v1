
'use client';

import { z } from 'zod';
import type { UserPermissions } from './modules';

export const userFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address."}).optional().or(z.literal('')),
  phone: z.string().regex(/^\d{10}$/, { message: "Please enter a valid 10-digit mobile number." }).optional().or(z.literal('')),
  loginId: z.string().min(3, { message: "Login ID must be at least 3 characters." }).regex(/^[a-z0-9_.]+$/, { message: 'Login ID can only contain lowercase letters, numbers, underscores, and periods.' }),
  userKey: z.string().min(1, { message: 'User Key is required.'}),
  role: z.enum(['Admin', 'User', 'Donor', 'Beneficiary']),
  status: z.enum(['Active', 'Inactive']),
  gender: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  panNumber: z.string().optional(),
  idProofType: z.string().optional(),
  idNumber: z.string().optional(),
  idProofFile: z.any().optional(),
  idProofDeleted: z.boolean().optional(),
  password: z.string().optional(),
  telegramChatId: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
  whatsappNotificationsEnabled: z.boolean().optional(),
  organizationGroup: z.string().optional().or(z.literal('none')),
  organizationRole: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarName: z.string().optional(),
  aadhaarDob: z.string().optional(),
  aadhaarGender: z.string().optional(),
  aadhaarAddress: z.string().optional(),
  aadhaarProofFile: z.any().optional(),
  familyDetails: z.object({
    members: z.coerce.number().optional(),
    earningMembers: z.coerce.number().optional(),
    male: z.coerce.number().optional(),
    female: z.coerce.number().optional(),
    occupation: z.string().optional(),
  }).optional(),
  bankDetails: z.array(z.object({
    bankName: z.string(),
    accountNumber: z.string(),
    ifscCode: z.string(),
  })).optional(),
  upiIds: z.array(z.string()).optional(),
  _isEditing: z.boolean(),
})
.refine((data) => data.email || data.phone, {
  message: 'Either an Email or a Phone Number is required.',
  path: ['email'],
})
.refine((data) => {
  if (!data._isEditing) {
    return data.password && data.password.length >= 6;
  }
  return true;
}, {
  message: 'Password is required and must be at least 6 characters for new users.',
  path: ['password'],
});

export type UserFormData = z.infer<typeof userFormSchema> & { permissions: UserPermissions };
