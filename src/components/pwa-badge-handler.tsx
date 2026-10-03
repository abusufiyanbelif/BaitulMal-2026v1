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
    const allBenQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? collection(firestore, 'beneficiaries') : null, 
    [firestore, user, isStaff]);
    const { data: allBeneficiaries } = useCollection<Beneficiary>(allBenQuery);
    const unverifiedBen = useMemo(() => allBeneficiaries?.filter(b => b.status !== 'Verified') || [], [allBeneficiaries]);

    // 2. Donations
    const allDonQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? collection(firestore, 'donations') : null, 
    [firestore, user, isStaff]);
    const { data: allDonations } = useCollection<Donation>(allDonQuery);

    const pendingDon = useMemo(() => allDonations?.filter(d => d.status === 'Pending') || [], [allDonations]);
    const verifiedDon = useMemo(() => allDonations?.filter(d => d.status === 'Verified') || [], [allDonations]);

    const unallocatedCount = useMemo(() => {
        if (!verifiedDon) return 0;
        return verifiedDon.filter(d => {
            const allocated = d.linkSplit?.reduce((sum, l) => sum + l.amount, 0) || 0;
            return (d.amount - allocated) > 0.01;
        }).length;
    }, [verifiedDon]);

    // 4. Unverified Initiatives
    const allLeadsQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? collection(firestore, 'leads') : null, 
    [firestore, user, isStaff]);
    const { data: allLeads } = useCollection<Lead>(allLeadsQuery);
    const unverifiedLeads = useMemo(() => allLeads?.filter(l => l.authenticityStatus !== 'Verified') || [], [allLeads]);

    const allCampsQuery = useMemoFirebase(() => 
        (firestore && user && isStaff) ? collection(firestore, 'campaigns') : null, 
    [firestore, user, isStaff]);
    const { data: allCamps } = useCollection<Campaign>(allCampsQuery);
    const unverifiedCamps = useMemo(() => allCamps?.filter(c => c.authenticityStatus !== 'Verified') || [], [allCamps]);

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
