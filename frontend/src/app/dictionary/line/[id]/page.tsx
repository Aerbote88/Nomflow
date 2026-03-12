'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { apiFetch } from '@/lib/api';
import { GlassCard, Button } from '@/components/ui';
import Link from 'next/link';

interface AnalysisItem {
    word: string;
    meaning: string;
    explanation?: string;
}

interface Analysis {
    breakdown: AnalysisItem[];
    compounds: AnalysisItem[];
}

interface CharSummary {
    id: number;
    nom: string;
    quoc_ngu: string;
    order: number;
}

interface LineData {
    id: number;
    nom: string;
    quoc_ngu: string;
    source_title: string;
    line_number: number;
    text_id: number | null;
    prev_line_id: number | null;
    next_line_id: number | null;
    prev_line_number: number | null;
    next_line_number: number | null;
    english_translation: string | null;
    analysis: Analysis | AnalysisItem[] | null;
    characters: CharSummary[];
    stats: {
        is_learning: boolean;
        next_review: string | null;
    };
}

interface UserInfo {
    id: number;
    username: string;
    is_admin: boolean;
}

export default function LineDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<LineData | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isEditingTranslation, setIsEditingTranslation] = useState(false);
    const [editedTranslation, setEditedTranslation] = useState('');

    useEffect(() => {
        if (id) {
            fetchData();
            // Fetch user info to check admin status
            apiFetch<UserInfo>('user/me').then(setUser).catch(console.error);
        }
    }, [id]);

    const fetchData = async () => {
        try {
            const lineData = await api.get<LineData>(`/api/dictionary/line/${id}`);
            setData(lineData);
        } catch (error) {
            console.error('Failed to fetch line data:', error);
        } finally {
            setLoading(false);
        }
    };

    const startEditTranslation = () => {
        setIsEditingTranslation(true);
        setEditedTranslation(data?.english_translation || '');
    };

    const cancelEditTranslation = () => {
        setIsEditingTranslation(false);
        setEditedTranslation('');
    };

    const saveTranslation = async () => {
        if (!data) return;
        try {
            await apiFetch(`line-dict/${data.id}`, {
                method: 'PUT',
                body: JSON.stringify({ english_translation: editedTranslation })
            });
            await fetchData();
            setIsEditingTranslation(false);
        } catch (error) {
            console.error('Failed to update translation:', error);
            alert('Failed to update translation. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <h2 className="text-2xl font-serif font-bold text-text-primary mb-4">Line Not Found</h2>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    const renderAnalysis = () => {
        if (!data.analysis) return null;

        // Handle standard breakdown/compounds format
        if ('breakdown' in data.analysis || 'compounds' in data.analysis) {
            const analysis = data.analysis as Analysis;
            return (
                <div className="space-y-8">
                    {analysis.breakdown && analysis.breakdown.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/40 mb-4 px-4">Character Breakdown</h4>
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-white/10">
                                        {analysis.breakdown.map((item, idx) => {
                                            const char = data.characters.find((_, i) => i === idx);
                                            return (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-4 pl-6 pr-4 w-1/3">
                                                        {char ? (
                                                            <Link
                                                                href={`/dictionary/char/${char.id}`}
                                                                className="nom-text text-xl text-text-primary hover:text-accent-primary transition-colors"
                                                            >
                                                                {item.word}
                                                            </Link>
                                                        ) : (
                                                            <span className="nom-text text-xl text-text-primary">{item.word}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 pr-6 text-text-primary font-medium">
                                                        {item.meaning}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {analysis.compounds && analysis.compounds.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/40 mb-4 px-4">Compounds & Phrases</h4>
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-white/10">
                                        {analysis.compounds.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-4 pl-6 pr-4 w-1/3">
                                                    <span className="font-bold text-text-primary">{item.word}</span>
                                                </td>
                                                <td className="py-4 pr-6 text-text-primary">
                                                    <div className="font-medium">{item.meaning}</div>
                                                    {item.explanation && (
                                                        <div className="text-[10px] text-text-secondary/60 mt-1 italic">{item.explanation}</div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Handle legacy list format
        if (Array.isArray(data.analysis)) {
            return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/40 mb-4 px-4">Analysis</h4>
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-white/10">
                                {(data.analysis as AnalysisItem[]).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="py-4 pl-6 pr-4 w-1/3">
                                            <span className="nom-text text-xl text-text-primary">{item.word}</span>
                                        </td>
                                        <td className="py-4 pr-6 text-text-primary font-medium">
                                            {item.meaning}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col items-center max-w-4xl mx-auto px-4 pb-12">
            {/* Header */}
            <div className="w-full flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="secondary"
                        onClick={() => router.back()}
                        className="text-xs font-black uppercase tracking-widest px-4"
                    >
                        Back
                    </Button>
                    <h2 className="text-xl font-black uppercase tracking-[0.3em] text-text-secondary/40">Line Details</h2>
                </div>

                <div className="flex gap-2">
                    {data.prev_line_id && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dictionary/line/${data.prev_line_id}`)}
                            className="flex items-center gap-1 text-xs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Prev
                        </Button>
                    )}
                    {data.next_line_id && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dictionary/line/${data.next_line_id}`)}
                            className="flex items-center gap-1 text-xs"
                        >
                            Next
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Display */}
            <GlassCard className="w-full p-8 md:p-12 text-center mb-12">
                <div className="text-sm font-black uppercase tracking-[0.2em] text-text-secondary/40 mb-4">
                    {data.source_title} • Line {data.line_number}
                </div>

                <div className="nom-text text-4xl md:text-5xl text-text-primary leading-relaxed mb-6">
                    {data.nom}
                </div>

                <div className="text-2xl font-serif font-bold text-text-primary mb-8 border-t border-white/10 pt-6">
                    {data.quoc_ngu}
                </div>

                {/* AI Insight Section */}
                <div className="text-left mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                    {/* Background SVG Decoration */}
                    <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-white/10 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-6 h-6 bg-accent-primary rounded-lg flex items-center justify-center text-white text-xs font-bold">AI</div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary/60">Insights & Analysis</h3>
                        </div>

                        {data.english_translation || user?.is_admin ? (
                            <div className="mb-10 animate-in fade-in slide-in-from-left-2 duration-500">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/40">English Translation</h5>
                                    {user?.is_admin && (
                                        <div className="flex gap-2">
                                            {isEditingTranslation ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={saveTranslation}
                                                        className="text-[9px] px-3 py-1"
                                                    >
                                                        SAVE
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={cancelEditTranslation}
                                                        className="text-[9px] px-3 py-1"
                                                    >
                                                        CANCEL
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={startEditTranslation}
                                                    className="text-[9px] px-3 py-1"
                                                >
                                                    EDIT
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {isEditingTranslation ? (
                                    <textarea
                                        value={editedTranslation}
                                        onChange={(e) => setEditedTranslation(e.target.value)}
                                        className="w-full text-xl font-serif italic text-text-primary leading-relaxed bg-white/5 border border-white/10 rounded-lg p-4 outline-none focus:border-accent-primary/50 min-h-[100px]"
                                        placeholder="Enter English translation..."
                                    />
                                ) : (
                                    <p className="text-xl font-serif italic text-text-primary leading-relaxed">
                                        {data.english_translation ? `"${data.english_translation}"` : user?.is_admin ? <span className="text-accent-primary/40">No translation yet. Click EDIT to add one.</span> : null}
                                    </p>
                                )}
                            </div>
                        ) : null}

                        {renderAnalysis()}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
