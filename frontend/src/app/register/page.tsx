'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email }),
            });

            if (res.ok) {
                // Auto login after register
                const formData = new URLSearchParams();
                formData.append('username', username);
                formData.append('password', password);

                const loginRes = await fetch('/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData,
                });

                if (loginRes.ok) {
                    const data = await loginRes.json();
                    localStorage.removeItem('guest_mode');
                    localStorage.setItem('username', data.username);
                    window.location.href = '/dashboard';
                } else {
                    localStorage.removeItem('guest_mode');
                    router.push('/login?registered=true');
                }
            } else {
                const data = await res.json();
                setError(data.detail || 'Registration failed. The name might be taken.');
            }
        } catch (err) {
            logger.error(err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <header className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="text-[12px] font-black text-accent-primary uppercase tracking-[0.5em] mb-4">
                    NômFlow
                </div>
                <h1 className="text-5xl md:text-6xl font-display font-bold text-text-primary tracking-tight">
                    Create an Account
                </h1>
            </header>

            <GlassCard className="w-full max-w-md p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-5 py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder="Choose a username..."
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-text-primary font-black outline-none focus:border-accent-primary/50 focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/10"
                            placeholder="you@example.com"
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
                            className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-text-primary font-black outline-none focus:border-accent-primary/50 focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/10"
                            placeholder="••••••••"
                        />
                        <p className="text-[10px] text-text-secondary/40 mt-1.5 px-1">Minimum 8 characters</p>
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
                            className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-text-primary font-black outline-none focus:border-accent-primary/50 focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/10"
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
                        disabled={loading}
                        className="w-full py-5 text-sm font-black tracking-[0.2em] relative overflow-hidden group"
                    >
                        <span className="relative z-10">{loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</span>
                        {loading && (
                            <div className="absolute inset-0 bg-accent-gold/20 animate-pulse" />
                        )}
                    </Button>

                    <p className="text-center text-[10px] font-black text-text-secondary/60 uppercase tracking-widest">
                        Already have an account? <Link href="/login" className="text-accent-primary hover:text-accent-primary/80 transition-colors underline decoration-accent-primary/30">Sign In</Link>
                    </p>
                </form>
            </GlassCard>

        </div>
    );
}
