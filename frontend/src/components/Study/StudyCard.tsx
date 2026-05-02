'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/ui';

interface StudyCardProps {
    nom: string;
    contextLine?: string;
    quocNgu: string;
    english?: string;
    sourceTitle?: string;
    lineNumber?: number;
    itemType: 'character' | 'line';
    isFlipped: boolean;
    contentId: number;
    onNomClick?: () => void;
}

export const StudyCard: React.FC<StudyCardProps> = ({
    nom,
    contextLine,
    quocNgu,
    english,
    sourceTitle,
    lineNumber,
    itemType,
    isFlipped,
    contentId,
    onNomClick
}) => {
    const t = useTranslations('studyCard');

    return (
        <GlassCard className="w-full max-w-[600px] min-h-[280px] md:min-h-[450px] flex flex-col justify-center items-center relative overflow-hidden group transition-[background-color,border-color,box-shadow,transform,opacity] duration-500">
            <div className="w-full text-center z-10 p-4 md:p-8">
                <div className="flex flex-col items-center justify-center min-h-[180px] md:min-h-[300px]">
                    <button
                        onClick={onNomClick}
                        className="font-nom text-text-primary leading-tight hover:text-accent-primary transition-colors cursor-pointer bg-transparent border-none outline-none"
                        style={{ fontSize: 'clamp(2.5rem, 12vw, 6.5rem)' }}
                        dangerouslySetInnerHTML={{ __html: nom }}
                    />

                    {sourceTitle && (
                        <div className="text-[10px] md:text-xs text-text-secondary uppercase tracking-widest font-black opacity-40 mt-2 italic">
                            {sourceTitle} {lineNumber ? t('lineFormat', { number: lineNumber }) : ''}
                        </div>
                    )}

                    {contextLine && (
                        <div
                            className="text-2xl md:text-3xl text-text-secondary mt-3 md:mt-6 font-nom max-w-[95%] mx-auto leading-relaxed border-t border-white/5 pt-3 md:pt-4"
                            dangerouslySetInnerHTML={{ __html: contextLine }}
                        />
                    )}
                </div>

                <div className={`mt-1.5 pt-1.5 md:mt-8 md:pt-8 border-t border-white/10 w-full overflow-hidden transition-all duration-700 ease-out ${isFlipped ? 'opacity-100 translate-y-0 scale-100 h-auto' : 'opacity-0 translate-y-4 scale-95 h-0 pointer-events-none'}`}>
                    <div className="text-2xl md:text-4xl font-serif font-semibold text-accent-primary mb-1 md:mb-2">
                        {quocNgu}
                    </div>
                    {english && (
                        <div className="text-sm md:text-xl text-text-secondary italic font-serif opacity-80 max-w-[85%] mx-auto">
                            {english}
                        </div>
                    )}


                    {itemType === 'character' && <div className="mt-4 md:mt-8 flex justify-center gap-4 md:gap-6">
                        <a
                            href={`https://zi.tools/zi/${encodeURIComponent(nom.replace(/<[^>]*>/g, ''))}`}
                            target="_blank"
                            className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1 md:gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            zi.tools
                        </a>
                        <a
                            href={`https://www.digitizingvietnam.com/en/tools/han-nom-dictionaries/general?q=${encodeURIComponent(quocNgu)}`}
                            target="_blank"
                            className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1 md:gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Hán-Nôm
                        </a>
                    </div>}
                </div>
            </div>
        </GlassCard>
    );
};
