
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { setInstitutionalPasswordAction } from '@/app/portal-login/actions';

interface ResetPasswordDialogProps {
    targetId: string;
    collectionName: 'users' | 'donors' | 'beneficiaries';
    trigger?: React.ReactNode;
}

export function ResetPasswordDialog({ targetId, collectionName, trigger }: ResetPasswordDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();

    const handleReset = async () => {
        if (password.length < 4) {
            toast({ title: 'Invalid Password', description: 'Institutional standard requires at least 4 characters.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            const res = await setInstitutionalPasswordAction(targetId, collectionName, password);
            if (res.success) {
                toast({ title: 'Portal Access Secured', description: 'Credential Updated Successfully.', variant: 'success' });
                setIsOpen(false);
                setPassword('');
            } else {
                throw new Error(res.message);
            }
        } catch (e: any) {
            toast({ title: 'Update Failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                        <Key className="mr-2 h-4 w-4" /> Reset Portal Password
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/10 shadow-2xl bg-white">
                <DialogHeader>
                    <DialogTitle className="font-bold text-primary flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" /> Reset Portal Credential
                    </DialogTitle>
                    <DialogDescription className="font-normal text-xs leading-relaxed">
                        Establishing a manual password allows this member to bypass SMS OTP and log in directly using their Mobile or Institutional ID.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password" className="text-xs font-bold opacity-60">Temporary / Permanent Password</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="font-bold h-11 border-primary/10 pr-10"
                                placeholder="Min 4 characters"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button 
                        onClick={handleReset} 
                        disabled={isLoading} 
                        className="w-full font-bold h-11 shadow-lg active:scale-95 transition-transform"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                        Apply New Credential
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
