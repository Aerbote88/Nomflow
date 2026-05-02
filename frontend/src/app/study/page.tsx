'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { StudyHeader } from '@/components/Study/StudyHeader';
import { StudyCard } from '@/components/Study/StudyCard';
import { ReviewControls } from '@/components/Study/ReviewControls';
import { CompletionScreen } from '@/components/Study/CompletionScreen';
import { AddToListModal } from '@/components/Study/AddToListModal';
import { DictionarySidebar } from '@/components/Dictionary/DictionarySidebar';
import { DictionaryPanel } from '@/components/Dictionary/DictionaryPanel';
import { useDictionarySidebar } from '@/hooks/useDictionarySidebar';
import { useGuestOrAuthGuard } from '@/hooks/useGuestOrAuthGuard';

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
    useGuestOrAuthGuard();
    const t = useTranslations('study');
    const th = useTranslations('study.header');
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
    const [dictSidebarOpen, setDictSidebarOpen] = useState(false);
    const [modalItem, setModalItem] = useState<{ id: number; type: 'line' | 'character'; name: string } | null>(null);
    const dict = useDictionarySidebar();
    const [lastReviewedItem, setLastReviewedItem] = useState<StudyItem | null>(null);
    const [lastReviewedQuality, setLastReviewedQuality] = useState<number | null>(null);
    const isProcessingNext = useRef(false);
    const reviewedInSession = useRef<Set<string>>(new Set());
    const [reviewedVersion, setReviewedVersion] = useState(0);
    const noMoreRemaining = useRef(false);
    const activeSubmissionsRef = useRef(0);

    const mode = searchParams.get('mode') || 'srs';
    const listId = searchParams.get('list_id');
    const textId = searchParams.get('text_id');
    const customParams = searchParams.get('custom_params');
    const count = searchParams.get('count') || '5';

    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [isGuest, setIsGuest] = useState(false);

    // Purge study sessions from other users on mount
    useEffect(() => {
        const username = localStorage.getItem('username');
        const guest = localStorage.getItem('guest_mode') === 'true' && !username;
        const user = username || (guest ? 'guest' : 'anon');
        setCurrentUser(user);
        setIsGuest(guest);

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

    // Compact session-state snapshot for dev-console diagnostics. Cheap to call
    // — no allocation surprises since all fields are primitives derived from
    // already-tracked state. Only ever invoked inside logger.log() which is
    // gated on dev mode by frontend/src/lib/logger.ts.
    const sessionSnapshot = () => ({
        mode,
        textId,
        listId,
        customParams,
        queueLen: queueRef.current.length,
        currentItemId: currentItemRef.current
            ? `${currentItemRef.current.item_type}:${currentItemRef.current.content_id}`
            : null,
        reviewedCount: reviewedInSession.current.size,
        statsDue: stats.due,
        statsStudied: stats.studied,
        noMoreRemaining: noMoreRemaining.current,
    });

    const fetchItems = useCallback(async (silent = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsFetching(true);
        if (!silent) setLoading(true);

        try {
            // Guest mode: one-shot fetch from the public sample endpoint. No SRS,
            // no repeats — the frontend walks the list in order and stops.
            if (isGuest) {
                const sample = await apiFetch<StudyItem[]>('guest/study/sample');
                noMoreRemaining.current = true;
                if (sample.length === 0) {
                    setCompleted(true);
                } else {
                    setQueue(sample);
                    queueRef.current = sample;
                    setStats({ due: sample.length, studied: 0 });
                }
                return;
            }

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

            logger.log('[Study]', 'fetch:start', {
                silent,
                seenLen: sessionSeen.length,
                count: params.get('count'),
                snapshot: sessionSnapshot(),
            });

            type StudyNextDone = { status: 'done' };
            type StudyNextResponse = StudyNextDone | StudyItem | StudyItem[];
            const isDoneResponse = (d: StudyNextResponse): d is StudyNextDone =>
                !Array.isArray(d) && 'status' in d && d.status === 'done';
            const data = await apiFetch<StudyNextResponse>(`study/next?${params.toString()}`);
            if (isDoneResponse(data)) {
                logger.log('[Study]', 'fetch:result', { status: 'done', snapshot: sessionSnapshot() });
            } else {
                const items = Array.isArray(data) ? data : [data];
                const dueCount = items.filter(i => i.is_new === false).length;
                const newCount = items.filter(i => i.is_new === true).length;
                const backendTotalDue = items[0]?.session_stats?.due;
                logger.log('[Study]', 'fetch:result', {
                    returned: items.length,
                    due: dueCount,
                    new: newCount,
                    backendTotalDue,
                    statsDue: stats.due,
                    drift: backendTotalDue != null ? backendTotalDue - stats.due : null,
                });
            }

            if (isDoneResponse(data)) {
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
                    setQueue(prev => [...prev, ...uniqueNewItems]);
                    queueRef.current = [...queueRef.current, ...uniqueNewItems];
                    logger.log('[Study]', 'queue:append', {
                        added: uniqueNewItems.length,
                        queueLen: queueRef.current.length,
                    });
                    // Prevent concurrent race condition where a stale prefetch overwrites our optimistically decremented due count
                    const firstStats = uniqueNewItems[0]?.session_stats;
                    if (firstStats && activeSubmissionsRef.current === 0) {
                        setStats(prev => ({ ...prev, due: firstStats.due }));
                    }
                } else {
                    logger.log('[Study]', 'queue:append', { added: 0, queueLen: queueRef.current.length });
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
    }, [mode, listId, textId, customParams, count, isGuest]); // isFetching handled via ref to avoid recreation

    // Save session state to localStorage whenever it changes (SRS only)
    useEffect(() => {
        if (mode === 'random') return;
        if (currentUser === null) return;
        if (isGuest) return;
        if (currentItem || queue.length > 0) {
            const sessionState = {
                queue,
                currentItem,
                stats,
                reviewed: Array.from(reviewedInSession.current),
                timestamp: Date.now()
            };
            localStorage.setItem(sessionKey, JSON.stringify(sessionState));
        }
    }, [queue, currentItem, stats, sessionKey, mode, reviewedVersion]);

    // Restore session state from localStorage on mount (SRS only)
    useEffect(() => {
        // Wait until we know who the user is — otherwise we'd build a sessionKey
        // for "anon", miss the real user's saved session, and kick off a fetchItems
        // that races against the later restore (filtering all results out).
        if (currentUser === null) return;
        if (isGuest) {
            // Guests get a fresh sample deck every mount — no persistence.
            fetchItems();
            return;
        }
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
                    const restoredQueue = sessionState.queue || [];
                    const restoredCurrent = sessionState.currentItem || null;
                    setQueue(restoredQueue);
                    queueRef.current = restoredQueue;
                    setCurrentItem(restoredCurrent);
                    currentItemRef.current = restoredCurrent;
                    if (Array.isArray(sessionState.reviewed)) {
                        reviewedInSession.current = new Set(sessionState.reviewed);
                    }
                    setStats({ due: 0, studied: sessionState.stats?.studied || 0 });
                    // Fetch fresh due count — don't trust stale localStorage value
                    const statsParams = new URLSearchParams();
                    if (textId) statsParams.append('text_id', textId);
                    if (listId) statsParams.append('list_id', listId);
                    apiFetch<{ due_count: number }>(`dashboard/stats?${statsParams.toString()}`)
                        .then(data => setStats(prev => ({ ...prev, due: data.due_count })))
                        .catch(() => {});
                    logger.log('[Study] Restored session from localStorage');
                    // If the restored session is empty (e.g. user previously consumed
                    // their queue but didn't reach completion), fetch fresh items
                    // instead of leaving the page on a forever-spinner.
                    if (!restoredCurrent && restoredQueue.length === 0) {
                        fetchItems();
                    } else {
                        setLoading(false);
                    }
                    return;
                }
            } catch (err) {
                logger.error('[Study] Failed to restore session:', err);
            }
        }
        // If no valid saved session, fetch new items
        fetchItems();
    }, [sessionKey, fetchItems, mode, currentUser]);

    // Cross-tab sync: merge reviewed items written by sibling tabs into our local set
    // so the next prefetch's `seen` filter excludes anything the other tab has reviewed.
    useEffect(() => {
        if (currentUser === null || isGuest || mode === 'random') return;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== sessionKey || !e.newValue) return;
            try {
                const next = JSON.parse(e.newValue);
                if (Array.isArray(next.reviewed)) {
                    const merged = new Set(reviewedInSession.current);
                    for (const id of next.reviewed) merged.add(id);
                    reviewedInSession.current = merged;
                }
            } catch { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [sessionKey, currentUser, isGuest, mode]);


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
        logger.log('[Study]', 'queue:advance', {
            to: `${next.item_type}:${next.content_id}`,
            isNew: !!next.is_new,
            queueLen: queueRef.current.length,
        });
        
        setQueue(prev => prev.slice(1));
        queueRef.current = queueRef.current.slice(1);
        setCurrentItem(next);
        setIsFlipped(false);
        setDictSidebarOpen(false);
        dict.reset();

        // Pre-fetch if queue is low (not for random mode — we have a fixed set;
        // not for guests — the sample endpoint returns the same deck and would
        // reset the queue).
        if (mode !== 'random' && !isGuest && queueRef.current.length < 3) {
            logger.log('[Study]', 'prefetch:trigger', { queueLen: queueRef.current.length });
            fetchItems(true);
        }

        // Reset the flag after state updates are queued
        isProcessingNext.current = false;
    };

    const handlesubmitReview = (quality: number) => {
        if (!currentItem) return;

        const reviewedItem = currentItem;
        logger.log('[Study]', 'review:submit', {
            item: `${reviewedItem.item_type}:${reviewedItem.content_id}`,
            isNew: !!reviewedItem.is_new,
            isPractice: !!reviewedItem.is_practice,
            quality,
            statsDueBefore: stats.due,
        });
        setLastReviewedItem(reviewedItem);
        setLastReviewedQuality(quality);
        reviewedInSession.current.add(`${reviewedItem.item_type}:${reviewedItem.content_id}`);
        setReviewedVersion(v => v + 1);

        if (mode === 'random' && quality < 2) {
            // Re-queue wrong answer in random mode
            setQueue(prev => [...prev, reviewedItem]);
            queueRef.current = [...queueRef.current, reviewedItem];
        } else {
            setStats(prev => ({ ...prev, studied: prev.studied + 1, due: Math.max(0, prev.due - 1) }));
        }

        // Check for stale session before advancing (guests skip — no real SRS state)
        if (!isGuest && !reviewedItem.is_practice && mode !== 'random' && !reviewedItem.user_progress_id) {
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

        // Fire review in the background (skipped for guests — no persistence)
        if (!isGuest && !reviewedItem.is_practice && mode !== 'random') {
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
                    <p className="text-text-secondary font-black uppercase tracking-widest text-xs">{t('loadingItems')}</p>
                </div>
            </div>
        );
    }

    const progressText = mode === 'srs'
        ? (completed ? th('reviewComplete') : th('due', { count: stats.due }))
        : (completed ? th('practiceComplete') : th('remaining', { count: queue.length + 1 }));

    const handleNomClick = () => {
        if (!currentItem) return;
        setDictSidebarOpen(true);
        if (currentItem.item_type === 'line') {
            dict.loadLineDict(currentItem.content_id);
        } else {
            dict.loadCharDict(currentItem.content_id);
        }
    };

    const handleCloseDictSidebar = () => {
        setDictSidebarOpen(false);
        dict.reset();
    };

    return (
        <div className="flex w-full py-1 md:py-8 px-4 md:px-6 relative min-h-[calc(100vh-120px)]">
            {/* Main content area */}
            <main className="flex-grow flex flex-col items-center">
                <StudyHeader
                    mode={mode}
                    progress={progressText}
                    title={completed || (!textId && !listId) ? undefined : currentItem?.source_title}
                />

                <div className="w-full max-w-[600px] mt-4 md:mt-8">
                    {completed ? (
                        <CompletionScreen isSRS={mode === 'srs'} isGuest={isGuest} />
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
                                onNomClick={handleNomClick}
                            />

                            <ReviewControls
                                isFlipped={isFlipped}
                                onShow={() => setIsFlipped(true)}
                                onSubmit={handlesubmitReview}
                                intervals={currentItem.intervals}
                                isPractice={mode === 'random'}
                            />

                            {!isGuest && (
                                <div className="flex gap-3 mt-4 md:mt-6 w-full">
                                    <button
                                        onClick={handleUndo}
                                        disabled={!canUndo}
                                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/30 text-text-secondary hover:text-accent-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-text-secondary"
                                    >
                                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{t('undo')}</span>
                                    </button>
                                    <button
                                        onClick={() => setIsAddToListOpen(true)}
                                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/30 text-text-secondary hover:text-accent-primary transition-all"
                                    >
                                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{t('addToList')}</span>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center min-h-[300px]">
                            <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {!completed && !isGuest && (
                    <div className="mt-8 text-[10px] text-text-secondary uppercase tracking-[0.3em] font-black opacity-30">
                        {t('progressSavedAuto')}
                    </div>
                )}
                {!completed && isGuest && (
                    <div className="mt-8 text-[10px] text-text-secondary uppercase tracking-[0.3em] font-black opacity-30">
                        {t('demoMode')}
                    </div>
                )}
            </main>

            <DictionaryPanel
                variant="floating"
                floatingOffsetPx={320}
                mobileOpen={dictSidebarOpen}
                desktopOpen={dictSidebarOpen}
                onClose={handleCloseDictSidebar}
            >
                <DictionarySidebar
                    sidebarView={dict.sidebarView}
                    dictData={dict.dictData}
                    charDictData={dict.charDictData}
                    dictLoading={dict.dictLoading}
                    charDictLoading={dict.charDictLoading}
                    onViewChar={(charId) => dict.loadCharDict(charId)}
                    onViewLine={(lineId) => dict.loadLineDict(lineId)}
                    onBackToLine={dict.backToLine}
                    showBackToLine={dict.canGoBack}
                    showInlineAdd={false}
                />
            </DictionaryPanel>

            {/* Add to List Modal - supports both study card button and sidebar */}
            {currentItem && !isGuest && (
                <AddToListModal
                    isOpen={isAddToListOpen}
                    onClose={() => { setIsAddToListOpen(false); setModalItem(null); }}
                    itemId={modalItem?.id ?? currentItem.content_id}
                    itemType={modalItem?.type ?? currentItem.item_type}
                    itemName={modalItem?.name ?? currentItem.nom.replace(/<[^>]*>/g, '')}
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
