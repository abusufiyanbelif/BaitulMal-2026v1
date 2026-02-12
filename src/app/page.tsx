
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton';
import { getNestedValue } from '@/lib/utils';
import React from 'react';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, LifeBuoy, FlaskConical } from 'lucide-react';
import { DonationSummary } from '@/components/donation-summary';
import { LeadAndCampaignSummary } from '@/components/lead-campaign-summary';

export default function Home() {
    const { userProfile, isLoading } = useSession();

    const allCards = [
        {
            title: "Campaigns",
            description: "Manage ration, relief, and general campaigns.",
            href: "/campaign-members",
            icon: <FolderKanban />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns', false),
        },
        {
            title: "Leads",
            description: "Track and convert new initiatives and opportunities.",
            href: "/leads-members",
            icon: <Lightbulb />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members', false),
        },
        {
            title: "Donations",
            description: "View and manage all incoming donations.",
            href: "/donations",
            icon: <LifeBuoy />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations', false),
        },
        {
            title: "Extractor",
            description: "Scan & extract data from various documents.",
            href: "/extractor",
            icon: <ScanSearch />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor', false),
        },
        {
            title: "Story Creator",
            description: "Generate narratives from documents.",
            href: "/story-creator",
            icon: <MessageSquare />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.storyCreator', false),
        },
        {
            title: "User Management",
            description: "Manage user accounts and permissions.",
            href: "/users",
            icon: <Users />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users', false),
        },
        {
            title: "Settings",
            description: "Configure application branding and payments.",
            href: "/settings",
            icon: <Settings />,
            isVisible: userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings', false),
        },
        {
            title: "Diagnostics",
            description: "Check system health and configurations.",
            href: "/diagnostics",
            icon: <FlaskConical />,
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
            <>
                <h2 className="text-3xl font-bold tracking-tight mb-4">
                    Welcome back, {userProfile.name}!
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleCards.map((card) => (
                    <Link href={card.href} key={card.title} className="group">
                        <Card className="h-full hover:shadow-lg hover:border-primary transition-all duration-200 ease-in-out hover:scale-105 active:scale-95">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            {card.icon}
                            <div className="flex-1">
                            <CardTitle>{card.title}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>{card.description}</CardDescription>
                        </CardContent>
                        </Card>
                    </Link>
                    ))}
                </div>
            </>
            ) : (
            <div className="space-y-8">
              <Card className="max-w-4xl mx-auto text-center">
                  <CardHeader>
                      <CardTitle className="text-3xl font-bold">Welcome to Baitulmal Samajik Sanstha Solapur</CardTitle>
                      <CardDescription className="text-lg text-muted-foreground pt-2">
                          An overview of our organization's impact and activities.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button asChild size="lg">
                          <Link href="/campaign-public">View Public Campaigns</Link>
                      </Button>
                      <Button asChild variant="outline" size="lg">
                          <Link href="/leads-public">View Public Leads</Link>
                      </Button>
                  </CardContent>
              </Card>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-center">Live Summary</h2>
                <DonationSummary />
                <LeadAndCampaignSummary />
              </div>
            </div>
            )}
        </div>
    );
}
