
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Users, FolderKanban, ScanSearch, Settings, MessageSquare, Lightbulb, Database, FlaskConical, LifeBuoy, Home } from 'lucide-react';
import { getNestedValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardCard({ title, description, href, icon: Icon, isVisible, animationDelay }: { title: string, description: string, href: string, icon: React.ComponentType<{ className?: string }>, isVisible: boolean, animationDelay: string }) {
  if (!isVisible) {
    return null;
  }
  return (
    <div className="animate-fade-in-zoom" style={{ animationDelay }}>
        <Link href={href} className="block group">
            <Card className="h-full p-4 transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-primary active:scale-95">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription className="text-xs">{description}</CardDescription>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
            </Card>
        </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { userProfile, isLoading } = useSession();
  
  const canViewCampaigns = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns', false);
  const canViewLeads = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members', false);
  const canViewDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.donations', false);
  const canViewExtractor = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.extractor', false);
  const canViewStoryCreator = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.storyCreator', false);
  const canViewUsers = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.users', false);
  const canViewSettings = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings', false);
  const canViewDiagnostics = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.diagnostics', false);

  const cards = [
    { title: "Public Home", description: "View the public-facing homepage.", href: "/", icon: Home, isVisible: true },
    { title: "Campaigns", description: "Manage ration, relief, and general campaigns.", href: "/campaign-members", icon: FolderKanban, isVisible: canViewCampaigns },
    { title: "Leads", description: "Track and convert new initiatives and opportunities.", href: "/leads-members", icon: Lightbulb, isVisible: canViewLeads },
    { title: "Donations", description: "View and manage all incoming donations.", href: "/donations", icon: LifeBuoy, isVisible: canViewDonations },
    { title: "Extractor", description: "Scan & extract data from various documents.", href: "/extractor", icon: ScanSearch, isVisible: canViewExtractor },
    { title: "Story Creator", description: "Generate narratives from documents.", href: "/story-creator", icon: MessageSquare, isVisible: canViewStoryCreator },
    { title: "User Management", description: "Manage user accounts and permissions.", href: "/users", icon: Users, isVisible: canViewUsers },
    { title: "Settings", description: "Configure application branding and payments.", href: "/settings", icon: Settings, isVisible: canViewSettings },
    { title: "Diagnostics", description: "Check system health and configurations.", href: "/diagnostics", icon: FlaskConical, isVisible: canViewDiagnostics },
  ];

  const visibleCards = cards.filter(card => card.isVisible);

  return (
    <main className="container mx-auto p-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold animate-fade-in-zoom" style={{ animationDelay: '300ms' }}>Dashboard</h1>
        <p className="text-muted-foreground animate-fade-in-zoom" style={{ animationDelay: '400ms' }}>
            {isLoading ? <Skeleton className="h-5 w-48" /> : `Welcome back, ${userProfile?.name}. Here's an overview of your application modules.`}
        </p>
        {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
            </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleCards.map((card, index) => (
              <DashboardCard
                key={card.title}
                {...card}
                animationDelay={`${100 + index * 100}ms`}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
