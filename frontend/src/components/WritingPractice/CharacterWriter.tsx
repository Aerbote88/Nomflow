'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { loadCharacter, type CharacterData } from '@/lib/strokeData';

type Props = {
    character: string;
    quocNgu?: string;
    size?: number;
    onUnavailable?: () => void;
    onSuccess?: () => void;
};

type HanziWriterInstance = {
    animateCharacter: (opts?: {
        onComplete?: (summary: { canceled: boolean }) => void;
    }) => void;
    quiz: (opts?: {
        showOutline?: boolean;
        leniency?: number;
        onComplete?: (summary: { totalMistakes: number }) => void;
    }) => void;
    cancelQuiz?: () => void;
    showOutline: () => void;
    hideOutline: () => void;
    showCharacter: () => void;
    hideCharacter: (opts?: { duration?: number; onComplete?: () => void }) => void;
    updateColor: (type: string, color: string, opts?: { duration?: number }) => void;
};

function computeResponsiveSize(max: number): number {
    if (typeof window === 'undefined') return max;
    const padding = 48;
    return Math.min(max, Math.max(220, window.innerWidth - padding));
}

export function CharacterWriter({
    character,
    quocNgu,
    size,
    onUnavailable,
    onSuccess,
}: Props) {
    const t = useTranslations('characterWriter');
    const hostRef = useRef<HTMLDivElement>(null);
    const writerRef = useRef<HanziWriterInstance | null>(null);
    const onSuccessRef = useRef(onSuccess);
    const onUnavailableRef = useRef(onUnavailable);
    onSuccessRef.current = onSuccess;
    onUnavailableRef.current = onUnavailable;

    const [resolvedSize] = useState(() => size ?? computeResponsiveSize(320));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [succeeded, setSucceeded] = useState(false);
    const [mistakes, setMistakes] = useState(0);

    const startQuiz = () => {
        const w = writerRef.current;
        if (!w) return;
        w.hideOutline();
        w.updateColor('drawingColor', '#fafafa', { duration: 0 });
        setSucceeded(false);
        setMistakes(0);
        w.quiz({
            showOutline: false,
            leniency: 1.3,
            onComplete: (summary) => {
                setMistakes(summary.totalMistakes);
                setSucceeded(true);
                onSuccessRef.current?.();
            },
        });
    };

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setUnavailable(false);
        setSucceeded(false);
        setMistakes(0);

        (async () => {
            try {
                const data = await loadCharacter(character);
                if (cancelled) return;
                if (!data) {
                    setUnavailable(true);
                    setLoading(false);
                    onUnavailableRef.current?.();
                    return;
                }
                const mod = await import('hanzi-writer');
                if (cancelled) return;
                const HanziWriter = mod.default;
                if (!hostRef.current) return;
                hostRef.current.innerHTML = '';
                writerRef.current = HanziWriter.create(hostRef.current, character, {
                    width: resolvedSize,
                    height: resolvedSize,
                    padding: 12,
                    strokeColor: '#fafafa',
                    radicalColor: '#fafafa',
                    outlineColor: '#3f3f46',
                    drawingColor: '#fafafa',
                    highlightColor: '#fafafa',
                    strokeAnimationSpeed: 1.6,
                    delayBetweenStrokes: 80,
                    showOutline: false,
                    showCharacter: false,
                    charDataLoader: (
                        _ch: string,
                        onComplete: (d: CharacterData) => void,
                    ) => onComplete(data),
                }) as unknown as HanziWriterInstance;
                const svg = hostRef.current.querySelector('svg');
                if (svg) {
                    svg.style.transform = `translateY(-${Math.round(resolvedSize * 0.05)}px)`;
                }
                setLoading(false);
                startQuiz();
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : String(err));
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            try {
                writerRef.current?.cancelQuiz?.();
            } catch {}
        };
    }, [character, resolvedSize]);

    const animate = () => {
        const w = writerRef.current;
        if (!w) return;
        w.cancelQuiz?.();
        setSucceeded(false);
        w.updateColor('drawingColor', '#fafafa', { duration: 0 });
        w.animateCharacter({
            onComplete: ({ canceled }) => {
                if (canceled) return;
                setTimeout(() => {
                    if (writerRef.current !== w) return;
                    w.hideCharacter({
                        duration: 600,
                        onComplete: () => {
                            if (writerRef.current !== w) return;
                            startQuiz();
                        },
                    });
                }, 700);
            },
        });
    };
    const peek = () => {
        const w = writerRef.current;
        if (!w) return;
        w.showOutline();
        setTimeout(() => w.hideOutline(), 900);
    };

    return (
        <div className="flex flex-col items-center gap-1 sm:gap-3">
            <div className="relative">
                <div
                    ref={hostRef}
                    className={`rounded-xl border-2 bg-white/5 transition-all duration-500 ${
                        succeeded
                            ? 'border-green-400 shadow-[0_0_40px_rgba(74,222,128,0.5)]'
                            : 'border-accent-gold/20'
                    }`}
                    style={{ width: resolvedSize, height: resolvedSize }}
                />
                {succeeded && (
                    <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-green-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg animate-in fade-in duration-300">
                        ✓ {mistakes === 0 ? t('perfect') : t('correct')}
                    </div>
                )}
            </div>
            <div className="h-7 flex items-center justify-center text-sm">
                {loading && !unavailable && (
                    <span className="text-text-secondary">{t('loading')}</span>
                )}
                {!loading && !error && !unavailable && quocNgu && (
                    <span className="text-text-primary font-serif text-base lowercase">
                        {quocNgu}
                    </span>
                )}
                {unavailable && (
                    <span className="text-text-secondary max-w-xs text-center">
                        {t('noStrokeData')} <span className="font-nom text-base">{character}</span>
                    </span>
                )}
                {error && <span className="text-red-400 max-w-xs text-center">{error}</span>}
            </div>
            <div className="flex gap-2">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={animate}
                    disabled={loading || !!error || unavailable}
                    className="!px-3 !py-1 text-xs"
                >
                    {t('animate')}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={peek}
                    disabled={loading || !!error || unavailable}
                    className="!px-3 !py-1 text-xs"
                >
                    {t('hint')}
                </Button>
            </div>
        </div>
    );
}
