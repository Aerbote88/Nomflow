'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { AddToListModal } from '@/components/Study/AddToListModal';
import { DictionarySidebar } from '@/components/Dictionary/DictionarySidebar';
import { DictionaryPanel } from '@/components/Dictionary/DictionaryPanel';
import { useDictionarySidebar } from '@/hooks/useDictionarySidebar';
import { useGuestOrAuthGuard } from '@/hooks/useGuestOrAuthGuard';

interface LineItem {
    id: number;
    line_number: number;
    nom: string;
    quoc_ngu: string;
    status: 'unseen' | 'learning' | 'learned';
    char_id?: number;
    line_dict_id?: number;
}

interface TextDetail {
    text_title: string;
    author: string;
    total_lines: number;
    total_pages: number;
    current_page: number;
    is_curated: boolean;
    lines: LineItem[];
}

interface SourceText {
    id: number;
    title: string;
    author: string;
}

const WORD_LIST_AUTHORS = ['Chunom.org', 'Digitizing Vietnam Team'];

export default function ReaderDetailPage() {
    useGuestOrAuthGuard();
    const t = useTranslations('reader');
    const tc = useTranslations('common');
    const params = useParams();
    const router = useRouter();
    const textId = params.id;

    const [data, setData] = useState<TextDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        setIsGuest(localStorage.getItem('guest_mode') === 'true' && !localStorage.getItem('username'));
    }, []);

    // Sidebar: available texts
    const [texts, setTexts] = useState<SourceText[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Right panel: dictionary data
    const [selectedLine, setSelectedLine] = useState<LineItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);
    const [showQuocNgu, setShowQuocNgu] = useState(true);

    // Dictionary sidebar hook
    const dict = useDictionarySidebar();

    const fetchContent = async (p: number) => {
        setLoading(true);
        try {
            const resp = await apiFetch<TextDetail>(`browse?text_id=${textId}&page=${p}&limit=20`);
            setData(resp);
            setPage(resp.current_page);
        } catch (err) {
            logger.error('Failed to load text content:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent(1);
        setSelectedLine(null);
        dict.reset();
    }, [textId]);

    useEffect(() => {
        apiFetch<SourceText[]>('texts')
            .then((data) => setTexts(data.filter((t) => !WORD_LIST_AUTHORS.includes(t.author))))
            .catch(logger.error);
    }, []);

    const handleLineClick = useCallback(async (line: LineItem) => {
        if (!line.line_dict_id) return;
        setSelectedLine(line);
        dict.loadLineDict(line.line_dict_id);
    }, [dict.loadLineDict]);

    const handleViewChar = useCallback(async (charId: number) => {
        dict.loadCharDict(charId);
    }, [dict.loadCharDict]);

    const handlePageChange = (p: number) => {
        if (p < 1 || (data && p > data.total_pages)) return;
        setSelectedLine(null);
        dict.reset();
        fetchContent(p);
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex gap-0 lg:gap-6 w-full mx-auto py-4 md:py-8 px-4 md:px-6 relative min-h-[calc(100vh-120px)]">
            {/* Mobile sidebar toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden fixed bottom-6 left-6 z-[80] w-12 h-12 rounded-full bg-accent-primary/90 text-white shadow-xl flex items-center justify-center hover:bg-accent-primary transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            </button>

            {/* Left Sidebar - Text Navigation */}
            <aside className={`
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
                fixed lg:static inset-y-0 left-0 z-[70]
                w-64 lg:w-56 shrink-0
                bg-bg-primary/95 lg:bg-transparent
                backdrop-blur-xl lg:backdrop-blur-none
                border-r border-white/10 lg:border-0
                transition-transform duration-300
                overflow-y-auto
                pt-20 lg:pt-0
                px-4 lg:px-0
            `}>
                {/* Mobile close button */}
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] mb-4">
                    {t('texts')}
                </div>
                <div className="space-y-1">
                    {texts.map((text) => (
                        <button
                            key={text.id}
                            onClick={() => {
                                router.push(`/reader/${text.id}`);
                                setSidebarOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                                String(text.id) === String(textId)
                                    ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/20'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            <div className="font-serif font-semibold truncate">{text.title}</div>
                            <div className="text-[10px] opacity-50 mt-0.5 italic">{text.author}</div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Center - Reading Area */}
            <main className="flex-grow min-w-0">
                {/* Header */}
                <header className="mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-4 mb-4">
                        <Link href="/reader">
                            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all group">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                                </svg>
                            </div>
                        </Link>
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] leading-none">
                            {t('title')}
                        </div>
                    </div>

                    <h1 className="text-2xl md:text-4xl font-display font-bold text-text-primary tracking-tight">
                        {data.text_title}
                    </h1>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-text-secondary italic opacity-60 text-base">
                            {t('byAuthor', { author: data.author })}
                        </p>
                        <Button
                            variant={showQuocNgu ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setShowQuocNgu(!showQuocNgu)}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5"
                        >
                            {showQuocNgu ? t('hideQuocNgu') : t('showQuocNgu')}
                        </Button>
                    </div>
                </header>

                {/* Reading Content */}
                <GlassCard className="p-5 md:p-8 border-white/5 shadow-2xl mb-6">
                    <div className="space-y-2 md:space-y-3">
                        {data.lines.map((line) => {
                            const isClickable = !!line.line_dict_id;
                            const isSelected = selectedLine?.id === line.id;

                            return (
                                <div
                                    key={line.id}
                                    onClick={isClickable ? () => handleLineClick(line) : undefined}
                                    className={`relative group flex gap-3 md:gap-5 ${isClickable ? 'cursor-pointer' : ''}`}
                                >
                                    {/* Line number */}
                                    <div className="w-8 shrink-0 pt-1">
                                        <span className="text-xs font-mono font-black text-accent-primary/50 group-hover:text-accent-primary transition-colors select-none">
                                            {line.line_number}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-grow rounded-xl px-3 py-2 -mx-3 -my-2 transition-all duration-200 ${isClickable ? 'hover:bg-white/5' : ''} ${isSelected ? 'bg-accent-primary/10 ring-1 ring-accent-primary/30' : ''}`}>
                                        <div className="font-nom text-xl md:text-2xl text-text-primary leading-relaxed tracking-wide">
                                            {line.nom}
                                        </div>
                                        {showQuocNgu && (
                                            <div className="text-xs md:text-sm font-serif italic text-text-secondary/60 mt-1 leading-relaxed">
                                                {line.quoc_ngu}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </GlassCard>

                {/* Pagination */}
                {data.total_pages > 1 && (
                    <GlassCard className="p-4 border-white/5 flex justify-between items-center">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1}
                            className="font-black py-2 px-4 text-[10px]"
                        >
                            {tc('previous')}
                        </Button>
                        <span className="text-xs font-black text-text-primary uppercase tracking-widest">
                            {page} <span className="text-text-secondary opacity-30 mx-1">/</span> {data.total_pages}
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === data.total_pages}
                            className="font-black py-2 px-4 text-[10px]"
                        >
                            {tc('next')}
                        </Button>
                    </GlassCard>
                )}

                <div className="mt-6 text-center">
                    <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-[0.4em]">
                        {t('totalLines', { count: data.total_lines })}
                    </p>
                </div>
            </main>

            <DictionaryPanel
                variant="sidebar"
                mobileOpen={!!selectedLine}
                desktopOpen={true}
                onClose={() => { setSelectedLine(null); dict.reset(); }}
            >
                {!selectedLine ? (
                    <div className="text-text-secondary/40 text-sm italic text-center py-12">
                        {t('tapPrompt')}
                    </div>
                ) : (
                    <DictionarySidebar
                        sidebarView={dict.sidebarView}
                        dictData={dict.dictData}
                        charDictData={dict.charDictData}
                        dictLoading={dict.dictLoading}
                        charDictLoading={dict.charDictLoading}
                        onViewChar={handleViewChar}
                        onViewLine={(lineId) => dict.loadLineDict(lineId)}
                        onBackToLine={dict.backToLine}
                        showBackToLine={dict.canGoBack}
                        onAddToList={isGuest ? undefined : (item) => {
                            setModalItem(item);
                            setIsModalOpen(true);
                        }}
                        status={isGuest ? undefined : selectedLine.status}
                    />
                )}
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
