'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { GlassCard, Button } from '@/components/ui';
import Link from 'next/link';

interface Relation {
    id: number;
    nom: string;
    quoc_ngu: string;
}

interface Example {
    line_id: number;
    nom: string;
    quoc_ngu: string;
    source: string;
}

interface CharData {
    id: number;
    nom: string;
    quoc_ngu: string;
    variants: Relation[];
    homophones: Relation[];
    examples: Example[];
    stats: {
        is_learning: boolean;
        next_review: string | null;
    };
}

export default function CharDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<CharData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            api.get<CharData>(`/api/dictionary/char/${id}`)
                .then(setData)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <h2 className="text-2xl font-display font-bold text-text-primary mb-4">Entry Not Found</h2>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto py-8 px-4 md:px-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em]">Dictionary</div>
                <Button variant="secondary" size="sm" onClick={() => router.back()} className="text-[10px] font-black uppercase tracking-widest">
                    Back
                </Button>
            </div>

            {/* Main Card */}
            <GlassCard className="text-center relative overflow-hidden border-white/5 shadow-2xl mb-8">
                {/* Lookup buttons */}
                <div className="absolute top-6 right-6 flex flex-col gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(`https://zi.tools/zi/${encodeURIComponent(data.nom)}`, '_blank')}
                        className="text-[10px] font-black tracking-widest flex items-center gap-1.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        zi.tools
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(`https://www.digitizingvietnam.com/en/tools/han-nom-dictionaries/general?q=${encodeURIComponent(data.quoc_ngu)}`, '_blank')}
                        className="text-[10px] font-black tracking-widest flex items-center gap-1.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Hán-Nôm
                    </Button>
                </div>

                {/* Character Display */}
                <div className="flex flex-col items-center mb-12">
                    <div className="font-nom leading-none mb-4 animate-in fade-in zoom-in duration-500 text-text-primary"
                        style={{ fontSize: 'clamp(6rem, 20vw, 10rem)' }}>
                        {data.nom}
                    </div>
                    <div className="text-3xl md:text-4xl font-serif font-bold text-text-primary mb-4 tracking-wide">
                        {data.quoc_ngu}
                    </div>
                    <div>
                        {data.stats.is_learning ? (
                            <span className="px-4 py-1.5 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">
                                Learning
                            </span>
                        ) : data.stats.next_review ? (
                            <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                                Learned
                            </span>
                        ) : (
                            <span className="px-4 py-1.5 bg-white/5 text-text-secondary/50 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10">
                                Not Started
                            </span>
                        )}
                    </div>
                </div>

                {/* Relations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 text-left">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4">
                            Alternate Readings <span className="text-[8px] opacity-60">(Same Character)</span>
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {data.variants.length === 0 ? (
                                <span className="text-text-secondary/30 italic text-sm">None recorded</span>
                            ) : data.variants.map((v) => (
                                <Link
                                    key={v.id}
                                    href={`/dictionary/char/${v.id}`}
                                    className="flex flex-col items-center justify-center w-16 h-16 bg-white/5 border border-white/10 rounded-xl hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all group"
                                >
                                    <span className="font-nom text-xl text-text-primary group-hover:text-accent-primary transition-colors">{v.nom}</span>
                                    <span className="text-[10px] font-bold text-text-secondary/60 uppercase">{v.quoc_ngu}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4">
                            Alternate Characters <span className="text-[8px] opacity-60">(Same Reading)</span>
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {data.homophones.length === 0 ? (
                                <span className="text-text-secondary/30 italic text-sm">None recorded</span>
                            ) : data.homophones.map((h) => (
                                <Link
                                    key={h.id}
                                    href={`/dictionary/char/${h.id}`}
                                    className="flex flex-col items-center justify-center w-16 h-16 bg-white/5 border border-white/10 rounded-xl hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all group"
                                >
                                    <span className="font-nom text-xl text-text-primary group-hover:text-accent-primary transition-colors">{h.nom}</span>
                                    <span className="text-[10px] font-bold text-text-secondary/60 uppercase">{h.quoc_ngu}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Examples */}
                <div className="text-left">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary/40 mb-6 flex items-center gap-4">
                        Example Sentences
                        <div className="flex-1 h-px bg-white/10" />
                    </h3>
                    <div className="space-y-3">
                        {data.examples.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary/30 italic font-display text-xl">
                                No examples found for this interpretation.
                            </div>
                        ) : data.examples.map((ex, idx) => (
                            <Link
                                key={idx}
                                href={`/dictionary/line/${ex.line_id}`}
                                className="block p-5 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/8 hover:border-accent-primary/30 transition-all group"
                            >
                                <div
                                    className="font-nom text-2xl text-text-primary mb-2 group-hover:text-accent-primary transition-colors leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: ex.nom }}
                                />
                                <div className="font-serif italic text-text-primary/80 mb-2 text-sm">
                                    {ex.quoc_ngu}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40">
                                    {ex.source}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
