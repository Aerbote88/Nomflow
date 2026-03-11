'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Portal } from '@/components/ui';

interface OnboardingModalProps {
    isOpen: boolean;
    curriculumId?: number;
    kieuId?: number;
    onComplete: () => void;
}

export function OnboardingModal({ isOpen, curriculumId, kieuId, onComplete }: OnboardingModalProps) {
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSelection = async (id: number, type: 'curriculum' | 'text') => {
        setSaving(true);
        try {
            const settings = await apiFetch<{ daily_new_limit: number }>('settings');
            await apiFetch('settings', {
                method: 'POST',
                body: JSON.stringify({
                    daily_new_limit: settings.daily_new_limit || 10,
                    active_text_id: type === 'text' ? id : null,
                    curriculum_id: type === 'curriculum' ? id : null,
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

    return (
        <Portal>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="w-full max-w-2xl bg-bg-primary border border-accent-gold/30 rounded-3xl p-8 md:p-12 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-xs font-black text-accent-primary uppercase tracking-[0.3em] mb-3">
                        Welcome to NômFlow
                    </div>
                    <h2 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-6">
                        Ready to start your journey?
                    </h2>
                    <p className="text-text-secondary mb-12 text-lg leading-relaxed max-w-md mx-auto">
                        Pick a classic text or a curriculum and start mastering Nôm today.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => handleSelection(curriculumId || 1, 'curriculum')}
                            disabled={saving}
                            className="p-8 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/5 hover:border-accent-primary/50 transition-all group disabled:opacity-40"
                        >
                            <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">🎓</span>
                            <div className="font-black text-xs uppercase tracking-widest text-text-primary mb-2">Continue Curriculum</div>
                            <p className="text-[10px] text-text-secondary opacity-60">Follow our structured learning path</p>
                        </button>

                        <button
                            onClick={() => handleSelection(kieuId || 1, 'text')}
                            disabled={saving}
                            className="p-8 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/5 hover:border-accent-gold/50 transition-all group disabled:opacity-40"
                        >
                            <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">📜</span>
                            <div className="font-black text-xs uppercase tracking-widest text-text-primary mb-2">Study Kim Vân Kiều</div>
                            <p className="text-[10px] text-text-secondary opacity-60">Learn the masterpiece of Vietnamese literature</p>
                        </button>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={() => (window.location.href = '/library')}
                            className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] hover:text-accent-primary transition-colors"
                        >
                            Or browse the library
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
