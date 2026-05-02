'use client';

import React from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { GlassCard, Button } from '@/components/ui';

interface SourceCardProps {
    id: number;
    type: 'text' | 'list';
    title: string;
    author?: string;
    description?: string;
    itemCount?: number;
    isActive: boolean;
    onStudy: () => void;
    onSetActive: () => void;
    onBrowse: () => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({
    id,
    type,
    title,
    author,
    description,
    itemCount,
    isActive,
    onStudy,
    onSetActive,
    onBrowse
}) => {
    const t = useTranslations('sourceCard');
    const messages = useMessages() as { textDescriptions?: Record<string, string> };
    const localizedDescription = messages.textDescriptions?.[title] || description;
    const isCurated = author && ['Chunom.org', 'Digitizing Vietnam Team'].includes(author);
    const typeLabel = type === 'text'
        ? (isCurated ? t('typeWordList') : t('typeClassicText'))
        : t('typeCustomList');

    return (
        <GlassCard className={`p-0 group relative overflow-hidden transition-[background-color,border-color,box-shadow,transform,opacity] duration-500 hover:shadow-2xl hover:shadow-accent-primary/10 border-white/5 ${isActive ? 'ring-2 ring-accent-primary ring-offset-4 ring-offset-background' : ''}`}>
            {isActive && (
                <div className="absolute top-0 right-0 bg-accent-primary text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl shadow-lg tracking-[0.2em] z-10 animate-in slide-in-from-top slide-in-from-right duration-500">
                    {t('active')}
                </div>
            )}

            <div className="flex flex-col md:flex-row min-h-[160px]">
                <div className="flex-grow p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.2em]">
                            {typeLabel}
                        </span>
                        {itemCount !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/5 text-text-secondary border border-white/10 uppercase tracking-widest">
                                {t('itemsCount', { count: itemCount })}
                            </span>
                        )}
                    </div>

                    <h3 className="text-2xl font-serif text-text-primary mb-1 group-hover:text-accent-primary transition-colors duration-300">
                        {title}
                    </h3>

                    {author && (
                        <p className="text-xs text-text-secondary italic opacity-60 mb-2 font-serif">
                            {t('byAuthor', { author })}
                        </p>
                    )}

                    {localizedDescription && (
                        <p className="hidden md:block text-sm font-serif text-text-secondary line-clamp-2 leading-relaxed opacity-80 mt-2">
                            {localizedDescription}
                        </p>
                    )}
                </div>

                <div className="md:w-52 md:border-l border-t md:border-t-0 border-accent-gold/20 p-6 flex flex-col gap-3 justify-center shrink-0">
                    <Button
                        onClick={onStudy}
                        className="w-full font-black uppercase tracking-widest text-[10px] py-3.5 shadow-xl shadow-accent-primary/20 bg-accent-primary hover:bg-accent-hover border-0"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            {t('studyNow')}
                        </span>
                    </Button>

                    {!isActive && (
                        <Button
                            variant="secondary"
                            onClick={onSetActive}
                            className="w-full font-black uppercase tracking-widest text-[10px] py-3 border-white/10 bg-white/5 hover:bg-white/10"
                        >
                            {t('setActive')}
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        onClick={onBrowse}
                        className="w-full font-black uppercase tracking-widest text-[9px] py-2.5 text-text-primary bg-white/5 hover:bg-white/10 border-white/10 hover:border-accent-gold/20 transition-colors"
                    >
                        {type === 'list' ? t('manageList') : t('browseContent')}
                    </Button>
                </div>
            </div>
        </GlassCard>
    );
};
