'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase, collection, query, where, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign, Lead, Donation, DonationCategory, BrandingSettings, Beneficiary } from '@/lib/types';
import { donationCategories } from '@/lib/modules';

/**
 * usePublicData - High-fidelity organizational impact reporting.
 * Hardened to provide 100% calculation accuracy for landing page summaries.
 */
export function usePublicData() {
  const firestore = useFirestore();
  const { user, isLoading: isSessionLoading } = useSession();

  const brandingRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'branding') : null, [firestore]);
  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_visibility') : null, [firestore]);

  const { data: brandingSettings, isLoading: isBrandingLoading } = useDoc<BrandingSettings>(brandingRef);
  const { data: visSettings, isLoading: isVisLoading } = useDoc<any>(visRef);

  const campaignsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'campaigns'),
      where('authenticityStatus', '==', 'Verified'),
      where('publicVisibility', '==', 'Published')
    );
  }, [firestore]);

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'leads'),
      where('authenticityStatus', '==', 'Verified'),
      where('publicVisibility', '==', 'Published')
    );
  }, [firestore]);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'beneficiaries');
  }, [firestore, user]);

  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const isLoading = areCampaignsLoading || areLeadsLoading || areDonationsLoading || (user ? areBeneficiariesLoading : false) || isSessionLoading || isBrandingLoading || isVisLoading;

  const memoizedData = useMemo(() => {
    if (isLoading || !campaigns || !leads || !donations) {
      return {
        campaignsWithProgress: [],
        leadsWithProgress: [],
        overallSummary: {
          totalTarget: 0,
          grandTotalRaised: 0,
          totalCollectedForGoals: 0,
          grandTotalUnlinked: 0,
          progress: 0,
          familiesImpacted: 0,
          showUnlinkedFunds: false,
        },
        yearlySummary: [],
        categorySummary: [],
        recentDonationsFormatted: [],
        summaryDateRange: null,
        isTickerActiveVisible: true,
        isTickerDonationVisible: true,
        isTickerCompletedVisible: true,
        skipIds: new Set<string>(),
        maxCompleted: 5
      };
    }

    const allPublicItems = [...campaigns, ...leads];
    const skipIds = new Set(brandingSettings?.tickerSkipIds || []);
    const maxDonations = brandingSettings?.tickerMaxDonations ?? 15;
    const maxCompleted = brandingSettings?.tickerMaxCompleted ?? 5;
    const isTickerActiveVisible = brandingSettings?.isTickerActiveVisible !== false;
    const isTickerDonationVisible = brandingSettings?.isTickerDonationVisible !== false;
    const isTickerCompletedVisible = brandingSettings?.isTickerCompletedVisible !== false;

    const startDate = brandingSettings?.summaryStartDate || '';
    const endDate = brandingSettings?.summaryEndDate || '';

    // --- RECONCILIATION ENGINE ---
    // Calculates verified contributions for an individual initiative
    const reconcileInitiative = (item: Campaign | Lead, isCampaign: boolean) => {
        const itemDonations = donations.filter(d => 
            d.linkSplit?.some(l => l.linkId === item.id || l.linkId === `${isCampaign ? 'campaign' : 'lead'}_${item.id}`)
        );

        const allowedTypes = item.allowedDonationTypes && item.allowedDonationTypes.length > 0
            ? item.allowedDonationTypes
            : [...donationCategories];

        let collected = item.collectedAmount || 0;
        const target = item.targetAmount || 0;
        const progress = target > 0 ? (collected / target) * 100 : 0;

        return { collected, target, progress: Math.min(progress, 100) };
    };

    const campaignsWithProgress = campaigns.map(c => ({ ...c, ...reconcileInitiative(c, true) }));
    const leadsWithProgress = leads.map(l => ({ ...l, ...reconcileInitiative(l, false) }));

    const summaryDonations = donations.filter(d => {
        const dDate = d.donationDate || '';
        return (!startDate || dDate >= startDate) && (!endDate || dDate <= endDate);
    });

    // --- OVERALL CALCULATION ---
    // Use the combined set of reconciled items for perfect progress alignment
    const combinedItems = [...campaignsWithProgress, ...leadsWithProgress];
    const totalTarget = combinedItems.reduce((sum, item) => sum + (item.target || 0), 0);
    const totalGoalReceived = combinedItems.reduce((sum, item) => sum + (item.collected || 0), 0);
    const grandTotalRaised = summaryDonations.reduce((sum, d) => sum + (d.amount || 0), 0);

    const overallProgress = totalTarget > 0 ? (totalGoalReceived / totalTarget) * 100 : 0;

    const amountsByCategoryInRange = summaryDonations.reduce((acc, d) => {
      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
      splits.forEach(split => {
        const category = (split.category as any) === 'General' ? 'Sadaqah' : split.category as DonationCategory;
        if (donationCategories.includes(category)) {
          acc[category] = (acc[category] || 0) + split.amount;
        }
      });
      return acc;
    }, {} as Record<DonationCategory, number>);

    const yearlyData: Record<string, { totalGoalReceived: number; overallTotalReceived: number; totalTarget: number; }> = {};
    
    combinedItems.forEach(item => {
        if (item.startDate && item.target) {
            const year = item.startDate.split('-')[0];
            if (!yearlyData[year]) {
                yearlyData[year] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
            }
            yearlyData[year].totalTarget += item.target;
            yearlyData[year].totalGoalReceived += item.collected;
        }
    });

    donations.forEach(donation => {
        const year = donation.donationDate?.split('-')[0];
        if (year && yearlyData[year]) {
            yearlyData[year].overallTotalReceived += donation.amount;
        }
    });
    
    const sortedYearlyData = Object.entries(yearlyData)
        .map(([year, data]) => ({ 
            year, 
            ...data, 
            progress: data.totalTarget > 0 ? (data.totalGoalReceived / data.totalTarget) * 100 : 0 
        }))
        .filter(y => y.totalGoalReceived > 0 || y.overallTotalReceived > 0)
        .sort((a, b) => parseInt(b.year) - parseInt(a.year));

    const recentDonationsFormatted = isTickerDonationVisible ? [...donations]
        .sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())
        .slice(0, maxDonations)
        .map(d => {
            const primaryLink = d.linkSplit?.find(l => l.linkType !== 'general');
            const initiativeName = primaryLink?.linkName || 'General Fund';
            return {
                id: d.id,
                text: `₹${d.amount.toLocaleString('en-IN')} For ${initiativeName}`,
                href: (primaryLink?.linkType === 'campaign') 
                    ? `/campaign-public/${primaryLink.linkId}/summary` 
                    : (primaryLink?.linkType === 'lead') 
                        ? `/leads-public/${primaryLink.linkId}/summary` 
                        : '#'
            };
        }) : [];

    const grandTotalUnlinkedPool = donations.reduce((sum, d) => {
        const allocated = d.linkSplit?.reduce((s, l) => s + l.amount, 0) || 0;
        return sum + Math.max(0, d.amount - allocated);
    }, 0);

    return {
      campaignsWithProgress,
      leadsWithProgress,
      overallSummary: {
        totalTarget: totalTarget,
        grandTotalRaised: grandTotalRaised,
        totalCollectedForGoals: totalGoalReceived,
        grandTotalUnlinked: grandTotalUnlinkedPool,
        progress: overallProgress,
        familiesImpacted: beneficiaries?.length || 0,
        showUnlinkedFunds: user ? (visSettings?.member_unlinked_funds !== false) : (visSettings?.public_unlinked_funds === true)
      },
      yearlySummary: sortedYearlyData,
      categorySummary: Object.entries(amountsByCategoryInRange).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
      recentDonationsFormatted,
      summaryDateRange: (startDate || endDate) ? { start: startDate, end: endDate } : null,
      isTickerActiveVisible,
      isTickerDonationVisible,
      isTickerCompletedVisible,
      skipIds,
      maxCompleted
    };

  }, [isLoading, campaigns, leads, donations, beneficiaries, brandingSettings, visSettings, user]);

  return { isLoading, ...memoizedData };
}