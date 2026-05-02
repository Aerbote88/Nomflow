'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { DictionarySidebar } from '@/components/Dictionary/DictionarySidebar';
import { DictionaryPanel } from '@/components/Dictionary/DictionaryPanel';
import { useDictionarySidebar } from '@/hooks/useDictionarySidebar';
import { AddToListModal } from '@/components/Study/AddToListModal';

interface ListItem {
    id: number;
    type: 'character' | 'line';
    nom: string;
    quoc_ngu: string;
}

interface ListDetail {
    id: number;
    name: string;
    description: string;
    items: ListItem[];
}

export default function ListDetailPage() {
    const t = useTranslations('library.list');
    const tc = useTranslations('common');
    const params = useParams();
    const router = useRouter();
    const listId = params.id;

    const [data, setData] = useState<ListDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [dictSidebarOpen, setDictSidebarOpen] = useState(false);
    const dict = useDictionarySidebar();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);

    const fetchList = async () => {
        try {
            const resp = await apiFetch<ListDetail>(`lists/${listId}`);
            setData(resp);
        } catch (err) {
            logger.error('Failed to load list details:', err);
            router.push('/library');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [listId]);

    const handleRemove = async (type: string, id: number) => {
        if (!confirm(t('removeConfirm'))) return;
        try {
            await apiFetch(`lists/${listId}/items/${type}/${id}`, { method: 'DELETE' });
            fetchList();
        } catch (err) {
            logger.error('Failed to remove item:', err);
        }
    };

    const handleDeleteList = async () => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            await apiFetch(`lists/${listId}`, { method: 'DELETE' });
            router.push('/library');
        } catch (err) {
            logger.error('Failed to delete list:', err);
        }
    };

    const handleItemClick = useCallback((item: ListItem) => {
        setDictSidebarOpen(true);
        if (item.type === 'line') {
            dict.loadLineDict(item.id);
        } else {
            dict.loadCharDict(item.id);
        }
    }, [dict.loadLineDict, dict.loadCharDict]);

    const handleCloseDictSidebar = () => {
        setDictSidebarOpen(false);
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
            <header className="mb-6 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <Link href="/library">
                            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all group">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                                </svg>
                            </div>
                        </Link>
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] leading-none">
                            {t('kicker')}
                        </div>
                    </div>

                    <h1 className="text-2xl md:text-5xl font-display font-bold text-text-primary tracking-tight">
                        {data.name}
                    </h1>
                    {data.description && (
                        <p className="text-text-secondary italic mt-2 opacity-60 text-lg">
                            "{data.description}"
                        </p>
                    )}
                </div>

                <Button
                    variant="secondary"
                    onClick={handleDeleteList}
                    className="bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500 group"
                >
                    <span className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t('deleteList')}
                    </span>
                </Button>
            </header>

            {/* Items Table */}
            <GlassCard className="p-0 overflow-hidden border-white/5 shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest w-12 text-center">#</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest">{t('tableExpression')}</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest">{t('tableTranscription')}</th>
                            <th className="p-4 md:p-6 font-black text-[10px] text-text-secondary uppercase tracking-widest text-right">{t('tableActions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-20 text-center italic text-text-secondary opacity-30 font-display text-2xl">
                                    {t('empty')}
                                </td>
                            </tr>
                        ) : (
                            data.items.map((item, index) => (
                                <tr key={`${item.type}-${item.id}`} className="group hover:bg-white/5 transition-colors duration-300">
                                    <td className="p-4 md:p-6 text-center align-middle">
                                        <span className="text-[10px] font-mono font-black text-text-secondary/30">
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="p-4 md:p-6 align-middle">
                                        <div
                                            onClick={() => handleItemClick(item)}
                                            className="font-nom text-2xl md:text-3xl text-text-primary group-hover:text-accent-primary transition-colors leading-tight hover:underline cursor-pointer"
                                        >
                                            {item.nom}
                                        </div>
                                    </td>
                                    <td className="p-4 md:p-6 align-middle">
                                        <div
                                            onClick={() => handleItemClick(item)}
                                            className="text-sm md:text-lg font-black text-text-primary font-serif italic tracking-tight opacity-90 hover:text-accent-primary hover:underline cursor-pointer transition-colors"
                                        >
                                            {item.quoc_ngu}
                                        </div>
                                    </td>
                                    <td className="p-4 md:p-6 text-right align-middle">
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleRemove(item.type, item.id)}
                                            className="text-[9px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
                                        >
                                            {tc('remove')}
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </GlassCard>

            <div className="mt-8 text-center">
                <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-[0.4em]">
                    {t('totalCurated', { count: data.items.length })}
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
                    onAddToList={(item) => {
                        setModalItem(item);
                        setIsModalOpen(true);
                    }}
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
