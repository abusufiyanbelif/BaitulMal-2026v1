'use client';

import { ReactNode } from 'react';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
    LayoutDashboard, 
    HeartHandshake, 
    UserCircle2, 
    Settings, 
    ChevronRight 
} from 'lucide-react';

export default function DonorPortalLayout({ children }: { children: ReactNode }) {
    const { isLoading, userProfile } = useSession();
    const pathname = usePathname();

    if (isLoading) return <BrandedLoader message="Synchronizing Donor Access..." />;

    const navItems = [
        { name: 'Dashboard', href: '/donor-portal', icon: LayoutDashboard },
        { name: 'My Contributions', href: '/donor-portal/donations', icon: HeartHandshake },
        { name: 'Profile & KYC', href: '/donor-portal/profile', icon: UserCircle2 },
        { name: 'Security', href: '/donor-portal/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Top Navigation Spacer (already handled by DocuExtractHeader) */}
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <aside className="w-full lg:w-64 shrink-0">
                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                                            isActive 
                                                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                                                : "text-slate-500 hover:bg-white hover:text-primary hover:shadow-sm"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400 group-hover:text-primary")} />
                                            {item.name}
                                        </div>
                                        {isActive && <ChevronRight className="h-4 w-4 text-white/60" />}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Quick Action Card */}
                        <div className="mt-8 p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-4">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Support Mission</p>
                            <p className="text-xs text-slate-600 leading-relaxed">Your contributions drive our community initiatives. Thank you for your continued trust.</p>
                            <Link href="/donate" className="block w-full py-3 bg-white text-primary text-center rounded-xl text-xs font-bold border border-primary/10 shadow-sm hover:shadow-md transition-all">
                                Contribute Now
                            </Link>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
