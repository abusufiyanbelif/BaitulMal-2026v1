'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, useCollection, collection, query, getDocs, type QueryDocumentSnapshot } from '@/firebase';
import type { Donor } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, Users, Phone, Mail, CheckCircle2, UserPlus, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface DonorSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDonor: (donor: Donor) => void;
}

export function DonorSearchDialog({ open, onOpenChange, onSelectDonor }: DonorSearchDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [masterDonors, setMasterDonors] = useState<Donor[]>([]);
  
  const donorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donors') : null, [firestore]);

  const fetchMasterList = useCallback(async () => {
    if (!firestore) return;
    setIsInitialLoading(true);
    try {
      const donorsQuery = query(collection(firestore, 'donors'));
      const querySnapshot = await getDocs(donorsQuery);
      const results: Donor[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          results.push({ id: doc.id, ...doc.data() } as Donor);
      });
      setMasterDonors(results);
    } catch (e: any) {
      console.error("Failed to fetch master donor list:", e);
    } finally {
      setIsInitialLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    if (open) {
      fetchMasterList();
      setSearchTerm('');
    }
  }, [open, fetchMasterList]);

  const filteredResults = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    if (!searchTerm) return masterDonors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return masterDonors.filter(d => {
        const nameMatch = (d.name || '').toLowerCase().includes(lowerTerm);
        const phoneMatch = (d.phone || '').includes(searchTerm);
        const emailMatch = (d.email || '').toLowerCase().includes(lowerTerm);
        return nameMatch || phoneMatch || emailMatch;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [masterDonors, searchTerm]);

  const handleSelect = (donor: Donor) => {
    onSelectDonor(donor);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl text-primary font-normal p-0 overflow-hidden rounded-[16px] border-primary/10">
        <DialogHeader className="px-6 py-4 bg-primary/5 border-b border-primary/10">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40"/> Retrieve Donor Profile
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-primary/70">
            Select an existing donor to populate current donation records with verified information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                    placeholder="Search by Name, Mobile, or Email..."
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

            <div className="rounded-[12px] border border-primary/10 bg-primary/[0.02] overflow-hidden shadow-inner h-[350px]">
                <ScrollArea className="h-full w-full">
                    <div className="p-2 space-y-2">
                        {isInitialLoading ? (
                            <div className="space-y-2 p-2">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[10px]" />)}
                            </div>
                        ) : filteredResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <Users className="h-12 w-12 mb-2" />
                                <p className="text-sm font-bold italic">No Donor Profile Discovered.</p>
                                <p className="text-[10px] font-normal tracking-tight mt-1">Refine Your Search Or Create A New Entry.</p>
                            </div>
                        ) : (
                            filteredResults.map(donor => (
                                <div 
                                    key={donor.id} 
                                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-[12px] bg-white border border-transparent hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer"
                                    onClick={() => handleSelect(donor)}
                                >
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-primary truncate">{donor.name}</p>
                                            <Badge variant={donor.status === 'Active' ? 'active' : 'outline'} className="text-[9px] font-bold">
                                                {donor.status}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary/70">
                                            <span className="flex items-center gap-1.5 font-mono"><Phone className="h-3 w-3 opacity-40"/> {donor.phone}</span>
                                            {donor.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 opacity-40"/> {donor.email}</span>}
                                        </div>
                                    </div>
                                    <Button size="sm" className="mt-2 sm:mt-0 font-bold bg-primary hover:bg-primary/90 text-white rounded-[10px] h-8 px-4 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 shadow-sm">
                                        Load Profile
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
            <p className="text-[10px] font-bold text-primary/60 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" /> Secure Institutional Identity Retrieval
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-primary/20 text-primary h-9 rounded-[10px] transition-transform active:scale-95">
                Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
