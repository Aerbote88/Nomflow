'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SourceCard } from '@/components/Library/SourceCard';
import { StudyOptionsModal } from '@/components/Library/StudyOptionsModal';
import { CreateListModal } from '@/components/Library/CreateListModal';
import { Button } from '@/components/ui';

interface SourceText {
    id: number;
    title: string;
    author: string;
    description?: string;
}

interface StudyList {
    id: number;
    name: string;
    description: string;
    item_count: number;
}

interface UserSettings {
    active_text_id: number | null;
    active_list_id: number | null;
    daily_new_limit: number;
}

export default function LibraryPage() {
    const router = useRouter();
    const [texts, setTexts] = useState<SourceText[]>([]);
    const [lists, setLists] = useState<StudyList[]>([]);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [studyModal, setStudyModal] = useState<{ isOpen: boolean; type: 'text' | 'list' | null; id: number | null; name: string }>({
        isOpen: false,
        type: null,
        id: null,
        name: ''
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            const [textsData, listsData, settingsData] = await Promise.all([
                apiFetch<SourceText[]>('texts'),
                apiFetch<StudyList[]>('lists'),
                apiFetch<UserSettings>('settings')
            ]);
            setTexts(textsData);
            setLists(listsData);
            setSettings(settingsData);
        } catch (err) {
            console.error('Failed to load library data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSetActive = async (type: 'text' | 'list', id: number) => {
        if (!settings) return;
        try {
            await apiFetch('settings', {
                method: 'POST',
                body: JSON.stringify({
                    daily_new_limit: settings.daily_new_limit,
                    active_text_id: type === 'text' ? id : null,
                    active_list_id: type === 'list' ? id : null
                })
            });
            fetchData(); // Refresh state
        } catch (err) {
            console.error('Failed to set active source:', err);
        }
    };

    const openStudyOptions = (type: 'text' | 'list', id: number, name: string) => {
        setStudyModal({ isOpen: true, type, id, name });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto py-8 px-4 md:px-6">
            <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                <div>
                    <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-2 leading-none">
                        Your Repository
                    </div>
                    <h1 className="text-5xl md:text-6xl font-display font-bold text-text-primary tracking-tight">
                        Library
                    </h1>
                </div>
            </header>

            {/* Premade Texts Section */}
            <section className="mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <h2 className="text-sm font-black text-text-primary uppercase tracking-[0.3em] mb-8 flex items-center gap-4">
                    Curated Lists
                    <div className="h-[1px] flex-grow bg-white/10" />
                </h2>
                <div className="grid grid-cols-1 gap-6">
                    {texts.map((text) => (
                        <SourceCard
                            key={`text-${text.id}`}
                            id={text.id}
                            type="text"
                            title={text.title}
                            author={text.author}
                            description={text.description}
                            isActive={settings?.active_text_id === text.id && !settings?.active_list_id}
                            onStudy={() => openStudyOptions('text', text.id, text.title)}
                            onSetActive={() => handleSetActive('text', text.id)}
                            onBrowse={() => router.push(`/library/text/${text.id}`)}
                        />
                    ))}
                </div>
            </section>

            {/* Custom Lists Section */}
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-sm font-black text-text-primary uppercase tracking-[0.3em] flex items-center gap-4">
                        Custom Lists
                        <div className="h-[1px] w-32 bg-white/10" />
                    </h2>
                    <Button
                        size="sm"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="shadow-lg shadow-accent-primary/10"
                    >
                        <span className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                            </svg>
                            Create Custom List
                        </span>
                    </Button>
                </div>

                {lists.length === 0 ? (
                    <div
                        onClick={() => setIsCreateModalOpen(true)}
                        className="group py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-accent-primary/20 transition-[background-color,border-color,transform] duration-500"
                    >
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform mb-4 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100">
                            📜
                        </div>
                        <p className="text-text-secondary font-black uppercase tracking-widest text-[10px] opacity-40 group-hover:opacity-100 transition-opacity">
                            Embark on your first custom collection
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {lists.map((list) => (
                            <SourceCard
                                key={`list-${list.id}`}
                                id={list.id}
                                type="list"
                                title={list.name}
                                description={list.description}
                                itemCount={list.item_count}
                                isActive={settings?.active_list_id === list.id}
                                onStudy={() => openStudyOptions('list', list.id, list.name)}
                                onSetActive={() => handleSetActive('list', list.id)}
                                onBrowse={() => router.push(`/library/list/${list.id}`)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <StudyOptionsModal
                isOpen={studyModal.isOpen}
                onClose={() => setStudyModal({ ...studyModal, isOpen: false })}
                sourceType={studyModal.type}
                sourceId={studyModal.id}
                sourceName={studyModal.name}
            />

            <CreateListModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchData}
            />
        </div>
    );
}
