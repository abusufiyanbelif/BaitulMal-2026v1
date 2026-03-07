'use client';

import { LogOut, User, LogIn, Settings, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { signOut } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/utils';
import { NotificationBell } from './notification-bell';

/**
 * Main Header - Fully theme-reactive.
 * Uses semantic background and border classes to adapt to all themes.
 */
export function DocuExtractHeader() {
  const session = useSession();
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    if (auth) {
      await session.forceRefetch();
      await signOut(auth);
      router.push('/login');
    }
  };

  const isLoading = session.isLoading || isBrandingLoading;
  const user = session.user;
  const userProfile = session.userProfile;
  
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const homeHref = user ? '/dashboard' : '/';
  
  return (
    <header className="bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-50 w-full py-4 flex items-center transition-all duration-500 shadow-sm">
      <div className="container mx-auto flex justify-between items-center px-4 gap-4">
        <Link href={homeHref} className="flex items-center gap-4 group transition-all hover:scale-[1.01]">
          <div className="relative flex-shrink-0 flex items-center justify-center h-16 w-16 bg-primary/5 rounded-xl border border-primary/10 overflow-hidden shadow-inner">
            {isLoading ? (
                <Skeleton className="h-12 w-12 rounded-lg" />
            ) : (
                validLogoUrl && (
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Logo"
                    fill
                    className="object-contain p-1.5"
                    priority
                  />
                )
            )}
            </div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tighter leading-tight transition-colors group-hover:opacity-80">
            {isBrandingLoading ? <Skeleton className="h-6 w-48" /> : (brandingSettings?.name || "Baitulmal Samajik Sanstha Solapur")}
          </h1>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
            {isLoading ? (
                <Skeleton className="h-10 w-10 rounded-full" />
            ) : user && userProfile ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-primary/10 p-0 transition-all hover:border-primary active:scale-95 shadow-sm">
                      <Avatar className="h-full w-full rounded-full overflow-hidden">
                        <AvatarImage
                          src={userProfile?.idProofUrl || ''}
                          alt={userProfile?.name || 'User'}
                        />
                        <AvatarFallback className="bg-secondary text-primary font-bold text-xs">
                          {getInitials(userProfile?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 mt-2 animate-fade-in-zoom border-primary/10 shadow-2xl" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal p-4">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold tracking-tight text-primary">
                          {userProfile?.name || 'User'}
                        </p>
                        <p className="text-[10px] font-normal text-muted-foreground pt-1 truncate uppercase tracking-widest">
                          {user.email}
                        </p>
                        <Badge variant="outline" className="w-fit mt-3 text-[9px] font-bold border-primary/20 text-primary uppercase tracking-tighter">Member Account</Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-primary/5" />
                     <DropdownMenuItem asChild className="cursor-pointer h-11 font-normal text-primary hover:bg-primary/5">
                      <Link href="/dashboard" className="flex items-center w-full">
                        <LayoutDashboard className="mr-3 h-4 w-4 opacity-60" />
                        <span>Member Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer h-11 font-normal text-primary hover:bg-primary/5">
                      <Link href="/profile" className="flex items-center w-full">
                        <User className="mr-3 h-4 w-4 opacity-60" />
                        <span>Profile Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    {userProfile.role === 'Admin' && (
                      <DropdownMenuItem asChild className="cursor-pointer h-11 font-normal text-primary hover:bg-primary/5">
                        <Link href="/settings" className="flex items-center w-full">
                          <Settings className="mr-3 h-4 w-4 opacity-60" />
                          <span>System Administration</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-primary/5" />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer h-11 font-normal"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              pathname !== '/login' && (
                <Button asChild className="font-bold tracking-tight text-xs shadow-md px-6 h-10 transition-all active:scale-95 rounded-xl">
                    <Link href="/login">
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Member Login</span>
                    </Link>
                </Button>
              )
            )}
        </nav>
      </div>
    </header>
  );
}
