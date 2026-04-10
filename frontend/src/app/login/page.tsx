'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch('/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('username', data.username);
                window.location.href = '/dashboard';
            } else {
                const data = await res.json();
                setError(data.detail || 'Invalid username/email or password.');
            }
        } catch (err) {
            logger.error(err);
            setError('An unexpected error occurred during login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <header className="mb-12 text-center flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="text-5xl md:text-6xl font-display font-medium text-accent-primary uppercase tracking-[0.1em] mb-3 leading-tight">
                    NômFlow
                </div>
                <h1 className="text-sm md:text-base font-normal text-text-secondary/60 tracking-[0.2em] uppercase">
                    Welcome Back
                </h1>
            </header>

            <GlassCard className="w-full max-w-md p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <form onSubmit={handleSubmit} className="space-y-8" suppressHydrationWarning>
                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            Username or Email
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder="Enter your username or email..."
                            suppressHydrationWarning
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder="••••••••"
                            suppressHydrationWarning
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
                        className="w-full py-5 text-sm font-black tracking-[0.2em] relative overflow-hidden group"
                    >
                        <span className="relative z-10">{loading ? 'SIGNING IN...' : 'SIGN IN'}</span>
                        {loading && (
                            <div className="absolute inset-0 bg-accent-gold/20 animate-pulse" />
                        )}
                    </Button>

                    <div className="flex flex-col gap-3 items-center">
                        <Link href="/forgot-password" className="text-[10px] font-black text-text-secondary/50 hover:text-accent-primary transition-colors uppercase tracking-widest">
                            Forgot your password?
                        </Link>
                        <p className="text-[10px] font-black text-text-secondary/60 uppercase tracking-widest">
                            Don't have an account? <Link href="/register" className="text-accent-primary hover:text-accent-primary/80 transition-colors underline decoration-accent-primary/30">Register Now</Link>
                        </p>
                    </div>
                </form>
            </GlassCard>

        </div>
    );
}
