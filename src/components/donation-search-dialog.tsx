'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, useCollection, collection, query, where, doc, updateDoc, type QueryDocumentSnapshot } from '@/firebase';
import type { Donation, Campaign, Lead, DonationCategory, DonationLink } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, IndianRupee, Filter, X, Link as LinkIcon, AlertCircle, Info } from 'lucide-react';
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
  
  const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
  const { data: allDonations, isLoading: isInitialLoading } = useCollection<Donation>(donationsRef);

  const eligibleDonations = useMemo(() => {
    if (!allDonations) return [];

    return allDonations.filter(d => {
        if (d.status !== 'Verified') return false;

        // 1. Exclude if already linked to THIS specific target
        const isAlreadyLinked = d.linkSplit?.some(l => l.linkId === targetId);
        if (isAlreadyLinked) return false;

        // 2. Calculate Unallocated Balance
        const totalAllocated = d.linkSplit?.reduce((sum, l) => sum + l.amount, 0) || 0;
        const unallocatedBalance = d.amount - totalAllocated;
        if (unallocatedBalance <= 0.01) return false; // Basically zero

        // 3. Check if any Designation (typeSplit) matches target's allowed types
        const allowedDesignationSum = d.typeSplit?.reduce((sum, split) => {
            const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
            if (allowedTypes.includes(category as DonationCategory)) {
                return sum + split.amount;
            }
            return sum;
        }, 0) || 0;

        if (allowedDesignationSum <= 0) return false;

        // 4. Search Filter
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            d.donorName.toLowerCase().includes(lowerTerm) ||
            d.donorPhone.includes(searchTerm) ||
            d.id.toLowerCase().includes(lowerTerm) ||
            d.receiverName.toLowerCase().includes(lowerTerm)
        );
    }).map(d => {
        const totalAllocated = d.linkSplit?.reduce((sum, l) => sum + l.amount, 0) || 0;
        const unallocatedBalance = d.amount - totalAllocated;
        const allowedDesignationSum = d.typeSplit?.reduce((sum, split) => {
            const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
            return allowedTypes.includes(category as DonationCategory) ? sum + split.amount : sum;
        }, 0) || 0;

        return {
            ...d,
            unallocatedBalance,
            maxPossibleLink: Math.min(unallocatedBalance, allowedDesignationSum)
        };
    });
  }, [allDonations, searchTerm, targetId, allowedTypes]);

  const handleLinkDonation = async (donation: any) => {
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
        onOpenChange(false);
    } catch (e: any) {
        console.error("Linking Failed:", e);
        toast({ title: 'Linking Failed', description: 'Institutional Database Permission Denied.', variant: 'destructive' });
    } finally {
        setIsLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl text-primary font-normal p-0 overflow-hidden rounded-[16px] border-[#E2EEE7]">
        <DialogHeader className="px-6 py-4 bg-[#F0FDF4] border-b border-[#E2EEE7]">
          <DialogTitle className="text-xl font-bold tracking-tight text-[#14532D]">Link Master Donation</DialogTitle>
          <DialogDescription className="text-sm font-normal text-[#355E3B]/70">
            Allocate unassigned funds from verified global donations to this initiative.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1FA34A]/50" />
                <Input
                    placeholder="Search Donor Name, Phone, Or Reference ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 text-sm border-[#E2EEE7] focus-visible:ring-[#1FA34A] rounded-[12px] font-normal"
                />
            </div>

            <div className="rounded-[12px] border border-[#E2EEE7] bg-[#F7FBF8]/50 overflow-hidden shadow-inner">
                <ScrollArea className="h-[400px] w-full">
                    <div className="p-2 space-y-2">
                        {isInitialLoading ? (
                            <div className="space-y-2 p-2">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[10px]" />)}
                            </div>
                        ) : eligibleDonations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <IndianRupee className="h-12 w-12 mb-2" />
                                <p className="text-sm font-bold italic">No Eligible Unallocated Donations Found.</p>
                                <p className="text-[10px] uppercase font-normal tracking-widest mt-1">Check Allowed Donation Types Or Global Balance.</p>
                            </div>
                        ) : (
                            eligibleDonations.map(donation => (
                                <div 
                                    key={donation.id} 
                                    className="p-4 rounded-[12px] bg-white border border-transparent hover:border-[#1FA34A]/20 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-[#14532D] truncate">{donation.donorName}</p>
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase border-[#E2EEE7] text-[#355E3B]/60">
                                                    {donation.donationType}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#355E3B]/70">
                                                <span className="font-mono">{donation.donationDate}</span>
                                                <span className="font-mono">ID: {donation.id.slice(-6).toUpperCase()}</span>
                                            </div>
                                            <div className="pt-2 flex flex-wrap gap-1">
                                                {donation.typeSplit.map((ts, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-[8px] font-bold h-4">
                                                        {ts.category}: ₹{ts.amount.toLocaleString()}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right space-y-2 shrink-0">
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Available To Link</p>
                                                <p className="font-mono font-bold text-lg text-[#1FA34A]">₹{donation.maxPossibleLink.toLocaleString()}</p>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                className="font-bold bg-[#1FA34A] hover:bg-[#16863B] text-white rounded-[10px] h-8 px-4 transition-all active:scale-95 shadow-sm"
                                                onClick={() => handleLinkDonation(donation)}
                                                disabled={!!isLinking}
                                            >
                                                {isLinking === donation.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <LinkIcon className="mr-2 h-3 w-3" />}
                                                Link Funds
                                            </Button>
                                        </div>
                                    </div>
                                    {donation.unallocatedBalance > donation.maxPossibleLink && (
                                        <div className="mt-3 p-2 bg-amber-50 rounded-md border border-amber-100 flex items-start gap-2 animate-fade-in-up">
                                            <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5" />
                                            <p className="text-[10px] font-normal text-amber-800 leading-tight">
                                                Partial allocation: Only ₹{donation.maxPossibleLink.toLocaleString()} matches the allowed categories for this {targetType}.
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

        <DialogFooter className="px-6 py-4 bg-[#F7FBF8] border-t border-[#E2EEE7]">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#14532D]/60 uppercase tracking-widest">
                <Info className="h-3 w-3" /> Allowed: {allowedTypes.join(', ')}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-[#CDE8D5] text-[#14532D] h-9 rounded-[10px] transition-transform active:scale-95">
                Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
