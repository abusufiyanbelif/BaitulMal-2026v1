'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query, getDocs, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { Badge } from './ui/badge';

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (user: UserProfile) => void;
}

export function UserSearchDialog({ open, onOpenChange, onSelectUser }: UserSearchDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);

  const handleSearch = useCallback(async () => {
    if (!firestore || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    const lowerCaseTerm = searchTerm.toLowerCase();

    try {
      const usersQuery = query(collection(firestore, 'users'));
      const querySnapshot = await getDocs(usersQuery);
      const allUsers: UserProfile[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          allUsers.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      
      const filtered = allUsers.filter(u => {
        const nameMatch = u.name ? u.name.toLowerCase().includes(lowerCaseTerm) : false;
        const emailMatch = u.email ? u.email.toLowerCase().includes(lowerCaseTerm) : false;
        const phoneMatch = u.phone ? u.phone.includes(searchTerm) : false;
        
        return (nameMatch || emailMatch || phoneMatch);
      }).slice(0, 20);

      setSearchResults(filtered);
    } catch (e: any) {
      console.error("User search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, [firestore, searchTerm]);
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, handleSearch]);

  useEffect(() => {
    // Reset search when dialog opens or closes
    if (!open) {
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [open]);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg text-primary">
        <DialogHeader>
          <DialogTitle className="font-bold text-primary">Find & add organization member</DialogTitle>
          <DialogDescription className="font-normal text-primary/70">
            Search for an existing user to assign them an organizational role.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="font-normal"
                />
                 {isSearching && <Loader2 className="h-10 w-10 animate-spin" />}
            </div>
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                    {!isSearching && searchResults.length === 0 && (
                        <p className="text-center text-muted-foreground pt-10 font-normal italic">Enter a search term to begin.</p>
                    )}
                    {!isSearching && searchResults.map(user => (
                        <div key={user.id} className="flex justify-between items-center p-2 rounded-md hover:bg-accent transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user.idProofUrl} alt={user.name} />
                                    <AvatarFallback className="font-bold">{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold text-sm">{user.name}</p>
                                    <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                                    {user.organizationGroup && <Badge variant="secondary" className="mt-1 text-[10px] font-bold">{user.organizationGroup}</Badge>}
                                </div>
                            </div>
                            <Button size="sm" onClick={() => handleSelect(user)} className="font-bold">Assign role</Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
