'use client';

import { ReactNode } from 'react';
import { useSession } from '@/hooks/use-session';
import { useRouter, usePathname } from 'next/navigation';
import { BrandedLoader } from '@/components/branded-loader';

export default function DonorPortalLayout({ children }: { children: ReactNode }) {
    const { user, userProfile, isLoading } = useSession();
    const router = useRouter();

    if (isLoading) {
        return <BrandedLoader message="Accessing Supporter Records..." />;
    }

    if (!user || (!userProfile?.linkedDonorId && userProfile?.role !== 'Donor' && userProfile?.role !== 'Admin')) {
        router.replace('/portal-login');
        return null;
    }

    return (
        <div className="min-h-screen bg-muted/10 relative">
            <div className="absolute inset-0 bg-grid-primary/5 [mask-image:linear-gradient(0deg,transparent,black)] -z-10" />
            <div className="container mx-auto px-4 py-8">
                {children}
            </div>
        </div>
    );
}
