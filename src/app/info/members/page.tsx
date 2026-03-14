'use client';

import { useState, useEffect, useMemo } from 'react';
import type { UserProfile } from '@/lib/types';
import { GROUPS, type GroupId } from '@/lib/modules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Users, Building2, MapPin, Hash, ShieldCheck, Globe, Landmark, User, CreditCard, QrCode, Award, Shield, GraduationCap, HeartPulse, Utensils } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { cn, getInitials } from '@/lib/utils';

function DetailItem({ icon: Icon, label, value, isMono = false }: { icon: any, label: string, value?: string, isMono?: boolean }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 py-2">
            <div className="mt-1 shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-0.5">
                <p className="text-[10px] font-bold text-primary tracking-tight">{label}</p>
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
        if (!members) {
            return {} as Record<GroupId, UserProfile[]>;
        }
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
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
    const validQrUrl = paymentSettings?.qrCodeUrl?.trim() ? paymentSettings.qrCodeUrl : null;

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-10 text-primary">
             <div className="mb-4">
                <Button variant="outline" asChild className="transition-transform active:scale-95 font-bold border-primary/20">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back To Home
                    </Link>
                </Button>
            </div>

            <section className="text-center space-y-4 animate-fade-in-up">
                <div className="flex justify-center mb-4">
                    {validLogoUrl && (
                        <div className="relative w-24 h-24">
                            <Image 
                                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`} 
                                alt="Logo" 
                                fill 
                                sizes="96px"
                                className="object-contain" 
                            />
                        </div>
                    )}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">{brandingSettings?.name || 'About Our Organization'}</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-normal italic">
                    Committed To Community Support And Transparent Welfare Initiatives.
                </p>
            </section>

            <Accordion type="multiple" defaultValue={['verifiable', 'contribution', 'principles']} className="space-y-6">
                
                {/* Verifiable Details */}
                <AccordionItem value="verifiable" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5">
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

                {/* Contribution Details */}
                <AccordionItem value="contribution" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5">
                        <div className="flex items-center gap-3">
                            <Landmark className="h-6 w-6 text-primary" />
                            <span className="text-xl font-bold tracking-tight">Contribution Details</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pt-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold text-muted-foreground tracking-tight mb-3">Bank Transfer</h4>
                                <DetailItem icon={User} label="Account Holder" value={paymentSettings?.bankAccountName} />
                                <DetailItem icon={CreditCard} label="Account Number" value={paymentSettings?.bankAccountNumber} isMono />
                                <DetailItem icon={Landmark} label="IFSC Code" value={paymentSettings?.bankIfsc} isMono />
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-secondary/30 border border-primary/10">
                                {validQrUrl ? (
                                    <div className="space-y-3 text-center">
                                        <div className="relative w-40 h-40 bg-white p-3 rounded-lg shadow-sm border-2 border-primary">
                                            <Image 
                                                src={`/api/image-proxy?url=${encodeURIComponent(validQrUrl)}`} 
                                                alt="Payment QR" 
                                                fill 
                                                sizes="160px"
                                                className="object-contain p-1" 
                                            />
                                        </div>
                                        <p className="font-mono text-sm font-bold text-primary">{paymentSettings?.upiId}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground tracking-tight">Scan With Any UPI App</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground p-4">
                                        <QrCode className="h-12 w-12 mx-auto opacity-20 mb-2" />
                                        <p className="text-[10px] font-bold tracking-tighter">UPI QR Not Available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Guiding Principles Section */}
                {isGPVisible && (
                    <AccordionItem value="principles" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5">
                            <div className="flex items-center gap-3">
                                <Shield className="h-6 w-6 text-primary" />
                                <span className="text-xl font-bold tracking-tight">Guiding Principles</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pt-8 pb-10">
                            {/* Institutional Areas of Focus */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                                <div className="p-4 rounded-xl bg-primary/[0.02] border border-primary/5 space-y-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit"><GraduationCap className="h-5 w-5" /></div>
                                    <h4 className="font-bold text-sm">Education</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-normal">Empowering students through verified fee assistance and academic support to secure a brighter future.</p>
                                </div>
                                <div className="p-4 rounded-xl bg-primary/[0.02] border border-primary/5 space-y-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit"><HeartPulse className="h-5 w-5" /></div>
                                    <h4 className="font-bold text-sm">Healthcare</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-normal">Vetting critical medical cases to provide timely financial aid for surgeries and life-saving treatments.</p>
                                </div>
                                <div className="p-4 rounded-xl bg-primary/[0.02] border border-primary/5 space-y-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit"><Utensils className="h-5 w-5" /></div>
                                    <h4 className="font-bold text-sm">Relief Hub</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-normal">Coordinating monthly ration distributions and emergency relief kits for the most deserving families.</p>
                                </div>
                            </div>
                            
                            <Separator className="mb-8 opacity-10" />

                            <p className="text-sm text-primary/70 mb-8 max-w-3xl font-normal leading-relaxed">
                                {gpData.description}
                            </p>
                            {visiblePrinciples.length > 0 && (
                                <div className="grid gap-6">
                                    {visiblePrinciples.map((principle, idx) => (
                                        <div key={principle.id} className="flex gap-4 group">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                                                {idx + 1}
                                            </div>
                                            <div className="pt-1">
                                                <p className="text-base font-normal leading-relaxed text-foreground/90">
                                                    {principle.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Team Directory */}
                <AccordionItem value="team" className="border rounded-xl bg-white shadow-lg overflow-hidden border-primary/10">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline bg-primary/5">
                        <div className="flex items-center gap-3">
                            <Users className="h-6 w-6 text-primary" />
                            <span className="text-xl font-bold tracking-tight">Our Dedicated Team</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pt-6 pb-8">
                        <Accordion type="multiple" defaultValue={['founder', 'co-founder', 'finance', 'member']} className="w-full">
                            {GROUPS.map((group) => (
                                <AccordionItem value={group.id} key={group.id} className="border-primary/5">
                                    <AccordionTrigger className="text-lg font-bold hover:text-primary transition-colors py-6 tracking-tight">
                                        {group.name} ({(membersByGroup[group.id] || []).length})
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                                            {(membersByGroup[group.id] || []).map((member) => (
                                                <Card key={member.id} className="group transition-all duration-300 hover:shadow-md hover:-translate-y-1 bg-primary/[0.02] border-primary/5">
                                                    <CardContent className="p-4 flex items-center gap-4">
                                                        <Avatar className="h-16 w-16 border-2 border-primary/10 transition-transform group-hover:scale-105">
                                                            <AvatarImage src={member.idProofUrl || ''} alt={member.name || 'Member'} />
                                                            <AvatarFallback className="bg-primary text-white font-bold text-xs">{getInitials(member.name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0 space-y-0.5">
                                                            <p className="font-bold text-base truncate">{member.name}</p>
                                                            <p className="text-xs font-normal text-muted-foreground tracking-tight">{member.organizationRole || 'Member'}</p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                            {(membersByGroup[group.id] || []).length === 0 && <p className="text-sm text-muted-foreground p-4 font-normal italic">No Public Members In This Group.</p>}
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
