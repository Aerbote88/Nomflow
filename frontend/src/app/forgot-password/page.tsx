'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GlassCard, Button } from '@/components/ui';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json();
                setError(data.detail || 'Something went wrong. Please try again.');
            }
        } catch {
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <header className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="text-[12px] font-black text-accent-primary uppercase tracking-[0.5em] mb-4">
                    NômFlow
                </div>
                <h1 className="text-5xl md:text-6xl font-display font-bold text-text-primary tracking-tight">
                    Reset Password
                </h1>
            </header>

            <GlassCard className="w-full max-w-md p-8 md:p-10 shadow-2xl">
                {sent ? (
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-text-primary font-bold mb-2">Check your email</p>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                If an account with that email exists, we've sent a reset link. Check your inbox (and spam folder).
                            </p>
                        </div>
                        <Link href="/login" className="block text-[10px] font-black text-accent-primary hover:text-accent-primary/80 transition-colors uppercase tracking-widest">
                            Back to Sign In
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Enter the email address on your account and we'll send you a reset link.
                        </p>

                        <div>
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                                placeholder="you@example.com"
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 text-sm font-black tracking-[0.2em] relative overflow-hidden"
                        >
                            <span className="relative z-10">{loading ? 'SENDING...' : 'SEND RESET LINK'}</span>
                            {loading && <div className="absolute inset-0 bg-accent-gold/20 animate-pulse" />}
                        </Button>

                        <p className="text-center text-[10px] font-black text-text-secondary/60 uppercase tracking-widest">
                            <Link href="/login" className="text-accent-primary hover:text-accent-primary/80 transition-colors underline decoration-accent-primary/30">
                                Back to Sign In
                            </Link>
                        </p>
                    </form>
                )}
            </GlassCard>
        </div>
    );
}
