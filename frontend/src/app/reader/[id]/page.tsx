'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { AddToListModal } from '@/components/Study/AddToListModal';

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

interface DictCharacter {
    id: number;
    nom: string;
    quoc_ngu: string;
    order: number;
}

interface LineDictData {
    id: number;
    nom: string;
    quoc_ngu: string;
    english_translation?: string;
    analysis?: Array<{ nom: string; quoc_ngu: string; meaning?: string }>;
    characters: DictCharacter[];
    stats: {
        is_learning: boolean;
        next_review: string | null;
    };
}

interface CharDictExample {
    line_id: number;
    nom: string;
    quoc_ngu: string;
    source: string;
}

interface CharDictVariant {
    id: number;
    nom: string;
    quoc_ngu: string;
}

interface CharDictData {
    id: number;
    nom: string;
    quoc_ngu: string;
    variants: CharDictVariant[];
    homophones: CharDictVariant[];
    examples: CharDictExample[];
    stats: {
        is_learning: boolean;
        next_review: string | null;
    };
}

const WORD_LIST_AUTHORS = ['Chunom.org', 'Digitizing Vietnam Team'];

export default function ReaderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const textId = params.id;

    const [data, setData] = useState<TextDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    // Sidebar: available texts
    const [texts, setTexts] = useState<SourceText[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Right panel: dictionary data
    const [selectedLine, setSelectedLine] = useState<LineItem | null>(null);
    const [dictData, setDictData] = useState<LineDictData | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);
    const [showQuocNgu, setShowQuocNgu] = useState(true);

    // Character dictionary view in right sidebar
    const [charDictData, setCharDictData] = useState<CharDictData | null>(null);
    const [charDictLoading, setCharDictLoading] = useState(false);
    const [sidebarView, setSidebarView] = useState<'line' | 'char'>('line');

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
        setDictData(null);
    }, [textId]);

    useEffect(() => {
        apiFetch<SourceText[]>('texts')
            .then((data) => setTexts(data.filter((t) => !WORD_LIST_AUTHORS.includes(t.author))))
            .catch(logger.error);
    }, []);

    const handleLineClick = useCallback(async (line: LineItem) => {
        if (!line.line_dict_id) return;

        setSelectedLine(line);
        setSidebarView('line');
        setCharDictData(null);
        setDictLoading(true);
        try {
            const resp = await apiFetch<LineDictData>(`dictionary/line/${line.line_dict_id}`);
            setDictData(resp);
        } catch (err) {
            logger.error('Failed to load dictionary data:', err);
            setDictData(null);
        } finally {
            setDictLoading(false);
        }
    }, []);

    const handleViewChar = useCallback(async (charId: number) => {
        setSidebarView('char');
        setCharDictLoading(true);
        try {
            const resp = await apiFetch<CharDictData>(`dictionary/char/${charId}`);
            setCharDictData(resp);
        } catch (err) {
            logger.error('Failed to load char dictionary data:', err);
            setCharDictData(null);
        } finally {
            setCharDictLoading(false);
        }
    }, []);

    const handlePageChange = (p: number) => {
        if (p < 1 || (data && p > data.total_pages)) return;
        setSelectedLine(null);
        setDictData(null);
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
                    Texts
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
                            Reader Mode
                        </div>
                    </div>

                    <h1 className="text-2xl md:text-4xl font-display font-bold text-text-primary tracking-tight">
                        {data.text_title}
                    </h1>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-text-secondary italic opacity-60 text-base">
                            by {data.author}
                        </p>
                        <Button
                            variant={showQuocNgu ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setShowQuocNgu(!showQuocNgu)}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5"
                        >
                            {showQuocNgu ? 'Hide' : 'Show'} Quốc Ngữ
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
                            PREVIOUS
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
                            NEXT
                        </Button>
                    </GlassCard>
                )}

                <div className="mt-6 text-center">
                    <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-[0.4em]">
                        {data.total_lines} total lines
                    </p>
                </div>
            </main>

            {/* Right Sidebar - Dictionary / Toolbox */}
            <aside className={`
                ${selectedLine ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                fixed lg:static inset-y-0 right-0 z-[70]
                w-80 lg:w-72 shrink-0
                bg-bg-primary/95 lg:bg-transparent
                backdrop-blur-xl lg:backdrop-blur-none
                border-l border-white/10 lg:border-0
                transition-transform duration-300
                overflow-y-auto
                pt-20 lg:pt-0
                px-4 lg:px-0
            `}>
                {/* Mobile close button */}
                {selectedLine && (
                    <button
                        onClick={() => { setSelectedLine(null); setDictData(null); }}
                        className="lg:hidden absolute top-4 left-4 text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] mb-4">
                    Dictionary
                </div>

                {!selectedLine ? (
                    <div className="text-text-secondary/40 text-sm italic text-center py-12">
                        Tap a line to view its dictionary entry
                    </div>
                ) : (dictLoading || charDictLoading) ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
                    </div>
                ) : sidebarView === 'char' && charDictData ? (
                    /* ===== Character Dictionary View ===== */
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Back to line view */}
                        <button
                            onClick={() => setSidebarView('line')}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Line
                        </button>

                        {/* Character header */}
                        <GlassCard className="!p-4 border-white/5">
                            <div className="font-nom text-4xl text-text-primary text-center leading-relaxed mb-1">
                                {charDictData.nom}
                            </div>
                            <div className="text-sm font-serif italic text-text-secondary/80 text-center">
                                {charDictData.quoc_ngu}
                            </div>
                        </GlassCard>

                        {/* Variants */}
                        {charDictData.variants.length > 0 && (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Variants
                                </div>
                                <div className="space-y-1">
                                    {charDictData.variants.map((v) => (
                                        <div key={v.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/var">
                                            <span className="font-nom text-lg text-text-primary w-8 text-center shrink-0">
                                                {v.nom}
                                            </span>
                                            <span className="text-xs font-serif italic text-text-secondary/70 flex-grow">
                                                {v.quoc_ngu}
                                            </span>
                                            <button
                                                onClick={() => handleViewChar(v.id)}
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 text-text-secondary/50 hover:text-accent-primary opacity-0 group-hover/var:opacity-100 transition-all"
                                            >
                                                View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Homophones */}
                        {charDictData.homophones.length > 0 && (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Homophones
                                </div>
                                <div className="space-y-1">
                                    {charDictData.homophones.map((h) => (
                                        <div key={h.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/homo">
                                            <span className="font-nom text-lg text-text-primary w-8 text-center shrink-0">
                                                {h.nom}
                                            </span>
                                            <span className="text-xs font-serif italic text-text-secondary/70 flex-grow">
                                                {h.quoc_ngu}
                                            </span>
                                            <button
                                                onClick={() => handleViewChar(h.id)}
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 text-text-secondary/50 hover:text-accent-primary opacity-0 group-hover/homo:opacity-100 transition-all"
                                            >
                                                View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Examples */}
                        {charDictData.examples.length > 0 && (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Examples
                                </div>
                                <div className="space-y-3">
                                    {charDictData.examples.slice(0, 5).map((ex) => (
                                        <div key={ex.line_id} className="px-2 py-1.5">
                                            <div
                                                className="font-nom text-base text-text-primary leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: ex.nom }}
                                            />
                                            <div className="text-xs font-serif italic text-text-secondary/60 mt-0.5">
                                                {ex.quoc_ngu}
                                            </div>
                                            <div className="text-[9px] text-text-secondary/30 mt-0.5">
                                                {ex.source}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Add Character to List */}
                        <Button
                            onClick={() => {
                                setModalItem({ id: charDictData.id, type: 'character', name: charDictData.nom });
                                setIsModalOpen(true);
                            }}
                            className="w-full font-black uppercase tracking-widest text-[10px] py-3.5 shadow-xl shadow-accent-primary/20"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Character to List
                            </span>
                        </Button>
                    </div>
                ) : dictData ? (
                    /* ===== Line Dictionary View ===== */
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Nom + Quoc Ngu */}
                        <GlassCard className="!p-4 border-white/5">
                            <div className="font-nom text-2xl text-text-primary text-center leading-relaxed mb-2">
                                {dictData.nom}
                            </div>
                            <div className="text-sm font-serif italic text-text-secondary/80 text-center">
                                {dictData.quoc_ngu}
                            </div>
                            {dictData.english_translation && (
                                <div className="text-xs text-text-secondary/60 text-center mt-2 pt-2 border-t border-white/5">
                                    {dictData.english_translation}
                                </div>
                            )}
                        </GlassCard>

                        {/* Character Breakdown */}
                        {dictData.characters.length > 0 && (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Character Breakdown
                                </div>
                                <div className="space-y-1">
                                    {dictData.characters.map((char) => (
                                        <div key={char.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/char">
                                            <span className="font-nom text-lg text-text-primary w-8 text-center shrink-0">
                                                {char.nom}
                                            </span>
                                            <span className="text-xs font-serif italic text-text-secondary/70 flex-grow">
                                                {char.quoc_ngu}
                                            </span>
                                            <button
                                                onClick={() => handleViewChar(char.id)}
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 text-text-secondary/50 hover:text-accent-primary opacity-0 group-hover/char:opacity-100 transition-all"
                                            >
                                                View
                                            </button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setModalItem({ id: char.id, type: 'character', name: char.nom });
                                                    setIsModalOpen(true);
                                                }}
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 opacity-0 group-hover/char:opacity-100 transition-opacity"
                                            >
                                                + Add
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Analysis */}
                        {dictData.analysis && dictData.analysis.length > 0 && (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Analysis
                                </div>
                                <div className="space-y-2">
                                    {dictData.analysis.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 px-2 py-1.5">
                                            <span className="font-nom text-base text-text-primary shrink-0">
                                                {item.nom}
                                            </span>
                                            <div className="text-xs">
                                                <span className="font-serif italic text-text-secondary/70">{item.quoc_ngu}</span>
                                                {item.meaning && (
                                                    <span className="text-text-secondary/50 ml-1">— {item.meaning}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        )}

                        {/* Status */}
                        <GlassCard className="!p-4 border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">
                                    Status
                                </div>
                                {selectedLine.status === 'learned' ? (
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                                        Learned
                                    </span>
                                ) : selectedLine.status === 'learning' ? (
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                                        Learning
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black bg-white/5 text-text-secondary/40 border border-white/10 uppercase tracking-widest">
                                        New
                                    </span>
                                )}
                            </div>
                        </GlassCard>

                        {/* Add Line to List Button */}
                        <Button
                            onClick={() => {
                                setModalItem({ id: selectedLine.line_dict_id!, type: 'line', name: selectedLine.nom });
                                setIsModalOpen(true);
                            }}
                            className="w-full font-black uppercase tracking-widest text-[10px] py-3.5 shadow-xl shadow-accent-primary/20"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Line to List
                            </span>
                        </Button>
                    </div>
                ) : null}
            </aside>

            {/* Mobile overlay for right sidebar */}
            {selectedLine && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
                    onClick={() => { setSelectedLine(null); setDictData(null); }}
                />
            )}

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
