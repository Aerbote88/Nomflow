'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GlassCard, Button, Portal } from '@/components/ui';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackType = 'bug' | 'suggestion' | 'other';

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const [type, setType] = useState<FeedbackType>('bug');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!message.trim()) return;
        setStatus('submitting');
        try {
            await apiFetch('feedback', {
                method: 'POST',
                body: JSON.stringify({ type, message }),
            });
            setStatus('done');
            setMessage('');
        } catch {
            setStatus('error');
        }
    };

    const handleClose = () => {
        setStatus('idle');
        setMessage('');
        onClose();
    };

    const types: { value: FeedbackType; label: string; icon: string }[] = [
        { value: 'bug', label: 'Bug Report', icon: '🐛' },
        { value: 'suggestion', label: 'Suggestion', icon: '💡' },
        { value: 'other', label: 'Other', icon: '💬' },
    ];

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleClose} />

                <GlassCard className="w-full max-w-md relative z-10 !p-0 border-accent-primary/20 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="px-8 pt-8 pb-6 border-b border-white/5">
                        <button onClick={handleClose} className="absolute top-5 right-5 text-text-secondary/40 hover:text-text-primary transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-1">Feedback</div>
                        <h2 className="text-2xl font-display font-bold text-text-primary">Send Feedback</h2>
                        <p className="text-xs text-text-secondary mt-1">Help me improve NômFlow</p>
                    </div>

                    {status === 'done' ? (
                        <div className="px-8 py-12 text-center">
                            <div className="text-4xl mb-4">🙏</div>
                            <p className="text-text-primary font-bold mb-1">Thank you!</p>
                            <p className="text-text-secondary text-sm">Your feedback has been received.</p>
                            <Button className="mt-8 w-full" onClick={handleClose}>Close</Button>
                        </div>
                    ) : (
                        <div className="px-8 py-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-[0.3em] text-text-secondary/70 mb-3">Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {types.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setType(t.value)}
                                            className={`py-3 px-2 rounded-xl border transition-all text-center ${
                                                type === t.value
                                                    ? 'bg-accent-primary/10 border-accent-primary/50 text-accent-primary'
                                                    : 'bg-white/3 border-white/5 text-text-secondary hover:border-white/20 hover:text-text-primary'
                                            }`}
                                        >
                                            <div className="text-lg mb-1">{t.icon}</div>
                                            <div className="font-black text-[10px] uppercase tracking-widest">{t.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-[0.3em] text-text-secondary/70 mb-3">Message</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Describe the issue or share your thoughts..."
                                    rows={5}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm outline-none focus:border-accent-primary/50 resize-none placeholder:text-text-secondary/30"
                                />
                            </div>

                            {status === 'error' && (
                                <p className="text-red-400 text-xs font-bold uppercase tracking-widest text-center">Something went wrong. Please try again.</p>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button variant="ghost" className="flex-1" onClick={handleClose}>Cancel</Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSubmit}
                                    disabled={!message.trim() || status === 'submitting'}
                                >
                                    {status === 'submitting' ? 'Sending...' : 'Send Feedback'}
                                </Button>
                            </div>
                        </div>
                    )}
                </GlassCard>
            </div>
        </Portal>
    );
}
