'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard } from '@/components/ui';

interface SourceText {
    id: number;
    title: string;
    author: string;
    description?: string;
}

const WORD_LIST_AUTHORS = ['Chunom.org', 'Digitizing Vietnam Team'];

export default function ReaderPage() {
    const router = useRouter();
    const [texts, setTexts] = useState<SourceText[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch<SourceText[]>('texts')
            .then((data) => {
                setTexts(data.filter((t) => !WORD_LIST_AUTHORS.includes(t.author)));
            })
            .catch(logger.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto py-4 md:py-8 px-4 md:px-6">
            <header className="mb-6 md:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-2 leading-none">
                    Read &amp; Collect
                </div>
                <h1 className="text-3xl md:text-6xl font-display font-bold text-text-primary tracking-tight">
                    Reader Mode
                </h1>
                <p className="text-text-secondary mt-2 opacity-60 text-sm md:text-base max-w-xl">
                    Read through classical texts at your own pace. Tap any line to add it to your custom flashcard lists.
                </p>
            </header>

            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <h2 className="text-[10px] md:text-sm font-black text-text-primary uppercase tracking-[0.3em] mb-6 md:mb-8 flex items-center gap-4">
                    Available Texts
                    <div className="h-[1px] flex-grow bg-white/10" />
                </h2>

                {texts.length === 0 ? (
                    <div className="py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center">
                        <p className="text-text-secondary font-black uppercase tracking-widest text-[10px] opacity-40">
                            No texts available
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {texts.map((text) => (
                            <GlassCard
                                key={text.id}
                                onClick={() => router.push(`/reader/${text.id}`)}
                                className="p-6 md:p-8 cursor-pointer group border-white/5 hover:shadow-2xl hover:shadow-accent-primary/10 transition-all duration-500"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.2em]">
                                        Classic Text
                                    </span>
                                </div>
                                <h3 className="text-2xl font-serif text-text-primary mb-1 group-hover:text-accent-primary transition-colors duration-300">
                                    {text.title}
                                </h3>
                                <p className="text-xs text-text-secondary italic opacity-60 font-serif">
                                    by {text.author}
                                </p>
                                {text.description && (
                                    <p className="hidden md:block text-sm font-serif text-text-secondary line-clamp-2 leading-relaxed opacity-80 mt-3">
                                        {text.description}
                                    </p>
                                )}
                            </GlassCard>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
