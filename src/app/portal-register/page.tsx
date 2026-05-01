'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerPortalUserAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, ArrowRight, Phone, User, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function PortalRegisterPage() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'Donor' | 'Beneficiary'>('Donor');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !password) {
            toast({ title: "Required Fields", description: "Please complete all fields to join.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await registerPortalUserAction({ name, phone, role, password });
            if (res.success) {
                toast({ title: "Registration Successful", description: res.message, variant: "success" });
                router.push('/portal-login');
            } else {
                toast({ title: "Registration Failed", description: res.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 animate-fade-in-up">
                <div className="text-center space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-2">
                        <UserPlus className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Join Community</h1>
                    <p className="text-slate-500 font-normal">Create your supporter profile in seconds.</p>
                </div>

                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">New Account</CardTitle>
                        <CardDescription>Select your role and provide basic details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">I am joining as a</Label>
                                <Select value={role} onValueChange={(v: any) => setRole(v)} disabled={isLoading}>
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="Donor" className="font-bold py-3">Community Donor</SelectItem>
                                        <SelectItem value="Beneficiary" className="font-bold py-3">Assistance Beneficiary</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Legal Name</Label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                    <Input 
                                        id="name"
                                        placeholder="e.g. Ahmed Shaikh"
                                        className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Mobile Number</Label>
                                <div className="relative group">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                    <Input 
                                        id="phone"
                                        placeholder="e.g. 9876543210"
                                        className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Create Password</Label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                    <Input 
                                        id="password"
                                        type="password"
                                        placeholder="Minimum 6 characters"
                                        className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-12 font-bold text-base shadow-xl shadow-primary/20 mt-4 rounded-xl group"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Register Now
                                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>

                            <p className="text-center text-xs font-normal text-slate-500 pt-2">
                                Already have an account? <Link href="/portal-login" className="font-bold text-primary hover:underline">Sign In</Link>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
