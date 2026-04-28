'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart, BookOpen, HeartHandshake, ShieldCheck, Activity, ChevronRight } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotificationManager } from '@/components/notification-manager';
import React from 'react';

function HomeDashboardCard({ title, description, href, icon: Icon, delay, badge }: { title: string, description: string, href: string, icon: React.ComponentType<{ className?: string }>, delay: string, badge?: string }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
      <Link href={href} className="block group">
        <Card className="h-full glass-card hover-lift group-hover:border-primary border-primary/10 p-5 relative overflow-hidden transition-all duration-500">
          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
             <ChevronRight className="h-4 w-4 text-primary/40" />
          </div>
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-md font-bold text-primary group-hover:text-primary transition-colors tracking-tight">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[7px] font-bold uppercase px-1.5 h-3.5 bg-primary/10 text-primary border-none">{badge}</Badge>}
              </div>
              <CardDescription className="text-[10px] sm:text-xs font-medium leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{description}</CardDescription>
            </div>
            <div className="p-2.5 rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-all duration-300 group-hover:rotate-6 shadow-sm group-hover:shadow-md">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}

export default function Home() {
    const { userProfile, isLoading, isContributor } = useSession();

    const allCards = [
        {
            title: "Organization Campaigns",
            description: "Manage Team Projects, Relief Efforts, And Charity Programs.",
            href: "/campaign-members",
            icon: FolderKanban,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false),
        },
        {
            title: "Public Appeals Hub",
            description: "Track And Manage Individual Aid Cases And Community Requests.",
            href: "/leads-members",
            icon: Lightbulb,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "Beneficiary Registry",
            description: "Maintain The Master List Of All Deserving Families And Recipients.",
            href: "/beneficiaries",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false),
        },
        {
            title: "Donor Profiles",
            description: "Manage Donor Identity, History, And Community Relationships.",
            href: "/donors",
            icon: HeartHandshake,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.read', false),
        },
        {
            title: "Donation Records",
            description: "Secure Access To All Verified Contributions And Payment Vouchers.",
            href: "/donations",
            icon: IndianRupee,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.read', false),
        },
        {
            title: "Verification Pipeline",
            description: "Audit And Approve Institutional Record Modifications.",
            href: "/verifications",
            icon: ShieldCheck,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.read', false),
        },
        {
            title: "Guidance Center",
            description: "Manage Help Documents, Local Schemes, And Support Resources.",
            href: "/guidance",
            icon: BookOpen,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.guidance.read', false),
        },
        {
            title: "Smart Document Scanner",
            description: "AI Tools For Scanning Forms, Bills, And Identity Proofs.",
            href: "/extractor",
            icon: ScanSearch,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor.read', false),
        },
        {
            title: "User & Team Management",
            description: "Control Team Access, Roles, And Member Account Settings.",
            href: "/users",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.read', false),
        },
        {
            title: "System Settings",
            description: "Update Organization Name, Payments, And Branding Themes.",
            href: "/settings",
            icon: Settings,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.read', false),
        },
        {
            title: "Impact Analytics",
            description: "Explore Visual Reports On Growth And Data Usage Trends.",
            href: "/analytics",
            icon: BarChart,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.analytics.read', false),
        },
        {
            title: "Messaging Module",
            description: "Monitor All Notifications, WhatsApp Alerts, And Message Templates.",
            href: "/messages",
            icon: MessageSquare,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.messages.read', false),
        },
        {
            title: "My Donor Portal",
            description: "Switch To Personal View To See Your Own Contributions And Receipts.",
            href: "/donor-portal",
            icon: HeartHandshake,
            isVisible: isContributor,
            badge: "Self Service"
        },
    ];

    const visibleCards = allCards.filter(card => card.isVisible);

    return (
        <div className="container mx-auto p-4 md:p-8 text-primary font-normal">
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-[20px]" />
                    ))}
                </div>
            ) : userProfile ? (
            <div className="space-y-6 md:space-y-10 animate-fade-in-zoom relative">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
                <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter text-primary leading-tight">
                            Assalamu Alaikum!
                        </h2>
                        <div className="flex items-center gap-2">
                            <p className="text-sm sm:text-xl opacity-80 font-medium tracking-tight">{userProfile.name}</p>
                            <span className="h-1 w-1 rounded-full bg-primary/40" />
                            <Badge variant="outline" className="font-bold border-primary/20 text-primary capitalize px-3 h-6 bg-primary/5 rounded-full text-[10px]">{userProfile.role}</Badge>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-primary/5 shadow-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <div className="px-4 py-2 text-center border-r border-primary/10">
                            <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Active Tasks</p>
                            <p className="text-xl font-bold text-primary">08</p>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Team Live</p>
                            <div className="flex items-center justify-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-xl font-bold text-primary">24</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 mb-8">
                    {visibleCards.map((card, index) => (
                        <HomeDashboardCard
                            key={card.title}
                            title={card.title}
                            description={card.description}
                            href={card.href}
                            icon={card.icon}
                            delay={`${100 + index * 40}ms`}
                            badge={card.badge}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 animate-fade-in-up" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
                    <Card className="glass-card border-primary/10 overflow-hidden group hover:border-primary/20 transition-all duration-500">
                        <CardHeader className="bg-primary/5 py-4">
                            <CardTitle className="text-md font-bold text-primary flex items-center gap-2 tracking-tight">
                                <Database className="h-5 w-5 opacity-40 group-hover:rotate-12 transition-transform"/> Mobile App Connectivity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row gap-6 items-center">
                                <div className="flex-1 space-y-3">
                                    <h4 className="text-sm font-bold text-primary">APK & Native Support</h4>
                                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                                        The institutional platform is now **Native-Ready**. Download the APK for real-time system alerts.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="h-9 text-xs font-bold border-primary/20 text-primary rounded-xl transition-transform active:scale-95 px-5">
                                            Download APK
                                        </Button>
                                        <Button variant="secondary" className="h-9 text-xs font-bold bg-primary/10 text-primary rounded-xl transition-transform active:scale-95 border-none px-5">
                                            Add to Home
                                        </Button>
                                    </div>
                                </div>
                                <div className="w-full sm:w-auto">
                                    <NotificationManager />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-primary/10 overflow-hidden group hover:border-primary/20 transition-all duration-500">
                        <CardHeader className="bg-primary/5 py-4">
                            <CardTitle className="text-md font-bold text-primary flex items-center gap-2 tracking-tight">
                                <FlaskConical className="h-5 w-5 opacity-40 group-hover:rotate-12 transition-transform"/> Real-time Sync Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 flex items-center justify-center min-h-[160px]">
                            <div className="text-center space-y-4">
                                <div className="relative inline-flex">
                                    <div className="w-16 h-16 rounded-full border-4 border-primary/10 flex items-center justify-center shadow-inner">
                                        <Activity className="h-8 w-8 text-primary animate-pulse" />
                                    </div>
                                    <span className="absolute top-0 right-0 h-4 w-4 bg-green-500 border-2 border-white rounded-full shadow-sm"></span>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-primary">Bi-Directional Sync Active</h4>
                                    <p className="text-[10px] text-muted-foreground font-normal tracking-tight">Cloud verification latency: <span className="text-green-600 font-bold">14ms</span></p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            ) : (
             <div className="text-center py-20 animate-fade-in-zoom">
                <p className="text-primary font-bold text-lg opacity-40">Your Profile Record Could Not Be Found.</p>
             </div>
            )}
        </div>
    );
}