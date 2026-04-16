'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';

export function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    useEffect(() => {
        const username = localStorage.getItem('username');
        const guest = localStorage.getItem('guest_mode') === 'true';
        setIsLoggedIn(!!username);
        setIsGuest(guest && !username);
        setCurrentUser(username);
    }, [pathname]);

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('study_session_')) localStorage.removeItem(key);
        });
        localStorage.removeItem('username');
        localStorage.removeItem('guest_mode');
        window.location.href = '/api/logout';
    };

    const handleExitDemo = () => {
        localStorage.removeItem('guest_mode');
        window.location.href = '/login';
    };

    if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') return null;

    const navLinks = [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/library', label: 'Library' },
        { href: '/reader', label: 'Reader' },
        { href: '/writing-practice', label: 'Writing' },
        { href: '/leaderboard', label: 'Leaderboard' },
        { href: '/settings', label: 'Settings' },
    ];

    const guestNavLinks = [
        { href: '/writing-practice', label: 'Writing' },
        { href: '/reader', label: 'Reader' },
        { href: '/flashcards', label: 'Flashcards' },
    ];

    return (
        <nav className="w-full mb-4 md:mb-8 border-b border-accent-gold/10 pb-3 md:pb-6 animate-in fade-in duration-700 relative z-[100]">
            <div className="flex justify-between items-center">
                <Link href="/" className="group flex items-center gap-3">
                    <Image
                        src="/nomflow-wordmark-v3.png"
                        alt=""
                        width={880}
                        height={1024}
                        priority
                        className="h-12 w-auto select-none scale-125 origin-center group-hover:scale-[1.32] transition-transform duration-300"
                    />
                    <div className="flex flex-col">
                        <span className="text-xl font-display font-bold tracking-tight text-text-primary">NômFlow</span>
                        <span className="text-[8px] font-display font-bold uppercase tracking-[0.4em] text-accent-primary opacity-60">Script, Simplified</span>
                    </div>
                </Link>

                {/* Hamburger Toggle */}
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-text-secondary hover:text-accent-primary transition-colors"
                >
                    {isMenuOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8">
                    {isLoggedIn ? (
                        <>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-[11px] font-black uppercase tracking-widest transition-colors ${pathname?.startsWith(link.href) ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
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
                    ) : isGuest ? (
                        <>
                            {guestNavLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-[11px] font-black uppercase tracking-widest transition-colors ${pathname?.startsWith(link.href) ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExitDemo}
                                className="text-[11px] font-black text-text-secondary/60 hover:text-text-secondary uppercase tracking-[0.2em]"
                            >
                                Exit Demo
                            </Button>
                        </>
                    ) : (
                        <Link href="/login" className="text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors">
                            Sign In
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full mt-2 glass-card !p-4 border-accent-gold/20 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    {isLoggedIn ? (
                        <>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-sm font-black uppercase tracking-[0.2em] transition-colors py-2 border-b border-white/5 last:border-0 ${pathname?.startsWith(link.href) ? 'text-accent-primary' : 'text-text-secondary'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="flex justify-between items-center pt-2">
                                {currentUser && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                                        Hi, {currentUser}
                                    </span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-[10px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-widest"
                                >
                                    Sign Out
                                </Button>
                            </div>
                        </>
                    ) : isGuest ? (
                        <>
                            {guestNavLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-sm font-black uppercase tracking-[0.2em] transition-colors py-2 border-b border-white/5 last:border-0 ${pathname?.startsWith(link.href) ? 'text-accent-primary' : 'text-text-secondary'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="flex justify-end items-center pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleExitDemo}
                                    className="text-[10px] font-black text-text-secondary/60 uppercase tracking-widest"
                                >
                                    Exit Demo
                                </Button>
                            </div>
                        </>
                    ) : (
                        <Link href="/login" className="text-sm font-black uppercase tracking-[0.2em] text-text-secondary py-2">
                            Sign In
                        </Link>
                    )}
                </div>
            )}
        </nav>
    );
}
