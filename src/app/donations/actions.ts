'use server';

import type { Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { revalidatePath } from 'next/cache';

const notImplemented = { success: false, message: 'Admin actions are temporarily disabled to resolve a server startup issue.', updatedCount: 0 };

export async function syncDonationsAction(): Promise<{ success: boolean; message: string; updatedCount: number; }> {
    console.error("syncDonationsAction is not implemented");
    return notImplemented;
}
