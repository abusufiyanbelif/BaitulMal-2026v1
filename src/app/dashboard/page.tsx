'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

function HomeDashboardCard({ title, description, href, icon: Icon, delay }: { title: string, description: string, href: string, icon: React.ComponentType<{ className?: string }>, delay: string }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay, animationFillMode: 'backwards' }}>
      <Link href={href} className="block group">
        <Card className="h-full transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-primary active:scale-95 border-primary/10">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <CardTitle className="text-md font-bold text-primary">{title}</CardTitle>
              <CardDescription className="text-xs font-normal">{description}</CardDescription>
            </div>
            <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary shrink-0" />
          </div>
        </Card>
      </Link>
    </div>
  );
}

export default function Home() {
    const { userProfile, isLoading } = useSession();

    const allCards = [
        {
            title: "Campaigns",
            description: "Manage Ration, Relief, And General Campaigns.",
            href: "/campaign-members",
            icon: FolderKanban,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false),
        },
        {
            title: "Leads",
            description: "Track And Convert New Initiatives And Individual Leads.",
            href: "/leads-members",
            icon: Lightbulb,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "Beneficiaries",
            description: "Manage A Comprehensive List Of All Aid Recipients.",
            href: "/beneficiaries",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false),
        },
        {
            title: "Donations",
            description: "View And Manage All Verified Incoming Donations.",
            href: "/donations",
            icon: IndianRupee,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.read', false),
        },
         {
            title: "Public Preview",
            description: "Review Public-Facing Pages And Summaries.",
            href: "/public-summary",
            icon: Eye,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false) || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "Extractor",
            description: "Scan And Extract Key Information From Documents.",
            href: "/extractor",
            icon: ScanSearch,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor.read', false),
        },
        {
            title: "Story Creator",
            description: "Generate Impact Narratives From Verified Data.",
            href: "/story-creator",
            icon: MessageSquare,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.storyCreator.read', false),
        },
        {
            title: "User Management",
            description: "Manage Organization User Accounts And Permissions.",
            href: "/users",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.read', false),
        },
        {
            title: "Settings",
            description: "Configure Branding, Payments, And Module Rules.",
            href: "/settings",
            icon: Settings,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.read', false),
        },
        {
            title: "Analytics",
            description: "View Organization Metrics And Usage Statistics.",
            href: "/analytics",
            icon: BarChart,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.analytics.read', false),
        },
        {
            title: "Diagnostics",
            description: "Perform Health Checks On All Critical Resources.",
            href: "/diagnostics",
            icon: FlaskConical,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.diagnostics.read', false),
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
                <h2 className="text-3xl font-bold tracking-tight mb-4 text-primary">
                    Welcome Back, {userProfile.name}!
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                    {visibleCards.map((card, index) => (
                        <HomeDashboardCard
                            key={card.title}
                            title={card.title}
                            description={card.description}
                            href={card.href}
                            icon={card.icon}
                            delay={`${200 + index * 50}ms`}
                        />
                    ))}
                </div>
            </div>
            ) : (
             <div className="text-center py-20">
                <p className="text-primary font-bold text-lg">Could Not Load User Profile Document.</p>
             </div>
            )}
        </div>
    );
}
