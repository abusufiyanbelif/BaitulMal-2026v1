'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query, where } from 'firebase/firestore';
import type { Campaign, Lead, Donation, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';

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
      };
    }

    const allPublicItems = [...campaigns, ...leads];
    const itemsById = new Map(allPublicItems.map(item => [item.id, item]));

    // --- Calculate Collected Amounts for Each Item ---
    const collectedAmounts = new Map<string, number>();
    donations.forEach(donation => {
      const links = (donation.linkSplit && donation.linkSplit.length > 0)
        ? donation.linkSplit
        : (donation as any).campaignId ? [{ linkId: (donation as any).campaignId, amount: donation.amount, linkType: 'campaign' }] : [];
      
      links.forEach(link => {
        const item = itemsById.get(link.linkId);
        // Only process donations linked to our public items
        if (!item) return;

        const amountForThisItem = link.amount;
        const totalDonationAmount = donation.amount > 0 ? donation.amount : 1;
        const proportionForThisItem = amountForThisItem / totalDonationAmount;

        const typeSplits = (donation.typeSplit && donation.typeSplit.length > 0)
          ? donation.typeSplit
          : (donation.type ? [{ category: donation.type as DonationCategory, amount: donation.amount }] : []);
        
        const applicableAmountInDonation = typeSplits.reduce((acc, split) => {
          const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
          if (item.allowedDonationTypes?.includes(category as DonationCategory)) {
            return acc + split.amount;
          }
          return acc;
        }, 0);
        
        const currentCollected = collectedAmounts.get(link.linkId) || 0;
        collectedAmounts.set(link.linkId, currentCollected + (applicableAmountInDonation * proportionForThisItem));
      });
    });

    // --- Enhance Campaign/Lead data with progress ---
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

    // --- Calculate Overall Summary ---
    const totalTarget = allPublicItems.reduce((sum, item) => sum + (item.targetAmount || 0), 0);
    const grandTotalRaised = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalCollectedForGoals = Array.from(collectedAmounts.values()).reduce((sum, amount) => sum + amount, 0);
    const overallProgress = totalTarget > 0 ? Math.min((totalCollectedForGoals / totalTarget) * 100, 100) : 0;

    // --- Calculate Yearly and Category Summaries ---
    const yearlyData: Record<string, { totalGoalReceived: number; overallTotalReceived: number; totalTarget: number; }> = {};
    const amountsByCategory = donations.reduce((acc, d) => {
      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : [];
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
            } catch (e) { /* ignore */ }
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
            } catch(e) { /* ignore */ }
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
            } catch(e) { /* ignore */ }
        }
    });
    
    const sortedYearlyData = Object.entries(yearlyData)
        .map(([year, data]) => ({ 
            year, 
            ...data, 
            progress: data.totalTarget > 0 ? (data.totalGoalReceived / data.totalTarget) * 100 : 0 
        }))
        .sort((a, b) => parseInt(b.year) - parseInt(a.year));


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
    };

  }, [isLoading, campaigns, leads, donations]);

  return { isLoading, ...memoizedData };
}
