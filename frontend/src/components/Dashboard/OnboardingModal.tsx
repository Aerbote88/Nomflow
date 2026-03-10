'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface OnboardingModalProps {
    isOpen: boolean;
    curriculumId?: number;
    kieuId?: number;
    onComplete: () => void;
}

export function OnboardingModal({ isOpen, curriculumId, kieuId, onComplete }: OnboardingModalProps) {
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const selectPath = async (type: 'text', id?: number) => {
        if (!id) return;
        setSaving(true);
        try {
            const settings = await apiFetch<{ daily_new_limit: number }>('settings');
            await apiFetch('settings', {
                method: 'POST',
                body: JSON.stringify({
                    daily_new_limit: settings.daily_new_limit || 10,
                    active_text_id: id,
                    active_list_id: null,
                }),
            });
            onComplete();
        } catch (err) {
            console.error('Failed to set path:', err);
        } finally {
            setSaving(false);
        }
    };

    const paths = [
        {
            id: curriculumId,
            icon: '📜',
            title: 'Standard Nôm Curriculum',
            description: 'A structured path through the official standard curriculum. Recommended for all learners.',
            cta: 'Start Learning',
        },
        {
            id: kieuId,
            icon: '🪕',
            title: 'Truyện Kiều',
            description: 'Dive straight into the greatest masterpiece of Vietnamese literature. Learn by reading.',
            cta: 'Read the Classics',
        },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-bg-primary border border-accent-gold/30 rounded-3xl p-8 md:p-12 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="text-xs font-black text-accent-primary uppercase tracking-[0.3em] mb-3">
                    Welcome to NômFlow
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-3">
                    Choose Your Path
                </h2>
                <p className="text-text-secondary text-sm md:text-base mb-10 max-w-md mx-auto leading-relaxed">
                    How would you like to begin your learning journey?
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paths.map(path => (
                        <button
                            key={path.title}
                            onClick={() => selectPath('text', path.id)}
                            disabled={saving || !path.id}
                            className="group text-left p-6 md:p-8 border-2 border-white/10 rounded-2xl bg-white/3 hover:bg-accent-primary/5 hover:border-accent-primary/50 transition-all duration-300 hover:-translate-y-1 disabled:opacity-40"
                        >
                            <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
                                {path.icon}
                            </div>
                            <h3 className="text-lg font-display font-bold text-text-primary mb-2">{path.title}</h3>
                            <p className="text-sm text-text-secondary leading-relaxed mb-5">{path.description}</p>
                            <div className="text-accent-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                {path.cta}
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </button>
                    ))}
                </div>

                <p className="mt-8 text-[10px] text-text-secondary/40 font-black uppercase tracking-widest">
                    You can change your active source anytime in the Library.
                </p>
            </div>
        </div>
    );
}
