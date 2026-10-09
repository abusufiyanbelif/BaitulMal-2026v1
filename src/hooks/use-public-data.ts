'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase, collection, query, where, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Campaign, Lead, Donation, DonationCategory, BrandingSettings, Beneficiary } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { isDonationLinkedToInitiative, getDonationLinkForInitiative } from '@/lib/utils';

/**
 * usePublicData - High-fidelity organizational impact reporting.
 * Strictly filters for Published/Verified initiatives for all public-facing calculations.
 */
export function usePublicData() {
  const firestore = useFirestore();
  const { user, isStaff, isLoading: isSessionLoading } = useSession();

  const brandingRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'branding') : null, [firestore]);
  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_visibility') : null, [firestore]);
  const benVisRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_visibility') : null, [firestore]);

  const { data: brandingSettings, isLoading: isBrandingLoading } = useDoc<BrandingSettings>(brandingRef);
  const { data: visSettings, isLoading: isVisLoading } = useDoc<any>(visRef);
  const { data: benVisSettings, isLoading: isBenVisLoading } = useDoc<any>(benVisRef);

  const campaignsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'campaigns');
  }, [firestore]);

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  
  const beneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !user || !isStaff) return null;
    return collection(firestore, 'beneficiaries');
  }, [firestore, user, isStaff]);

  const donationsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    if (user && isStaff) {
      return collection(firestore, 'donations');
    }
    return query(collection(firestore, 'donations'), where('status', '==', 'Verified'));
  }, [firestore, user, isStaff]);

  const { data: rawCampaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);
  const { data: rawLeads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
  const { data: rawDonations, isLoading: areDonationsLoading } = useCollection<Donation>(donationsCollectionRef);

  const campaigns = useMemo(() => {
    if (!rawCampaigns) return [];
    return rawCampaigns.filter(c => c.authenticityStatus === 'Verified' && c.publicVisibility === 'Published');
  }, [rawCampaigns]);

  const leads = useMemo(() => {
    if (!rawLeads) return [];
    return rawLeads.filter(l => l.authenticityStatus === 'Verified' && l.publicVisibility === 'Published');
  }, [rawLeads]);

  const donations = useMemo(() => {
    if (!rawDonations) return [];
    return rawDonations.filter(d => d.status === 'Verified');
  }, [rawDonations]);

  const pendingDonationsList = useMemo(() => {
    if (!rawDonations) return [];
    return rawDonations.filter(d => d.status === 'Pending');
  }, [rawDonations]);

  const isLoading = areCampaignsLoading || areLeadsLoading || areDonationsLoading || (user && isStaff ? areBeneficiariesLoading : false) || isSessionLoading || isBrandingLoading || isVisLoading || isBenVisLoading;

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
          repeatBeneficiariesCount: 0,
          isRepeatBeneficiariesVisible: true,
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

    const activeInitiativeIds = new Set([...campaigns.map(c => c.id), ...leads.map(l => l.id)]);
    const skipIds = new Set(brandingSettings?.tickerSkipIds || []);
    const maxDonations = brandingSettings?.tickerMaxDonations ?? 15;
    const maxCompleted = brandingSettings?.tickerMaxCompleted ?? 5;
    const isTickerActiveVisible = brandingSettings?.isTickerActiveVisible !== false;
    const isTickerDonationVisible = brandingSettings?.isTickerDonationVisible !== false;
    const isTickerCompletedVisible = brandingSettings?.isTickerCompletedVisible !== false;

    const startDate = brandingSettings?.summaryStartDate || '';
    const endDate = brandingSettings?.summaryEndDate || '';

    // --- RECONCILIATION ENGINE ---
    // Calculates verified and pending contributions for an individual initiative by summing donations on-the-fly
    const reconcileInitiative = (item: Campaign | Lead, isCampaign: boolean) => {
        const itemType = isCampaign ? 'campaign' : 'lead';
        
        // Filter verified donations linked to this specific initiative
        const itemDonations = donations.filter(d => 
            d.status === 'Verified' && isDonationLinkedToInitiative(d, item.id, item.caseId, itemType as 'campaign' | 'lead')
        );

        let totalCollected = 0;
        const allowedTypes = item.allowedDonationTypes && item.allowedDonationTypes.length > 0
            ? item.allowedDonationTypes
            : [...donationCategories];

        itemDonations.forEach(d => {
            let amountForThisItem = 0;
            const link = getDonationLinkForInitiative(d, item.id, item.caseId, itemType as 'campaign' | 'lead');

            if (link) {
                amountForThisItem = link.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && ((d as any).campaignId === item.id || (d as any).leadId === item.id || d.caseId === item.caseId)) {
                amountForThisItem = d.amount;
            }

            if (amountForThisItem <= 0) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportion = amountForThisItem / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : [{ category: 'Sadaqah' as DonationCategory, amount: d.amount, forFundraising: true }]);
            
            splits.forEach((split: any) => {
                const rawCategory = (split.category as string || '').trim();
                const normalizedCategory = rawCategory === 'General' || rawCategory === 'Sadqa' ? 'Sadaqah' : rawCategory;
                
                const isAllowed = allowedTypes.some(t => t.toLowerCase() === normalizedCategory.toLowerCase());
                
                if (isAllowed) {
                    const isForFundraising = normalizedCategory.toLowerCase() !== 'zakat' || split.forFundraising !== false;
                    if (isForFundraising) {
                        totalCollected += split.amount * proportion;
                    }
                }
            });
        });

        // Filter pending donations linked to this specific initiative
        let totalPending = 0;
        const itemPendingDonations = pendingDonationsList.filter(d => 
            isDonationLinkedToInitiative(d, item.id, item.caseId, itemType as 'campaign' | 'lead')
        );

        itemPendingDonations.forEach(d => {
            let amountForThisItem = 0;
            const link = getDonationLinkForInitiative(d, item.id, item.caseId, itemType as 'campaign' | 'lead');

            if (link) {
                amountForThisItem = link.amount;
            } else if ((!d.linkSplit || d.linkSplit.length === 0) && ((d as any).campaignId === item.id || (d as any).leadId === item.id || d.caseId === item.caseId)) {
                amountForThisItem = d.amount;
            }

            if (amountForThisItem <= 0) return;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const proportion = amountForThisItem / totalDonationAmount;

            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : [{ category: 'Sadaqah' as DonationCategory, amount: d.amount, forFundraising: true }]);
            
            splits.forEach((split: any) => {
                const rawCategory = (split.category as string || '').trim();
                const normalizedCategory = rawCategory === 'General' || rawCategory === 'Sadqa' ? 'Sadaqah' : rawCategory;
                
                const isAllowed = allowedTypes.some(t => t.toLowerCase() === normalizedCategory.toLowerCase());
                
                if (isAllowed) {
                    const isForFundraising = normalizedCategory.toLowerCase() !== 'zakat' || split.forFundraising !== false;
                    if (isForFundraising) {
                        totalPending += split.amount * proportion;
                    }
                }
            });
        });

        const target = Number(item.targetAmount) || 0;
        const docCollected = Number(item.collectedAmount || (item as any).collected || (item as any).raisedAmount || 0);
        const isCompleted = item.status === 'Completed' || item.status === 'Closed' || item.status === 'Archived';
        
        let finalCollected = Math.max(totalCollected, docCollected);
        if (isCompleted && finalCollected < target && target > 0) {
            finalCollected = target;
        }

        const rawProgress = target > 0 ? (finalCollected / target) * 100 : (isCompleted ? 100 : 0);
        const progress = isCompleted ? Math.max(rawProgress, 100) : rawProgress;
        const pendingProgress = target > 0 ? (totalPending / target) * 100 : 0;
        
        return { 
            collected: finalCollected, 
            pendingAmount: totalPending,
            target, 
            progress: Math.min(progress, 100),
            pendingProgress: Math.min(pendingProgress, Math.max(0, 100 - Math.min(progress, 100))),
            totalLinkedAmount: finalCollected + totalPending
        };
    };

    const campaignsWithProgress = campaigns.map(c => ({ ...c, ...reconcileInitiative(c, true) }));
    const leadsWithProgress = leads.map(l => ({ ...l, ...reconcileInitiative(l, false) }));

    // FILTER DONATIONS: Only those linked to Published & Verified initiatives
    const publicLinkedDonations = donations.filter(d => {
        const dDate = d.donationDate || '';
        const inDateRange = (!startDate || dDate >= startDate) && (!endDate || dDate <= endDate);
        if (!inDateRange) return false;

        const isLinkedToPublic = d.linkSplit?.some(l => activeInitiativeIds.has(l.linkId));
        return isLinkedToPublic;
    });

    // --- OVERALL CALCULATION ---
    const combinedItems = [...campaignsWithProgress, ...leadsWithProgress];
    const totalTarget = combinedItems.reduce((sum, item) => sum + item.target, 0);
    const totalGoalReceived = combinedItems.reduce((sum, item) => sum + item.collected, 0);
    
    // grandTotalRaised: Sum of all verified donations linked to these public initiatives
    const grandTotalRaised = publicLinkedDonations.reduce((sum, d) => sum + (d.amount || 0), 0);

    const overallProgress = totalTarget > 0 ? (totalGoalReceived / totalTarget) * 100 : 0;

    const amountsByCategory = publicLinkedDonations.reduce((acc, d) => {
      const totalAmount = d.amount || 1;
      const linkedAmount = d.linkSplit?.filter(l => activeInitiativeIds.has(l.linkId)).reduce((s, l) => s + l.amount, 0) || 0;
      const proportion = linkedAmount / totalAmount;

      const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
      splits.forEach(split => {
        const rawCategory = (split.category as string || '').trim();
        const normalizedCategory = rawCategory === 'General' || rawCategory === 'Sadqa' ? 'Sadaqah' : rawCategory;
        const category = donationCategories.find(c => c.toLowerCase() === normalizedCategory.toLowerCase());
        
        if (category) {
          acc[category] = (acc[category] || 0) + (split.amount * proportion);
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

    publicLinkedDonations.forEach(donation => {
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

    const recentDonationsFormatted = isTickerDonationVisible ? publicLinkedDonations
        .sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())
        .slice(0, maxDonations)
        .map(d => {
            const primaryLink = d.linkSplit?.find(l => activeInitiativeIds.has(l.linkId));
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

    const publicFamiliesImpacted = (user && isStaff && beneficiaries)
        ? beneficiaries.length
        : (benVisSettings?.publicTotalCount || combinedItems.reduce((s, i) => s + ((i as any).beneficiaryStats?.total || 0), 0));

    const publicRepeatCount = (user && isStaff && beneficiaries)
        ? beneficiaries.filter(b => (b.initiativeCount || 0) > 1).length
        : (benVisSettings?.publicRepeatCount || 0);

    return {
      campaignsWithProgress,
      leadsWithProgress,
      overallSummary: {
        totalTarget,
        grandTotalRaised,
        totalCollectedForGoals: totalGoalReceived,
        grandTotalUnlinked: 0, // In public view, we don't show global unlinked pool
        progress: overallProgress,
        familiesImpacted: publicFamiliesImpacted,
        repeatBeneficiariesCount: publicRepeatCount,
        isRepeatBeneficiariesVisible: benVisSettings?.public_repeat_card !== false && visSettings?.public_repeat_card !== false,
        showUnlinkedFunds: false
      },
      yearlySummary: sortedYearlyData,
      categorySummary: Object.entries(amountsByCategory).map(([name, value]) => ({ name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` })),
      recentDonationsFormatted,
      summaryDateRange: (startDate || endDate) ? { start: startDate, end: endDate } : null,
      isTickerActiveVisible,
      isTickerDonationVisible,
      isTickerCompletedVisible,
      skipIds,
      maxCompleted
    };

  }, [isLoading, campaigns, leads, donations, beneficiaries, brandingSettings, visSettings, benVisSettings, user]);

  return { isLoading, ...memoizedData };
}
