
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, collection, query, getDocs, type QueryDocumentSnapshot } from '@/firebase';
import type { Donor } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, Users, Phone, Mail, CheckCircle2, UserPlus, X, Landmark, Smartphone, AlertCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
      console.error("Failed to fetch master donor list:", e);
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
        toast({ title: 'Validation Error', description: 'At least a name is required to create a profile.', variant: 'destructive' });
        return;
    }

    const existing = masterDonors.find(d => 
        (currentFormData.phone && d.phone === currentFormData.phone) || 
        (currentFormData.upiIds?.some(u => d.upiIds?.includes(u)))
    );

    if (existing) {
        toast({ 
            title: 'Profile Already Exists', 
            description: `A matching profile for '${existing.name}' was discovered. Linking to that instead.`, 
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
        notes: `Profile established via Identity Resolution during donation entry.`
    }, { id: userProfile.id, name: userProfile.name });

    if (res.success && res.id) {
        toast({ title: 'New Profile Secured', description: 'Institutional identity registered.', variant: 'success' });
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
      <DialogContent className="sm:max-w-2xl text-primary font-normal p-0 overflow-hidden rounded-[16px] border-primary/10">
        <DialogHeader className="px-6 py-4 bg-primary/5 border-b border-primary/10">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40"/> Retrieve Donor Profile
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-primary/70">
            Select an existing donor or register a new identity from this hub.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                    placeholder="Search by Name, Mobile, Email, UPI, or Account..."
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
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <AlertCircle className="h-12 w-12 mb-4 text-primary/20" />
                                <p className="text-sm font-bold text-primary tracking-tight">No Matching Profiles Discovered</p>
                                <p className="text-[10px] text-muted-foreground mt-1 mb-6">Create a new institutional identity for this contributor.</p>
                                
                                {currentFormData?.name && (
                                    <Button onClick={handleRegisterNewProfile} disabled={isCreating} className="font-bold shadow-md rounded-xl h-11 px-8 group active:scale-95 transition-transform">
                                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />}
                                        Register '{currentFormData.name}' As New Donor
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                {filteredResults.map(donor => (
                                    <div 
                                        key={donor.id} 
                                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-[12px] bg-white border border-transparent hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer"
                                        onClick={() => handleSelect(donor)}
                                    >
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-primary truncate">{donor.name}</p>
                                                <Badge variant={donor.status === 'Active' ? 'eligible' : 'outline'} className="text-[9px] font-bold">
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
                                ))}
                                
                                <Separator className="my-4 bg-primary/10" />
                                <div className="p-4 bg-primary/[0.03] rounded-xl border border-dashed border-primary/20 flex flex-col items-center gap-3">
                                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Entry Not Listed?</p>
                                    <Button variant="outline" size="sm" onClick={handleRegisterNewProfile} disabled={isCreating} className="font-bold border-primary/20 text-primary active:scale-95 transition-transform h-9 px-6 rounded-lg bg-white shadow-sm">
                                        Register New Identity <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </>
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
