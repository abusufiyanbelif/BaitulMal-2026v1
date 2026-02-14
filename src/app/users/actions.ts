'use server';

import type { UserProfile } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/components/user-form';

const notImplemented = { success: false, message: 'Admin actions are temporarily disabled to resolve a server startup issue.' };

export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
  console.error("createUserAuthAction is not implemented");
  return notImplemented;
}

export async function deleteUserAction(uidToDelete: string): Promise<{ success: boolean; message: string }> {
  console.error("deleteUserAction is not implemented");
  return notImplemented;
}

export async function updateUserAuthAction(uid: string, updates: { email?: string; password?: string }): Promise<{ success: boolean, message: string }> {
    console.error("updateUserAuthAction is not implemented");
    return notImplemented;
}
