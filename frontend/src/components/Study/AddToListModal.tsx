'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button, GlassCard, Portal } from '@/components/ui';

interface List {
    id: number;
    name: string;
    item_count: number;
}

interface AddToListModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    itemType: 'character' | 'line';
    itemName: string;
}

export function AddToListModal({ isOpen, onClose, itemId, itemType, itemName }: AddToListModalProps) {
    const [lists, setLists] = useState<List[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingToList, setAddingToList] = useState<number | null>(null);
    const [successId, setSuccessId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            api.get<List[]>('/api/lists')
                .then(setLists)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const addToList = async (listId: number) => {
        setAddingToList(listId);
        try {
            const result = await api.post<{ status: string }>(`/api/lists/${listId}/items`, {
                item_id: itemId,
                item_type: itemType,
            });
            if (result.status === 'added' || result.status === 'already_exists') {
                setSuccessId(listId);
                setTimeout(() => setSuccessId(null), 2000);
                if (result.status === 'added') {
                    setLists(prev => prev.map(l => l.id === listId ? { ...l, item_count: l.item_count + 1 } : l));
                }
            }
        } catch (error) {
            console.error('Failed to add item to list:', error);
        } finally {
            setAddingToList(null);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <GlassCard className="w-full max-w-md !p-6 border-accent-primary/20 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-text-secondary/40 hover:text-text-primary transition-colors text-2xl leading-none"
                >
                    &times;
                </button>

                <div className="text-center mb-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-primary mb-2">Add to Collection</div>
                    <h2 className="text-2xl font-display font-bold text-text-primary mb-3">Save Item</h2>
                    <div className="inline-block px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                        <span className="font-nom text-2xl text-text-primary">{itemName}</span>
                        <span className="ml-2 text-[10px] text-text-secondary uppercase font-black tracking-widest">{itemType}</span>
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {loading ? (
                        <div className="text-center py-8 text-text-secondary/40 italic text-sm">Loading your lists...</div>
                    ) : lists.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-text-secondary/60 italic mb-4 text-sm">No lists yet.</p>
                            <Button onClick={() => window.location.href = '/library'} variant="secondary" size="sm">
                                Go to Library to Create
                            </Button>
                        </div>
                    ) : (
                        lists.map((list) => (
                            <div
                                key={list.id}
                                className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-accent-primary/30 hover:bg-white/5 transition-all group"
                            >
                                <div>
                                    <h4 className="font-bold text-text-primary group-hover:text-accent-primary transition-colors text-sm">
                                        {list.name}
                                    </h4>
                                    <p className="text-[10px] text-text-secondary/40 font-black uppercase tracking-widest">
                                        {list.item_count} {list.item_count === 1 ? 'Item' : 'Items'}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => addToList(list.id)}
                                    disabled={addingToList !== null || successId === list.id}
                                    variant={successId === list.id ? 'secondary' : 'primary'}
                                    size="sm"
                                    className="min-w-[72px]"
                                >
                                    {addingToList === list.id ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ...
                                        </span>
                                    ) : successId === list.id ? 'Saved!' : 'Add'}
                                </Button>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 flex justify-end">
                    <Button onClick={onClose} variant="secondary" size="sm">Done</Button>
                </div>
            </GlassCard>
        </div>
        </Portal>
    );
}
