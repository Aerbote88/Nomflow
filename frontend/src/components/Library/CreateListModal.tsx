'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GlassCard, Button } from '@/components/ui';

interface CreateListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateListModal: React.FC<CreateListModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError('Name is required');

        setLoading(true);
        setError(null);

        try {
            await apiFetch('lists', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });
            onSuccess();
            onClose();
            setName('');
            setDescription('');
        } catch (err: any) {
            setError(err.message || 'Failed to create list');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <GlassCard className="w-full max-w-[450px] relative z-10 border-accent-primary/20 p-8 animate-in zoom-in-95 duration-300">
                <h2 className="text-3xl font-display font-bold text-text-primary mb-2">Create New List</h2>
                <p className="text-xs text-text-secondary italic mb-8 opacity-60">"Forge a new collection for your study."</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-accent-primary uppercase tracking-[0.2em] mb-2">List Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-secondary/30 outline-none focus:border-accent-primary/50 transition-colors font-bold"
                            placeholder="e.g. Essential Buddhist Terms"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-accent-primary uppercase tracking-[0.2em] mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-secondary/30 outline-none focus:border-accent-primary/50 transition-colors font-medium text-sm"
                            placeholder="What is the purpose of this list?"
                        />
                    </div>

                    {error && <div className="text-red-500 text-xs font-bold animate-shake">{error}</div>}

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-grow py-4"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-grow py-4"
                            disabled={loading}
                        >
                            {loading ? 'Forging...' : 'Create List'}
                        </Button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};
