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
    <header className="bg-white border-b p-2 shadow-sm sticky top-0 z-50 w-full overflow-hidden">
      <div className="container mx-auto flex flex-nowrap justify-between items-center gap-2 px-2 sm:px-4">
        <Link href={homeHref} className="flex items-center gap-2 min-w-0 flex-1 group transition-transform duration-300 ease-in-out hover:scale-[1.01]">
          <div className="relative flex-shrink-0 flex items-center justify-center h-10 w-auto min-w-[32px]">
            {isLoading ? (
                <Skeleton className="h-8 w-8 rounded-lg" />
            ) : (
                validLogoUrl && (
                  <Image
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Institutional logo"
                    width={60}
                    height={32}
                    className="object-contain drop-shadow-sm h-8 w-auto"
                    priority
                  />
                )
            )}
            </div>
          <h1 className="text-sm md:text-base lg:text-xl font-bold tracking-tight text-primary leading-tight">
            {isBrandingLoading ? <Skeleton className="h-4 w-32 sm:w-64" /> : (brandingSettings?.name || "Baitulmal Samajik Sanstha Solapur")}
          </h1>
        </Link>

        <nav className="flex items-center gap-2 flex-shrink-0">
            {isLoading ? (
                <Skeleton className="h-8 w-8 rounded-full" />
            ) : user && userProfile ? (
              <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full border-2 border-primary/10 p-0 transition-all hover:border-primary active:scale-95">
                        <Avatar className="h-full w-full">
                          <AvatarImage
                            src={userProfile?.idProofUrl || ''}
                            alt={userProfile?.name || 'User'}
                          />
                          <AvatarFallback className="bg-primary text-white font-bold text-xs">
                            {getInitials(userProfile?.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 mt-2" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-bold tracking-tight text-primary">
                            {userProfile?.name || 'User'}
                          </p>
                          <p className="text-xs font-normal text-muted-foreground pt-1 truncate">
                            {user.email}
                          </p>
                          <Badge variant="outline" className="w-fit mt-2 text-[10px] font-bold border-primary/20 text-primary">{userProfile.role}</Badge>
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
                          <span>Account settings</span>
                        </Link>
                      </DropdownMenuItem>
                      {userProfile.role === 'Admin' && (
                        <DropdownMenuItem asChild className="cursor-pointer font-bold h-11">
                          <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4 text-primary" />
                            <span>System admin</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-bold h-11"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            ) : (
              pathname !== '/login' && (
                <Button asChild size="sm" className="font-bold tracking-tight text-[10px] sm:text-xs bg-primary text-white hover:bg-primary/90 shadow-sm px-2 sm:px-4 h-8 transition-transform active:scale-95">
                    <Link href="/login">
                        <LogIn className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline">Member login</span>
                        <span className="xs:hidden">Login</span>
                    </Link>
                </Button>
              )
            )}
        </nav>
      </div>
    </header>
  );
}
