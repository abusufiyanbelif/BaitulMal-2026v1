'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, IndianRupee, Eye, BarChart, BookOpen, HeartHandshake } from 'lucide-react';
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
            description: "Manage Group Ration, Relief, And Special Projects.",
            href: "/campaign-members",
            icon: FolderKanban,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false),
        },
        {
            title: "Public Appeals",
            description: "Track And Manage Individual Support Cases.",
            href: "/leads-members",
            icon: Lightbulb,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "Beneficiary Registry",
            description: "A Comprehensive List Of All Aid Recipients.",
            href: "/beneficiaries",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries.read', false),
        },
        {
            title: "Donor Profiles",
            description: "Manage Community Contributor Vetting And Identity.",
            href: "/donors",
            icon: HeartHandshake,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donors.read', false),
        },
        {
            title: "Donation Records",
            description: "View And Manage All Verified Contributions.",
            href: "/donations",
            icon: IndianRupee,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations.read', false),
        },
        {
            title: "Guidance Directory",
            description: "Manage Help Resources And Community Schemes.",
            href: "/guidance",
            icon: BookOpen,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.guidance.read', false),
        },
         {
            title: "Public Preview",
            description: "Review Live Informational Pages And Summary Metrics.",
            href: "/public-summary",
            icon: Eye,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.read', false) || !!getNestedValue(userProfile, 'permissions.leads-members.read', false),
        },
        {
            title: "Document Extractor",
            description: "AI-Powered Text And Data Extraction Hub.",
            href: "/extractor",
            icon: ScanSearch,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor.read', false),
        },
        {
            title: "Story Creator",
            description: "Generate Impact Narratives From Verified Reports.",
            href: "/story-creator",
            icon: MessageSquare,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.storyCreator.read', false),
        },
        {
            title: "User Management",
            description: "Manage Staff Accounts And Role Permissions.",
            href: "/users",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users.read', false),
        },
        {
            title: "System Settings",
            description: "Configure Branding, Payments, And Compliance Rules.",
            href: "/settings",
            icon: Settings,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.read', false),
        },
        {
            title: "Data Analytics",
            description: "In-Depth Usage Metrics And Historical Trends.",
            href: "/analytics",
            icon: BarChart,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.analytics.read', false),
        },
        {
            title: "System Health",
            description: "Perform Diagnostic Checks On All Essential Services.",
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
                    Assalamu Alaikum, {userProfile.name}!
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
                <p className="text-primary font-bold text-lg">Profile Could Not Be Retrieved.</p>
             </div>
            )}
        </div>
    );
}
