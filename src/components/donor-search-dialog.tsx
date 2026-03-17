'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, collection, query, getDocs, type QueryDocumentSnapshot } from '@/firebase';
import type { Donor } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, Users, Phone, Mail, CheckCircle2, UserPlus, X, AlertCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSession } from '@/hooks/use-session';
import { createDonorAction } from '@/app/donors/actions';
import { useToast } from '@/hooks/use-toast';

interface DonorSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDonor: (donor: Donor) => void;
  currentFormData?: {
      name: string;
      phone?: string;
      upiIds?: string[];
  };
}

/**
 * Donor Search Dialog - Re-engineered for high-fidelity mobile alignment.
 * Compact buttons and scroll-enabled results zones.
 */
export function DonorSearchDialog({ open, onOpenChange, onSelectDonor, currentFormData }: DonorSearchDialogProps) {
  const firestore = useFirestore();
  const { userProfile } = useSession();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [masterDonors, setMasterDonors] = useState<Donor[]>([]);
  
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
      console.error("Failed To Fetch Master Donor List:", e);
    } finally {
      setIsInitialLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    if (open) {
      fetchMasterList();
      setSearchTerm(currentFormData?.phone || currentFormData?.name || '');
    }
  }, [open, fetchMasterList, currentFormData]);

  const filteredResults = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    if (!searchTerm) return masterDonors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return masterDonors.filter(d => {
        const nameMatch = (d.name || '').toLowerCase().includes(lowerTerm);
        const phoneMatch = (d.phone || '').includes(searchTerm);
        const emailMatch = (d.email || '').toLowerCase().includes(lowerTerm);
        const upiMatch = d.upiIds?.some(u => u.toLowerCase().includes(lowerTerm));
        const accMatch = d.accountNumbers?.some(a => a.includes(searchTerm));
        return nameMatch || phoneMatch || emailMatch || upiMatch || accMatch;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [masterDonors, searchTerm]);

  const handleRegisterNewProfile = async () => {
    if (!userProfile || !currentFormData?.name) {
        toast({ title: 'Validation Error', description: 'At Least A Name Is Required To Create A Profile.', variant: 'destructive' });
        return;
    }

    const existing = masterDonors.find(d => 
        (currentFormData.phone && d.phone === currentFormData.phone) || 
        (currentFormData.upiIds?.some(u => d.upiIds?.includes(u)))
    );

    if (existing) {
        toast({ 
            title: 'Profile Already Exists', 
            description: `A Matching Profile For '${existing.name}' Was Discovered. Linking To That Instead.`, 
            variant: 'info' 
        });
        onSelectDonor(existing);
        onOpenChange(false);
        return;
    }

    setIsCreating(true);
    const res = await createDonorAction({
        name: currentFormData.name,
        phone: currentFormData.phone || '',
        upiIds: currentFormData.upiIds || [],
        status: 'Active',
        notes: `Profile Established Via Identity Resolution During Donation Entry.`
    }, { id: userProfile.id, name: userProfile.name });

    if (res.success && res.id) {
        toast({ title: 'New Profile Secured', description: 'Institutional Identity Registered.', variant: 'success' });
        onSelectDonor({ id: res.id, name: currentFormData.name, phone: currentFormData.phone || '', status: 'Active' } as Donor);
        onOpenChange(false);
    } else {
        toast({ title: 'Creation Failed', description: res.message, variant: 'destructive' });
    }
    setIsCreating(false);
  };

  const handleSelect = (donor: Donor) => {
    onSelectDonor(donor);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] text-primary font-normal p-0 overflow-hidden rounded-[24px] border-primary/10 flex flex-col shadow-2xl animate-fade-in-zoom">
        <DialogHeader className="px-6 py-6 bg-primary/5 border-b border-primary/10 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40"/> Retrieve Donor Profile
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-primary/70 pr-6">
            Select An Existing Donor Or Register A New Identity From This Hub.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 space-y-4">
            <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                    placeholder="Search By Name, Mobile, Email, UPI, Or Account..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-primary/10 focus-visible:ring-primary rounded-xl font-normal shadow-sm"
                />
                {searchTerm && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent" onClick={() => setSearchTerm('')}>
                        <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                )}
            </div>

            <div className="flex-1 rounded-2xl border border-primary/10 bg-primary/[0.02] overflow-hidden shadow-inner relative">
                <ScrollArea className="h-full w-full">
                    <div className="p-2 space-y-2">
                        {isInitialLoading ? (
                            <div className="space-y-3 p-2">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                            </div>
                        ) : filteredResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                <AlertCircle className="h-12 w-12 mb-4 text-primary/20" />
                                <p className="text-sm font-bold text-primary tracking-tight">No Matching Profiles Discovered</p>
                                <p className="text-[10px] text-muted-foreground mt-1 mb-8 font-normal max-w-[200px]">Register A New Institutional Identity For This Contributor.</p>
                                
                                {currentFormData?.name && (
                                    <Button onClick={handleRegisterNewProfile} disabled={isCreating} className="font-bold shadow-md rounded-xl h-12 px-8 group active:scale-95 transition-transform w-full sm:w-auto">
                                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />}
                                        <span className="truncate">Register '{currentFormData.name}'</span>
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="pb-4">
                                {filteredResults.map(donor => (
                                    <div 
                                        key={donor.id} 
                                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-white border border-transparent hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer mb-2"
                                        onClick={() => handleSelect(donor)}
                                    >
                                        <div className="flex-1 min-w-0 space-y-1 pr-2">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-primary truncate">{donor.name}</p>
                                                <Badge variant={donor.status === 'Active' ? 'eligible' : 'outline'} className="text-[9px] font-bold">
                                                    {donor.status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary/70">
                                                <span className="flex items-center gap-1.5 font-mono font-bold"><Phone className="h-3 w-3 opacity-40"/> {donor.phone}</span>
                                                {donor.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 opacity-40"/> {donor.email}</span>}
                                            </div>
                                        </div>
                                        <Button size="sm" className="mt-3 sm:mt-0 font-bold bg-primary hover:bg-primary/90 text-white rounded-lg h-8 px-4 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 shadow-sm shrink-0">
                                            Load Profile
                                        </Button>
                                    </div>
                                ))}
                                
                                <Separator className="my-6 bg-primary/10" />
                                <div className="p-6 bg-primary/[0.03] rounded-2xl border border-dashed border-primary/20 flex flex-col items-center gap-4 text-center mx-2">
                                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Entry Not Listed?</p>
                                    <Button variant="outline" size="sm" onClick={handleRegisterNewProfile} disabled={isCreating} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform h-10 px-8 rounded-xl bg-white shadow-sm w-full sm:w-auto">
                                        Register New Identity <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-primary/[0.02] border-t border-primary/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-bold text-primary/60 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" /> Secure Institutional Identity Retrieval
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-primary/20 text-primary h-10 px-10 rounded-xl transition-transform active:scale-95 w-full sm:w-auto">
                Close Hub
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
