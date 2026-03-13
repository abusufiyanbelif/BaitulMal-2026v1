
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection, collection, doc, type DocumentReference } from '@/firebase';
import type { Donor, Donation, BankDetail, DonationCategory } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ArrowLeft, 
    Edit, 
    Save, 
    X, 
    Loader2, 
    User, 
    History, 
    IndianRupee, 
    Phone, 
    Mail, 
    MapPin, 
    Calendar,
    FolderKanban,
    Lightbulb,
    ExternalLink,
    Clock,
    Landmark,
    CreditCard,
    Smartphone,
    Plus,
    Trash2,
    ShieldCheck,
    PieChart as PieChartIcon,
    TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { updateDonorAction, deleteDonorAction } from '../actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrandedLoader } from '@/components/branded-loader';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { cn, getNestedValue } from '@/lib/utils';
import { 
    Bar, 
    BarChart, 
    CartesianGrid, 
    XAxis, 
    YAxis, 
    Cell,
    Pie,
    PieChart
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { format, parseISO } from 'date-fns';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-3))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-7))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-5))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;

const monthlyTrendChartConfig = {
  total: {
    label: "Amount (₹)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function DetailItem({ icon: Icon, label, value, isMono = false }: { icon: any, label: string, value?: string, isMono?: boolean }) {
    return (
        <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/[0.02] border border-primary/5 transition-all hover:bg-white hover:shadow-sm">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className={cn("text-base font-bold text-primary truncate", isMono && "font-mono")}>
                    {value || <span className="italic opacity-30 font-normal">Not Provided</span>}
                </p>
            </div>
        </div>
    );
}

export default function DonorProfilePage() {
    const params = useParams();
    const router = useRouter();
    const donorId = params.donorId as string;
    const { toast } = useToast();
    const firestore = useFirestore();
    const { userProfile, isLoading: sessionLoading } = useSession();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => { setIsClient(true); }, []);

    const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
    const [upiIds, setUpiIds] = useState<string[]>([]);

    const donorDocRef = useMemoFirebase(() => donorId && firestore ? doc(firestore, 'donors', donorId) as DocumentReference<Donor> : null, [donorId, firestore]);
    const { data: donor, isLoading: donorLoading, forceRefetch } = useDoc<Donor>(donorDocRef);

    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
    const { data: allDonations, isLoading: donationsLoading } = useCollection<Donation>(donationsRef);

    useEffect(() => {
        if (donor) {
            setBankDetails(donor.bankDetails || [{ bankName: '', accountNumber: '', ifscCode: '' }]);
            setUpiIds(donor.upiIds || ['']);
        }
    }, [donor]);

    const donorDonations = useMemo(() => {
        if (!allDonations || !donor) return [];
        return allDonations.filter(d => 
            d.donorId === donor.id || 
            (d.donorPhone === donor.phone && !!donor.phone)
        ).sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());
    }, [allDonations, donor]);

    const analytics = useMemo(() => {
        const verified = donorDonations.filter(d => d.status === 'Verified');
        
        const catTotals: Record<string, number> = {};
        const monthlyTotals: Record<string, number> = {};

        verified.forEach(d => {
            const splits = d.typeSplit || (d.type ? [{ category: d.type as DonationCategory, amount: d.amount }] : []);
            splits.forEach(s => {
                const cat = (s.category as any) === 'General' || (s.category as any) === 'Sadqa' ? 'Sadaqah' : s.category;
                catTotals[cat] = (catTotals[cat] || 0) + s.amount;

                if (cat === 'Monthly Contribution' && d.donationDate) {
                    try {
                        const month = format(parseISO(d.donationDate), 'yyyy-MM');
                        monthlyTotals[month] = (monthlyTotals[month] || 0) + s.amount;
                    } catch(e) {}
                }
            });
        });

        const categoryData = Object.entries(catTotals).map(([name, value]) => ({
            name,
            value,
            fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));

        const monthlyTrends = Object.entries(monthlyTotals)
            .map(([month, total]) => ({ month, total }))
            .sort((a, b) => a.month.localeCompare(b.month));

        return {
            totalCount: donorDonations.length,
            verifiedSum: verified.reduce((sum, d) => sum + d.amount, 0),
            pendingSum: donorDonations.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amount, 0),
            latestDate: verified[0]?.donationDate || 'No Recorded Donation',
            categoryData,
            monthlyTrends
        };
    }, [donorDonations]);

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!userProfile) return;
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const validBanks = bankDetails.filter(b => b.bankName || b.accountNumber);
        const validUpis = upiIds.filter(u => u.trim() !== '');

        const updates: Partial<Donor> = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
            email: formData.get('email') as string,
            address: formData.get('address') as string,
            bankDetails: validBanks,
            accountNumbers: validBanks.map(b => b.accountNumber).filter(Boolean),
            upiIds: validUpis,
            status: formData.get('status') as any,
            notes: formData.get('notes') as string,
        };

        const res = await updateDonorAction(donorId, updates, { id: userProfile.id, name: userProfile.name });
        if (res.success) {
            toast({ title: 'Success', description: res.message, variant: 'success' });
            setIsEditMode(false);
            forceRefetch();
        } else {
            toast({ title: 'Update Failed', description: res.message, variant: 'destructive' });
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!userProfile || !donor) return;
        if (!confirm(`Permanently Remove Profile For ${donor.name}? Financial records will be preserved as unlinked entries.`)) return;
        
        setIsSubmitting(true);
        const res = await deleteDonorAction(donorId);
        if (res.success) {
            toast({ title: 'Profile Removed', description: res.message, variant: 'success' });
            router.push('/donors');
        } else {
            toast({ title: 'Removal Failed', description: res.message, variant: 'destructive' });
            setIsSubmitting(false);
        }
    };

    const isLoading = donorLoading || sessionLoading || donationsLoading;
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.update', false);
    const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.delete', false);

    if (isLoading && !donor) return <BrandedLoader />;
    if (!donor) return <div className="p-20 text-center font-bold text-primary">Donor Profile Not Found.</div>;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
            <div className="flex items-center justify-between">
                <Button variant="outline" asChild className="font-bold border-primary/10 text-primary transition-transform active:scale-95">
                    <Link href="/donors"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Registry</Link>
                </Button>
                <div className="flex items-center gap-2">
                    <Badge variant={donor.status === 'Active' ? 'active' : 'outline'} className="font-bold text-[10px]">{donor.status}</Badge>
                    <div className="flex gap-2">
                        {canUpdate && !isEditMode && (
                            <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-sm active:scale-95 transition-transform h-9">
                                <Edit className="mr-2 h-4 w-4"/> Edit Profile
                            </Button>
                        )}
                        {canDelete && !isEditMode && (
                            <Button onClick={handleDelete} variant="ghost" className="font-bold text-destructive hover:bg-destructive/10 active:scale-95 transition-transform h-9 px-3">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-1 animate-fade-in-up">
                <h1 className="text-4xl font-bold tracking-tight text-primary">{donor.name}</h1>
                <p className="text-sm text-muted-foreground font-normal">Registry Profile Entry ID: <span className="font-mono text-primary/60">{donor.id}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Impact</p>
                    <p className="text-2xl font-black text-primary font-mono mt-1">₹{analytics.verifiedSum.toLocaleString('en-IN')}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Contributions</p>
                    <p className="text-2xl font-black text-primary font-mono mt-1">{analytics.totalCount}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</p>
                    <p className="text-sm font-bold text-primary mt-2 flex items-center gap-2"><Clock className="h-3 w-3 opacity-40"/> {analytics.latestDate}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending Vetting</p>
                    <p className="text-lg font-bold text-amber-600 font-mono mt-1">₹{analytics.pendingSum.toLocaleString('en-IN')}</p>
                </Card>
            </div>

            <Tabs defaultValue="profile" className="w-full space-y-6">
                <ScrollArea className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:w-[400px] h-12 bg-primary/5 p-1 rounded-xl">
                        <TabsTrigger value="profile" className="font-bold"><User className="mr-2 h-4 w-4"/> Donor Details</TabsTrigger>
                        <TabsTrigger value="donations" className="font-bold"><History className="mr-2 h-4 w-4"/> Contribution Log</TabsTrigger>
                    </TabsList>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>

                <TabsContent value="profile" className="animate-fade-in-up mt-0 space-y-6">
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                                <CardHeader className="bg-primary/5 border-b pb-3">
                                    <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                        <PieChartIcon className="h-4 w-4 opacity-40"/> Impact by Designation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[200px] w-full">
                                            <PieChart>
                                                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                <Pie data={analytics.categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} strokeWidth={2} paddingAngle={5}>
                                                    {analytics.categoryData.map((entry) => (
                                                        <Cell key={`cell-profile-${entry.name}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <ChartLegend content={<ChartLegendContent />} />
                                            </PieChart>
                                        </ChartContainer>
                                    ) : <Skeleton className="h-[200px] w-full" />}
                                </CardContent>
                            </Card>

                            <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                                <CardHeader className="bg-primary/5 border-b pb-3">
                                    <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 opacity-40"/> Monthly Contribution Trends
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {isClient ? (
                                        <ChartContainer config={monthlyTrendChartConfig} className="h-[200px] w-full">
                                            <BarChart data={analytics.monthlyTrends}>
                                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                                <XAxis 
                                                    dataKey="month" 
                                                    tickLine={false} 
                                                    axisLine={false} 
                                                    tickMargin={8} 
                                                    tickFormatter={(v) => format(parseISO(v + '-01'), 'MMM yy')}
                                                    tick={{ fontSize: 10, fontWeight: 'bold' }}
                                                />
                                                <YAxis hide />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    ) : <Skeleton className="h-[200px] w-full" />}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="lg:col-span-8 border-primary/10 shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b px-6 py-4">
                                <CardTitle className="text-lg font-bold">Institutional Record & Identity</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                {isEditMode ? (
                                    <form onSubmit={handleUpdate} className="space-y-8 font-normal">
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Core Identity</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Full Name</Label><Input name="name" defaultValue={donor.name} required className="font-bold"/></div>
                                                <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Account Status</Label><Select name="status" defaultValue={donor.status}><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger><SelectContent className="rounded-[12px]"><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Phone Number</Label><Input name="phone" defaultValue={donor.phone} required className="font-mono"/></div>
                                                <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Email Address</Label><Input name="email" type="email" defaultValue={donor.email} className="font-normal"/></div>
                                            </div>
                                            <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Residential Address</Label><Input name="address" defaultValue={donor.address} className="font-normal"/></div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Verified Bank Accounts</h4>
                                                <Button type="button" variant="outline" size="sm" onClick={() => setBankDetails([...bankDetails, { bankName: '', accountNumber: '', ifscCode: '' }])} className="h-7 text-[10px] font-bold"><Plus className="h-3 w-3 mr-1"/> Add Account</Button>
                                            </div>
                                            {bankDetails.map((bank, idx) => (
                                                <div key={idx} className="relative p-4 rounded-xl border border-dashed border-primary/20 bg-primary/[0.01] grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    {bankDetails.length > 1 && (
                                                        <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 text-destructive" onClick={() => setBankDetails(bankDetails.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3"/></Button>
                                                    )}
                                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Bank Name</Label><Input value={bank.bankName} onChange={(e) => { const newB = [...bankDetails]; newB[idx].bankName = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-bold"/></div>
                                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Account No.</Label><Input value={bank.accountNumber} onChange={(e) => { const newB = [...bankDetails]; newB[idx].accountNumber = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-mono"/></div>
                                                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">IFSC Code</Label><Input value={bank.ifscCode} onChange={(e) => { const newB = [...bankDetails]; newB[idx].ifscCode = e.target.value; setBankDetails(newB); }} className="h-8 text-xs font-mono"/></div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Digital UPI Handles</h4>
                                                <Button type="button" variant="outline" size="sm" onClick={() => setUpiIds([...upiIds, ''])} className="h-7 text-[10px] font-bold"><Plus className="h-3 w-3 mr-1"/> Add UPI</Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {upiIds.map((upi, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <Input value={upi} onChange={(e) => { const newU = [...upiIds]; newU[idx] = e.target.value; setUpiIds(newU); }} placeholder="name@upi" className="font-mono text-xs h-9" />
                                                        {upiIds.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => setUpiIds(upiIds.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Institutional Observations</Label>
                                            <Textarea name="notes" defaultValue={donor.notes} rows={4} className="font-normal" placeholder="Donor preferences, historical notes, etc."/>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-6 border-t">
                                            <Button type="button" variant="outline" onClick={() => setIsEditMode(false)} className="font-bold border-primary/20 text-primary">Cancel</Button>
                                            <Button type="submit" disabled={isSubmitting} className="font-bold shadow-md px-10">
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Secure Profile
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-10">
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <DetailItem icon={Phone} label="Primary Contact" value={donor.phone} isMono />
                                            <DetailItem icon={Mail} label="Email Identity" value={donor.email} />
                                            <DetailItem icon={MapPin} label="Residential Hub" value={donor.address} />
                                        </div>

                                        <div className="space-y-6">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Verified Financial Handles</h4>
                                            <div className="grid gap-6 md:grid-cols-2">
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest flex items-center gap-2"><Landmark className="h-3 w-3"/> Bank Accounts</p>
                                                    <div className="space-y-2">
                                                        {(donor.bankDetails || []).map((bank, idx) => (
                                                            <div key={idx} className="p-3 rounded-lg border border-primary/5 bg-primary/[0.01]">
                                                                <p className="font-bold text-sm text-primary">{bank.bankName}</p>
                                                                <div className="flex justify-between mt-1 text-[11px] font-mono opacity-60">
                                                                    <span>A/C: {bank.accountNumber}</span>
                                                                    <span>IFSC: {bank.ifscCode}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!donor.bankDetails || donor.bankDetails.length === 0) && <p className="text-xs italic opacity-30 font-normal">No bank accounts registered.</p>}
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest flex items-center gap-2"><Smartphone className="h-3 w-3"/> UPI Identifiers</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(donor.upiIds || []).map((upi, idx) => (
                                                            <Badge key={idx} variant="outline" className="font-mono text-xs py-1 border-primary/10 text-primary/80 bg-white">{upi}</Badge>
                                                        ))}
                                                        {(!donor.upiIds || donor.upiIds.length === 0) && <p className="text-xs italic opacity-30 font-normal">No UPI handles registered.</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 rounded-2xl border border-dashed border-primary/20 bg-muted/5">
                                            <div className="flex items-center gap-2 text-primary font-bold mb-3"><History className="h-4 w-4 opacity-40"/> Institutional Observations</div>
                                            <p className="text-sm italic font-normal text-primary/80 whitespace-pre-wrap leading-relaxed">
                                                {donor.notes || 'No vetted observations recorded for this profile.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="donations" className="animate-fade-in-up mt-0">
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b px-6 py-4">
                            <CardTitle className="text-lg font-bold">Contribution History Across Causes</CardTitle>
                            <CardDescription className="font-normal">Verified and pending donations linked to this donor profile.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="w-full">
                                <div className="min-w-[1000px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-6 font-bold text-[10px] tracking-tight uppercase text-primary/60">Initiative / Project</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase text-primary/60">Donation Value (₹)</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase text-primary/60">Designation</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase text-primary/60">Date Record</TableHead>
                                                <TableHead className="text-center font-bold text-[10px] tracking-tight uppercase text-primary/60">Vetting Status</TableHead>
                                                <TableHead className="text-right pr-6 font-bold text-[10px] tracking-tight uppercase text-primary/60">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donorDonations.map((donation) => {
                                                const primaryLink = donation.linkSplit?.[0] || ( (donation as any).campaignId ? { linkName: (donation as any).campaignName || 'Campaign', linkId: (donation as any).campaignId, linkType: 'campaign', amount: donation.amount } : null );
                                                const initiativeName = primaryLink?.linkName || 'General Institutional Fund';
                                                
                                                return (
                                                    <TableRow key={donation.id} className="hover:bg-primary/[0.02] transition-colors border-b border-primary/5 last:border-0 bg-white group">
                                                        <TableCell className="pl-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                                                                    {primaryLink?.linkType === 'campaign' ? <FolderKanban className="h-4 w-4"/> : <Lightbulb className="h-4 w-4"/>}
                                                                </div>
                                                                <p className="font-bold text-sm text-primary truncate max-w-[200px]">{initiativeName}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono font-bold text-sm text-primary">₹{donation.amount.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                {donation.typeSplit.map((ts, idx) => (
                                                                    <Badge key={idx} variant="secondary" className="text-[8px] font-bold h-4">{ts.category}</Badge>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs opacity-60">{donation.donationDate}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant={donation.status === 'Verified' ? 'eligible' : 'outline'} className="text-[10px] font-bold">
                                                                {donation.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <Button variant="ghost" size="sm" asChild className="h-8 font-bold text-[10px] active:scale-95 transition-transform text-primary hover:bg-primary/10">
                                                                <Link href={primaryLink?.linkType === 'campaign' ? `/campaign-members/${primaryLink.linkId}/donations/${donation.id}` : `/leads-members/${primaryLink?.linkId}/donations/${donation.id}`}>
                                                                    <ExternalLink className="mr-1.5 h-3 w-3"/> Details
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                            {donorDonations.length === 0 && (
                                                <TableRow><TableCell colSpan={6} className="text-center py-24 text-primary/40 font-bold italic bg-primary/[0.01]">No Contribution Records Found Linked To This Identity.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    );
}
