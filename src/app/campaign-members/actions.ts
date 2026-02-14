'use server';

import type { Campaign, Beneficiary, Donation } from '@/lib/types';
import { revalidatePath } from 'next/cache';

interface CopyCampaignOptions {
  sourceCampaignId: string;
  newName: string;
  copyBeneficiaries: boolean;
  copyDonations: boolean;
  copyRationLists: boolean;
}

const notImplemented = { success: false, message: 'Admin actions are temporarily disabled to resolve a server startup issue.' };

export async function copyCampaignAction(options: CopyCampaignOptions): Promise<{ success: boolean; message: string }> {
  console.error('copyCampaignAction is not implemented');
  return notImplemented;
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; message: string }> {
  console.error('deleteCampaignAction is not implemented');
  return notImplemented;
}
