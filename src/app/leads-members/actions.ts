'use server';

import type { Lead, Beneficiary } from '@/lib/types';
import { revalidatePath } from 'next/cache';

interface CopyLeadOptions {
  sourceLeadId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyRationLists: boolean;
}

const notImplemented = { success: false, message: 'Admin actions are temporarily disabled to resolve a server startup issue.' };


export async function copyLeadAction(options: CopyLeadOptions): Promise<{ success: boolean; message: string }> {
  console.error("copyLeadAction is not implemented");
  return notImplemented;
}

export async function deleteLeadAction(leadId: string): Promise<{ success: boolean; message: string }> {
  console.error("deleteLeadAction is not implemented");
  return notImplemented;
}
