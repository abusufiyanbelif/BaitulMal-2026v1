'use client';

import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp
} from 'firebase/firestore';
import type { Donation, Campaign, Lead, DonationLink, DonationCategory } from './types';
import { donationCategories } from './modules';

/**
 * Systemic Financial Reconciliation Utility.
 * Ensures the 'collectedAmount' field on Campaigns and Leads perfectly matches 
 * the high-fidelity 'Raised For Goal' logic used in the UI.
 * Handles Zakat Surpluses correctly (Zakat Received - Zakat Allocated).
 */
export async function syncInitiativeCollectedTotals(db: any, links: DonationLink[]) {
    if (!db) return;

    // 1. Identify unique targets affected by these links
    const targets = Array.from(new Set(links.map(l => {
        const rawId = String(l.linkId);
        const cleanId = (rawId.startsWith('campaign_') || rawId.startsWith('lead_')) 
            ? rawId.split('_')[1] 
            : rawId;
        return `${l.linkType}_${cleanId}`;
    })));

    // 2. Fetch all verified donations once for a global audit sweep
    const donationsSnap = await getDocs(query(collection(db, 'donations'), where('status', '==', 'Verified')));
    const allVerifiedDonations = donationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Donation));

    for (const targetKey of targets) {
        const [type, id] = targetKey.split('_');
        const collectionName = type === 'campaign' ? 'campaigns' : 'leads';
        const initiativeRef = doc(db, collectionName, id);
        const initiativeSnap = await getDoc(initiativeRef);
        
        if (!initiativeSnap.exists()) continue;

        const initiativeData = initiativeSnap.data() as Campaign | Lead;
        const allowedTypes = initiativeData.allowedDonationTypes && initiativeData.allowedDonationTypes.length > 0
            ? initiativeData.allowedDonationTypes
            : [...donationCategories];

        // 3. Fetch current Zakat allocations for this specific initiative
        const beneficiariesSnap = await getDocs(collection(db, collectionName, id, 'beneficiaries'));
        const zakatAllocatedSum = beneficiariesSnap.docs.reduce((sum, bDoc) => {
            const bData = bDoc.data();
            // Important: we only subtract reservations if they are eligible for zakat
            return sum + (bData.isEligibleForZakat ? (Number(bData.zakatAllocation) || 0) : 0);
        }, 0);

        // 4. Calculate total collected sum based on allowed types and Zakat surplus
        let zakatSumForGoal = 0;
        let otherEligibleSum = 0;

        allVerifiedDonations.forEach(d => {
            // Support both prefixed and raw IDs for robustness
            const split = d.linkSplit?.find(l => l.linkId === id || l.linkId === `${type}_${id}`);
            if (split) {
                const totalDonation = d.amount || 1;
                const proportion = split.amount / totalDonation;
                const typeSplits = d.typeSplit || [];

                typeSplits.forEach(ts => {
                    const cat = (ts.category as any) === 'General' || (ts.category as any) === 'Sadqa' ? 'Sadaqah' : ts.category;
                    if (allowedTypes.includes(cat as DonationCategory)) {
                        const isForGoal = cat !== 'Zakat' || ts.forFundraising !== false;
                        if (isForGoal) {
                            const amount = ts.amount * proportion;
                            if (cat === 'Zakat') zakatSumForGoal += amount;
                            else otherEligibleSum += amount;
                        }
                    }
                });
            }
        });

        // The key reconciliation rule: Only Zakat received BEYOND current family allocations counts toward the goal progress bar.
        const zakatSurplus = Math.max(0, zakatSumForGoal - zakatAllocatedSum);
        const finalCollected = otherEligibleSum + zakatSurplus;

        // 5. Secure the reconciliation result
        await updateDoc(initiativeRef, { 
            collectedAmount: finalCollected, 
            updatedAt: serverTimestamp() 
        });
    }
}