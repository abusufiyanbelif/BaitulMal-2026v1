'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { getNestedValue } from '@/lib/utils';
import { settingsSubModules } from '@/lib/modules';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile } = useSession();

  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`);
  };

  const getActiveTab = () => {
    const pathParts = pathname.split('/');
    if (pathParts.length > 2) {
      return pathParts[2];
    }
    return 'app';
  };

  return (
    <div className="container mx-auto p-4 md:p-8 animate-fade-in-zoom">
       <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
              <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
              </Link>
          </Button>
      </div>
      <h1 className="text-3xl font-bold mb-6 text-primary">Settings</h1>
      
      <Tabs value={getActiveTab()} onValueChange={handleTabChange} className="w-full">
        <ScrollArea className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-3 h-auto w-full bg-transparent p-0">
                {settingsSubModules.map(subModule => {
                    const canReadSubModule = userProfile?.role === 'Admin' || getNestedValue(userProfile, `permissions.settings.${subModule.id}.read`, false);
                    if (!canReadSubModule) return null;
                    
                    return (
                        <TabsTrigger 
                            key={subModule.id} 
                            value={subModule.id} 
                            asChild
                            className="h-12 data-[state=active]:bg-primary data-[state=active]:text-white border border-primary/10 shadow-sm font-bold tracking-tight transition-all"
                        >
                             <Link href={`/settings/${subModule.id}`}>{subModule.name}</Link>
                        </TabsTrigger>
                    )
                })}
            </TabsList>
            <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
        <div className="mt-8">
            <div className="min-w-0">
                {children}
            </div>
        </div>
      </Tabs>
    </div>
  );
}