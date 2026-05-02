'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';

interface ChallengeItem {
    id: number;
    nom: string;
    quoc_ngu: string;
}

type ChallengeMode = 'normal' | 'sudden_death' | 'practice';
type GamePhase = 'loading' | 'mode_select' | 'line_select' | 'resume_prompt' | 'playing' | 'game_over';

function cleanText(text: string): string {
    if (!text) return '';
    const toneMap: Record<string, string> = {
        'oà': 'òa', 'oá': 'óa', 'oả': 'ỏa', 'oã': 'õa', 'oạ': 'ọa',
        'oè': 'òe', 'oé': 'óe', 'oẻ': 'ỏe', 'oẽ': 'õe', 'oẹ': 'ọe',
        'uỳ': 'ùy', 'uý': 'úy', 'uỷ': 'ủy', 'uỹ': 'ũy', 'uỵ': 'ụy',
    };
    let cleaned = text.normalize('NFC').toLowerCase();
    for (const [old, next] of Object.entries(toneMap)) {
        cleaned = cleaned.replace(new RegExp(old, 'g'), next);
    }
    return cleaned.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function ChallengePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const t = useTranslations('challenge');
    const tc = useTranslations('common');

    const textId = searchParams.get('text_id') || 'all';
    const listId = searchParams.get('list_id') || '';

    const [lines, setLines] = useState<ChallengeItem[]>([]);
    const [phase, setPhase] = useState<GamePhase>('loading');
    const [mode, setMode] = useState<ChallengeMode>('sudden_death');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
    const [gameOverWin, setGameOverWin] = useState(false);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [wrongAnswer, setWrongAnswer] = useState('');
    const [practiceStart, setPracticeStart] = useState('1');
    const [savedIndex, setSavedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const isDataLoaded = useRef(false);

    useEffect(() => {
        const load = async () => {
            try {
                const url = listId
                    ? `challenge/list/${listId}`
                    : `challenge/text/${textId}`;
                const data = await apiFetch<ChallengeItem[]>(url);
                setLines(data);
                isDataLoaded.current = true;
                setPhase('mode_select');
            } catch (err) {
                logger.error('Failed to load challenge content:', err);
            }
        };
        load();
    }, [textId, listId]);

    useEffect(() => {
        if (phase === 'playing') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [phase, currentIndex]);

    const checkForSavedSession = async (selectedMode: ChallengeMode) => {
        setMode(selectedMode);
        try {
            const params = new URLSearchParams({ mode: selectedMode });
            if (listId) params.set('list_id', listId);
            else params.set('text_id', textId);
            const session = await apiFetch<{ status: string; current_index?: number }>(`challenge/session?${params}`);
            if (session.status === 'found' && session.current_index !== undefined) {
                setSavedIndex(session.current_index);
                setPhase('resume_prompt');
            } else {
                if (selectedMode === 'practice') {
                    setPhase('line_select');
                } else {
                    startGame(0, selectedMode);
                }
            }
        } catch {
            if (selectedMode === 'practice') setPhase('line_select');
            else startGame(0, selectedMode);
        }
    };

    const startGame = (startIdx: number, gameMode?: ChallengeMode) => {
        setCurrentIndex(startIdx);
        setScore(startIdx);
        setUserAnswer('');
        setFeedback(null);
        setPhase('playing');
    };

    const resumeGame = () => {
        startGame(savedIndex, mode);
    };

    const restartGame = async () => {
        const params = new URLSearchParams({ mode });
        if (listId) params.set('list_id', listId);
        else params.set('text_id', textId);
        await apiFetch(`challenge/session?${params}`, { method: 'DELETE' }).catch(() => {});
        if (mode === 'practice') setPhase('line_select');
        else startGame(0, mode);
    };

    const confirmPracticeStart = () => {
        const n = parseInt(practiceStart);
        if (isNaN(n) || n < 1 || n > lines.length) return;
        startGame(n - 1, 'practice');
    };

    const submitAnswer = async () => {
        if (!userAnswer.trim() || !lines[currentIndex]) return;
        const userClean = cleanText(userAnswer);
        const correctClean = cleanText(lines[currentIndex].quoc_ngu);

        if (userClean === correctClean) {
            apiFetch('challenge/correct', { method: 'POST' }).catch(() => {});
            apiFetch('challenge/pause', {
                method: 'POST',
                body: JSON.stringify({
                    text_id: listId ? null : (textId === 'all' ? 0 : parseInt(textId)),
                    list_id: listId ? parseInt(listId) : null,
                    current_index: currentIndex + 1,
                    mode,
                }),
            }).catch(() => {});

            const nextIdx = currentIndex + 1;
            setScore(nextIdx);
            setFeedback({ text: t('correct'), correct: true });

            setTimeout(() => {
                setFeedback(null);
                setUserAnswer('');
                if (nextIdx >= lines.length) {
                    endGame(true);
                } else {
                    setCurrentIndex(nextIdx);
                }
            }, 700);
        } else {
            if (mode === 'sudden_death') {
                setCorrectAnswer(lines[currentIndex].quoc_ngu);
                setWrongAnswer(userAnswer);
                endGame(false);
            } else {
                setFeedback({ text: t('incorrect', { answer: lines[currentIndex].quoc_ngu }), correct: false });
            }
        }
    };

    const retryLine = () => {
        setFeedback(null);
        setUserAnswer('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const endGame = async (win: boolean) => {
        setGameOverWin(win);
        setPhase('game_over');
        await apiFetch('challenge/score', {
            method: 'POST',
            body: JSON.stringify({
                text_id: listId ? null : parseInt(textId),
                list_id: listId ? parseInt(listId) : null,
                score: currentIndex,
                mode,
            }),
        }).catch(() => {});
    };

    const pauseAndExit = async () => {
        await apiFetch('challenge/pause', {
            method: 'POST',
            body: JSON.stringify({
                text_id: listId ? null : (textId === 'all' ? 0 : parseInt(textId)),
                list_id: listId ? parseInt(listId) : null,
                current_index: currentIndex,
                mode,
            }),
        }).catch(() => {});
        router.push('/dashboard');
    };

    const modeLabel = mode === 'normal' ? t('modeNormal') : mode === 'practice' ? t('modePractice') : t('modeSuddenDeath');
    const modeColor = mode === 'normal' ? 'text-amber-600' : mode === 'practice' ? 'text-blue-500' : 'text-red-500';
    const currentLine = lines[currentIndex];

    if (phase === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin mb-4" />
                <p className="text-text-secondary font-black uppercase tracking-widest text-xs">{t('loading')}</p>
            </div>
        );
    }

    if (phase === 'mode_select') {
        return (
            <div className="flex items-center justify-center min-h-[70vh] px-4">
                <GlassCard className="w-full max-w-md p-6 md:p-10 border-accent-primary/20 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-center mb-6 md:mb-8">
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.4em] mb-2">{t('kicker')}</div>
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary">{t('choosePath')}</h2>
                        <p className="text-[10px] md:text-xs text-text-secondary mt-2 opacity-60">{t('linesLoaded', { count: lines.length })}</p>
                    </div>

                    <div className="flex flex-col gap-2 md:gap-3">
                        <button
                            onClick={() => checkForSavedSession('normal')}
                            className="text-left p-4 md:p-5 border-2 border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-2xl transition-all group"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-text-primary uppercase tracking-widest text-[10px] md:text-xs group-hover:text-amber-600 transition-colors">{t('normal')}</span>
                                <span className="px-2 py-0.5 bg-amber-100/20 text-amber-600 text-[8px] md:text-[9px] rounded font-black uppercase">{t('normalBadge')}</span>
                            </div>
                            <p className="text-[10px] md:text-[11px] text-text-secondary opacity-70">{t('normalDesc')}</p>
                        </button>

                        <button
                            onClick={() => checkForSavedSession('sudden_death')}
                            className="text-left p-4 md:p-5 border-2 border-white/10 hover:border-red-500/50 hover:bg-red-500/5 rounded-2xl transition-all group"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-text-primary uppercase tracking-widest text-[10px] md:text-xs group-hover:text-red-500 transition-colors">{t('suddenDeath')}</span>
                                <span className="px-2 py-0.5 bg-red-100/20 text-red-500 text-[8px] md:text-[9px] rounded font-black uppercase">{t('suddenDeathBadge')}</span>
                            </div>
                            <p className="text-[10px] md:text-[11px] text-text-secondary opacity-70">{t('suddenDeathDesc')}</p>
                        </button>

                        <button
                            onClick={() => checkForSavedSession('practice')}
                            className="text-left p-4 md:p-5 border-2 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl transition-all group"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-text-primary uppercase tracking-widest text-[10px] md:text-xs group-hover:text-blue-500 transition-colors">{t('practice')}</span>
                                <span className="px-2 py-0.5 bg-blue-100/20 text-blue-500 text-[8px] md:text-[9px] rounded font-black uppercase">{t('practiceBadge')}</span>
                            </div>
                            <p className="text-[10px] md:text-[11px] text-text-secondary opacity-70">{t('practiceDesc')}</p>
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <Link href="/dashboard" className="text-[10px] font-black text-text-secondary/50 uppercase tracking-widest hover:text-text-secondary transition-colors">
                            {t('returnToDashboard')}
                        </Link>
                    </div>
                </GlassCard>
            </div>
        );
    }

    if (phase === 'line_select') {
        return (
            <div className="flex items-center justify-center min-h-[70vh] px-4">
                <GlassCard className="w-full max-w-md p-6 md:p-10 border-blue-500/30 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-center mb-6 md:mb-8">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-2">{t('selectStartLine')}</h2>
                        <p className="text-[10px] md:text-xs text-text-secondary opacity-60">{t('lineRange', { max: lines.length })}</p>
                    </div>
                    <input
                        type="number"
                        value={practiceStart}
                        onChange={(e) => setPracticeStart(e.target.value)}
                        min={1}
                        max={lines.length}
                        className="w-full bg-white/5 border-b-2 border-blue-500/30 focus:border-blue-500 text-center text-4xl md:text-5xl font-display font-bold py-3 md:py-4 outline-none transition text-text-primary mb-6 md:mb-8"
                    />
                    <div className="flex flex-col gap-3">
                        <Button className="w-full py-4 bg-blue-600 hover:bg-blue-500" onClick={confirmPracticeStart}>
                            {t('beginPractice')}
                        </Button>
                        <button
                            onClick={() => setPhase('mode_select')}
                            className="text-[10px] font-black text-text-secondary/50 uppercase tracking-widest hover:text-text-secondary transition-colors"
                        >
                            {tc('goBack')}
                        </button>
                    </div>
                </GlassCard>
            </div>
        );
    }

    if (phase === 'resume_prompt') {
        return (
            <div className="flex items-center justify-center min-h-[70vh] px-4">
                <GlassCard className="w-full max-w-md p-6 md:p-10 border-accent-primary/30 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-center mb-6 md:mb-8">
                        <div className="text-3xl md:text-4xl mb-3 md:mb-4">📜</div>
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-3 md:mb-4">{t('savedFound')}</h2>
                        <p className="text-sm md:text-base text-text-secondary leading-relaxed">
                            {t.rich('savedBody', {
                                lineNum: savedIndex + 1,
                                modeName: modeLabel,
                                line: (chunks) => <span className="font-black text-accent-primary">{chunks}</span>,
                                mode: (chunks) => <span className="font-black text-text-primary">{chunks}</span>,
                            })}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-3">
                        <Button className="w-full py-3 md:py-4 text-xs md:text-sm font-black uppercase tracking-widest" onClick={resumeGame}>
                            {t('resume')}
                        </Button>
                        <button
                            onClick={restartGame}
                            className="text-[10px] font-black text-red-500/50 uppercase tracking-widest hover:text-red-500 transition-colors"
                        >
                            {t('startOver')}
                        </button>
                    </div>
                </GlassCard>
            </div>
        );
    }

    if (phase === 'game_over') {
        return (
            <div className="flex items-center justify-center min-h-[70vh] px-4">
                <GlassCard className="w-full max-w-md p-6 md:p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-4xl md:text-5xl mb-4 md:mb-6">{gameOverWin ? '🏆' : '💀'}</div>
                    <h2 className={`text-3xl md:text-4xl font-display font-bold mb-3 md:mb-4 ${gameOverWin ? 'text-emerald-500' : 'text-red-500'}`}>
                        {gameOverWin ? t('textComplete') : t('gameOver')}
                    </h2>
                    <p className="text-xs md:text-base text-text-secondary mb-1 md:mb-2">
                        {mode === 'practice' ? t('youReached') : t('youMadeIt')}
                    </p>
                    <p className="text-5xl md:text-6xl font-black text-accent-primary mb-6 md:mb-8">{score}</p>

                    {!gameOverWin && mode === 'sudden_death' && (
                        <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">{t('correctAnswer')}</p>
                            <p className="font-serif italic text-text-primary text-lg">{correctAnswer}</p>
                            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mt-3 mb-1">{t('yourAnswer')}</p>
                            <p className="font-serif text-red-500 line-through">{wrongAnswer || t('blank')}</p>
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        <Button variant="secondary" onClick={() => setPhase('mode_select')}>
                            {t('tryAgain')}
                        </Button>
                        <Button onClick={() => router.push(`/leaderboard?source=${listId ? 'list' : textId}`)}>
                            {t('leaderboard')}
                        </Button>
                    </div>
                </GlassCard>
            </div>
        );
    }

    if (!currentLine) return null;

    return (
        <div className="flex flex-col items-center py-2 md:py-8 max-w-2xl mx-auto px-4 animate-in fade-in duration-300">
            <div className="w-full flex justify-between items-center mb-4 md:mb-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={pauseAndExit}
                        className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-text-secondary/50 uppercase tracking-widest hover:text-text-secondary transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('pause')}
                    </button>
                    <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest ${modeColor} bg-current/10`}
                        style={{ backgroundColor: 'transparent' }}>
                        <span className={modeColor}>{modeLabel}</span>
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-[9px] md:text-[10px] text-text-secondary uppercase tracking-widest font-black">
                        {mode === 'normal' ? t('progress') : mode === 'practice' ? t('line') : t('streak')}
                    </p>
                    <p className="text-3xl md:text-4xl font-black text-accent-primary leading-none">
                        {mode === 'practice' ? currentIndex + 1 : score}
                    </p>
                </div>
            </div>

            <GlassCard className="w-full text-center py-8 md:py-12 px-6 md:px-8 mb-4 md:mb-6 shadow-2xl">
                <p className="text-[9px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4 md:mb-6">
                    {t('lineCount', { current: currentIndex + 1, total: lines.length })}
                </p>

                <div className="font-nom text-5xl md:text-7xl text-text-primary leading-none mb-6 md:mb-8">
                    {currentLine.nom}
                </div>

                {currentLine.nom.length === 1 && (
                    <div className="flex gap-4 md:gap-6 justify-center mb-6 md:mb-8">
                        <a
                            href={`https://zi.tools/zi/${encodeURIComponent(currentLine.nom)}`}
                            target="_blank"
                            className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary/40 hover:text-accent-primary transition-colors flex items-center gap-1 md:gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            zi.tools
                        </a>
                        <a
                            href={`https://www.digitizingvietnam.com/en/tools/han-nom-dictionaries/general?q=${encodeURIComponent(currentLine.quoc_ngu)}`}
                            target="_blank"
                            className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary/40 hover:text-accent-primary transition-colors flex items-center gap-1 md:gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Hán-Nôm
                        </a>
                    </div>
                )}

                <div className="w-full max-w-md mx-auto mb-4">
                    <input
                        ref={inputRef}
                        type="text"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (feedback && !feedback.correct) retryLine();
                                else submitAnswer();
                            }
                        }}
                        disabled={!!feedback}
                        placeholder={t('typeReading')}
                        className="w-full bg-white/5 border-b-2 border-white/20 focus:border-accent-primary text-center text-xl md:text-2xl text-text-primary py-3 px-4 outline-none transition-colors placeholder:text-text-secondary/30 font-serif"
                        autoComplete="off"
                    />
                </div>

                <div className={`min-h-8 mb-4 text-lg font-black transition-all duration-200 ${feedback ? 'opacity-100' : 'opacity-0'}`}>
                    {feedback && (
                        <span className={feedback.correct ? 'text-emerald-500' : 'text-red-500'}>
                            {feedback.text}
                        </span>
                    )}
                </div>

                {feedback && !feedback.correct ? (
                    <Button onClick={retryLine} variant="secondary" className="px-8 md:px-10 py-3 md:py-4 text-xs md:text-sm font-black uppercase tracking-widest">
                        {t('tryAgain')}
                    </Button>
                ) : (
                    <Button
                        onClick={submitAnswer}
                        disabled={!userAnswer.trim() || !!feedback}
                        className="px-8 md:px-10 py-3 md:py-4 text-xs md:text-sm shadow-lg shadow-accent-primary/20 font-black uppercase tracking-widest"
                    >
                        {t('submitAnswer')}
                    </Button>
                )}
            </GlassCard>

            <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-[0.3em]">
                {t('autoSave')}
            </p>
        </div>
    );
}

export default function ChallengePageWrapper() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        }>
            <ChallengePage />
        </Suspense>
    );
}
