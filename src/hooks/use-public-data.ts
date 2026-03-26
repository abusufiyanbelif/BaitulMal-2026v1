'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase, collection, query, where, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign, Lead, Donation, DonationCategory, BrandingSettings } from '@/lib/types';
import { donationCategories } from '@/lib/modules';

const RECENT_UPDATE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * usePublicData - Strict filtering for public-facing organizational reporting.
 * Re-engineered to support Custom Date Range filtering from organization settings.
 */
export function usePublicData() {
  const firestore = useFirestore();
  const { isLoading: isSessionLoading } = useSession();

  // Load configuration for date range filtering
  const brandingRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'branding') : null, [firestore]);
  const { data: brandingSettings, isLoading: isBrandingLoading } = useDoc<BrandingSettings>(brandingRef);

  // Strict Query: Authenticity Verified AND Visibility Published
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
  
  // Donations must be Verified to appear in aggregates or tickers
  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const isLoading = areCampaignsLoading || areLeadsLoading || areDonationsLoading || isSessionLoading || isBrandingLoading;

  const isRecentlyUpdated = (updatedAt: any) => {
    if (!updatedAt) return false;
    const date = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
    return (Date.now() - date.getTime()) < RECENT_UPDATE_THRESHOLD_MS;
  };

  const memoizedData = useMemo(() => {
    if (isLoading || !campaigns || !leads || !donations) {
      return {
        campaignsWithProgress: [],
        leadsWithProgress: [],
        overallSummary: {
          totalTarget: 0,
          grandTotalRaised: 0,
          totalCollectedForGoals: 0,
          progress: 0,
        },
        yearlySummary: [],
        categorySummary: [],
        recentDonationsFormatted: [],
        summaryDateRange: null
      };
    }

    const allPublicItems = [...campaigns, ...leads];
    const itemsById = new Map(allPublicItems.map(item => [item.id, item]));

    // Identity Configured Date Range
    const startDate = brandingSettings?.summaryStartDate || '';
    const endDate = brandingSettings?.summaryEndDate || '';

    const collectedAmounts = new Map<string, number>();
    const yearlyData: Record<string, { totalGoalReceived: number; overallTotalReceived: number; totalTarget: number; }> = {};

    donations.forEach(donation => {
      const donationDate = donation.donationDate || '';
      
      // Global Aggregate Filter: Respect Custom Date Range
      const isWithinRange = (!startDate || donationDate >= startDate) && (!endDate || donationDate <= endDate);

      const donationYear = donationDate ? donationDate.split('-')[0] : null;
      if (donationYear && !yearlyData[donationYear]) {
          yearlyData[donationYear] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
      }
      if (donationYear && isWithinRange) yearlyData[donationYear].overallTotalReceived += donation.amount;

      const links = (donation.linkSplit && donation.linkSplit.length > 0)
        ? donation.linkSplit
        : (donation as any).campaignId 
            ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] 
            : [];
      
      links.forEach((link: any) => {
        const item = itemsById.get(link.linkId);
        if (!item) return;

        // Individual item progress remains lifetime for accuracy, but aggregate summary respects range
        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const proportionForThisItem = link.amount / totalDonationAmount;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
          ? donation.typeSplit
          : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount, forFundraising: true }] : []);
        
        const applicableAmountInDonation = typeSplits.reduce((acc, split) => {
          const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
          const isAllowed = item.allowedDonationTypes?.includes(category as DonationCategory);
          const isForGoal = category !== 'Zakat' || split.forFundraising === true;

          if (isAllowed && isForGoal) {
            return acc + split.amount;
          }
          return acc;
        }, 0);
        
        const itemContribution = applicableAmountInDonation * proportionForThisItem;
        
        // Progress for cards is always lifetime
        const currentLifetimeCollected = collectedAmounts.get(link.id) || 0;
        collectedAmounts.set(link.id, currentLifetimeCollected + itemContribution);

        // Aggregate goal tracking respects custom range
        if (donationYear && isWithinRange) {
            yearlyData[donationYear].totalGoalReceived += itemContribution;
        }
      });
    });

    const campaignsWithProgress = campaigns.map(campaign => {
      const collected = collectedAmounts.get(campaign.id) || 0;
      const progress = campaign.targetAmount && campaign.targetAmount > 0 ? (collected / campaign.targetAmount) * 100 : 0;
      return { 
        ...campaign, 
        collected, 
        progress,
        isUpdated: isRecentlyUpdated(campaign.updatedAt)
      };
    });

    const leadsWithProgress = leads.map(lead => {
      const collected = collectedAmounts.get(lead.id) || 0;
      const progress = lead.targetAmount && lead.targetAmount > 0 ? (collected / lead.targetAmount) * 100 : 0;
      return { 
        ...lead, 
        collected, 
        progress,
        isUpdated: isRecentlyUpdated(lead.updatedAt)
      };
    });

    // Aggregate summaries filtered by the configured date range
    const summaryDonations = donations.filter(d => {
        const dDate = d.donationDate || '';
        return (!startDate || dDate >= startDate) && (!endDate || dDate <= endDate);
    });

    // Calculate Target specifically for items that fall within or overlap the period
    const summaryItems = allPublicItems.filter(item => {
        const itemStart = item.startDate || '';
        return (!startDate || itemStart >= startDate) && (!endDate || itemStart <= endDate);
    });

    const totalTargetInRange = summaryItems.reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    
    // Recalculate collected amount specifically for the summary period
    let totalCollectedForGoalsInRange = 0;
    summaryDonations.forEach(d => {
        const links = d.linkSplit || [];
        links.forEach(l => {
            const item = itemsById.get(l.linkId);
            if (!item) return;
            const splits = d.typeSplit || [];
            const prop = l.amount / (d.amount || 1);
            const eligible = splits.reduce((acc, s) => {
                const cat = (s.category as any) === 'General' ? 'Sadaqah' : s.category;
                const isAllowed = item.allowedDonationTypes?.includes(cat as DonationCategory);
                const isForGoal = cat !== 'Zakat' || s.forFundraising === true;
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

    const recentDonationsFormatted = [...donations]
        .sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())
        .slice(0, 15)
        .map(d => {
            const primaryLink = d.linkSplit?.[0] || ( (d as any).campaignId ? { linkName: (d as any).campaignName || 'Campaign', linkId: (d as any).campaignId, linkType: 'campaign', amount: d.amount } : null );
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
        });

    return {
      campaignsWithProgress,
      leadsWithProgress,
      overallSummary: {
        totalTarget: totalTargetInRange,
        grandTotalRaised: grandTotalRaisedInRange,
        totalCollectedForGoals: totalCollectedForGoalsInRange,
        progress: overallProgress,
      },
      yearlySummary: sortedYearlyData,
      categorySummary: Object.entries(amountsByCategoryInRange).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
      recentDonationsFormatted,
      summaryDateRange: (startDate || endDate) ? { start: startDate, end: endDate } : null
    };

  }, [isLoading, campaigns, leads, donations, brandingSettings]);

  return { isLoading, ...memoizedData };
}
