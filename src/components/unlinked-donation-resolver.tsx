'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
    useFirestore, 
    useCollection, 
    useMemoFirebase, 
    collection, 
    query, 
    getDocs,
    doc
} from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Loader2, 
    Search, 
    UserPlus, 
    ShieldCheck, 
    IndianRupee, 
    CheckCircle2, 
    X, 
    AlertCircle, 
    ArrowRight,
    Edit,
    Smartphone,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { linkDonationToDonorAction } from '@/app/donations/actions';
import { createDonorAction } from '@/app/donors/actions';
import type { Donation, Donor } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface UnlinkedDonationResolverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialDonationId?: string | null;
}

/**
 * Unlinked Donation Resolver - Optimized for mobile alignment and compact interaction.
 * Features independent scroll zones and professional Title Case typography.
 */
export function UnlinkedDonationResolver({ open, onOpenChange, initialDonationId }: UnlinkedDonationResolverProps) {
    const firestore = useFirestore();
    const { userProfile } = useSession();
    const { toast } = useToast();

    const [isResolving, setIsResolving] = useState<string | null>(null);
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Donor[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
    const { data: allDonations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsRef);

    const unlinkedDonations = useMemo(() => {
        if (!allDonations) return [];
        return allDonations.filter(d => !d.donorId).sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());
    }, [allDonations]);

    const totalPages = Math.ceil(unlinkedDonations.length / itemsPerPage);
    const paginatedDonations = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return unlinkedDonations.slice(start, start + itemsPerPage);
    }, [unlinkedDonations, currentPage]);

    useEffect(() => {
        if (open && initialDonationId && unlinkedDonations.length > 0) {
            const found = unlinkedDonations.find(d => d.id === initialDonationId);
            if (found) {
                setSelectedDonation(found);
                setSearchTerm(found.donorPhone || found.donorName);
            }
        }
    }, [open, initialDonationId, unlinkedDonations]);

    useEffect(() => {
        setCurrentPage(1);
    }, [unlinkedDonations.length, searchTerm]);

    useEffect(() => {
        const fetchMatches = async () => {
            if (!firestore || !searchTerm.trim()) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const q = query(collection(firestore, 'donors'));
                const snap = await getDocs(q);
                const donors: Donor[] = [];
                const term = searchTerm.toLowerCase();
                snap.forEach(docSnap => {
                    const d = { id: docSnap.id, ...docSnap.data() } as Donor;
                    const nameMatch = d.name.toLowerCase().includes(term);
                    const phoneMatch = d.phone.includes(searchTerm);
                    const upiMatch = d.upiIds?.some(u => u.toLowerCase().includes(term));
                    if (nameMatch || phoneMatch || upiMatch) {
                        donors.push(d);
                    }
                });
                setSearchResults(donors);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchMatches, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, firestore]);

    const handleLinkToExisting = async (donor: Donor) => {
        if (!selectedDonation || !userProfile) return;
        setIsResolving(selectedDonation.id);
        const res = await linkDonationToDonorAction(selectedDonation.id, donor.id, { id: userProfile.id, name: userProfile.name });
        if (res.success) {
            toast({ title: 'Identity Mapped', description: `Successfully Consolidated Records For ${donor.name}.`, variant: 'success' });
            setSelectedDonation(null);
        } else {
            toast({ title: 'Mapping Failed', description: res.message, variant: 'destructive' });
        }
        setIsResolving(null);
    };

    const handleCreateNewProfile = async () => {
        if (!selectedDonation || !userProfile) return;
        setIsResolving(selectedDonation.id);
        
        const donorUpis = selectedDonation.transactions?.map(t => t.upiId).filter(Boolean) as string[];

        const res = await createDonorAction({
            name: selectedDonation.donorName,
            phone: selectedDonation.donorPhone || '',
            upiIds: Array.from(new Set(donorUpis)),
            status: 'Active',
            notes: `Profile Established Via Identity Resolution Hub For Contribution Entry.`
        }, { id: userProfile.id, name: userProfile.name });

        if (res.success && res.id) {
            const linkRes = await linkDonationToDonorAction(selectedDonation.id, res.id, { id: userProfile.id, name: userProfile.name });
            if (linkRes.success) {
                toast({ title: 'New Profile Registered', description: 'Institutional Identity Secured And Linked.', variant: 'success' });
                setSelectedDonation(null);
            }
        } else {
            toast({ title: 'Creation Failed', description: res.message, variant: 'destructive' });
        }
        setIsResolving(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[24px] border-primary/10 shadow-2xl animate-fade-in-zoom">
                <DialogHeader className="bg-primary/5 px-6 py-6 border-b shrink-0">
                    <DialogTitle className="text-2xl font-bold text-primary tracking-tight">Identity Resolver Hub</DialogTitle>
                    <DialogDescription className="font-normal text-primary/70">
                        Map Unlinked Contributions To Verified Institutional Donor Profiles.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                    {/* Sidebar: Unlinked Records List */}
                    <div className="w-full md:w-1/3 lg:w-1/4 border-r border-primary/5 flex flex-col bg-muted/5 h-1/3 md:h-full shrink-0">
                        <div className="p-4 bg-white border-b flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Unlinked Records</h3>
                            <Badge variant="secondary" className="h-5 text-[9px] font-bold">{unlinkedDonations.length}</Badge>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {isLoadingDonations ? (
                                    <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary/20"/></div>
                                ) : unlinkedDonations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                                        <CheckCircle2 className="h-10 w-10 mb-2"/>
                                        <p className="text-xs font-bold uppercase tracking-widest">Registry Secure</p>
                                    </div>
                                ) : (
                                    paginatedDonations.map(d => (
                                        <div 
                                            key={d.id}
                                            onClick={() => { setSelectedDonation(d); setSearchTerm(d.donorPhone || d.donorName); }}
                                            className={cn(
                                                "p-3 rounded-xl border transition-all cursor-pointer group mb-1",
                                                selectedDonation?.id === d.id ? "bg-primary border-primary text-white shadow-lg scale-[1.02]" : "bg-white border-transparent hover:border-primary/20"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-bold text-xs truncate">{d.donorName}</p>
                                                <p className="font-mono text-[9px] font-bold opacity-60">₹{d.amount.toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] opacity-60">
                                                <span>{d.donationDate}</span>
                                                <span className="font-mono uppercase truncate max-w-[60px]">ID:{d.id.slice(-4)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                        
                        {totalPages > 1 && (
                            <div className="p-3 bg-white border-t flex items-center justify-between shrink-0">
                                <p className="text-[9px] font-bold text-muted-foreground">P. {currentPage}/{totalPages}</p>
                                <div className="flex gap-1">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-6 w-6 border-primary/10 text-primary transition-transform active:scale-90" 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-6 w-6 border-primary/10 text-primary transition-transform active:scale-90" 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Resolution Workspace */}
                    <div className="flex-1 flex flex-col bg-white overflow-hidden relative h-2/3 md:h-full">
                        {selectedDonation ? (
                            <ScrollArea className="h-full w-full">
                                <div className="p-4 sm:p-8 space-y-8 animate-fade-in-up pb-20">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-primary tracking-tight">Resolving Contribution</h3>
                                        <Card className="p-4 bg-primary/5 border-primary/10 shadow-none">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-full bg-white text-primary shadow-sm"><IndianRupee className="h-6 w-6"/></div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-primary truncate">{selectedDonation.donorName}</p>
                                                    <p className="text-xs font-mono text-muted-foreground">{selectedDonation.donorPhone || 'No Phone Number Provided'}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" asChild className="h-8 w-8 transition-transform active:scale-90"><Link href={`/donations/${selectedDonation.id}`} target="_blank"><Edit className="h-4 w-4"/></Link></Button>
                                            </div>
                                        </Card>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Identify Profile</h4>
                                            <Badge variant="outline" className="text-[9px] font-bold border-primary/10 text-primary/60">Heuristic Mapping</Badge>
                                        </div>
                                        
                                        <div className="grid gap-4">
                                            <Button onClick={handleCreateNewProfile} disabled={!!isResolving} className="h-12 font-bold justify-between px-6 rounded-xl shadow-md transition-all active:scale-95 group bg-primary text-white w-full sm:w-auto">
                                                <div className="flex items-center gap-3">
                                                    <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                                    Establish New Profile
                                                </div>
                                                <ArrowRight className="h-4 w-4 opacity-40" />
                                            </Button>

                                            <div className="relative pt-2">
                                                <Search className="absolute left-3 bottom-3 h-4 w-4 text-primary/40" />
                                                <Input 
                                                    placeholder="Search Database For Matches..." 
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                    className="pl-10 h-10 rounded-xl border-primary/10 text-sm font-normal"
                                                />
                                            </div>

                                            <div className="space-y-2 mt-2">
                                                {isSearching ? (
                                                    <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary/20"/></div>
                                                ) : searchResults.length > 0 ? (
                                                    searchResults.map(donor => (
                                                        <div 
                                                            key={donor.id}
                                                            onClick={() => handleLinkToExisting(donor)}
                                                            className="flex items-center justify-between p-3 rounded-xl border border-primary/5 hover:border-primary/30 hover:bg-primary/[0.02] cursor-pointer group transition-all"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm text-primary">{donor.name}</p>
                                                                <p className="text-[10px] font-mono text-muted-foreground">{donor.phone}</p>
                                                            </div>
                                                            <ShieldCheck className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    ))
                                                ) : searchTerm.length > 2 && (
                                                    <p className="text-center text-[10px] text-muted-foreground font-normal italic py-4">No Matching Profiles Discovered.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ScrollBar orientation="vertical" />
                            </ScrollArea>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-30 grayscale">
                                <AlertCircle className="h-16 w-16 mb-4"/>
                                <p className="text-sm font-bold uppercase tracking-widest">Select A Record To Resolve</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-primary/5 border-t shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] font-bold text-primary/60 tracking-tight flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Secure Institutional Identity Consolidation
                    </p>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold border-primary/20 text-primary px-10 rounded-xl transition-transform active:scale-95 w-full sm:w-auto">
                        Close Resolver
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
