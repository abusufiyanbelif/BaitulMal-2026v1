'use client';

import { LogOut, User, LogIn, Settings, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/firebase/provider';
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
import { getInitials } from '@/lib/utils';

export function DocuExtractHeader() {
  const session = useSession();
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    if (auth) {
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
    <header className="bg-card border-b p-1 shadow-sm">
      <div className="container mx-auto flex flex-wrap justify-between items-center gap-2">
        <Link href={homeHref} className="flex items-center gap-2 w-fit group transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-top" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="relative flex items-center justify-center" style={{ minHeight: '3.5rem' }}>
            {isLoading ? (
                <Skeleton className="h-12 w-24" />
            ) : (
                validLogoUrl && (
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Company Logo"
                    width={brandingSettings?.logoWidth || 100}
                    height={brandingSettings?.logoHeight || 50}
                    className="object-contain"
                    style={{
                      maxHeight: '3.5rem',
                      width: 'auto',
                      height: 'auto',
                    }}
                    priority
                  />
                )
            )}
            </div>
          <h1 className="text-base sm:text-lg md:text-xl font-bold font-headline text-foreground animate-fade-in-zoom" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            {isBrandingLoading ? <Skeleton className="h-8 w-64 md:w-80" /> : (brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur')}
          </h1>
        </Link>

        {isLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
        ) : user && userProfile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full transition-transform duration-200 ease-in-out hover:scale-110 active:scale-100 animate-slide-in-from-top" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user.photoURL || ''}
                    alt={userProfile?.name || 'User'}
                  />
                  <AvatarFallback>
                    {getInitials(userProfile?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userProfile?.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </Link>
              </DropdownMenuItem>
              {userProfile.role === 'Admin' && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          pathname !== '/login' && (
            <div className="flex gap-2 items-center">
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link href="/public-initiatives">Initiatives</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="animate-slide-in-from-top" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                    <Link href="/login">
                        <LogIn className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Members login</span>
                        <span className="sm:hidden">Login</span>
                    </Link>
                </Button>
            </div>
          )
        )}
      </div>
    </header>
  );
}
