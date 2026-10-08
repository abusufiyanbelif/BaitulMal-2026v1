'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, useCollection, collection, query, where, doc, updateDoc, type QueryDocumentSnapshot } from '@/firebase';
import type { Donation, Campaign, Lead, DonationCategory, DonationLink } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, IndianRupee, Filter, X, Link as LinkIcon, AlertCircle, Info, Lock, ShieldAlert } from 'lucide-react';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface DonationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetName: string;
  targetType: 'campaign' | 'lead';
  allowedTypes: DonationCategory[];
}

export function DonationSearchDialog({ open, onOpenChange, targetId, targetName, targetType, allowedTypes }: DonationSearchDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'eligible' | 'ineligible'>('eligible');
  
  const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
  const { data: allDonations, isLoading: isInitialLoading } = useCollection<Donation>(donationsRef);

  const categorizedDonations = useMemo(() => {
    if (!allDonations) return { eligible: [], ineligible: [] };

    const eligible: any[] = [];
    const ineligible: any[] = [];

    allDonations.forEach(d => {
        if (d.status !== 'Verified') return;

        // 1. Exclude if already linked to THIS specific target
        const isAlreadyLinked = d.linkSplit?.some(l => l.linkId === targetId);
        if (isAlreadyLinked) return;

        // 2. Calculate Unallocated Balance
        const totalAllocated = d.linkSplit?.reduce((sum, l) => sum + l.amount, 0) || 0;
        const unallocatedBalance = d.amount - totalAllocated;
        if (unallocatedBalance <= 0.01) return; // Basically zero

        // 3. Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const matchesSearch = (
                (d.donorName || '').toLowerCase().includes(lowerTerm) ||
                (d.donorPhone || '').includes(searchTerm) ||
                (d.id || '').toLowerCase().includes(lowerTerm) ||
                (d.receiverName || '').toLowerCase().includes(lowerTerm)
            );
            if (!matchesSearch) return;
        }

        // 4. Check if any Designation (typeSplit) matches target's allowed types
        const allowedDesignationSum = d.typeSplit?.reduce((sum, split) => {
            const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
            if (allowedTypes.includes(category as DonationCategory)) {
                return sum + split.amount;
            }
            return sum;
        }, 0) || 0;

        const donationCategories = (d.typeSplit && d.typeSplit.length > 0) 
            ? d.typeSplit.map(s => s.category) 
            : (d.type ? [d.type] : []);

        const item = {
            ...d,
            unallocatedBalance,
            allowedDesignationSum,
            maxPossibleLink: Math.min(unallocatedBalance, allowedDesignationSum),
            donationCategories,
            isCategoryAllowed: allowedDesignationSum > 0
        };

        if (allowedDesignationSum > 0) {
            eligible.push(item);
        } else {
            ineligible.push(item);
        }
    });

    return { eligible, ineligible };
  }, [allDonations, searchTerm, targetId, allowedTypes]);

  // Auto-switch to ineligible tab if 0 eligible funds exist but ineligible ones exist
  useEffect(() => {
    if (categorizedDonations.eligible.length === 0 && categorizedDonations.ineligible.length > 0) {
        setActiveTab('ineligible');
    } else if (categorizedDonations.eligible.length > 0) {
        setActiveTab('eligible');
    }
  }, [categorizedDonations.eligible.length, categorizedDonations.ineligible.length]);

  const displayedDonations = activeTab === 'eligible' ? categorizedDonations.eligible : categorizedDonations.ineligible;

  const [confirmDonationToLink, setConfirmDonationToLink] = useState<any | null>(null);

  const executeLink = async (donation: any) => {
    if (!firestore || isLinking) return;
    
    setIsLinking(donation.id);
    const docRef = doc(firestore, 'donations', donation.id);
    
    const newLink: DonationLink = {
        linkId: targetId,
        linkName: targetName,
        linkType: targetType,
        amount: donation.maxPossibleLink
    };

    const currentLinks = donation.linkSplit || [];
    const updatedLinks = [...currentLinks, newLink];

    try {
        await updateDoc(docRef, { linkSplit: updatedLinks });
        toast({ title: 'Donation Linked', description: `₹${donation.maxPossibleLink.toLocaleString()} Allocated To ${targetName}.`, variant: 'success' });
        setConfirmDonationToLink(null);
        onOpenChange(false);
    } catch (e: any) {
        console.error("Linking Failed:", e);
        toast({ title: 'Linking Failed', description: 'Database Permission Denied.', variant: 'destructive' });
    } finally {
        setIsLinking(null);
    }
  };

  const handleLinkDonation = async (donation: any) => {
    setConfirmDonationToLink(donation);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col text-primary font-normal p-0 overflow-hidden rounded-[16px] border-primary/10 shadow-2xl animate-fade-in-zoom">
        <DialogHeader className="px-6 py-4 bg-primary/5 border-b border-primary/10 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary">Link Master Donation</DialogTitle>
          <DialogDescription className="text-sm font-normal text-primary/70">
            Allocate unassigned funds from verified global donations to this initiative.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 space-y-4">
            <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                    placeholder="Search Donor Name, Phone, Or Reference ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 text-sm border-primary/10 focus-visible:ring-primary rounded-[12px] font-normal"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 p-1 bg-primary/5 rounded-[12px] shrink-0 border border-primary/10">
                <button
                    type="button"
                    onClick={() => setActiveTab('eligible')}
                    className={cn(
                        "flex-1 py-1.5 px-3 rounded-[8px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        activeTab === 'eligible' ? "bg-white text-primary shadow-sm" : "text-primary/60 hover:text-primary"
                    )}
                >
                    <span>Eligible Funds</span>
                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 h-4 bg-emerald-100 text-emerald-800 border-0">
                        {categorizedDonations.eligible.length}
                    </Badge>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('ineligible')}
                    className={cn(
                        "flex-1 py-1.5 px-3 rounded-[8px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        activeTab === 'ineligible' ? "bg-white text-amber-900 shadow-sm" : "text-primary/60 hover:text-primary"
                    )}
                >
                    <Lock className="h-3 w-3 text-amber-600" />
                    <span>Not Allowed (Category Mismatch)</span>
                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 h-4 bg-amber-100 text-amber-900 border-0">
                        {categorizedDonations.ineligible.length}
                    </Badge>
                </button>
            </div>

            {/* Ineligible Alert Banner when activeTab === 'ineligible' or eligible.length === 0 */}
            {categorizedDonations.eligible.length === 0 && categorizedDonations.ineligible.length > 0 && activeTab === 'eligible' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-[12px] flex items-start gap-2.5 text-amber-900 text-xs shrink-0 animate-fade-in-up">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-amber-900">No Eligible Funds Matching Allowed Categories</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                            Found {categorizedDonations.ineligible.length} unallocated verified donations, but their fund categories are not permitted by this cause&apos;s allowed donation types setting.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 rounded-[12px] border border-primary/10 bg-primary/[0.02] overflow-hidden shadow-inner relative">
                <ScrollArea className="h-full w-full">
                    <div className="p-2 space-y-2">
                        {isInitialLoading ? (
                            <div className="space-y-2 p-2">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[10px]" />)}
                            </div>
                        ) : displayedDonations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                <IndianRupee className="h-12 w-12 mb-2 opacity-40 text-primary" />
                                <p className="text-sm font-bold text-primary">
                                    {activeTab === 'eligible' ? 'No Eligible Unallocated Donations Found.' : 'No Category-Restricted Donations Found.'}
                                </p>
                                <p className="text-[11px] font-medium tracking-tight mt-1 text-primary/70">
                                    {activeTab === 'eligible' 
                                        ? `Check allowed types: ${allowedTypes.join(', ')}` 
                                        : 'All unallocated donations match this cause\'s settings.'}
                                </p>
                            </div>
                        ) : (
                            displayedDonations.map((donation: any) => (
                                <div 
                                    key={donation.id} 
                                    className={cn(
                                        "p-4 rounded-[12px] border transition-all group",
                                        donation.isCategoryAllowed 
                                            ? "bg-white border-transparent hover:border-primary/20 hover:shadow-sm" 
                                            : "bg-amber-50/40 border-amber-200/60"
                                    )}
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-sm text-primary truncate">{donation.donorName}</p>
                                                <Badge variant="outline" className="text-[9px] font-bold border-primary/10 text-primary/60">
                                                    {donation.donationType}
                                                </Badge>
                                                {!donation.isCategoryAllowed && (
                                                    <Badge variant="secondary" className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                                                        <Lock className="h-2.5 w-2.5" /> Not Allowed per Settings
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-primary/70">
                                                <span className="font-mono">{donation.donationDate}</span>
                                                <span className="font-mono">ID: {donation.id}</span>
                                                {(donation.caseId || donation.linkSplit?.[0]?.caseId) && (
                                                    <span className="font-mono text-emerald-700 font-bold">Case ID: {donation.caseId || donation.linkSplit?.[0]?.caseId}</span>
                                                )}
                                            </div>
                                            <div className="pt-2 flex flex-wrap gap-1">
                                                {(donation.typeSplit || []).map((ts: any, idx: number) => {
                                                    const isCatAllowed = allowedTypes.includes(ts.category as any);
                                                    return (
                                                        <Badge 
                                                            key={idx} 
                                                            variant="secondary" 
                                                            className={cn(
                                                                "text-[8px] font-bold h-4 border",
                                                                isCatAllowed 
                                                                    ? "bg-primary/5 text-primary border-primary/10" 
                                                                    : "bg-amber-100 text-amber-900 border-amber-300"
                                                            )}
                                                        >
                                                            {ts.category}: ₹{ts.amount.toLocaleString()} {!isCatAllowed && '(Restricted)'}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="text-right space-y-2 shrink-0">
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] font-bold text-muted-foreground tracking-tighter">
                                                    {donation.isCategoryAllowed ? 'Available To Link' : 'Unallocated Balance'}
                                                </p>
                                                <p className={cn("font-mono font-bold text-lg", donation.isCategoryAllowed ? "text-primary" : "text-amber-900 opacity-80")}>
                                                    ₹{(donation.isCategoryAllowed ? donation.maxPossibleLink : donation.unallocatedBalance).toLocaleString()}
                                                </p>
                                            </div>
                                            {donation.isCategoryAllowed ? (
                                                <Button 
                                                    size="sm" 
                                                    className="font-bold bg-primary hover:bg-primary/90 text-white rounded-[10px] h-8 px-4 transition-all active:scale-95 shadow-sm"
                                                    onClick={() => handleLinkDonation(donation)}
                                                    disabled={!!isLinking}
                                                >
                                                    {isLinking === donation.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <LinkIcon className="mr-2 h-3 w-3" />}
                                                    Link Funds
                                                </Button>
                                            ) : (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    disabled 
                                                    className="font-bold border-amber-300 text-amber-800 bg-amber-100/50 text-[10px] h-8 px-3 opacity-80 cursor-not-allowed"
                                                >
                                                    <Lock className="mr-1.5 h-3 w-3 text-amber-700" /> Category Restricted
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Explanation note for Category Mismatch */}
                                    {!donation.isCategoryAllowed && (
                                        <div className="mt-3 p-2 bg-amber-100/70 rounded-md border border-amber-200 flex items-start gap-2 text-amber-900 text-[10px] font-medium leading-tight">
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                                            <span>
                                                <strong>Not Allowed:</strong> This donation&apos;s category ({donation.donationCategories.join(', ')}) is not included in this cause&apos;s allowed donation types settings (Allowed: {allowedTypes.join(', ')}). You can update allowed types in cause settings if appropriate.
                                            </span>
                                        </div>
                                    )}

                                    {donation.isCategoryAllowed && donation.unallocatedBalance > donation.maxPossibleLink && (
                                        <div className="mt-3 p-2 bg-amber-50 rounded-md border border-amber-100 flex items-start gap-2 animate-fade-in-up">
                                            <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5" />
                                            <p className="text-[10px] font-normal text-amber-800 leading-tight">
                                                Partial Allocation: Only ₹{donation.maxPossibleLink.toLocaleString()} Matches The Allowed Categories For This {targetType}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-primary/[0.02] border-t border-primary/10">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 text-[10px] font-bold text-primary/60 tracking-tight">
                <Info className="h-3 w-3" /> Allowed Types: {allowedTypes.join(', ')}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-primary/20 text-primary h-9 rounded-[10px] transition-transform active:scale-95">
                Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={!!confirmDonationToLink} onOpenChange={(val) => { if (!val) setConfirmDonationToLink(null); }}>
        <DialogContent className="max-w-md rounded-[16px] border-primary/10 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-primary/5 p-6 border-b border-primary/10">
            <DialogTitle className="text-lg font-bold text-primary flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary shrink-0" /> Confirm Donation Allocation
            </DialogTitle>
            <DialogDescription className="text-xs text-primary/70 mt-1 font-medium">
              Target: <strong>{targetName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 text-sm font-medium text-primary/80 space-y-3 bg-white">
            <p>
              Are you sure you want to allocate <strong>₹{confirmDonationToLink?.maxPossibleLink?.toLocaleString()}</strong> from <strong>{confirmDonationToLink?.donorName || 'Donor'}</strong> to this initiative?
            </p>
            <p className="text-xs text-muted-foreground bg-primary/[0.02] p-3 rounded-lg border border-primary/10">
              This action will update the collection goal progress for {targetName}.
            </p>
          </div>
          <DialogFooter className="p-4 bg-gray-50 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDonationToLink(null)} className="font-bold border-primary/20">
              Cancel
            </Button>
            <Button onClick={() => executeLink(confirmDonationToLink)} disabled={!!isLinking} className="font-bold bg-primary text-white shadow-md">
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, Link Donation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
