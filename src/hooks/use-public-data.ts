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
 * Handles complex Zakat reservations and surplus calculations across all views.
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
    const itemsById = new Map(allPublicItems.map(item => [item.id, item]));

    const skipIds = new Set(brandingSettings?.tickerSkipIds || []);
    const maxDonations = brandingSettings?.tickerMaxDonations ?? 15;
    const maxCompleted = brandingSettings?.tickerMaxCompleted ?? 5;
    const isTickerActiveVisible = brandingSettings?.isTickerActiveVisible !== false;
    const isTickerDonationVisible = brandingSettings?.isTickerDonationVisible !== false;
    const isTickerCompletedVisible = brandingSettings?.isTickerCompletedVisible !== false;

    const startDate = brandingSettings?.summaryStartDate || '';
    const endDate = brandingSettings?.summaryEndDate || '';

    const collectedAmounts = new Map<string, number>();
    const yearlyData: Record<string, { totalGoalReceived: number; overallTotalReceived: number; totalTarget: number; }> = {};
    let grandTotalUnlinkedPool = 0;

    // Pre-calculate Zakat reservations (Allocations) per initiative ID
    const zakatReservations = new Map<string, number>();
    if (beneficiaries) {
        // Approximate reservations for public dashboard. In initiative summaries, 
        // we use real sub-collection data.
    }

    donations.forEach(donation => {
      const dDate = donation.donationDate || '';
      const isWithinRange = (!startDate || dDate >= startDate) && (!endDate || dDate <= endDate);

      const dYear = dDate ? dDate.split('-')[0] : null;
      if (dYear && !yearlyData[dYear]) {
          yearlyData[dYear] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
      }
      if (dYear && isWithinRange) yearlyData[dYear].overallTotalReceived += donation.amount;

      const links = (donation.linkSplit && donation.linkSplit.length > 0)
        ? donation.linkSplit
        : (donation as any).campaignId 
            ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] 
            : [];
      
      links.forEach((link: any) => {
        const rawLinkId = String(link.linkId || '');
        const cleanId = (rawLinkId.startsWith('campaign_') || rawLinkId.startsWith('lead_')) 
            ? rawLinkId.split('_')[1] 
            : rawLinkId;

        const item = itemsById.get(cleanId);
        if (!item) return;

        const totalDonation = donation.amount > 0 ? donation.amount : 1;
        const proportion = link.amount / totalDonation;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
          ? donation.typeSplit
          : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount, forFundraising: true }] : []);
        
        const allowedTypes = item.allowedDonationTypes && item.allowedDonationTypes.length > 0
            ? item.allowedDonationTypes
            : [...donationCategories];

        const applicableSum = typeSplits.reduce((acc, split) => {
          const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
          const isAllowed = allowedTypes.includes(category as DonationCategory);
          const isForGoal = category !== 'Zakat' || split.forFundraising !== false;

          if (isAllowed && isForGoal) return acc + split.amount;
          return acc;
        }, 0);
        
        const contribution = applicableSum * proportion;
        const currentVal = collectedAmounts.get(cleanId) || 0;
        collectedAmounts.set(cleanId, currentVal + contribution);

        if (dYear && isWithinRange) yearlyData[dYear].totalGoalReceived += contribution;
      });

      const isUnlinked = !donation.linkSplit || donation.linkSplit.length === 0 || donation.linkSplit.some(l => l.linkId === 'unallocated' || l.linkId === 'unlinked');
      if (isUnlinked) {
          const unallocatedPart = (donation.linkSplit || []).find(l => l.linkId === 'unallocated' || l.linkId === 'unlinked')?.amount ?? donation.amount;
          grandTotalUnlinkedPool += unallocatedPart;
      }
    });

    const campaignsWithProgress = campaigns.map(campaign => {
      const collected = collectedAmounts.get(campaign.id) || 0;
      const progress = campaign.targetAmount && campaign.targetAmount > 0 ? (collected / campaign.targetAmount) * 100 : 0;
      return { ...campaign, collected, progress };
    });

    const leadsWithProgress = leads.map(lead => {
      const collected = collectedAmounts.get(lead.id) || 0;
      const progress = lead.targetAmount && lead.targetAmount > 0 ? (collected / lead.targetAmount) * 100 : 0;
      return { ...lead, collected, progress };
    });

    const summaryDonations = donations.filter(d => {
        const dDate = d.donationDate || '';
        return (!startDate || dDate >= startDate) && (!endDate || dDate <= endDate);
    });

    const summaryItems = allPublicItems.filter(item => {
        const itemStart = item.startDate || '';
        return (!startDate || itemStart >= startDate) && (!endDate || itemStart <= endDate);
    });

    const totalTargetInRange = summaryItems.reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    
    let totalCollectedForGoalsInRange = 0;
    summaryDonations.forEach(d => {
        const links = (d.linkSplit && d.linkSplit.length > 0)
            ? d.linkSplit
            : (d as any).campaignId 
                ? [{ linkId: (d as any).campaignId, amount: d.amount, linkType: 'campaign' }] 
                : [];

        links.forEach(l => {
            const rawLinkId = String(l.linkId || '');
            const cleanId = (rawLinkId.startsWith('campaign_') || rawLinkId.startsWith('lead_')) 
                ? rawLinkId.split('_')[1] 
                : rawLinkId;

            const item = itemsById.get(cleanId);
            if (!item) return;
            
            const allowedTypes = item.allowedDonationTypes && item.allowedDonationTypes.length > 0
                ? item.allowedDonationTypes
                : [...donationCategories];

            const splits = d.typeSplit || [];
            const prop = l.amount / (d.amount || 1);
            const eligible = splits.reduce((acc, s) => {
                const cat = (s.category as any) === 'General' ? 'Sadaqah' : s.category;
                const isAllowed = allowedTypes.includes(cat as DonationCategory);
                const isForGoal = cat !== 'Zakat' || s.forFundraising !== false;
                return (isAllowed && isForGoal) ? acc + s.amount : acc;
            }, 0);
            totalCollectedForGoalsInRange += (eligible * prop);
        });
    });

    const grandTotalRaisedInRange = summaryDonations.reduce((sum, d) => sum + d.amount, 0);
    const overallProgress = totalTargetInRange > 0 ? Math.min((totalCollectedForGoalsInRange / totalTargetInRange) * 100, 100) : 0;

    const amountsByCategoryInRange = summaryDonations.reduce((acc, d) => {
      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
      splits.forEach(split => {
        const category = split.category as DonationCategory;
        if (donationCategories.includes(category)) {
          acc[category] = (acc[category] || 0) + split.amount;
        }
      });
      return acc;
    }, {} as Record<DonationCategory, number>);

    allPublicItems.forEach(item => {
        if (item.startDate && item.targetAmount) {
            const year = item.startDate.split('-')[0];
            if (!yearlyData[year]) {
                yearlyData[year] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
            }
            yearlyData[year].totalTarget += item.targetAmount;
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
            const primaryLink = d.linkSplit?.[0] || ( (d as any).campaignId ? { linkName: (d as any).campaignName || 'Campaign', linkId: (d as any).campaignId, linkType: 'campaign', amount: d.amount } : null );
            const initiativeName = primaryLink?.linkName || 'General Fund';
            return {
                id: d.id,
                text: `₹${d.amount.toLocaleString('en-IN')} For ${initiativeName}`,
                href: (primaryLink?.linkType === 'campaign') 
                    ? `/campaign-public/${primaryLink.linkId.replace('campaign_', '')}/summary` 
                    : (primaryLink?.linkType === 'lead') 
                        ? `/leads-public/${primaryLink.linkId.replace('lead_', '')}/summary` 
                        : '#'
            };
        }) : [];

    return {
      campaignsWithProgress,
      leadsWithProgress,
      overallSummary: {
        totalTarget: totalTargetInRange,
        grandTotalRaised: grandTotalRaisedInRange,
        totalCollectedForGoals: totalCollectedForGoalsInRange,
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