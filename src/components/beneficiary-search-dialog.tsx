
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { Beneficiary } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search } from 'lucide-react';

interface BeneficiarySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBeneficiary: (beneficiary: Beneficiary) => void;
  currentLeadId: string;
}

export function BeneficiarySearchDialog({ open, onOpenChange, onSelectBeneficiary, currentLeadId }: BeneficiarySearchDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Beneficiary[]>([]);

  const handleSearch = useCallback(async () => {
    if (!firestore || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    const lowerCaseTerm = searchTerm.toLowerCase();

    try {
      const beneficiariesQuery = query(collection(firestore, 'beneficiaries'));
      const querySnapshot = await getDocs(beneficiariesQuery);
      const allBeneficiaries: Beneficiary[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          allBeneficiaries.push({ id: doc.id, ...doc.data() } as Beneficiary);
      });

      const filtered = allBeneficiaries.filter(b => 
        b.name.toLowerCase().includes(lowerCaseTerm) || 
        (b.phone && b.phone.includes(searchTerm))
      ).slice(0, 20);

      setSearchResults(filtered);
    } catch (e: any) {
      console.error("Beneficiary search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, [firestore, searchTerm]);

  const handleSelect = (beneficiary: Beneficiary) => {
    onSelectBeneficiary(beneficiary);
    onOpenChange(false);
  };

  useEffect(() => {
    // Reset search when dialog opens
    if (open) {
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Existing Beneficiaries</DialogTitle>
          <DialogDescription>
            Search by name or phone number to find and add an existing beneficiary from the master list.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Enter name or phone number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4"/>}
                </Button>
            </div>
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-4 space-y-2">
                    {isSearching && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    {!isSearching && searchResults.length === 0 && (
                        <p className="text-center text-muted-foreground pt-10">{searchTerm ? 'No results found.' : 'Enter a search term to begin.'}</p>
                    )}
                    {!isSearching && searchResults.map(beneficiary => (
                        <div key={beneficiary.id} className="flex justify-between items-center p-2 rounded-md hover:bg-accent">
                            <div>
                                <p className="font-medium">{beneficiary.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {beneficiary.phone || 'No Phone'}
                                    {beneficiary.address && ` - ${beneficiary.address}`}
                                </p>
                            </div>
                            <Button size="sm" onClick={() => handleSelect(beneficiary)}>Select</Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
