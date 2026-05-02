'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { WritingSession } from '@/components/WritingPractice/WritingSession';
import { useGuestOrAuthGuard } from '@/hooks/useGuestOrAuthGuard';

type SourceText = {
    id: number;
    title: string;
    author?: string;
};

export type WritingEntry = {
    character: string;
    character_quoc_ngu: string;
    line_nom: string;
    line_quoc_ngu: string;
    line_number: number;
};

type TextCharacterSequence = {
    title: string;
    entries: WritingEntry[];
};

const SESSION_CACHE_KEY = 'writing-practice:kieu-sequence';

function isKieu(t: SourceText): boolean {
    const title = t.title.toLowerCase();
    return title.includes('kiều') || title.includes('kieu');
}

function readCache(): TextCharacterSequence | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as TextCharacterSequence;
    } catch {
        return null;
    }
}

function writeCache(seq: TextCharacterSequence): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(seq));
    } catch {
        // ignore
    }
}

export default function WritingPracticePage() {
    useGuestOrAuthGuard();
    const t = useTranslations('writing');
    const [entries, setEntries] = useState<WritingEntry[] | null>(null);
    const [title, setTitle] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        import('hanzi-writer').catch(() => {});

        let cancelled = false;

        const cached = readCache();
        if (cached) {
            setEntries(cached.entries);
            setTitle(cached.title);
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            try {
                const texts = await apiFetch<SourceText[]>('texts');
                if (cancelled) return;
                const kieu = texts.find(isKieu);
                if (!kieu) {
                    setError(t('kieuMissing'));
                    return;
                }
                const seq = await apiFetch<TextCharacterSequence>(
                    `texts/${kieu.id}/characters`,
                );
                if (cancelled) return;
                setEntries(seq.entries);
                setTitle(seq.title);
                writeCache(seq);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [t]);

    if (error) {
        return <p className="text-red-400 text-center">{error}</p>;
    }
    if (entries === null) {
        return <p className="text-text-secondary text-center">{t('loading')}</p>;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <WritingSession entries={entries} title={title} />
        </div>
    );
}
