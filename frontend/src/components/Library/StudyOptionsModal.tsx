'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, Button, Portal } from '@/components/ui';

interface StudyOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceType: 'text' | 'list' | null;
    sourceId: number | null;
    sourceName: string;
}

export const StudyOptionsModal: React.FC<StudyOptionsModalProps> = ({
    isOpen,
    onClose,
    sourceType,
    sourceId,
    sourceName
}) => {
    const router = useRouter();
    const [randomCount, setRandomCount] = useState(20);

    if (!isOpen) return null;

    const startStudy = (mode: string) => {
        const params = new URLSearchParams();
        params.append('mode', mode);
        if (sourceType === 'list') {
            params.append('list_id', sourceId?.toString() || '');
        } else {
            params.append('text_id', sourceId?.toString() || '');
        }

        if (mode === 'random') {
            params.append('count', randomCount.toString());
        }

        router.push(`/study?${params.toString()}`);
        onClose();
    };

    const options = [
        {
            id: 'srs',
            title: 'SRS Mastery',
            description: 'The definitive path. Review due items and learn new content using Spaced Repetition.',
            icon: '🏛️',
            action: () => startStudy('srs'),
            color: 'border-accent-primary bg-accent-primary/5 hover:bg-accent-primary/10'
        },
        {
            id: 'random',
            title: 'Incidental Practice',
            description: 'Study a random selection of items. Perfect for quick sessions without stakes.',
            icon: '✨',
            customUI: (
                <div className="mt-4 flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 pointer-events-auto">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Session Size</span>
                    <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); setRandomCount(Math.max(5, randomCount - 5)); }} className="text-accent-primary p-1 hover:scale-125 transition-transform">-</button>
                        <span className="text-sm font-black text-text-primary w-6 text-center">{randomCount}</span>
                        <button onClick={(e) => { e.stopPropagation(); setRandomCount(Math.min(100, randomCount + 5)); }} className="text-accent-primary p-1 hover:scale-125 transition-transform">+</button>
                    </div>
                </div>
            ),
            action: () => startStudy('random'),
            color: 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
        },
        {
            id: 'challenge',
            title: 'Chronicle Challenge',
            description: 'Progress through the source line-by-line. A true test of endurance and memory.',
            icon: '⚔️',
            action: () => router.push(`/challenge?${sourceType === 'list' ? 'list_id' : 'text_id'}=${sourceId}`),
            color: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
        }
    ];

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <GlassCard className="w-full max-w-[500px] relative z-10 border-accent-primary/20 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="mb-8">
                    <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] mb-1">Study Path</div>
                    <h2 className="text-3xl font-display font-bold text-text-primary leading-tight">
                        {sourceName}
                    </h2>
                    <p className="text-xs text-text-secondary italic mt-2 opacity-60">"Select your methodology of reflection."</p>
                </div>

                <div className="flex flex-col gap-4">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={opt.action}
                            className={`text-left p-5 border-2 rounded-2xl transition-all duration-300 group hover:-translate-y-1 ${opt.color}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="text-3xl filter saturate-0 group-hover:saturate-100 transition-all duration-500">
                                    {opt.icon}
                                </div>
                                <div>
                                    <div className="font-black text-text-primary uppercase tracking-widest text-xs mb-1 group-hover:text-accent-primary transition-colors">
                                        {opt.title}
                                    </div>
                                    <p className="text-[11px] text-text-secondary leading-relaxed font-medium opacity-80">
                                        {opt.description}
                                    </p>
                                    {opt.customUI}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] hover:text-text-primary transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </GlassCard>
        </div>
        </Portal>
    );
};
