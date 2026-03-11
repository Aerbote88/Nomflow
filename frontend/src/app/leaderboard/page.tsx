'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { api } from '@/lib/api';
import { GlassCard, Button } from '@/components/ui';
import { useSearchParams } from 'next/navigation';

interface GlobalRanking {
    username: string;
    xp: number;
}

interface SourceRanking {
    username: string;
    score: number;
    achieved_at?: string;
    is_live?: boolean;
}

interface SourceLeaderboardData {
    text_title: string;
    challenge: SourceRanking[];
    normal: SourceRanking[];
    progress: SourceRanking[];
}

interface Title {
    id: number;
    title: string;
}

function LeaderboardContent() {
    const searchParams = useSearchParams();
    const [source, setSource] = useState(searchParams.get('source') || 'global');
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'lifetime'>('daily');
    const [titles, setTitles] = useState<Title[]>([]);
    const [globalData, setGlobalData] = useState<GlobalRanking[]>([]);
    const [sourceData, setSourceData] = useState<SourceLeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<Title[]>('/api/leaderboard/titles').then(setTitles).catch(console.error);
    }, []);

    useEffect(() => {
        setLoading(true);
        const fetch = source === 'global'
            ? api.get<GlobalRanking[]>(`/api/leaderboard/global?period=${period}`).then(d => setGlobalData(d))
            : api.get<SourceLeaderboardData>(`/api/leaderboard/${source}`).then(d => setSourceData(d));
        fetch.catch(console.error).finally(() => setLoading(false));

        const params = new URLSearchParams(window.location.search);
        params.set('source', source);
        window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    }, [source, period]);

    const renderSkeleton = () => (
        <div className="space-y-2 md:space-y-3 animate-pulse w-full">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 md:h-14 bg-white/5 rounded-xl md:rounded-2xl border border-white/5" />
            ))}
        </div>
    );

    return (
        <div className="max-w-[1000px] mx-auto py-4 md:py-8 px-4 md:px-6 animate-in fade-in duration-500">
            <header className="mb-6 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-2">Hall of Scholars</div>
                    <h1 className="text-3xl md:text-6xl font-display font-bold text-text-primary tracking-tight">Leaderboard</h1>
                </div>

                <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full md:w-64 px-3 md:px-4 py-2 md:py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary text-sm md:text-base font-bold appearance-none outline-none focus:border-accent-primary/50 transition-colors cursor-pointer"
                >
                    <option value="global" className="bg-bg-primary">🌍 Global (XP)</option>
                    <optgroup label="Source Specific" className="bg-bg-primary text-text-secondary font-bold">
                        {titles.map(t => (
                            <option key={t.id} value={t.id} className="bg-bg-primary text-text-primary">{t.title}</option>
                        ))}
                    </optgroup>
                </select>
            </header>

            {source === 'global' && (
                <div className="flex justify-center mb-6 md:mb-8 text-center">
                    <div className="inline-flex p-1 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        {(['daily', 'weekly', 'monthly', 'lifetime'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-2.5 md:px-4 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${period === p
                                    ? 'bg-accent-primary text-white shadow-md'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {loading ? renderSkeleton() : source === 'global' ? (
                <GlassCard className="border-white/5 shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary/40 mb-6 text-center">Global XP Ranking</h3>
                    <div className="space-y-3">
                        {globalData.length === 0 ? (
                            <div className="text-center py-12 text-text-secondary/30 italic font-display text-xl">
                                No scholars have ascended yet...
                            </div>
                        ) : (
                            globalData.map((ranking, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between p-2.5 md:p-4 rounded-xl md:rounded-2xl border transition-all ${idx === 0 ? 'bg-accent-gold/10 border-accent-gold/30 shadow-md' :
                                            idx === 1 ? 'bg-white/5 border-white/10' :
                                                idx === 2 ? 'bg-accent-primary/5 border-accent-primary/15' :
                                                    'bg-white/3 border-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 md:gap-4">
                                        <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-sm ${idx === 0 ? 'bg-accent-gold text-white shadow-lg' :
                                                idx === 1 ? 'bg-white/20 text-text-primary' :
                                                    idx === 2 ? 'bg-accent-primary/20 text-accent-primary' :
                                                        'text-text-secondary/40'
                                            }`}>
                                            {idx + 1}
                                        </div>
                                        <span className={`font-bold text-sm md:text-base ${idx === 0 ? 'text-lg md:text-xl text-text-primary font-display' : 'text-text-primary'}`}>
                                            {ranking.username}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`font-black text-sm md:text-base ${idx === 0 ? 'text-accent-primary text-base md:text-lg' : 'text-text-secondary'}`}>
                                            {ranking.xp.toLocaleString()}
                                        </span>
                                        <span className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-text-secondary/40">XP</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            ) : sourceData && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <GlassCard className="border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4 flex items-center gap-2">
                                <span>💀</span> Challenge Mode
                            </h3>
                            <div className="space-y-2">
                                {sourceData.challenge.length === 0 ? (
                                    <div className="text-center py-8 text-text-secondary/30 italic text-xs">No records yet</div>
                                ) : sourceData.challenge.map((r, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 md:p-3 bg-white/3 rounded-lg md:rounded-xl border border-white/5 hover:border-red-500/20 transition-all">
                                        <div className="flex items-center gap-2 md:gap-3">
                                            <span className="text-[9px] md:text-[10px] font-black text-text-secondary/30 w-3 md:w-4">{idx + 1}</span>
                                            <span className="font-bold text-text-primary text-xs md:text-sm">{r.username}</span>
                                            {r.is_live && <span className="text-[7px] md:text-[8px] bg-emerald-500 text-white px-1 md:px-1.5 py-0.5 rounded-full font-black uppercase animate-pulse">Live</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-black text-accent-primary text-sm md:text-base">{r.score}</span>
                                            <span className="text-[7px] md:text-[8px] text-text-secondary/40 uppercase font-black tracking-widest">Lines</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>

                        <GlassCard className="border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4 flex items-center gap-2">
                                <span>🎻</span> Practice Mode
                            </h3>
                            <div className="space-y-2">
                                {sourceData.normal.length === 0 ? (
                                    <div className="text-center py-8 text-text-secondary/30 italic text-xs">No records yet</div>
                                ) : sourceData.normal.map((r, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 md:p-3 bg-white/3 rounded-lg md:rounded-xl border border-white/5 hover:border-accent-gold/20 transition-all">
                                        <div className="flex items-center gap-2 md:gap-3">
                                            <span className="text-[9px] md:text-[10px] font-black text-text-secondary/30 w-3 md:w-4">{idx + 1}</span>
                                            <span className="font-bold text-text-primary text-xs md:text-sm">{r.username}</span>
                                            {r.is_live && <span className="text-[7px] md:text-[8px] bg-emerald-500 text-white px-1 md:px-1.5 py-0.5 rounded-full font-black uppercase animate-pulse">Live</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-black text-accent-primary text-sm md:text-base">{r.score}</span>
                                            <span className="text-[7px] md:text-[8px] text-text-secondary/40 uppercase font-black tracking-widest">Lines</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>

                    <GlassCard className="border-white/5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4 flex items-center gap-2">
                            <span>📜</span> Mastery
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sourceData.progress.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-text-secondary/30 italic text-xs">No progress yet</div>
                            ) : sourceData.progress.map((r, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 md:p-3 bg-white/3 rounded-lg md:rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <span className="text-[9px] md:text-[10px] font-black text-text-secondary/30 w-3 md:w-4">{idx + 1}</span>
                                        <span className="font-bold text-text-primary text-xs md:text-sm">{r.username}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="font-black text-emerald-500 text-sm md:text-base">{r.score}</span>
                                        <span className="text-[7px] md:text-[8px] text-emerald-500/40 uppercase font-black tracking-widest">Learned</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}

export default function LeaderboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        }>
            <LeaderboardContent />
        </Suspense>
    );
}
