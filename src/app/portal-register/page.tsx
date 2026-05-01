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
import { Loader2, UserPlus, ArrowRight, Phone, User, KeyRound, Mail, Fingerprint, Users } from 'lucide-react';
import Link from 'next/link';

export default function PortalRegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [gender, setGender] = useState('');
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'Donor' | 'Beneficiary'>('Donor');
    const [password, setPassword] = useState('password');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !password) {
            toast({ title: "Required Fields", description: "Please complete all mandatory fields to join.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await registerPortalUserAction({ 
                name, 
                phone, 
                role, 
                password,
                email,
                gender,
                aadhaarNumber
            });
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
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gender" className="text-xs font-bold uppercase tracking-wider text-slate-500">Gender</Label>
                                    <div className="relative group">
                                        <Users className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 z-10" />
                                        <Select value={gender} onValueChange={setGender} disabled={isLoading}>
                                            <SelectTrigger className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl font-bold">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                <SelectItem value="Male" className="font-bold">Male</SelectItem>
                                                <SelectItem value="Female" className="font-bold">Female</SelectItem>
                                                <SelectItem value="Other" className="font-bold">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email (Optional)</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                        <Input 
                                            id="email"
                                            type="email"
                                            placeholder="mail@example.com"
                                            className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="aadhaar" className="text-xs font-bold uppercase tracking-wider text-slate-500">Aadhaar Number (Optional)</Label>
                                <div className="relative group">
                                    <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                    <Input 
                                        id="aadhaar"
                                        placeholder="12-Digit UIDAI Number"
                                        maxLength={12}
                                        className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl font-mono"
                                        value={aadhaarNumber}
                                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>


                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Mobile Number</Label>
                                <div className="flex gap-2">
                                    <div className="w-24 shrink-0">
                                        <Select defaultValue="+91" disabled={isLoading}>
                                            <SelectTrigger className="h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl font-bold">
                                                <SelectValue placeholder="+91" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                <SelectItem value="+91" className="font-bold">🇮🇳 +91</SelectItem>
                                                <SelectItem value="+1" className="font-bold">🇺🇸 +1</SelectItem>
                                                <SelectItem value="+44" className="font-bold">🇬🇧 +44</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="relative group flex-1">
                                        <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-primary" />
                                        <Input 
                                            id="phone"
                                            placeholder="10-Digit Number"
                                            maxLength={10}
                                            className="pl-10 h-12 border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl font-bold"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            disabled={isLoading}
                                        />
                                    </div>
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
