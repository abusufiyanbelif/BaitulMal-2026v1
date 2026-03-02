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
    <header className="bg-white border-b p-2 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
        <Link href={homeHref} className="flex items-center gap-3 w-fit group transition-transform duration-300 ease-in-out hover:scale-[1.02] animate-slide-in-from-top" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="relative flex items-center justify-center h-14 w-auto min-w-[60px]">
            {isLoading ? (
                <Skeleton className="h-12 w-24 rounded-lg" />
            ) : (
                validLogoUrl && (
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Logo"
                    width={120}
                    height={60}
                    className="object-contain drop-shadow-sm"
                    style={{
                      maxHeight: '3.5rem',
                      width: 'auto',
                    }}
                    priority
                  />
                )
            )}
            </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tighter animate-fade-in-zoom" style={{ color: '#1B5E20', animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            {isBrandingLoading ? <Skeleton className="h-8 w-64 md:w-80" /> : (brandingSettings?.name || "Baitulmal Samajik Sanstha Solapur")}
          </h1>
        </Link>

        <nav className="flex items-center gap-2">
            {isLoading ? (
                <Skeleton className="h-10 w-10 rounded-full" />
            ) : user && userProfile ? (
              <div className="flex items-center gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-primary/10 p-0 transition-all hover:border-primary active:scale-95 animate-slide-in-from-top" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                        <Avatar className="h-full w-full">
                          <AvatarImage
                            src={userProfile?.idProofUrl || ''}
                            alt={userProfile?.name || 'User'}
                          />
                          <AvatarFallback className="bg-primary text-white font-black">
                            {getInitials(userProfile?.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 mt-2" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-black uppercase tracking-tight leading-none text-primary">
                            {userProfile?.name || 'User'}
                          </p>
                          <p className="text-xs font-medium text-muted-foreground pt-1">
                            {user.email}
                          </p>
                          <Badge variant="outline" className="w-fit mt-2 text-[10px] uppercase font-black border-primary/20 text-primary">{userProfile.role}</Badge>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                       <DropdownMenuItem asChild className="cursor-pointer font-bold h-11">
                        <Link href="/dashboard">
                          <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer font-bold h-11">
                        <Link href="/profile">
                          <User className="mr-2 h-4 w-4 text-primary" />
                          <span>Account Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      {userProfile.role === 'Admin' && (
                        <DropdownMenuItem asChild className="cursor-pointer font-bold h-11">
                          <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4 text-primary" />
                            <span>System Admin</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-black h-11"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>LOG OUT</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            ) : (
              pathname !== '/login' && (
                <div className="flex gap-2 items-center">
                    <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex font-bold uppercase tracking-widest text-xs hover:bg-primary/10 text-primary">
                        <Link href="/public-initiatives">Initiatives</Link>
                    </Button>
                    <Button asChild size="sm" className="font-black uppercase tracking-widest text-xs interactive-hover px-6 animate-slide-in-from-top bg-primary text-white" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
                        <Link href="/login">
                            <LogIn className="mr-2 h-4 w-4" />
                            Members Sign In
                        </Link>
                    </Button>
                </div>
              )
            )}
        </nav>
      </div>
    </header>
  );
}