'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { DictionarySidebar } from '@/components/Dictionary/DictionarySidebar';
import { DictionaryPanel } from '@/components/Dictionary/DictionaryPanel';
import { useDictionarySidebar } from '@/hooks/useDictionarySidebar';
import { AddToListModal } from '@/components/Study/AddToListModal';
import { useGuestOrAuthGuard } from '@/hooks/useGuestOrAuthGuard';

interface VocabItem {
    user_progress_id: number;
    item_type: 'character' | 'line';
    content_id: number;
    nom: string;
    quoc_ngu: string;
    is_learning: boolean;
    next_review_due: string;
    interval: number;
    english?: string;
}

export default function VocabPage() {
    useGuestOrAuthGuard();
    const [vocab, setVocab] = useState<VocabItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'character' | 'line'>('all');
    const [displayCount, setDisplayCount] = useState(50);
    const [dictSidebarOpen, setDictSidebarOpen] = useState(false);
    const dict = useDictionarySidebar();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);
    const [selectedItemType, setSelectedItemType] = useState<'character' | 'line'>('character');

    const handleItemClick = useCallback((item: VocabItem) => {
        setDictSidebarOpen(true);
        setSelectedItemType(item.item_type);
        if (item.item_type === 'line') {
            dict.loadLineDict(item.content_id);
        } else {
            dict.loadCharDict(item.content_id);
        }
    }, [dict.loadLineDict, dict.loadCharDict]);

    const handleCloseDictSidebar = () => {
        setDictSidebarOpen(false);
        dict.reset();
    };

    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        const guest = localStorage.getItem('guest_mode') === 'true' && !localStorage.getItem('username');
        setIsGuest(guest);

        const endpoint = guest ? '/api/guest/study/sample' : '/api/user/vocab';
        api.get<VocabItem[]>(endpoint)
            .then(setVocab)
            .catch(logger.error)
            .finally(() => setLoading(false));
    }, []);

    const filteredVocab = useMemo(() => vocab.filter((item) => {
        const matchesSearch =
            item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.quoc_ngu.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.item_type === typeFilter;
        return matchesSearch && matchesType;
    }), [vocab, searchTerm, typeFilter]);

    const displayedVocab = useMemo(() => filteredVocab.slice(0, displayCount), [filteredVocab, displayCount]);

    const stats = useMemo(() => ({
        total: vocab.length,
        learning: vocab.filter(i => i.is_learning).length,
        learned: vocab.filter(i => !i.is_learning).length,
    }), [vocab]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (date <= new Date()) {
            return <span className="text-pink-500 font-black tracking-wider bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">DUE NOW</span>;
        }
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto py-4 md:py-8 px-4 md:px-6 fade-in-stable relative">
            <header className="mb-6 md:mb-12">
                <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-2">{isGuest ? 'Demo Deck' : 'Your Archive'}</div>
                <h1 className="text-3xl md:text-6xl font-display font-bold text-text-primary tracking-tight">Flashcards</h1>
            </header>

            {isGuest && vocab.length > 0 && (
                <Link
                    href="/study?mode=random"
                    className="block w-full md:w-auto md:inline-flex mb-6 md:mb-8 px-6 py-4 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-center transition-all"
                >
                    <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em]">
                        Start Random Review →
                    </span>
                </Link>
            )}

            {/* Stats */}
            {!isGuest && (
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
                    <GlassCard className="!p-3 md:!p-6 text-center">
                        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Total</div>
                        <div className="text-xl md:text-3xl font-black text-text-primary">{stats.total}</div>
                    </GlassCard>
                    <GlassCard className="!p-3 md:!p-6 text-center">
                        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Learning</div>
                        <div className="text-xl md:text-3xl font-black text-amber-500">{stats.learning}</div>
                    </GlassCard>
                    <GlassCard className="!p-3 md:!p-6 text-center">
                        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Learned</div>
                        <div className="text-xl md:text-3xl font-black text-emerald-500">{stats.learned}</div>
                    </GlassCard>
                </div>
            )}

            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search Nôm or Quốc Ngữ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2 md:py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary font-medium placeholder:text-text-secondary/30 outline-none focus:border-accent-primary/50 transition-colors text-sm md:text-base"
                    />
                </div>
                <div className="relative w-full md:w-44">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as 'all' | 'character' | 'line')}
                        className="w-full px-4 py-2 md:py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary font-bold appearance-none outline-none focus:border-accent-primary/50 transition-colors cursor-pointer text-sm md:text-base"
                    >
                        <option value="all" className="bg-bg-primary">All Types</option>
                        <option value="character" className="bg-bg-primary">Characters</option>
                        <option value="line" className="bg-bg-primary">Lines</option>
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {searchTerm && (
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/40 mb-4">
                    Showing {filteredVocab.length} of {vocab.length} items
                </p>
            )}

            {/* Table */}
            <GlassCard className="p-0 overflow-hidden border-white/5 shadow-2xl">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-bg-secondary/80 backdrop-blur-md border-b border-white/10">
                                <th className="px-3 md:px-6 py-3 md:py-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest text-text-secondary">Nôm</th>
                                <th className="px-3 md:px-6 py-3 md:py-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest text-text-secondary">Quốc Ngữ</th>
                                {!isGuest && (
                                    <>
                                        <th className="px-3 md:px-6 py-3 md:py-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest text-text-secondary hidden sm:table-cell">Status</th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest text-text-secondary">Next Due</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayedVocab.length === 0 ? (
                                <tr>
                                    <td colSpan={isGuest ? 2 : 4} className="px-6 py-16 text-center text-text-secondary/40 italic font-display text-xl">
                                        No flashcards match your filters.
                                    </td>
                                </tr>
                            ) : (
                                displayedVocab.map((item) => (
                                    <tr
                                        key={`${item.item_type}-${item.content_id}`}
                                        className="group hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <td className="px-3 md:px-6 py-3 md:py-4">
                                            <span className="font-nom text-xl md:text-2xl text-text-primary group-hover:text-accent-primary transition-colors">
                                                {item.nom}
                                            </span>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4">
                                            <span className="font-serif italic text-text-primary/80 font-semibold text-sm md:text-base">
                                                {item.quoc_ngu}
                                            </span>
                                        </td>
                                        {!isGuest && (
                                            <>
                                                <td className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                                                    {item.is_learning ? (
                                                        <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-md border border-amber-500/20">
                                                            Learning
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">
                                                            Learned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-text-secondary/60 font-medium">
                                                    {formatDate(item.next_review_due)}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {filteredVocab.length > displayCount && (
                        <div className="p-6 text-center border-t border-white/5">
                            <Button variant="secondary" size="sm" onClick={() => setDisplayCount(prev => prev + 50)}>
                                Load More Items
                            </Button>
                        </div>
                    )}
                </div>
            </GlassCard>

            <DictionaryPanel
                variant="floating"
                mobileOpen={dictSidebarOpen}
                desktopOpen={dictSidebarOpen}
                onClose={handleCloseDictSidebar}
            >
                <DictionarySidebar
                    sidebarView={dict.sidebarView}
                    dictData={dict.dictData}
                    charDictData={dict.charDictData}
                    dictLoading={dict.dictLoading}
                    charDictLoading={dict.charDictLoading}
                    onViewChar={(charId) => dict.loadCharDict(charId)}
                    onViewLine={(lineId) => dict.loadLineDict(lineId)}
                    onBackToLine={dict.backToLine}
                    showBackToLine={dict.canGoBack}
                />
            </DictionaryPanel>

            {/* Add to List Modal */}
            {modalItem && (
                <AddToListModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setModalItem(null); }}
                    itemId={modalItem.id}
                    itemType={modalItem.type}
                    itemName={modalItem.name}
                />
            )}
        </div>
    );
}
