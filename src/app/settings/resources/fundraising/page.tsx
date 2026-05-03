'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
    Zap, 
    HeartHandshake, 
    Trophy, 
    Clock, 
    Plus, 
    ArrowRight, 
    BarChart3, 
    ShieldCheck, 
    Users,
    Activity,
    CreditCard
} from 'lucide-react';
import { BrandedLoader } from '@/components/branded-loader';
import type { InternalFundraising } from '@/lib/types';

export default function InfrastructureFundraisingPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [campaigns, setCampaigns] = useState<InternalFundraising[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [newCampaign, setNewCampaign] = useState({
        title: '',
        purpose: '',
        targetAmount: 0,
        endDate: '',
        status: 'Active' as const
    });

    const canManage = userProfile?.role === 'Admin';

    useEffect(() => {
        if (!firestore) return;

        const q = query(collection(firestore, 'internal_fundraising'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InternalFundraising[];
            setCampaigns(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleCreate = async () => {
        if (!firestore || !newCampaign.title || !newCampaign.targetAmount) return;
        
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'internal_fundraising'), {
                ...newCampaign,
                targetAmount: Number(newCampaign.targetAmount),
                collectedAmount: 0,
                startDate: new Date().toISOString(),
                contributions: [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            toast({ title: 'Fundraising Launched', description: 'Internal request has been broadcasted to all registered users.' });
            setShowCreateForm(false);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDonate = async (campaignId: string, amount: number) => {
        if (!firestore || !userProfile) return;
        
        setIsSubmitting(true);
        try {
            const campaign = campaigns.find(c => c.id === campaignId);
            if (!campaign) return;

            const newContribution = {
                userId: userProfile.id,
                userName: userProfile.name,
                amount: Number(amount),
                date: new Date().toISOString(),
                status: 'Verified' as const
            };

            const updatedContributions = [...(campaign.contributions || []), newContribution];
            const newCollected = Number(campaign.collectedAmount || 0) + Number(amount);

            await updateDoc(doc(firestore, 'internal_fundraising', campaignId), {
                contributions: updatedContributions,
                collectedAmount: newCollected,
                status: newCollected >= campaign.targetAmount ? 'Completed' : campaign.status,
                updatedAt: Timestamp.now()
            });

            toast({ title: 'Contribution Received', description: `Jazakallah! ₹${amount} has been added to the infrastructure fund.` });
        } catch (e: any) {
            toast({ title: 'Contribution Failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSessionLoading || isLoading) return <BrandedLoader message="Loading Infrastructure Funds..." />;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <HeartHandshake className="h-6 w-6 text-pink-500" />
                        Infrastructure Support
                    </h2>
                    <p className="text-sm text-muted-foreground font-normal">Support the portal infrastructure: WhatsApp APIs, AI Resources, and Server Costs.</p>
                </div>
                {canManage && (
                    <Button onClick={() => setShowCreateForm(!showCreateForm)} className="font-bold shadow-md">
                        {showCreateForm ? 'Cancel Request' : <><Plus className="mr-2 h-4 w-4" /> Raise Fund</>}
                    </Button>
                )}
            </div>

            {showCreateForm && (
                <Card className="border-primary/10 animate-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle className="text-lg">Launch Infrastructure Fund</CardTitle>
                        <CardDescription>This request will only be visible to registered organization members.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Title / Resource Name</Label>
                                <Input placeholder="e.g. WhatsApp API 1 Year" value={newCampaign.title} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Amount (₹)</Label>
                                <Input type="number" placeholder="15000" value={newCampaign.targetAmount} onChange={e => setNewCampaign({...newCampaign, targetAmount: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Purpose & Details</Label>
                                <Input placeholder="Why is this fund needed?" value={newCampaign.purpose} onChange={e => setNewCampaign({...newCampaign, purpose: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={newCampaign.endDate} onChange={e => setNewCampaign({...newCampaign, endDate: e.target.value})} />
                            </div>
                        </div>
                        <Button onClick={handleCreate} disabled={isSubmitting} className="w-full font-bold">
                            Broadcast Internal Request
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Campaigns */}
                <div className="lg:col-span-2 space-y-4">
                    {campaigns.length === 0 ? (
                        <Card className="p-12 text-center border-dashed">
                            <div className="mx-auto w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                <Activity className="h-6 w-6 text-primary/40" />
                            </div>
                            <p className="text-sm text-muted-foreground">No active infrastructure requests. Everything is running smoothly!</p>
                        </Card>
                    ) : (
                        campaigns.map(campaign => {
                            const percent = Math.min(100, Math.round((campaign.collectedAmount / campaign.targetAmount) * 100));
                            return (
                                <Card key={campaign.id} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-all group">
                                    <div className="flex flex-col md:flex-row h-full">
                                        <div className="w-full md:w-2 bg-primary/5 group-hover:bg-primary/20 transition-colors" />
                                        <div className="flex-1 p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg text-primary">{campaign.title}</h3>
                                                        <Badge variant={campaign.status === 'Active' ? 'outline' : 'success'} className="text-[10px]">
                                                            {campaign.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground font-normal">{campaign.purpose}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-primary">₹{campaign.collectedAmount.toLocaleString()}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest">Raised of ₹{campaign.targetAmount.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span>Overall Progress</span>
                                                    <span>{percent}%</span>
                                                </div>
                                                <Progress value={percent} className="h-2" />
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="h-3.5 w-3.5" />
                                                        <span>{campaign.contributions?.length || 0} Contributors</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        <span>Ends {new Date(campaign.endDate).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                {campaign.status === 'Active' && (
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant="outline" className="font-bold h-8" onClick={() => handleDonate(campaign.id, 500)}>+₹500</Button>
                                                        <Button size="sm" variant="outline" className="font-bold h-8" onClick={() => handleDonate(campaign.id, 1000)}>+₹1000</Button>
                                                        <Button size="sm" className="font-bold h-8 bg-primary shadow-sm">
                                                            Contribute <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Ledger & Stats */}
                <div className="space-y-6">
                    <Card className="border-primary/10 shadow-sm">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary/60" />
                                Resource Ledger
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 rounded-lg border border-primary/5 bg-primary/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-white text-primary">
                                            <ShieldCheck className="h-4 w-4" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-primary/60 tracking-tight">Active Resources</p>
                                            <p className="text-lg font-black">04 Items</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-white text-amber-600">
                                            <Clock className="h-4 w-4" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-amber-600 tracking-tight">Due This Month</p>
                                            <p className="text-lg font-black text-amber-900">₹4,200</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t mt-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground tracking-widest">Recent Maintenance</p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-normal">Whapi Monthly Sub.</span>
                                        <span className="font-bold">₹2,800</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-normal">Gemini Pro API</span>
                                        <span className="font-bold text-green-600">FREE</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-normal">Vercel Pro (Portal)</span>
                                        <span className="font-bold">₹1,600</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary border-primary p-6 text-white overflow-hidden relative group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Trophy className="h-32 w-32" />
                        </div>
                        <div className="relative z-10 space-y-4">
                            <div className="p-2 bg-white/20 rounded-lg w-fit">
                                <Zap className="h-5 w-5 text-amber-300" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black text-lg">Organization Strength</h4>
                                <p className="text-xs text-primary-foreground/80 font-normal leading-relaxed">
                                    Our platform infrastructure is entirely community-funded. 
                                    Internal contributions ensure our system remains independent and operational.
                                </p>
                            </div>
                            <Button variant="secondary" className="w-full font-black text-[10px] tracking-widest h-9">
                                View Full Ledger
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
