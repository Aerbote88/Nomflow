'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GlassCard, Button } from '@/components/ui';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password }),
            });

            if (res.ok) {
                setDone(true);
            } else {
                const data = await res.json();
                setError(data.detail || 'Failed to reset password. The link may have expired.');
            }
        } catch {
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassCard className="w-full max-w-md p-8 md:p-10 shadow-2xl">
            {done ? (
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-text-primary font-bold mb-2">Password updated!</p>
                        <p className="text-sm text-text-secondary">You can now sign in with your new password.</p>
                    </div>
                    <Link
                        href="/login"
                        className="inline-block px-6 py-3 bg-accent-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-accent-hover transition-colors"
                    >
                        Sign In
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={!token}
                            className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={!token}
                            className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading || !token}
                        className="w-full py-5 text-sm font-black tracking-[0.2em] relative overflow-hidden"
                    >
                        <span className="relative z-10">{loading ? 'UPDATING...' : 'SET NEW PASSWORD'}</span>
                        {loading && <div className="absolute inset-0 bg-accent-gold/20 animate-pulse" />}
                    </Button>
                </form>
            )}
        </GlassCard>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <header className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="text-[12px] font-black text-accent-primary uppercase tracking-[0.5em] mb-4">
                    NômFlow
                </div>
                <h1 className="text-5xl md:text-6xl font-display font-bold text-text-primary tracking-tight">
                    New Password
                </h1>
            </header>

            <Suspense fallback={<div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
