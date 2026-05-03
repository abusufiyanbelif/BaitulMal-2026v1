'use client';

import { useEffect, useMemo } from 'react';
import { 
    useFirestore, 
    useCollection, 
    useMemoFirebase, 
    collection, 
    query, 
    where 
} from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { usePublicData } from '@/hooks/use-public-data';
import type { Donation, Beneficiary, Lead, Campaign } from '@/lib/types';

/**
 * PWABadgeHandler - Invisible Component
 * Synchronizes the Home Screen App Icon Badge with system data.
 */
export function PWABadgeHandler() {
    const { user, isStaff } = useSession();
    const { campaignsWithProgress, leadsWithProgress, isLoading: isPublicLoading } = usePublicData();
    const firestore = useFirestore();

    // --- Member Level Queries (Only if logged in and Staff) ---
    
    // 1. Unverified Beneficiaries
    const unverifiedBenQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? query(collection(firestore, 'beneficiaries'), where('status', '!=', 'Verified')) : null, 
    [firestore, user, isStaff]);
    const { data: unverifiedBen } = useCollection<Beneficiary>(unverifiedBenQuery);

    // 2. Pending Donations
    const pendingDonQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? query(collection(firestore, 'donations'), where('status', '==', 'Pending')) : null, 
    [firestore, user, isStaff]);
    const { data: pendingDon } = useCollection<Donation>(pendingDonQuery);

    // 3. Unallocated Verified Donations
    const verifiedDonQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? query(collection(firestore, 'donations'), where('status', '==', 'Verified')) : null, 
    [firestore, user, isStaff]);
    const { data: verifiedDon } = useCollection<Donation>(verifiedDonQuery);

    const unallocatedCount = useMemo(() => {
        if (!verifiedDon) return 0;
        return verifiedDon.filter(d => {
            const allocated = d.linkSplit?.reduce((sum, l) => sum + l.amount, 0) || 0;
            return (d.amount - allocated) > 0.01;
        }).length;
    }, [verifiedDon]);

    // 4. Unverified Initiatives
    const unverifiedLeadsQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? query(collection(firestore, 'leads'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore, user, isStaff]);
    const { data: unverifiedLeads } = useCollection<Lead>(unverifiedLeadsQuery);

    const unverifiedCampsQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? query(collection(firestore, 'campaigns'), where('authenticityStatus', '!=', 'Verified')) : null, 
    [firestore, user, isStaff]);
    const { data: unverifiedCamps } = useCollection<Campaign>(unverifiedCampsQuery);

    // --- Calculation Engine ---

    const badgeCount = useMemo(() => {
        if (!user || !isStaff) {
            // Public/Supporter View: Ongoing Initiatives
            const activeCamps = campaignsWithProgress.filter(c => c.status === 'Active' || c.status === 'Upcoming').length;
            const activeLeads = leadsWithProgress.filter(l => l.status === 'Active' || l.status === 'Upcoming').length;
            return activeCamps + activeLeads;
        } else {
            // Member View: Action Items
            return (unverifiedBen?.length || 0) + 
                   (pendingDon?.length || 0) + 
                   unallocatedCount + 
                   (unverifiedLeads?.length || 0) + 
                   (unverifiedCamps?.length || 0);
        }
    }, [user, isStaff, campaignsWithProgress, leadsWithProgress, unverifiedBen, pendingDon, unallocatedCount, unverifiedLeads, unverifiedCamps]);

    // --- API Sync ---

    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
            if (badgeCount > 0) {
                navigator.setAppBadge(badgeCount).catch(err => console.warn("Badge Sync Blocked:", err));
            } else {
                navigator.clearAppBadge().catch(err => console.warn("Badge Clear Blocked:", err));
            }
        }
    }, [badgeCount]);

    return null; // Component stays invisible
}
