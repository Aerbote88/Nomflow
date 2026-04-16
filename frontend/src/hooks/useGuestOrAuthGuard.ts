'use client';

import { useEffect } from 'react';

/**
 * Redirect to /login if the visitor is neither logged in nor in guest mode.
 * Also re-checks on bfcache restore so pressing back after Exit Demo bounces
 * the user off a stale guest-only page instead of leaving them on it.
 */
export function useGuestOrAuthGuard(): void {
    useEffect(() => {
        const check = () => {
            const username = localStorage.getItem('username');
            const guest = localStorage.getItem('guest_mode') === 'true';
            if (!username && !guest) {
                window.location.replace('/login');
            }
        };
        check();
        const handler = (e: PageTransitionEvent) => {
            if (e.persisted) check();
        };
        window.addEventListener('pageshow', handler);
        return () => window.removeEventListener('pageshow', handler);
    }, []);
}
