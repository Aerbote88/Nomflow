'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocaleAction } from '@/i18n/actions';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

const SHORT_LABELS: Record<Locale, string> = {
    en: 'EN',
    vi: 'VI',
};

const FULL_LABELS: Record<Locale, string> = {
    en: 'English',
    vi: 'Tiếng Việt',
};

export function LanguageToggle({ className = '' }: { className?: string }) {
    const locale = useLocale() as Locale;
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const select = (next: Locale) => {
        setOpen(false);
        if (next === locale) return;
        startTransition(async () => {
            await setLocaleAction(next);
        });
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors disabled:opacity-50"
            >
                <span>{SHORT_LABELS[locale]}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute right-0 top-full mt-2 min-w-[140px] glass-card !p-1 border-accent-gold/20 shadow-xl z-[110]"
                >
                    {SUPPORTED_LOCALES.map((code) => {
                        const isActive = code === locale;
                        return (
                            <li key={code}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isActive}
                                    onClick={() => select(code)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-between gap-3 ${
                                        isActive
                                            ? 'bg-accent-primary/10 text-accent-primary'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                    }`}
                                >
                                    <span>{FULL_LABELS[code]}</span>
                                    {isActive && (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-3.5 w-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
