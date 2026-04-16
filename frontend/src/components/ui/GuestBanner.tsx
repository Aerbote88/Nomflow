'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function GuestBanner() {
    const pathname = usePathname();
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        setIsGuest(
            localStorage.getItem('guest_mode') === 'true'
            && !localStorage.getItem('username')
        );
    }, [pathname]);

    if (!isGuest) return null;
    if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') return null;

    return (
        <div className="w-full mb-3 px-4 py-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-between gap-4 text-[11px] font-black uppercase tracking-widest animate-in fade-in duration-500">
            <span className="text-text-secondary">
                You&apos;re in demo mode
            </span>
            <Link
                href="/register"
                className="text-accent-primary hover:text-accent-primary/80 transition-colors underline decoration-accent-primary/30"
            >
                Sign up for full access and to save your progress →
            </Link>
        </div>
    );
}
