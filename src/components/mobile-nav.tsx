'use client';

import { Home, FolderKanban, Heart, ShieldCheck, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';

export function MobileNav() {
  const pathname = usePathname();
  const { userProfile, isStaff } = useSession();

  if (!userProfile) return null;

  const navItems = isStaff ? [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Donations', href: '/donations', icon: Heart },
    { label: 'Campaigns', href: '/campaign-members', icon: FolderKanban },
    { label: 'Verify', href: '/verifications', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: Settings },
  ] : [
    { label: 'Home', href: '/donor-portal', icon: Home },
    { label: 'History', href: '/donations', icon: Heart },
    { label: 'Profile', href: '/profile', icon: Settings },
  ];

  return (
    <div className="mobile-bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-all duration-300 tap-highlight",
              isActive ? "text-primary scale-110" : "text-muted-foreground opacity-60"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-all",
              isActive && "bg-primary/10 shadow-sm"
            )}>
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
            </div>
            <span className="text-[10px] font-bold tracking-tight uppercase">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
