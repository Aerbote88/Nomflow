'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('auth.login');
    const tc = useTranslations('common');
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
                localStorage.removeItem('guest_mode');
                localStorage.setItem('username', data.username);
                window.location.href = '/dashboard';
            } else {
                const data = await res.json();
                setError(data.detail || t('errorInvalid'));
            }
        } catch (err) {
            logger.error(err);
            setError(t('errorUnexpected'));
        } finally {
            setLoading(false);
        }
    };

    const handleTryWithoutSignIn = () => {
        localStorage.setItem('guest_mode', 'true');
        window.location.href = '/writing-practice';
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <header className="mb-3 md:mb-6 flex justify-center animate-in fade-in slide-in-from-top-4 duration-1000">
                <Image
                    src="/nomflow-wordmark-v3.png"
                    alt="NômFlow"
                    width={880}
                    height={1024}
                    priority
                    className="w-44 md:w-72 h-auto select-none"
                />
            </header>

            <div className="relative w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-1000">
                <GlassCard className="w-full p-5 md:p-10 shadow-2xl relative overflow-hidden">
                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-8" suppressHydrationWarning>
                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            {t('usernameOrEmail')}
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-5 py-3 md:py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder={t('usernamePlaceholder')}
                            suppressHydrationWarning
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">
                            {t('password')}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-5 py-3 md:py-4 rounded-xl bg-white/10 border-2 border-white/20 text-text-primary font-black outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all placeholder:text-white/30"
                            placeholder={t('passwordPlaceholder')}
                            suppressHydrationWarning
                        />
                    </div>

                    {error && (
                        <div className="p-3 md:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 md:py-5 text-sm font-black tracking-[0.2em] relative overflow-hidden group"
                    >
                        <span className="relative z-10">{loading ? t('signingIn') : t('signIn')}</span>
                        {loading && (
                            <div className="absolute inset-0 bg-accent-gold/20 animate-pulse" />
                        )}
                    </Button>

                    <div className="flex flex-col gap-2 md:gap-3 items-center">
                        <Link href="/forgot-password" className="text-[10px] font-black text-text-secondary/50 hover:text-accent-primary transition-colors uppercase tracking-widest">
                            {t('forgotPassword')}
                        </Link>
                        <p className="text-[10px] font-black text-text-secondary/60 uppercase tracking-widest">
                            {t('noAccount')} <Link href="/register" className="text-accent-primary hover:text-accent-primary/80 transition-colors underline decoration-accent-primary/30">{t('registerNow')}</Link>
                        </p>
                    </div>

                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[9px] font-black text-text-secondary/50 uppercase tracking-[0.3em]">{tc('or')}</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <button
                        type="button"
                        onClick={handleTryWithoutSignIn}
                        className="w-full py-3 md:py-4 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/15 border-2 border-accent-primary/30 hover:border-accent-primary/60 text-accent-primary text-sm font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] group"
                    >
                        <span className="inline-flex items-center gap-2">
                            {t('tryDemo')}
                            <span className="transition-transform group-hover:translate-x-1">→</span>
                        </span>
                    </button>
                </form>
                </GlassCard>
            </div>

        </div>
    );
}
