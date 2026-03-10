import React from 'react';
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
    contentId
}) => {
    const dictionaryUrl = itemType === 'character'
        ? `/dictionary/char/${contentId}`
        : `/dictionary/line/${contentId}`;

    return (
        <GlassCard className="w-full max-w-[600px] min-h-[320px] md:min-h-[450px] flex flex-col justify-center items-center relative overflow-hidden group transition-[background-color,border-color,box-shadow,transform,opacity] duration-500">
            <div className="w-full text-center z-10 p-4 md:p-8">
                {/* Front and Back Container (Stabilized) */}
                <div className="flex flex-col items-center justify-center min-h-[180px] md:min-h-[300px]">
                    <a
                        href={dictionaryUrl}
                        className="font-nom text-text-primary leading-tight hover:text-accent-primary transition-colors cursor-pointer"
                        style={{ fontSize: 'clamp(3.5rem, 15vw, 6.5rem)' }}
                        dangerouslySetInnerHTML={{ __html: nom }}
                    />

                    {sourceTitle && (
                        <div className="text-[10px] md:text-xs text-text-secondary uppercase tracking-widest font-black opacity-40 mt-2 italic">
                            {sourceTitle} {lineNumber ? `• Line ${lineNumber}` : ''}
                        </div>
                    )}

                    {contextLine && (
                        <div
                            className="text-xl md:text-2xl text-text-secondary mt-6 font-nom max-w-[90%] mx-auto leading-relaxed border-t border-white/5 pt-4"
                            dangerouslySetInnerHTML={{ __html: contextLine }}
                        />
                    )}
                </div>

                {/* Back of Card (Fades in without shifting layout) */}
                <div className={`mt-4 pt-4 md:mt-8 md:pt-8 border-t border-white/10 w-full overflow-hidden transition-all duration-700 ease-out ${isFlipped ? 'opacity-100 translate-y-0 scale-100 h-auto' : 'opacity-0 translate-y-4 scale-95 h-0 pointer-events-none'}`}>
                    <div className="text-3xl md:text-4xl font-serif font-semibold text-accent-primary mb-2">
                        {quocNgu}
                    </div>
                    {english && (
                        <div className="text-lg md:text-xl text-text-secondary italic font-serif opacity-80 max-w-[85%] mx-auto">
                            {english}
                        </div>
                    )}


                    {itemType === 'character' && <div className="mt-8 flex justify-center gap-6">
                        <a
                            href={`https://zi.tools/zi/${encodeURIComponent(nom.replace(/<[^>]*>/g, ''))}`}
                            target="_blank"
                            className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            zi.tools
                        </a>
                        <a
                            href={`https://www.digitizingvietnam.com/en/tools/han-nom-dictionaries/general?q=${encodeURIComponent(quocNgu)}`}
                            target="_blank"
                            className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
