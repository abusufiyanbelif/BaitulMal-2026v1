'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart, BookOpen, HeartHandshake, ShieldCheck, Activity } from 'lucide-react';
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
        <Card className="h-full glass-card hover-lift group-hover:border-primary border-primary/5 p-5">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-md font-bold text-primary group-hover:text-primary transition-colors">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[7px] font-bold uppercase px-1.5 h-3.5 bg-primary/10 text-primary border-none">{badge}</Badge>}
              </div>
              <CardDescription className="text-[10px] sm:text-xs font-medium leading-relaxed opacity-80">{description}</CardDescription>
            </div>
            <div className="p-2 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
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
            <div className="space-y-6 md:space-y-10 animate-fade-in-zoom">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-primary">
                            Assalamu Alaikum!
                        </h2>
                        <p className="text-sm sm:text-lg opacity-70 font-medium">{userProfile.name}</p>
                    </div>
                    <Badge variant="outline" className="w-fit font-bold border-primary/20 text-primary capitalize px-4 h-8 bg-primary/5 rounded-full">{userProfile.role} Account</Badge>
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
                    <Card className="glass-card border-primary/10 overflow-hidden group">
                        <CardHeader className="bg-primary/5 py-4">
                            <CardTitle className="text-md font-bold text-primary flex items-center gap-2">
                                <Database className="h-5 w-5 opacity-40"/> Mobile App Connectivity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row gap-6 items-center">
                                <div className="flex-1 space-y-3">
                                    <h4 className="text-sm font-bold text-primary">APK & Native Support</h4>
                                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                                        The institutional platform is now **Native-Ready**. You can download the APK or install it as a standalone app to receive system tray notifications even when offline.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="h-9 text-xs font-bold border-primary/20 text-primary rounded-xl transition-transform active:scale-95">
                                            Download APK
                                        </Button>
                                        <Button variant="secondary" className="h-9 text-xs font-bold bg-primary/10 text-primary rounded-xl transition-transform active:scale-95 border-none">
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

                    <Card className="glass-card border-primary/10 overflow-hidden group">
                        <CardHeader className="bg-primary/5 py-4">
                            <CardTitle className="text-md font-bold text-primary flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 opacity-40"/> Real-time Sync Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 flex items-center justify-center min-h-[160px]">
                            <div className="text-center space-y-4">
                                <div className="relative inline-flex">
                                    <div className="w-16 h-16 rounded-full border-4 border-primary/10 flex items-center justify-center">
                                        <Activity className="h-8 w-8 text-primary animate-pulse" />
                                    </div>
                                    <span className="absolute top-0 right-0 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></span>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-primary">Bi-Directional Sync Active</h4>
                                    <p className="text-[10px] text-muted-foreground font-normal">All actions performed on mobile are instantly verified across the institutional cloud database.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            ) : (
             <div className="text-center py-20">
                <p className="text-primary font-bold text-lg">Your Profile Record Could Not Be Found.</p>
             </div>
            )}
        </div>
    );
}