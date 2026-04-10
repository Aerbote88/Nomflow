'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { StudyHeader } from '@/components/Study/StudyHeader';
import { StudyCard } from '@/components/Study/StudyCard';
import { ReviewControls } from '@/components/Study/ReviewControls';
import { CompletionScreen } from '@/components/Study/CompletionScreen';
import { AddToListModal } from '@/components/Study/AddToListModal';

interface StudyItem {
    user_progress_id: number;
    item_type: 'character' | 'line';
    content_id: number;
    nom: string;
    quoc_ngu: string;
    english?: string;
    context_line?: string;
    source_title?: string;
    line_number?: number;
    is_new?: boolean;
    is_practice?: boolean;
    intervals?: { [key: number]: string };
    session_stats?: { due: number };
}

function StudyContent() {
    const searchParams = useSearchParams();
    const [queue, setQueue] = useState<StudyItem[]>([]);
    const [currentItem, setCurrentItem] = useState<StudyItem | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [completed, setCompleted] = useState(false);
    const [stats, setStats] = useState({ due: 0, studied: 0 });
    const [isFetching, setIsFetching] = useState(false);
    const isFetchingRef = useRef(false);
    const [canUndo, setCanUndo] = useState(false);
    const [isAddToListOpen, setIsAddToListOpen] = useState(false);
    const [lastReviewedItem, setLastReviewedItem] = useState<StudyItem | null>(null);
    const [lastReviewedQuality, setLastReviewedQuality] = useState<number | null>(null);
    const isProcessingNext = useRef(false);
    const reviewedInSession = useRef<Set<string>>(new Set());
    const noMoreRemaining = useRef(false);
    const activeSubmissionsRef = useRef(0);

    const mode = searchParams.get('mode') || 'srs';
    const listId = searchParams.get('list_id');
    const textId = searchParams.get('text_id');
    const customParams = searchParams.get('custom_params');
    const count = searchParams.get('count') || '5';

    const [currentUser, setCurrentUser] = useState<string>('anon');

    // Purge study sessions from other users on mount
    useEffect(() => {
        const user = localStorage.getItem('username') || 'anon';
        setCurrentUser(user);
        
        const prefix = `study_session_${user}_`;
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('study_session_') && !key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        });
    }, []);

    // Generate a unique session key scoped to the current user
    const sessionKey = `study_session_${currentUser}_${mode}_${listId || 'none'}_${textId || 'none'}_${customParams || 'none'}`;

    // Use refs to track latest state for fetchItems without triggering it as a dependency
    const queueRef = useRef<StudyItem[]>([]);
    const currentItemRef = useRef<StudyItem | null>(null);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        currentItemRef.current = currentItem;
    }, [currentItem]);

    const fetchItems = useCallback(async (silent = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsFetching(true);
        if (!silent) setLoading(true);

        try {
            // Add a small coordination delay for pre-fetches to avoid 
            // slamming the server at the exact same time as a review POST
            if (silent) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const params = new URLSearchParams();
            params.append('mode', mode);
            params.append('count', mode === 'random' ? (count || '20') : count);
            if (listId) params.append('list_id', listId);
            if (textId) params.append('text_id', textId);
            if (customParams) params.append('custom_params', customParams);

            // Pass currently in-flight items + session-reviewed items to prevent repeats
            const inFlight = [currentItemRef.current, ...queueRef.current]
                .filter((item): item is StudyItem => !!item)
                .map(item => `${item.item_type}:${item.content_id}`);

            const sessionSeen = mode === 'srs'
                ? [...new Set([...reviewedInSession.current, ...inFlight])]
                : inFlight;

            if (sessionSeen.length > 0) {
                params.append('seen', sessionSeen.join(','));
            }

            logger.log(`[Study Debug] Fetching items. In-flight IDs:`, inFlight);

            const data = await apiFetch<any>(`study/next?${params.toString()}`);
            logger.log(`[Study Debug] Received data:`, data);

            if (data.status === 'done') {
                noMoreRemaining.current = true;
                if (queueRef.current.length === 0 && !currentItemRef.current) {
                    setCompleted(true);
                }
            } else {
                noMoreRemaining.current = false;
                const newItems = Array.isArray(data) ? data : [data];

                // If in random mode, we treat the first fetch as the complete session
                if (mode === 'random') {
                    noMoreRemaining.current = true;
                }

                // Client-side guard against duplicates already in queue or reviewed in this session
                const currentIds = new Set([currentItemRef.current, ...queueRef.current]
                    .filter(Boolean)
                    .map(i => `${i!.item_type}:${i!.content_id}`));
                
                // Also add reviewed items to the client-side exclusion set
                reviewedInSession.current.forEach(id => currentIds.add(id));

                const uniqueNewItems = newItems.filter(item =>
                    !currentIds.has(`${item.item_type}:${item.content_id}`)
                );

                if (uniqueNewItems.length > 0) {
                    logger.log(`[Study Debug] Appending ${uniqueNewItems.length} unique items to queue`);
                    setQueue(prev => [...prev, ...uniqueNewItems]);
                    queueRef.current = [...queueRef.current, ...uniqueNewItems];
                    // Prevent concurrent race condition where a stale prefetch overwrites our optimistically decremented due count
                    if (uniqueNewItems[0]?.session_stats && activeSubmissionsRef.current === 0) {
                        setStats(prev => ({ ...prev, due: uniqueNewItems[0].session_stats.due }));
                    }
                } else {
                    logger.log(`[Study Debug] No new unique items to add`);
                }
            }
        } catch (err) {
            logger.error('Fetch study items failed:', err);
            // If it's the initial load and it fails, it might be an empty source 
            // or a backend error. Default to completion screen as requested.
            if (queueRef.current.length === 0 && !currentItemRef.current) {
                setCompleted(true);
            }
        } finally {
            isFetchingRef.current = false;
            setIsFetching(false);
            setLoading(false);
        }
    }, [mode, listId, textId, customParams, count]); // isFetching handled via ref to avoid recreation

    // Save session state to localStorage whenever it changes (SRS only)
    useEffect(() => {
        if (mode === 'random') return;
        if (currentItem || queue.length > 0 || reviewedInSession.current.size > 0) {
            const sessionState = {
                queue,
                currentItem,
                stats,
                reviewedIds: Array.from(reviewedInSession.current),
                timestamp: Date.now()
            };
            localStorage.setItem(sessionKey, JSON.stringify(sessionState));
        }
    }, [queue, currentItem, stats, sessionKey, mode]);

    // Restore session state from localStorage on mount (SRS only)
    useEffect(() => {
        if (mode === 'random') {
            localStorage.removeItem(sessionKey); // clear any stale random session
            fetchItems();
            return;
        }
        const savedSession = localStorage.getItem(sessionKey);
        if (savedSession) {
            try {
                const sessionState = JSON.parse(savedSession);
                // Only restore if session is less than 1 hour old
                const oneHour = 60 * 60 * 1000;
                if (Date.now() - sessionState.timestamp < oneHour) {
                    setQueue(sessionState.queue || []);
                    queueRef.current = sessionState.queue || [];
                    setCurrentItem(sessionState.currentItem || null);
                    currentItemRef.current = sessionState.currentItem || null;
                    if (sessionState.reviewedIds) {
                        reviewedInSession.current = new Set(sessionState.reviewedIds);
                    }
                    setStats({ due: 0, studied: sessionState.stats?.studied || 0 });
                    setLoading(false);
                    // Fetch fresh due count — don't trust stale localStorage value
                    const statsParams = new URLSearchParams();
                    if (textId) statsParams.append('text_id', textId);
                    if (listId) statsParams.append('list_id', listId);
                    apiFetch<{ due_count: number }>(`dashboard/stats?${statsParams.toString()}`)
                        .then(data => setStats(prev => ({ ...prev, due: data.due_count })))
                        .catch(() => {});
                    logger.log('[Study] Restored session from localStorage');
                    return;
                }
            } catch (err) {
                logger.error('[Study] Failed to restore session:', err);
            }
        }
        // If no valid saved session, fetch new items
        fetchItems();
    }, [sessionKey, fetchItems, mode]);


    useEffect(() => {
        if (!loading && !currentItem && queue.length > 0) {
            nextItem();
        }
    }, [loading, currentItem]);

    const nextItem = () => {
        if (isProcessingNext.current) {
            logger.log('[Study] Skipping nextItem - already processing');
            return;
        }

        isProcessingNext.current = true;

        if (queueRef.current.length === 0) {
            // Clear session and currentItem so completion check can trigger.
            // Eagerly clear the ref so fetchItems sees null immediately (setState is async).
            if (noMoreRemaining.current) {
                localStorage.removeItem(sessionKey);
                currentItemRef.current = null;
                setCurrentItem(null);
                setCompleted(true);
            } else {
                fetchItems();
            }
            isProcessingNext.current = false;
            return;
        }
        const next = queueRef.current[0];
        logger.log(`[Study Debug] Advancing to next item:`, `${next.item_type}:${next.content_id}`);
        
        setQueue(prev => prev.slice(1));
        queueRef.current = queueRef.current.slice(1);
        setCurrentItem(next);
        setIsFlipped(false);

        // Pre-fetch if queue is low (not for random mode — we have a fixed set)
        if (mode !== 'random' && queueRef.current.length < 3) {
            logger.log(`[Study Debug] Queue low (${queueRef.current.length} remaining), pre-fetching...`);
            fetchItems(true);
        }

        // Reset the flag after state updates are queued
        isProcessingNext.current = false;
    };

    const handlesubmitReview = (quality: number) => {
        if (!currentItem) return;

        const reviewedItem = currentItem;
        setLastReviewedItem(reviewedItem);
        setLastReviewedQuality(quality);
        reviewedInSession.current.add(`${reviewedItem.item_type}:${reviewedItem.content_id}`);
        
        if (mode === 'random' && quality < 2) {
            // Re-queue wrong answer in random mode
            setQueue(prev => [...prev, reviewedItem]);
            queueRef.current = [...queueRef.current, reviewedItem];
        } else {
            setStats(prev => ({ ...prev, studied: prev.studied + 1, due: Math.max(0, prev.due - 1) }));
        }

        // Check for stale session before advancing
        if (!reviewedItem.is_practice && mode !== 'random' && !reviewedItem.user_progress_id) {
            logger.warn('[Study] Stale session - clearing and restarting');
            localStorage.removeItem(sessionKey);
            setQueue([]);
            queueRef.current = [];
            setCurrentItem(null);
            fetchItems();
            return;
        }

        // Advance immediately — don't wait for the API
        nextItem();

        // Fire review in the background
        if (!reviewedItem.is_practice && mode !== 'random') {
            activeSubmissionsRef.current++;
            apiFetch('study/review', {
                method: 'POST',
                body: JSON.stringify({
                    item_id: reviewedItem.user_progress_id,
                    quality,
                }),
            }).then(() => {
                setCanUndo(true);
            }).catch(err => {
                logger.error('Review failed:', err);
                if (err instanceof Error && err.message === 'Item not found') {
                    logger.warn('[Study] Stale session detected - clearing and restarting');
                    localStorage.removeItem(sessionKey);
                    setQueue([]);
                    setCurrentItem(null);
                    fetchItems();
                }
            }).finally(() => {
                activeSubmissionsRef.current--;
            });
        }
    };

    const handleUndo = () => {
        if (!lastReviewedItem) return;

        // Optimistic UI update — restore immediately
        const itemToRestore = lastReviewedItem;
        const qualityToRestore = lastReviewedQuality;
        setCurrentItem(itemToRestore);
        setIsFlipped(false);
        setCanUndo(false);
        setLastReviewedItem(null);
        setStats(prev => ({
            ...prev,
            studied: Math.max(0, prev.studied - 1),
            due: qualityToRestore !== null && qualityToRestore > 0 ? prev.due + 1 : prev.due
        }));

        // Sync with backend in the background
        apiFetch('study/undo', { method: 'POST' }).catch(err => {
            logger.error('Undo failed:', err);
        });
    };

    if (loading && queue.length === 0 && !completed) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin mb-4" />
                    <p className="text-text-secondary font-black uppercase tracking-widest text-xs">Loading study items...</p>
                </div>
            </div>
        );
    }

    const progressText = mode === 'srs'
        ? (completed ? "Review session complete" : `Due: ${stats.due}`)
        : (completed ? "Practice session complete" : `Remaining: ${queue.length + 1}`);

    return (
        <div className="flex flex-col items-center py-1 md:py-8">
            <StudyHeader
                mode={mode}
                progress={progressText}
                title={completed ? undefined : currentItem?.source_title}
            />

            <div className="w-full max-w-[600px] mt-4 md:mt-8">
                {completed ? (
                    <CompletionScreen isSRS={mode === 'srs'} />
                ) : currentItem ? (
                    <>
                        <StudyCard
                            nom={currentItem.nom}
                            contextLine={currentItem.context_line}
                            quocNgu={currentItem.quoc_ngu}
                            english={currentItem.english}
                            sourceTitle={currentItem.source_title}
                            lineNumber={currentItem.line_number}
                            itemType={currentItem.item_type}
                            isFlipped={isFlipped}
                            contentId={currentItem.content_id}
                        />

                        <ReviewControls
                            isFlipped={isFlipped}
                            onShow={() => setIsFlipped(true)}
                            onSubmit={handlesubmitReview}
                            intervals={currentItem.intervals}
                            isPractice={mode === 'random'}
                        />

                        <div className="flex gap-3 mt-4 md:mt-6 w-full">
                            <button
                                onClick={handleUndo}
                                disabled={!canUndo}
                                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/30 text-text-secondary hover:text-accent-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-text-secondary"
                            >
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">↶ Undo</span>
                            </button>
                            <button
                                onClick={() => setIsAddToListOpen(true)}
                                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/30 text-text-secondary hover:text-accent-primary transition-all"
                            >
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">+ Add to List</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {!completed && (
                <div className="mt-8 text-[10px] text-text-secondary uppercase tracking-[0.3em] font-black opacity-30">
                    Your Progress is Automatically Saved
                </div>
            )}

            {currentItem && (
                <AddToListModal
                    isOpen={isAddToListOpen}
                    onClose={() => setIsAddToListOpen(false)}
                    itemId={currentItem.content_id}
                    itemType={currentItem.item_type}
                    itemName={currentItem.nom.replace(/<[^>]*>/g, '')}
                />
            )}
        </div>
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-16 h-16 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin mb-4" />
            </div>
        }>
            <StudyContent />
        </Suspense>
    );
}
