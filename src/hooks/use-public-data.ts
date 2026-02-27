'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, collection, query, where } from '@/firebase';
import type { Campaign, Lead, Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';

const RECENT_UPDATE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function usePublicData() {
  const firestore = useFirestore();

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
  
  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  const { data: donations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const isLoading = areCampaignsLoading || areLeadsLoading || areDonationsLoading;

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
      };
    }

    const allPublicItems = [...campaigns, ...leads];
    const itemsById = new Map(allPublicItems.map(item => [item.id, item]));

    const collectedAmounts = new Map<string, number>();
    donations.forEach(donation => {
      const links = (donation.linkSplit && donation.linkSplit.length > 0)
        ? donation.linkSplit
        : (donation as any).campaignId 
            ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] 
            : [];
      
      links.forEach((link: any) => {
        const item = itemsById.get(link.linkId);
        if (!item) return;

        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const proportionForThisItem = link.amount / totalDonationAmount;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
          ? donation.typeSplit
          : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount, forFundraising: true }] : []);
        
        const applicableAmountInDonation = typeSplits.reduce((acc, split) => {
          const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
          const isAllowed = item.allowedDonationTypes?.includes(category as DonationCategory);
          const isForGoal = category !== 'Zakat' || split.forFundraising !== false;

          if (isAllowed && isForGoal) {
            return acc + split.amount;
          }
          return acc;
        }, 0);
        
        const currentCollected = collectedAmounts.get(link.linkId) || 0;
        collectedAmounts.set(link.linkId, currentCollected + (applicableAmountInDonation * proportionForThisItem));
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

    const totalTarget = allPublicItems.reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    const grandTotalRaised = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalCollectedForGoals = Array.from(collectedAmounts.values()).reduce((sum, amount) => sum + amount, 0);
    const overallProgress = totalTarget > 0 ? Math.min((totalCollectedForGoals / totalTarget) * 100, 100) : 0;

    const yearlyData: Record<string, { totalGoalReceived: number; overallTotalReceived: number; totalTarget: number; }> = {};
    const amountsByCategory = donations.reduce((acc, d) => {
      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
      splits.forEach(split => {
        const category = split.category as DonationCategory;
        if (donationCategories.includes(category)) {
          acc[category] = (acc[category] || 0) + split.amount;
        }
      });
      return acc;
    }, {} as Record<DonationCategory, number>);

    donations.forEach(donation => {
        if (donation.donationDate) {
            try {
                const year = new Date(donation.donationDate).getFullYear().toString();
                if (!yearlyData[year]) {
                    yearlyData[year] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
                }
                yearlyData[year].overallTotalReceived += donation.amount;
            } catch (e: any) { /* ignore */ }
        }
    });
    
    allPublicItems.forEach(item => {
        if (item.startDate && item.targetAmount) {
            try {
                const year = new Date(item.startDate).getFullYear().toString();
                 if (!yearlyData[year]) {
                    yearlyData[year] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
                }
                yearlyData[year].totalTarget += item.targetAmount;
            } catch(e: any) { /* ignore */ }
        }
    });

    collectedAmounts.forEach((amount, itemId) => {
        const item = itemsById.get(itemId);
        if (item && item.startDate) {
            try {
                const year = new Date(item.startDate).getFullYear().toString();
                 if (!yearlyData[year]) {
                    yearlyData[year] = { totalGoalReceived: 0, overallTotalReceived: 0, totalTarget: 0 };
                }
                yearlyData[year].totalGoalReceived += amount;
            } catch(e: any) { /* ignore */ }
        }
    });
    
    const sortedYearlyData = Object.entries(yearlyData)
        .map(([year, data]) => ({ 
            year, 
            ...data, 
            progress: data.totalTarget > 0 ? (data.totalGoalReceived / data.totalTarget) * 100 : 0 
        }))
        .sort((a, b) => parseInt(b.year) - parseInt(a.year));

    const recentDonationsFormatted = [...donations]
        .sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())
        .slice(0, 15)
        .map(d => {
            const primaryLink = d.linkSplit?.[0] || ( (d as any).campaignId ? { linkName: (d as any).campaignName || 'Campaign', linkId: (d as any).campaignId, linkType: 'campaign', amount: d.amount } : null );
            const initiativeName = primaryLink?.linkName || 'General Fund';
            return {
                id: d.id,
                text: `₹${d.amount.toLocaleString('en-IN')} for ${initiativeName}`,
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
        totalTarget,
        grandTotalRaised,
        totalCollectedForGoals,
        progress: overallProgress,
      },
      yearlySummary: sortedYearlyData,
      categorySummary: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})`})),
      recentDonationsFormatted,
    };

  }, [isLoading, campaigns, leads, donations]);

  return { isLoading, ...memoizedData };
}