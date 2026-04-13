import React from 'react';
import { GlassCard, Button } from '@/components/ui';

export interface DictCharacter {
    id: number;
    nom: string;
    quoc_ngu: string;
    order: number;
}

export interface AnalysisItem {
    word: string;
    meaning: string;
    explanation?: string;
}

export interface LineDictData {
    id: number;
    nom: string;
    quoc_ngu: string;
    english_translation?: string;
    analysis?: AnalysisItem[] | { breakdown?: AnalysisItem[]; compounds?: AnalysisItem[] };
    characters: DictCharacter[];
    stats: {
        is_learning: boolean;
        next_review: string | null;
    };
}

export interface CharDictVariant {
    id: number;
    nom: string;
    quoc_ngu: string;
}

export interface CharDictExample {
    line_id: number;
    nom: string;
    quoc_ngu: string;
    source: string;
}

export interface CharDictData {
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

interface DictionarySidebarProps {
    sidebarView: 'line' | 'char';
    dictData: LineDictData | null;
    charDictData: CharDictData | null;
    dictLoading: boolean;
    charDictLoading: boolean;
    onViewChar: (charId: number) => void;
    onViewLine?: (lineId: number) => void;
    onBackToLine: () => void;
    onAddToList?: (item: { id: number; type: 'line' | 'character'; name: string }) => void;
    /** Status to display — if omitted, no status card is shown */
    status?: 'unseen' | 'learning' | 'learned';
    /** Whether to show the "Back to Line" button in char view. False when viewing a standalone character. */
    showBackToLine?: boolean;
    /** Whether to show inline "+ Add" buttons next to each character in the breakdown. Default true. */
    showInlineAdd?: boolean;
}

export const DictionarySidebar: React.FC<DictionarySidebarProps> = ({
    sidebarView,
    dictData,
    charDictData,
    dictLoading,
    charDictLoading,
    onViewChar,
    onViewLine,
    onBackToLine,
    onAddToList,
    status,
    showBackToLine = true,
    showInlineAdd = true,
}) => {
    if (dictLoading || charDictLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    const backButton = showBackToLine ? (
        <button
            onClick={onBackToLine}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
            Back
        </button>
    ) : null;

    if (sidebarView === 'char' && charDictData) {
        return (
            <div className="space-y-4 animate-in fade-in duration-200">
                {backButton}

                {/* Character header */}
                <GlassCard className="!p-4 border-white/5">
                    <div className="font-nom text-5xl text-text-primary text-center leading-relaxed mb-1">
                        {charDictData.nom}
                    </div>
                    <div className="text-base font-serif italic text-text-secondary/80 text-center">
                        {charDictData.quoc_ngu}
                    </div>
                    {(() => {
                        const char = charDictData.nom?.[0];
                        if (!char) return null;
                        const linkClass = "px-2.5 py-1 rounded-md bg-white/5 hover:bg-accent-primary/10 border border-white/10 hover:border-accent-primary/30 text-[9px] font-black uppercase tracking-widest text-text-secondary hover:text-accent-primary transition-colors";
                        return (
                            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/5">
                                <a
                                    href={`https://zi.tools/zi/${encodeURIComponent(char)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={linkClass}
                                >
                                    zi.tools ↗
                                </a>
                                <a
                                    href={`https://digitizingvietnam.com/en/tools/han-nom-dictionaries/general?q=${encodeURIComponent(char)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={linkClass}
                                >
                                    Hán Nôm ↗
                                </a>
                            </div>
                        );
                    })()}
                </GlassCard>

                {/* Variants */}
                {charDictData.variants.length > 0 && (
                    <GlassCard className="!p-4 border-white/5">
                        <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                            Variants
                        </div>
                        <div className="space-y-1">
                            {charDictData.variants.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => onViewChar(v.id)}
                                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                                >
                                    <span className="font-nom text-xl text-text-primary w-9 text-center shrink-0">
                                        {v.nom}
                                    </span>
                                    <span className="text-sm font-serif italic text-text-secondary/70 flex-grow">
                                        {v.quoc_ngu}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {/* Homophones */}
                {charDictData.homophones.length > 0 && (
                    <GlassCard className="!p-4 border-white/5">
                        <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                            Homophones
                        </div>
                        <div className="space-y-1">
                            {charDictData.homophones.map((h) => (
                                <button
                                    key={h.id}
                                    onClick={() => onViewChar(h.id)}
                                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                                >
                                    <span className="font-nom text-xl text-text-primary w-9 text-center shrink-0">
                                        {h.nom}
                                    </span>
                                    <span className="text-sm font-serif italic text-text-secondary/70 flex-grow">
                                        {h.quoc_ngu}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {/* Examples */}
                {charDictData.examples.length > 0 && (
                    <GlassCard className="!p-4 border-white/5">
                        <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                            Examples
                        </div>
                        <div className="space-y-3">
                            {charDictData.examples.slice(0, 5).map((ex) => {
                                const content = (
                                    <>
                                        <div
                                            className="font-nom text-lg text-text-primary leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: ex.nom }}
                                        />
                                        <div className="text-sm font-serif italic text-text-secondary/60 mt-0.5">
                                            {ex.quoc_ngu}
                                        </div>
                                        <div className="text-[10px] text-text-secondary/30 mt-0.5">
                                            {ex.source}
                                        </div>
                                    </>
                                );
                                return onViewLine ? (
                                    <button
                                        key={ex.line_id}
                                        onClick={() => onViewLine(ex.line_id)}
                                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <div key={ex.line_id} className="px-2 py-1.5">
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                )}

                {/* Add Character to List */}
                {onAddToList && (
                    <Button
                        onClick={() => onAddToList({ id: charDictData.id, type: 'character', name: charDictData.nom })}
                        className="w-full font-black uppercase tracking-widest text-xs py-3.5 shadow-xl shadow-accent-primary/20"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Character to List
                        </span>
                    </Button>
                )}
            </div>
        );
    }

    if (dictData) {
        return (
            <div className="space-y-4 animate-in fade-in duration-200">
                {backButton}
                {/* Nom + Quoc Ngu */}
                <GlassCard className="!p-4 border-white/5">
                    <div className="font-nom text-3xl text-text-primary text-center leading-relaxed mb-2">
                        {dictData.nom}
                    </div>
                    <div className="text-base font-serif italic text-text-secondary/80 text-center">
                        {dictData.quoc_ngu}
                    </div>
                    {dictData.english_translation && (
                        <div className="text-sm text-text-secondary/60 text-center mt-2 pt-2 border-t border-white/5">
                            {dictData.english_translation}
                        </div>
                    )}
                </GlassCard>

                {/* Character Breakdown */}
                {dictData.characters.length > 0 && (
                    <GlassCard className="!p-4 border-white/5">
                        <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                            Character Breakdown
                        </div>
                        <div className="space-y-1">
                            {dictData.characters.map((char, idx) => (
                                <div
                                    key={`${char.id}-${idx}`}
                                    onClick={() => onViewChar(char.id)}
                                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/char cursor-pointer"
                                >
                                    <span className="font-nom text-xl text-text-primary w-9 text-center shrink-0">
                                        {char.nom}
                                    </span>
                                    <span className="text-sm font-serif italic text-text-secondary/70 flex-grow">
                                        {char.quoc_ngu}
                                    </span>
                                    {showInlineAdd && onAddToList && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddToList({ id: char.id, type: 'character', name: char.nom });
                                            }}
                                            className="text-[10px] font-black uppercase tracking-widest px-2 py-1 opacity-0 group-hover/char:opacity-100 transition-opacity"
                                        >
                                            + Add
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {/* Analysis / Compounds */}
                {(() => {
                    const analysis = dictData.analysis;
                    if (!analysis) return null;

                    // Object form: { breakdown?, compounds? } — show compounds only
                    // (breakdown is already covered by Character Breakdown section)
                    if (!Array.isArray(analysis)) {
                        const compounds = analysis.compounds;
                        if (!compounds || compounds.length === 0) return null;
                        return (
                            <GlassCard className="!p-4 border-white/5">
                                <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                    Compounds & Phrases
                                </div>
                                <div className="space-y-3">
                                    {compounds.map((item, i) => (
                                        <div key={i} className="px-2 py-1.5">
                                            <div className="flex items-baseline gap-3">
                                                <span className="font-nom text-lg text-text-primary shrink-0">
                                                    {item.word}
                                                </span>
                                                <span className="text-sm font-serif italic text-text-secondary/70">
                                                    {item.meaning}
                                                </span>
                                            </div>
                                            {item.explanation && (
                                                <div className="text-xs text-text-secondary/50 mt-1 italic leading-relaxed">
                                                    {item.explanation}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        );
                    }

                    // Legacy flat array form
                    if (analysis.length === 0) return null;
                    return (
                        <GlassCard className="!p-4 border-white/5">
                            <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-3">
                                Analysis
                            </div>
                            <div className="space-y-3">
                                {analysis.map((item, i) => (
                                    <div key={i} className="px-2 py-1.5">
                                        <div className="flex items-baseline gap-3">
                                            <span className="font-nom text-lg text-text-primary shrink-0">
                                                {item.word}
                                            </span>
                                            <span className="text-sm font-serif italic text-text-secondary/70">
                                                {item.meaning}
                                            </span>
                                        </div>
                                        {item.explanation && (
                                            <div className="text-xs text-text-secondary/50 mt-1 italic leading-relaxed">
                                                {item.explanation}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    );
                })()}

                {/* Status */}
                {status && (
                    <GlassCard className="!p-4 border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black text-text-secondary uppercase tracking-[0.2em]">
                                Status
                            </div>
                            {status === 'learned' ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                                    Learned
                                </span>
                            ) : status === 'learning' ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                                    Learning
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-white/5 text-text-secondary/40 border border-white/10 uppercase tracking-widest">
                                    New
                                </span>
                            )}
                        </div>
                    </GlassCard>
                )}

                {/* Add Line to List Button */}
                {onAddToList && (
                    <Button
                        onClick={() => onAddToList({ id: dictData.id, type: 'line', name: dictData.nom })}
                        className="w-full font-black uppercase tracking-widest text-xs py-3.5 shadow-xl shadow-accent-primary/20"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Line to List
                        </span>
                    </Button>
                )}
            </div>
        );
    }

    return null;
};
