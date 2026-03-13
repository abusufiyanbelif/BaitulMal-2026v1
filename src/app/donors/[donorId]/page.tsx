
'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection, collection, doc, type DocumentReference } from '@/firebase';
import type { Donor, Donation } from '@/lib/types';
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
    Smartphone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { updateDonorAction } from '../actions';
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

function DetailItem({ icon: Icon, label, value, isMono = false }: { icon: any, label: string, value?: string, isMono?: boolean }) {
    return (
        <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/[0.02] border border-primary/5 transition-all hover:bg-white hover:shadow-sm">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
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

    const donorDocRef = useMemoFirebase(() => donorId && firestore ? doc(firestore, 'donors', donorId) as DocumentReference<Donor> : null, [donorId, firestore]);
    const { data: donor, isLoading: donorLoading, forceRefetch } = useDoc<Donor>(donorDocRef);

    const donationsRef = useMemoFirebase(() => firestore ? collection(firestore, 'donations') : null, [firestore]);
    const { data: allDonations, isLoading: donationsLoading } = useCollection<Donation>(donationsRef);

    const donorDonations = useMemo(() => {
        if (!allDonations || !donor) return [];
        return allDonations.filter(d => 
            d.donorId === donor.id || 
            (d.donorPhone === donor.phone && !!donor.phone)
        ).sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());
    }, [allDonations, donor]);

    const stats = useMemo(() => {
        const verified = donorDonations.filter(d => d.status === 'Verified');
        return {
            totalCount: donorDonations.length,
            verifiedSum: verified.reduce((sum, d) => sum + d.amount, 0),
            pendingSum: donorDonations.filter(d => d.status === 'Pending').reduce((sum, d) => sum + d.amount, 0),
            latestDate: verified[0]?.donationDate || 'No Recorded Donation'
        };
    }, [donorDonations]);

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!userProfile) return;
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        const updates: Partial<Donor> = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
            email: formData.get('email') as string,
            address: formData.get('address') as string,
            bankName: formData.get('bankName') as string,
            accountNumber: formData.get('accountNumber') as string,
            ifscCode: formData.get('ifscCode') as string,
            upiId: formData.get('upiId') as string,
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

    const isLoading = donorLoading || sessionLoading || donationsLoading;
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.update', false);

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
                    {canUpdate && !isEditMode && (
                        <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-sm active:scale-95 transition-transform h-9">
                            <Edit className="mr-2 h-4 w-4"/> Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-1 animate-fade-in-up">
                <h1 className="text-4xl font-bold tracking-tight text-primary">{donor.name}</h1>
                <p className="text-sm text-muted-foreground font-normal">Registry Profile Entry ID: <span className="font-mono text-primary/60">{donor.id}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Impact</p>
                    <p className="text-2xl font-black text-primary font-mono mt-1">₹{stats.verifiedSum.toLocaleString('en-IN')}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Contributions</p>
                    <p className="text-2xl font-black text-primary font-mono mt-1">{stats.totalCount}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</p>
                    <p className="text-sm font-bold text-primary mt-2 flex items-center gap-2"><Clock className="h-3 w-3 opacity-40"/> {stats.latestDate}</p>
                </Card>
                <Card className="p-4 bg-white border-primary/5 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending Vetting</p>
                    <p className="text-lg font-bold text-amber-600 font-mono mt-1">₹{stats.pendingSum.toLocaleString('en-IN')}</p>
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

                <TabsContent value="profile" className="animate-fade-in-up mt-0">
                    <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b px-6 py-4">
                            <CardTitle className="text-lg font-bold">Institutional Record & Financials</CardTitle>
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

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Verified Financial Handles</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Preferred Bank Name</Label><Input name="bankName" defaultValue={donor.bankName} placeholder="e.g. HDFC Bank" className="font-bold"/></div>
                                            <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Account Number</Label><Input name="accountNumber" defaultValue={donor.accountNumber} placeholder="Primary contribution account" className="font-mono"/></div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">IFSC Code</Label><Input name="ifscCode" defaultValue={donor.ifscCode} placeholder="11-digit bank code" className="font-mono"/></div>
                                            <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Personal UPI Identifier</Label><Input name="upiId" defaultValue={donor.upiId} placeholder="e.g. name@upi" className="font-mono"/></div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Institutional Observations</Label>
                                        <Textarea name="notes" defaultValue={donor.notes} rows={4} className="font-normal" placeholder="Donor preferences, historical notes, etc."/>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-6 border-t">
                                        <Button type="button" variant="outline" onClick={() => setIsEditMode(false)} className="font-bold border-primary/20">Cancel</Button>
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

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Financial Identifiers</h4>
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            <DetailItem icon={Landmark} label="Verified Bank" value={donor.bankName} />
                                            <DetailItem icon={CreditCard} label="Account Mapping" value={donor.accountNumber} isMono />
                                            <DetailItem icon={ShieldCheck} label="Branch Identifier" value={donor.ifscCode} isMono />
                                            <DetailItem icon={Smartphone} label="Digital UPI Handle" value={donor.upiId} isMono />
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
                                        <TableHeader className="bg-primary/5">
                                            <TableRow>
                                                <TableHead className="pl-6 font-bold text-[10px] tracking-tight uppercase">Initiative / Project</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase">Donation Value (₹)</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase">Designation</TableHead>
                                                <TableHead className="font-bold text-[10px] tracking-tight uppercase">Date Record</TableHead>
                                                <TableHead className="text-center font-bold text-[10px] tracking-tight uppercase">Vetting Status</TableHead>
                                                <TableHead className="text-right pr-6 font-bold text-[10px] tracking-tight uppercase">Action</TableHead>
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
