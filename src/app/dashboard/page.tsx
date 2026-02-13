
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, LifeBuoy, Eye, Quote } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import dynamic from 'next/dynamic';

const WisdomAndReflection = dynamic(() => import('@/components/WisdomAndReflection').then(mod => mod.WisdomAndReflection), {
    ssr: false,
    loading: () => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Quote className="h-6 w-6 text-primary" />
                    Wisdom & Reflection
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pl-10">
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-4/5" />
            </CardContent>
        </Card>
    ),
});


function HomeDashboardCard({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
      <Link href={href} className="block group">
        <Card className="h-full p-4 transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-primary active:scale-95">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <CardTitle className="text-md">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
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
            description: "Manage ration, relief, and general campaigns.",
            href: "/campaign-members",
            icon: FolderKanban,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns', false),
        },
        {
            title: "Leads",
            description: "Track and convert new initiatives and opportunities.",
            href: "/leads-members",
            icon: Lightbulb,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members', false),
        },
        {
            title: "Beneficiaries",
            description: "Manage a master list of all beneficiaries.",
            href: "/beneficiaries",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.beneficiaries', false),
        },
        {
            title: "Donations",
            description: "View and manage all incoming donations.",
            href: "/donations",
            icon: LifeBuoy,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations', false),
        },
         {
            title: "Public Summary",
            description: "Preview public-facing pages.",
            href: "/public-summary",
            icon: Eye,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns', false) || !!getNestedValue(userProfile, 'permissions.leads-members', false),
        },
        {
            title: "Extractor",
            description: "Scan & extract data from various documents.",
            href: "/extractor",
            icon: ScanSearch,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor', false),
        },
        {
            title: "Story Creator",
            description: "Generate narratives from documents.",
            href: "/story-creator",
            icon: MessageSquare,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.storyCreator', false),
        },
        {
            title: "User Management",
            description: "Manage user accounts and permissions.",
            href: "/users",
            icon: Users,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users', false),
        },
        {
            title: "Settings",
            description: "Configure application branding and payments.",
            href: "/settings",
            icon: Settings,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings', false),
        },
        {
            title: "Diagnostics",
            description: "Check system health and configurations.",
            href: "/diagnostics",
            icon: FlaskConical,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.diagnostics', false),
        },
    ];

    const visibleCards = allCards.filter(card => card.isVisible);

    return (
        <div className="container mx-auto p-4 md:p-8">
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-40" />
                    ))}
                </div>
            ) : userProfile ? (
            <div className="space-y-8">
                <h2 className="text-3xl font-bold tracking-tight mb-4">
                    Welcome back, {userProfile.name}!
                </h2>
                <WisdomAndReflection />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                    {visibleCards.map((card) => (
                        <HomeDashboardCard
                            key={card.title}
                            title={card.title}
                            description={card.description}
                            href={card.href}
                            icon={card.icon}
                        />
                    ))}
                </div>
            </div>
            ) : (
             <div className="text-center">
                <p>Could not load user profile.</p>
             </div>
            )}
        </div>
    );
}
