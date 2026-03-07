'use client';

import { useState, useEffect, useMemo } from 'react';
import type { UserProfile } from '@/lib/types';
import { GROUPS, type GroupId } from '@/lib/modules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Users, Building2, MapPin, Hash, ShieldCheck, Globe, Landmark, User, CreditCard, QrCode, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { getPublicMembersAction } from '@/app/users/actions';
import { usePageHit } from '@/hooks/use-page-hit';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useGuidingPrinciples } from '@/hooks/use-guiding-principles';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { defaultGuidingPrinciples } from '@/lib/guiding-principles-default';
import { cn, getInitials } from '@/lib/utils';

function DetailItem({ icon: Icon, label, value, isMono = false }: { icon: any, label: string, value?: string, isMono?: boolean }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 py-2 group">
            <div className="mt-1 shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-0.5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{label}</p>
                <p className={cn("text-sm font-normal text-foreground leading-relaxed", isMono && "font-mono")}>
                    {value}
                </p>
            </div>
        </div>
    );
}

export default function AboutOrganizationPage() {
    const [members, setMembers] = useState<Partial<UserProfile>[] | null>(null);
    const [isMembersLoading, setIsMembersLoading] = useState(true);
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { guidingPrinciplesData, isLoading: isGPDataLoading } = useGuidingPrinciples();
    const { infoSettings, isLoading: isInfoLoading } = useInfoSettings();
    
    usePageHit('about_organization');

    useEffect(() => {
        async function fetchMembers() {
            setIsMembersLoading(true);
            const result = await getPublicMembersAction();
            setMembers(result);
            setIsMembersLoading(false);
        }
        fetchMembers();
    }, []);

    const membersByGroup = useMemo(() => {
        if (!members) return {} as Record<GroupId, UserProfile[]>;
        return members.reduce((acc, member) => {
            const group = member.organizationGroup || 'member';
            (acc[group as GroupId] = acc[group as GroupId] || []).push(member as UserProfile);
            return acc;
        }, {} as Record<GroupId, UserProfile[]>);
    }, [members]);

    const isLoading = isMembersLoading || isBrandingLoading || isPaymentLoading || isGPDataLoading || isInfoLoading;
    const gpData = guidingPrinciplesData || defaultGuidingPrinciples;
    const isGPVisible = guidingPrinciplesData?.isGuidingPrinciplesPublic ?? true;
    const visiblePrinciples = gpData.principles?.filter(p => !p.isHidden && p.text?.trim()) || [];

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-10 text-primary font-normal">
             <div className="mb-4">
                <Button variant="outline" asChild className="transition-transform active:scale-95 font-bold border-primary/20 text-primary">
                    <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Home</Link>
                </Button>
            </div>

            <section className="text-center space-y-4 animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">{brandingSettings?.name || 'About Our Organization'}</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-normal italic">
                    Committed To Community Support And Transparent Welfare Initiatives.
                </p>
            </section>

            <Accordion type="multiple" defaultValue={['verifiable', 'contribution', 'principles', 'team']} className="space-y-6">
                
                <AccordionItem value="verifiable" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5 transition-colors hover:bg-primary/[0.08]">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            <span className="text-xl font-bold tracking-tight">Verifiable Details</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pt-6 pb-8 space-y-1">
                        <DetailItem icon={Building2} label="Legal Name" value={brandingSettings?.name} />
                        <DetailItem icon={MapPin} label="Registered Address" value={paymentSettings?.address} />
                        <DetailItem icon={Hash} label="Registration No." value={paymentSettings?.regNo} />
                        <DetailItem icon={ShieldCheck} label="PAN Number" value={paymentSettings?.pan} isMono />
                        <DetailItem icon={Globe} label="Official Website" value={paymentSettings?.website} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contribution" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5 transition-colors hover:bg-primary/[0.08]">
                        <div className="flex items-center gap-3">
                            <Landmark className="h-6 w-6 text-primary" />
                            <span className="text-xl font-bold tracking-tight">Contribution Details</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pt-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Bank Transfer</h4>
                                <DetailItem icon={User} label="Account Holder Name" value={paymentSettings?.bankAccountName} />
                                <DetailItem icon={CreditCard} label="Account Number" value={paymentSettings?.bankAccountNumber} isMono />
                                <DetailItem icon={Landmark} label="IFSC Code" value={paymentSettings?.bankIfsc} isMono />
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-secondary/30 border border-primary/10">
                                {validQrUrl ? (
                                    <div className="space-y-3 text-center">
                                        <div className="relative w-40 h-40 bg-white p-3 rounded-2xl border-4 border-primary shadow-xl">
                                            <Image src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`} alt="Payment QR" fill className="object-contain p-1" unoptimized />
                                        </div>
                                        <p className="font-mono text-sm font-bold text-primary">{paymentSettings?.upiId}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Scan With Any UPI App</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground p-4">
                                        <QrCode className="h-12 w-12 mx-auto opacity-20 mb-2" />
                                        <p className="text-[10px] uppercase font-bold tracking-tighter">UPI QR Not Available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {isGPVisible && visiblePrinciples.length > 0 && (
                    <AccordionItem value="principles" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5 transition-colors hover:bg-primary/[0.08]">
                            <div className="flex items-center gap-3">
                                <Shield className="h-6 w-6 text-primary" />
                                <span className="text-xl font-bold tracking-tight">Guiding Principles</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pt-8 pb-10">
                            <p className="text-sm text-primary/70 mb-8 max-w-3xl font-normal leading-relaxed">{gpData.description}</p>
                            <div className="grid gap-6">
                                {visiblePrinciples.map((principle, idx) => (
                                    <div key={principle.id} className="flex gap-4 group">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 transition-colors group-hover:bg-primary group-hover:text-white">{idx + 1}</div>
                                        <div className="pt-1 flex-1"><p className="text-base font-normal leading-relaxed text-foreground/90">{principle.text}</p></div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                <AccordionItem value="team" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5 transition-colors hover:bg-primary/[0.08]">
                        <div className="flex items-center gap-3">
                            <Users className="h-6 w-6 text-primary" />
                            <span className="text-xl font-bold tracking-tight">Our Dedicated Team</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pt-4 pb-6">
                        <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full">
                            {GROUPS.map((group) => (
                                <AccordionItem value={group.id} key={group.id} className="border-primary/5 last:border-0">
                                    <AccordionTrigger className="text-base font-bold hover:text-primary transition-colors py-3 tracking-tight">
                                        {group.name} ({(membersByGroup[group.id] || []).length})
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-1">
                                            {(membersByGroup[group.id] || []).map((member) => (
                                                <Card key={member.id} className="group transition-all duration-300 hover:shadow-sm bg-primary/[0.01] border-primary/5 overflow-hidden">
                                                    <CardContent className="p-2 flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border border-primary/5 transition-transform group-hover:scale-105">
                                                            <AvatarImage src={member.idProofUrl || ''} alt={member.name || 'Member'} />
                                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-[13px] truncate text-primary">{member.name}</p>
                                                            <p className="text-[10px] font-normal text-muted-foreground leading-tight">{member.organizationRole || 'Member'}</p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                            {(membersByGroup[group.id] || []).length === 0 && <p className="text-xs text-muted-foreground p-4 font-normal italic opacity-60">No Public Members In This Group.</p>}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </main>
    );
}
