'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart, BookOpen, HeartHandshake, ShieldCheck, Activity, ChevronRight, Smartphone, Navigation2 } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotificationManager } from '@/components/notification-manager';
import { useResourceConfig } from '@/hooks/use-resource-config';
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
                {badge && <Badge variant="secondary" className="text-[7px] font-bold px-1.5 h-3.5 bg-primary/10 text-primary border-none">{badge}</Badge>}
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
    const { resourceSettings } = useResourceConfig();

    const allCards = [
        {
            title: "Our Campaigns",
            description: "Manage projects, relief efforts, and charity programs.",
            href: "/campaign-members",
            icon: FolderKanban,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false),
        },
        {
            title: "Help Requests (Appeals)",
            description: "Track and manage help requests from the community.",
            href: "/leads-members",
            icon: Lightbulb,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "People Receiving Help",
            description: "See the list of families and recipients we support.",
            href: "/beneficiaries",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false),
        },
        {
            title: "Donor Profiles",
            description: "See details and history of people who donate.",
            href: "/donors",
            icon: HeartHandshake,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.read', false),
        },
        {
            title: "Donation List",
            description: "See all donations and payment slips received.",
            href: "/donations",
            icon: IndianRupee,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.read', false),
        },
        {
            title: "Approve & Check",
            description: "Check and approve new entries or changes in the system.",
            href: "/verifications",
            icon: ShieldCheck,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.read', false),
        },
        {
            title: "Help Guides",
            description: "See help documents and government schemes info.",
            href: "/guidance",
            icon: BookOpen,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.guidance.read', false),
        },
        {
            title: "AI File Scanner",
            description: "Scan identity cards, bills, and forms automatically.",
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
            title: "Charts & Reports",
            description: "See reports and charts of our progress.",
            href: "/analytics",
            icon: BarChart,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.analytics.read', false),
        },
        {
            title: "Messages & Alerts",
            description: "Check WhatsApp messages and other notifications.",
            href: "/messages",
            icon: MessageSquare,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.messages.read', false),
        },
        {
            title: "My Donor Profile",
            description: "See your own donations and slips.",
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
                {/* Infrastructure Health Alert (Admin Only) */}
                {userProfile?.role === 'Admin' && resourceSettings?.waPlanDetails?.status !== 'Active' && (
                    <div className="p-5 rounded-[32px] bg-red-50 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-red-900 tracking-tight">WhatsApp System Problem</p>
                                <p className="text-xs text-red-700 font-medium leading-relaxed">
                                    WhatsApp Notification System is <strong>{resourceSettings?.waPlanDetails?.status || 'Offline'}</strong>. 
                                    Automated tray alerts for donors and members are currently suspended.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Link href="/settings/resources/fundraising">
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 rounded-xl shadow-lg shadow-red-100">
                                    Raise Fund
                                </Button>
                            </Link>
                            <Link href="/settings/resources">
                                <Button size="sm" variant="outline" className="border-red-200 text-red-800 font-bold h-9 rounded-xl">
                                    Manage Plan
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
                
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
                            <p className="text-[10px] font-bold opacity-40 tracking-widest">Active Tasks</p>
                            <p className="text-xl font-bold text-primary">08</p>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <p className="text-[10px] font-bold opacity-40 tracking-widest">Team Live</p>
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
                                <Database className="h-5 w-5 opacity-40 group-hover:rotate-12 transition-transform"/> Mobile App Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row gap-6 items-center">
                                <div className="flex-1 space-y-3">
                                    <h4 className="text-sm font-bold text-primary tracking-tighter">Mobile App Experience</h4>
                                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                                        Enable **System Tray Alerts** for instant notifications on your mobile device. Install the portal as a native home screen app for a premium experience.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button asChild variant="default" className="h-9 text-xs font-bold bg-slate-900 text-white rounded-xl transition-transform active:scale-95 px-5">
                                            <Link href="/registry-index">
                                                <Navigation2 className="h-4 w-4 mr-2" /> Mobile Setup Guide
                                            </Link>
                                        </Button>
                                        <Button variant="outline" onClick={() => window.location.href = '/registry-index'} className="h-9 text-xs font-bold border-primary/20 text-primary rounded-xl transition-transform active:scale-95 px-5">
                                            <Smartphone className="h-4 w-4 mr-2" /> Add to Home
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
                                <FlaskConical className="h-5 w-5 opacity-40 group-hover:rotate-12 transition-transform"/> Live Sync Status
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
                                    <h4 className="text-sm font-bold text-primary">Everything is Up to Date</h4>
                                    <p className="text-[10px] text-muted-foreground font-normal tracking-tight">System is working correctly</p>
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