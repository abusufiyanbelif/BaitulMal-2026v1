
'use client';

import { useEffect } from 'react';
import { LogOut, User, LogIn, Settings, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { signOut } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const isLoading = session.isLoading || isBrandingLoading;
  const user = session.user;
  const userProfile = session.userProfile;
  
  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;
  const homeHref = user ? '/dashboard' : '/';
  
  const logoStyle: React.CSSProperties = {
    objectFit: 'contain',
    maxHeight: '4.5rem', // 72px
  };

  if (brandingSettings?.logoWidth) {
    logoStyle.width = `${brandingSettings.logoWidth}px`;
  } else {
    logoStyle.width = 'auto';
  }
  if (brandingSettings?.logoHeight) {
    logoStyle.height = `${brandingSettings.logoHeight}px`;
  } else {
    logoStyle.height = 'auto';
  }

  return (
    <header className="bg-card border-b p-2 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href={homeHref} className="flex items-center gap-3 w-fit group transition-transform duration-300 ease-in-out hover:scale-105 animate-slide-in-from-top" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="relative flex items-center justify-center" style={{ minHeight: '4.5rem' }}>
            {isLoading ? (
                <Skeleton className="h-12 w-24" />
            ) : (
                validLogoUrl && (
                  <img
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
<<<<<<< Updated upstream
                    alt="Company Logo"
                    style={logoStyle}
=======
                    alt="Institutional logo"
                    width={60}
                    height={32}
                    className="object-contain drop-shadow-sm h-8 w-auto"
                    priority
>>>>>>> Stashed changes
                  />
                )
            )}
            </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-headline text-foreground animate-fade-in-zoom" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            {isBrandingLoading ? <Skeleton className="h-8 w-80" /> : (brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur')}
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
            <Button asChild variant="outline" className="animate-slide-in-from-top" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Organization members login</span>
                    <span className="sm:hidden">Login</span>
                </Link>
            </Button>
          )
        )}
      </div>
    </header>
  );
}
