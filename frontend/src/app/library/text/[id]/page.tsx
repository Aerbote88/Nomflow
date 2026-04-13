'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { DictionarySidebar } from '@/components/Dictionary/DictionarySidebar';
import { DictionaryPanel } from '@/components/Dictionary/DictionaryPanel';
import { useDictionarySidebar } from '@/hooks/useDictionarySidebar';
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

interface UserInfo {
    id: number;
    username: string;
    is_admin: boolean;
}

export default function TextDetailPage() {
    const params = useParams();
    const router = useRouter();
    const textId = params.id;

    const [data, setData] = useState<TextDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [gotoPage, setGotoPage] = useState('');
    const [user, setUser] = useState<UserInfo | null>(null);
    const [editingLineId, setEditingLineId] = useState<number | null>(null);
    const [editNom, setEditNom] = useState('');
    const [editQuocNgu, setEditQuocNgu] = useState('');
    const [selectedLine, setSelectedLine] = useState<LineItem | null>(null);
    const [dictSidebarOpen, setDictSidebarOpen] = useState(false);
    const dict = useDictionarySidebar();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);

    const fetchContent = async (p: number) => {
        setLoading(true);
        try {
            const resp = await apiFetch<TextDetail>(`browse?text_id=${textId}&page=${p}`);
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
        // Fetch user info to check admin status
        apiFetch<UserInfo>('user/me').then(setUser).catch(logger.error);
    }, [textId]);

    const handlePageChange = (p: number) => {
        if (p < 1 || (data && p > data.total_pages)) return;
        fetchContent(p);
    };

    const handleGoto = (e: React.FormEvent) => {
        e.preventDefault();
        const p = parseInt(gotoPage);
        if (!isNaN(p)) handlePageChange(p);
    };

    const startEdit = (line: LineItem) => {
        setEditingLineId(line.id);
        setEditNom(line.nom);
        setEditQuocNgu(line.quoc_ngu);
    };

    const cancelEdit = () => {
        setEditingLineId(null);
        setEditNom('');
        setEditQuocNgu('');
    };

    const saveEdit = async (lineId: number) => {
        try {
            await apiFetch(`lines/${lineId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nom_text: editNom,
                    quoc_ngu_text: editQuocNgu
                })
            });
            // Refresh the page data
            await fetchContent(page);
            cancelEdit();
        } catch (err) {
            logger.error('Failed to update line:', err);
            alert('Failed to update line. Please try again.');
        }
    };

    const handleLineClick = useCallback((line: LineItem) => {
        if (!line.line_dict_id && !line.char_id) return;
        setSelectedLine(line);
        setDictSidebarOpen(true);
        if (line.line_dict_id) {
            dict.loadLineDict(line.line_dict_id);
        } else if (line.char_id) {
            dict.loadCharDict(line.char_id);
        }
    }, [dict.loadLineDict, dict.loadCharDict]);

    const handleCloseDictSidebar = () => {
        setDictSidebarOpen(false);
        setSelectedLine(null);
        dict.reset();
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
        <div className="max-w-[1000px] mx-auto py-4 md:py-8 px-4 md:px-6 relative">
            <header className="mb-6 md:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/library">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all group">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                        </div>
                    </Link>
                    <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] leading-none">
                        Classical Repository
                    </div>
                </div>

                <h1 className="text-2xl md:text-5xl font-display font-bold text-text-primary tracking-tight">
                    {data.text_title}
                </h1>
                <p className="text-text-secondary italic mt-2 opacity-60 text-lg">
                    by {data.author}
                </p>
            </header>

            {/* Pagination Controls */}
            <GlassCard className="mb-6 p-4 border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="font-black py-2 px-4 text-[10px]"
                    >
                        PREVIOUS
                    </Button>
                    <span className="text-xs font-black text-text-primary uppercase tracking-widest min-w-[100px] text-center">
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
                </div>

                <form onSubmit={handleGoto} className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Jump to:</span>
                    <input
                        type="number"
                        value={gotoPage}
                        onChange={(e) => setGotoPage(e.target.value)}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-center font-black outline-none focus:border-accent-primary/50"
                        min={1}
                        max={data.total_pages}
                    />
                    <Button type="submit" variant="ghost" className="text-[10px] font-black p-2">GO</Button>
                </form>
            </GlassCard>

            {/* Content Table */}
            <GlassCard className="p-0 overflow-hidden border-white/5 shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest w-12 text-center">#</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest">Original Nôm</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest">Transcription</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest w-24 text-center">Status</th>
                            {user?.is_admin && (
                                <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest w-24 text-center">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.lines.map((line) => (
                            <tr key={line.id} className="group hover:bg-white/5 transition-colors duration-300">
                                <td className="p-4 md:p-6 text-center align-middle">
                                    <span className="text-[10px] font-mono font-black text-text-secondary/30 group-hover:text-text-secondary transition-colors">
                                        {line.line_number}
                                    </span>
                                </td>
                                <td className="p-4 md:p-6 align-middle">
                                    {editingLineId === line.id ? (
                                        <input
                                            type="text"
                                            value={editNom}
                                            onChange={(e) => setEditNom(e.target.value)}
                                            className="w-full font-nom text-2xl md:text-3xl text-text-primary bg-white/5 border border-accent-primary/50 rounded px-2 py-1 outline-none focus:border-accent-primary"
                                        />
                                    ) : (line.line_dict_id || line.char_id) ? (
                                        <div
                                            onClick={() => handleLineClick(line)}
                                            className="font-nom text-2xl md:text-3xl text-text-primary group-hover:text-accent-primary transition-colors leading-tight hover:underline cursor-pointer"
                                        >
                                            {line.nom}
                                        </div>
                                    ) : (
                                        <div className="font-nom text-2xl md:text-3xl text-text-primary group-hover:text-accent-primary transition-colors leading-tight">
                                            {line.nom}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 md:p-6 align-middle">
                                    {editingLineId === line.id ? (
                                        <input
                                            type="text"
                                            value={editQuocNgu}
                                            onChange={(e) => setEditQuocNgu(e.target.value)}
                                            className="w-full text-sm md:text-lg font-medium text-text-primary bg-white/5 border border-accent-primary/50 rounded px-2 py-1 outline-none focus:border-accent-primary font-serif italic"
                                        />
                                    ) : (line.line_dict_id || line.char_id) ? (
                                        <div
                                            onClick={() => handleLineClick(line)}
                                            className="text-sm md:text-lg font-semibold text-text-primary font-serif italic tracking-tight opacity-90 hover:text-accent-primary hover:underline cursor-pointer transition-colors"
                                        >
                                            {line.quoc_ngu}
                                        </div>
                                    ) : (
                                        <div className="text-sm md:text-lg font-semibold text-text-primary font-serif italic tracking-tight opacity-90">
                                            {line.quoc_ngu}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 md:p-6 text-center align-middle">
                                    {line.status === 'learned' ? (
                                        <span className="px-2 py-1 rounded-md text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                                            Learned
                                        </span>
                                    ) : line.status === 'learning' ? (
                                        <span className="px-2 py-1 rounded-md text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                                            Learning
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 rounded-md text-[9px] font-black bg-white/5 text-text-secondary/40 border border-white/10 uppercase tracking-widest group-hover:opacity-100 transition-opacity">
                                            New
                                        </span>
                                    )}
                                </td>
                                {user?.is_admin && (
                                    <td className="p-4 md:p-6 text-center align-middle">
                                        {editingLineId === line.id ? (
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    size="sm"
                                                    onClick={() => saveEdit(line.id)}
                                                    className="text-[9px] px-3 py-1"
                                                >
                                                    SAVE
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={cancelEdit}
                                                    className="text-[9px] px-3 py-1"
                                                >
                                                    CANCEL
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => startEdit(line)}
                                                className="text-[9px] px-3 py-1"
                                            >
                                                EDIT
                                            </Button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </GlassCard>

            <div className="mt-8 text-center">
                <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-[0.4em]">
                    {data.total_lines} total items
                </p>
            </div>

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
                    status={selectedLine?.status}
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
