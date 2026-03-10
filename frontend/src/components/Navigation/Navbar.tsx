'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';

export function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    useEffect(() => {
        const username = localStorage.getItem('username');
        setIsLoggedIn(!!username);
        setCurrentUser(username);
    }, [pathname]);

    const handleLogout = () => {
        // Clear all saved study sessions so a different user doesn't inherit them
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('study_session_')) localStorage.removeItem(key);
        });
        localStorage.removeItem('username');
        window.location.href = '/api/logout';
    };

    if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') return null;

    return (
        <>
        <nav className="w-full flex justify-between items-center mb-8 border-b border-accent-gold/10 pb-6 animate-in fade-in duration-700">
            <Link href="/" className="group flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary font-nom text-xl border border-accent-gold/20 group-hover:bg-accent-primary/20 transition-all duration-300">
                    𡨸
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-display font-bold tracking-tight text-text-primary">NômFlow</span>
                    <span className="text-[8px] font-display font-bold uppercase tracking-[0.4em] text-accent-primary opacity-60">Script, Simplified</span>
                </div>
            </Link>

            <div className="flex items-center gap-4 md:gap-8">
                {isLoggedIn ? (
                    <>
                        <Link href="/dashboard" className={`text-[11px] font-black uppercase tracking-widest transition-colors ${pathname === '/dashboard' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                            Dashboard
                        </Link>
                        <Link href="/library" className={`text-[11px] font-black uppercase tracking-widest transition-colors ${pathname?.startsWith('/library') ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                            Library
                        </Link>
                        <Link href="/vocab" className={`hidden md:block text-[11px] font-black uppercase tracking-widest transition-colors ${pathname === '/vocab' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                            Flashcards
                        </Link>
                        <Link href="/leaderboard" className={`hidden md:block text-[11px] font-black uppercase tracking-widest transition-colors ${pathname === '/leaderboard' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                            Leaderboard
                        </Link>
                        <Link href="/settings" className={`hidden md:block text-[11px] font-black uppercase tracking-widest transition-colors ${pathname === '/settings' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                            Settings
                        </Link>
{currentUser && (
                            <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                                {currentUser}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-[11px] font-black text-red-500/60 hover:text-red-500 hover:bg-red-500/10 uppercase tracking-[0.2em]"
                        >
                            Sign Out
                        </Button>
                    </>
                ) : (
                    <Link href="/login" className="text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors">
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
        </>
    );
}
