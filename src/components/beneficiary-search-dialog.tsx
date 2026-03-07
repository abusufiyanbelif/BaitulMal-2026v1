'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, useCollection, collection, query, getDocs, type QueryDocumentSnapshot } from '@/firebase';
import type { Beneficiary } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, Users, Filter, X, Info } from 'lucide-react';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface BeneficiarySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBeneficiary: (beneficiary: Beneficiary) => void;
  currentLeadId: string;
  initiativeType: 'campaign' | 'lead';
}

export function BeneficiarySearchDialog({ open, onOpenChange, onSelectBeneficiary, currentLeadId, initiativeType }: BeneficiarySearchDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [referralFilter, setReferralFilter] = useState('All');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [masterBeneficiaries, setMasterBeneficiaries] = useState<Beneficiary[]>([]);
  
  const existingBeneficiariesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !currentLeadId || !initiativeType) return null;
    const collectionPath = initiativeType === 'campaign' ? 'campaigns' : 'leads';
    return collection(firestore, `${collectionPath}/${currentLeadId}/beneficiaries`);
  }, [firestore, currentLeadId, initiativeType]);

  const { data: existingBeneficiaries } = useCollection<Beneficiary>(existingBeneficiariesCollectionRef);

  const existingBeneficiaryIds = useMemo(() => {
    return new Set(existingBeneficiaries?.map(b => b.id) || []);
  }, [existingBeneficiaries]);

  const fetchMasterList = useCallback(async () => {
    if (!firestore) return;
    setIsInitialLoading(true);
    try {
      const beneficiariesQuery = query(collection(firestore, 'beneficiaries'));
      const querySnapshot = await getDocs(beneficiariesQuery);
      const results: Beneficiary[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          results.push({ id: doc.id, ...doc.data() } as Beneficiary);
      });
      setMasterBeneficiaries(results);
    } catch (e: any) {
      console.error("Failed to fetch master beneficiary list:", e);
    } finally {
      setIsInitialLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    if (open) {
      fetchMasterList();
      setSearchTerm('');
      setReferralFilter('All');
    }
  }, [open, fetchMasterList]);

  const referralSources = useMemo(() => {
    const sources = new Set<string>();
    masterBeneficiaries.forEach(b => {
        if (b.referralBy?.trim()) sources.add(b.referralBy.trim());
    });
    return Array.from(sources).sort();
  }, [masterBeneficiaries]);

  const filteredResults = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return masterBeneficiaries.filter(b => {
        // 1. Exclude if already in this initiative
        if (existingBeneficiaryIds.has(b.id)) return false;

        // 2. Filter by Referral Source
        if (referralFilter !== 'All' && b.referralBy !== referralFilter) return false;

        // 3. Search by Name, Phone, ID, or Address
        if (!searchTerm) return true;
        
        const nameMatch = (b.name || '').toLowerCase().includes(lowerTerm);
        const phoneMatch = (b.phone || '').includes(searchTerm);
        const idMatch = (b.idNumber || '').toLowerCase().includes(lowerTerm);
        const addressMatch = (b.address || '').toLowerCase().includes(lowerTerm);

        return nameMatch || phoneMatch || idMatch || addressMatch;
    });
  }, [masterBeneficiaries, searchTerm, referralFilter, existingBeneficiaryIds]);

  const handleSelect = (beneficiary: Beneficiary) => {
    onSelectBeneficiary(beneficiary);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl text-primary font-normal p-0 overflow-hidden rounded-[16px] border-primary/10">
        <DialogHeader className="px-6 py-4 bg-primary/5 border-b border-primary/10">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary">Search Master List</DialogTitle>
          <DialogDescription className="text-sm font-normal text-primary/70">
            Select beneficiaries from the verified database to add them to this initiative.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <Input
                        placeholder="Search Name, Phone, ID, Address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 text-sm border-primary/10 focus-visible:ring-primary rounded-[12px] font-normal"
                    />
                    {searchTerm && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent" onClick={() => setSearchTerm('')}>
                            <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
                <Select value={referralFilter} onValueChange={setReferralFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] h-10 font-normal text-sm border-primary/10 rounded-[12px]">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 opacity-40" />
                            <SelectValue placeholder="All Referral Sources" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">
                        <SelectItem value="All" className="font-normal">All Referral Sources</SelectItem>
                        {referralSources.map(source => (
                            <SelectItem key={source} value={source} className="font-normal">{source}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-[12px] border border-primary/10 bg-primary/[0.02] overflow-hidden shadow-inner">
                <ScrollArea className="h-80 w-full">
                    <div className="p-2 space-y-2">
                        {isInitialLoading ? (
                            <div className="space-y-2 p-2">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[10px]" />)}
                            </div>
                        ) : filteredResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <Users className="h-12 w-12 mb-2" />
                                <p className="text-sm font-bold italic">No Beneficiaries Found Matching Criteria.</p>
                            </div>
                        ) : (
                            filteredResults.map(beneficiary => (
                                <div 
                                    key={beneficiary.id} 
                                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-[12px] bg-white border border-transparent hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer"
                                    onClick={() => handleSelect(beneficiary)}
                                >
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-primary truncate">{beneficiary.name}</p>
                                            <Badge variant="outline" className="text-[9px] font-bold border-primary/10 text-primary/60">
                                                {beneficiary.status || 'Verified'}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary/70">
                                            <span className="font-mono">{beneficiary.phone || 'No Phone'}</span>
                                            {beneficiary.idNumber && <span className="font-mono">ID: {beneficiary.idNumber}</span>}
                                            {beneficiary.referralBy && <span className="font-bold text-primary">Ref: {beneficiary.referralBy}</span>}
                                        </div>
                                        {beneficiary.address && (
                                            <p className="text-[10px] text-muted-foreground truncate italic">{beneficiary.address}</p>
                                        )}
                                    </div>
                                    <Button size="sm" className="mt-2 sm:mt-0 font-bold bg-primary hover:bg-primary/90 text-white rounded-[10px] h-8 px-4 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 shadow-sm">
                                        Select Record
                                    </Button>
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
                <Info className="h-3 w-3" /> Allowed Types: {initiativeType === 'campaign' ? 'Campaign Only' : 'Lead Only'}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-primary/20 text-primary h-9 rounded-[10px] transition-transform active:scale-95">
                Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
