'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart, BookOpen, HeartHandshake, ShieldCheck } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import React from 'react';

function HomeDashboardCard({ title, description, href, icon: Icon, delay, badge }: { title: string, description: string, href: string, icon: React.ComponentType<{ className?: string }>, delay: string, badge?: string }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
      <Link href={href} className="block group">
        <Card className="h-full transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-primary active:scale-95 border-primary/10">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-md font-bold text-primary">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4">{badge}</Badge>}
              </div>
              <CardDescription className="text-xs font-normal leading-relaxed">{description}</CardDescription>
            </div>
            <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary shrink-0" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-[16px]" />
                    ))}
                </div>
            ) : userProfile ? (
            <div className="space-y-8 animate-fade-in-zoom">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-primary">
                        Assalamu Alaikum, {userProfile.name}!
                    </h2>
                    <Badge variant="outline" className="font-bold border-primary/20 text-primary capitalize px-3 h-7">{userProfile.role} Account</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                    {visibleCards.map((card, index) => (
                        <HomeDashboardCard
                            key={card.title}
                            title={card.title}
                            description={card.description}
                            href={card.href}
                            icon={card.icon}
                            delay={`${200 + index * 50}ms`}
                            badge={card.badge}
                        />
                    ))}
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