'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { GlassCard, Button } from '@/components/ui';

interface SourceText {
    id: number;
    title: string;
    author: string;
}

interface StudyList {
    id: number;
    name: string;
    item_count: number;
}

interface CustomStudyModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTextId?: number | null;
    initialListId?: number | null;
}

type ContentType = 'all' | 'character' | 'line';
type StudyMode = 'srs' | 'random' | 'challenge';

export function CustomStudyModal({ isOpen, onClose, initialTextId, initialListId }: CustomStudyModalProps) {
    const router = useRouter();

    const [texts, setTexts] = useState<SourceText[]>([]);
    const [lists, setLists] = useState<StudyList[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection state
    const [sourceType, setSourceType] = useState<'text' | 'list'>(initialListId ? 'list' : 'text');
    const [selectedTextId, setSelectedTextId] = useState<number | null>(initialTextId ?? null);
    const [selectedListId, setSelectedListId] = useState<number | null>(initialListId ?? null);
    const [contentType, setContentType] = useState<ContentType>('all');
    const [mode, setMode] = useState<StudyMode>('srs');
    const [randomCount, setRandomCount] = useState(20);

    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            apiFetch<SourceText[]>('texts'),
            apiFetch<StudyList[]>('lists'),
        ]).then(([t, l]) => {
            setTexts(t);
            setLists(l);
            // Default to first text if nothing preselected
            if (!selectedTextId && !selectedListId && t.length > 0) {
                setSelectedTextId(t[0].id);
            }
        }).catch(console.error).finally(() => setLoading(false));
    }, [isOpen]);

    // Sync initial values when they change
    useEffect(() => {
        if (initialListId) {
            setSourceType('list');
            setSelectedListId(initialListId);
        } else if (initialTextId) {
            setSourceType('text');
            setSelectedTextId(initialTextId);
        }
    }, [initialTextId, initialListId]);

    const sourceId = sourceType === 'list' ? selectedListId : selectedTextId;
    const canBegin = !!sourceId;

    const handleBegin = () => {
        if (!sourceId) return;

        const params = new URLSearchParams();

        if (mode === 'challenge') {
            if (sourceType === 'list') params.set('list_id', String(sourceId));
            else params.set('text_id', String(sourceId));
            router.push(`/challenge?${params}`);
        } else {
            params.set('mode', mode);
            if (sourceType === 'list') params.set('list_id', String(sourceId));
            else params.set('text_id', String(sourceId));
            if (contentType !== 'all') params.set('custom_params', `type:${contentType}`);
            if (mode === 'random') params.set('count', String(randomCount));
            router.push(`/study?${params}`);
        }

        onClose();
    };

    if (!isOpen) return null;

    const selectedSourceName = sourceType === 'list'
        ? lists.find(l => l.id === selectedListId)?.name
        : texts.find(t => t.id === selectedTextId)?.title;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <GlassCard className="w-full max-w-[540px] relative z-10 !p-0 border-accent-primary/20 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-white/5">
                    <button onClick={onClose} className="absolute top-5 right-5 text-text-secondary/40 hover:text-text-primary transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-1">Custom Study</div>
                    <h2 className="text-2xl font-display font-bold text-text-primary">Custom Study</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">

                        {/* ── STUDY SOURCE ── */}
                        <section>
                            <label className="block text-xs font-black uppercase tracking-[0.3em] text-text-secondary/70 mb-3">
                                Study Source
                            </label>

                            {/* Source type tabs */}
                            <div className="flex gap-2 mb-3">
                                {(['text', 'list'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setSourceType(t)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                            sourceType === t
                                                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                                : 'bg-white/3 border-white/10 text-text-secondary hover:border-white/20'
                                        }`}
                                    >
                                        {t === 'text' ? '📚 Texts' : '📜 My Lists'}
                                    </button>
                                ))}
                            </div>

                            {sourceType === 'text' ? (
                                texts.length === 0 ? (
                                    <p className="text-text-secondary/40 italic text-sm text-center py-4">No texts available.</p>
                                ) : (
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                        {texts.map(text => (
                                            <button
                                                key={text.id}
                                                onClick={() => setSelectedTextId(text.id)}
                                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                                                    selectedTextId === text.id
                                                        ? 'bg-accent-primary/10 border-accent-primary/50 text-text-primary'
                                                        : 'bg-white/3 border-white/5 text-text-secondary hover:border-white/20 hover:text-text-primary'
                                                }`}
                                            >
                                                <div className="font-black text-xs uppercase tracking-wider">{text.title}</div>
                                                <div className="text-xs opacity-60 italic mt-0.5">{text.author}</div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            ) : (
                                lists.length === 0 ? (
                                    <p className="text-text-secondary/40 italic text-sm text-center py-4">No custom lists yet. Create one in the Library.</p>
                                ) : (
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                        {lists.map(list => (
                                            <button
                                                key={list.id}
                                                onClick={() => setSelectedListId(list.id)}
                                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                                                    selectedListId === list.id
                                                        ? 'bg-accent-primary/10 border-accent-primary/50 text-text-primary'
                                                        : 'bg-white/3 border-white/5 text-text-secondary hover:border-white/20 hover:text-text-primary'
                                                }`}
                                            >
                                                <div className="font-black text-xs uppercase tracking-wider">{list.name}</div>
                                                <div className="text-xs opacity-60 mt-0.5">{list.item_count} items</div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </section>

                        {/* ── CONTENT TYPE ── (not shown for challenge) */}
                        {mode !== 'challenge' && (
                            <section>
                                <label className="block text-xs font-black uppercase tracking-[0.3em] text-text-secondary/70 mb-3">
                                    Study Content
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { value: 'all', label: 'Both', sub: 'Chars & Lines' },
                                        { value: 'character', label: 'Chars', sub: 'Chữ Nôm only' },
                                        { value: 'line', label: 'Lines', sub: 'Full verses' },
                                    ] as { value: ContentType; label: string; sub: string }[]).map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setContentType(opt.value)}
                                            className={`py-3 px-2 rounded-xl border transition-all text-center ${
                                                contentType === opt.value
                                                    ? 'bg-accent-primary/10 border-accent-primary/50 text-accent-primary'
                                                    : 'bg-white/3 border-white/5 text-text-secondary hover:border-white/20 hover:text-text-primary'
                                            }`}
                                        >
                                            <div className="font-black text-[10px] uppercase tracking-widest">{opt.label}</div>
                                            <div className="text-[10px] opacity-65 mt-0.5">{opt.sub}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── STUDY MODE ── */}
                        <section>
                            <label className="block text-xs font-black uppercase tracking-[0.3em] text-text-secondary/70 mb-3">
                                Study Mode
                            </label>
                            <div className="space-y-2">
                                {([
                                    {
                                        value: 'srs',
                                        icon: '🏛️',
                                        label: 'SRS Review',
                                        desc: 'Review due items and learn new content with Spaced Repetition.',
                                        accent: 'hover:border-accent-primary/50 hover:bg-accent-primary/5',
                                        active: 'border-accent-primary bg-accent-primary/10',
                                    },
                                    {
                                        value: 'random',
                                        icon: '✨',
                                        label: 'Random',
                                        desc: 'Study a random selection of items. No SRS stakes.',
                                        accent: 'hover:border-blue-500/40 hover:bg-blue-500/5',
                                        active: 'border-blue-500/60 bg-blue-500/10',
                                    },
                                    {
                                        value: 'challenge',
                                        icon: '⚔️',
                                        label: 'Challenge',
                                        desc: 'Progress line-by-line, type the reading. Compete on the leaderboard.',
                                        accent: 'hover:border-red-500/40 hover:bg-red-500/5',
                                        active: 'border-red-500/60 bg-red-500/10',
                                    },
                                ] as { value: StudyMode; icon: string; label: string; desc: string; accent: string; active: string }[]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setMode(opt.value)}
                                        className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all group ${
                                            mode === opt.value ? opt.active : `bg-white/3 border-white/5 ${opt.accent}`
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xl transition-all duration-300 ${mode === opt.value ? '' : 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                                {opt.icon}
                                            </span>
                                            <div>
                                                <div className="font-black text-xs uppercase tracking-widest text-text-primary">{opt.label}</div>
                                                <p className="text-xs text-text-secondary opacity-80 mt-0.5">{opt.desc}</p>
                                            </div>
                                        </div>
                                        {/* Random count picker */}
                                        {opt.value === 'random' && mode === 'random' && (
                                            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <span className="text-xs font-black text-text-secondary uppercase tracking-widest">Session Size</span>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setRandomCount(c => Math.max(5, c - 5)); }}
                                                        className="text-accent-primary font-black text-lg w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform"
                                                    >−</button>
                                                    <span className="text-sm font-black text-text-primary w-6 text-center">{randomCount}</span>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setRandomCount(c => Math.min(100, c + 5)); }}
                                                        className="text-accent-primary font-black text-lg w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform"
                                                    >+</button>
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {/* Footer */}
                <div className="px-8 py-5 border-t border-white/5 flex items-center justify-between gap-4">
                    <div className="text-xs text-text-secondary/60 font-black uppercase tracking-widest truncate">
                        {selectedSourceName ? `→ ${selectedSourceName}` : 'Select a source above'}
                    </div>
                    <Button
                        onClick={handleBegin}
                        disabled={!canBegin || loading}
                        className="shrink-0 px-8 py-3 font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-primary/20"
                    >
                        Begin Session
                    </Button>
                </div>
            </GlassCard>
        </div>
    );
}
