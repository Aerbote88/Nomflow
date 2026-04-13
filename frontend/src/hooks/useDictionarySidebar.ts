import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { LineDictData, CharDictData } from '@/components/Dictionary/DictionarySidebar';

type HistoryEntry = { type: 'line' | 'char'; id: number };

export function useDictionarySidebar() {
    const [sidebarView, setSidebarView] = useState<'line' | 'char'>('line');
    const [dictData, setDictData] = useState<LineDictData | null>(null);
    const [charDictData, setCharDictData] = useState<CharDictData | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [charDictLoading, setCharDictLoading] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const currentRef = useRef<HistoryEntry | null>(null);

    const fetchLine = useCallback(async (lineId: number) => {
        setSidebarView('line');
        setDictLoading(true);
        currentRef.current = { type: 'line', id: lineId };
        try {
            const resp = await apiFetch<LineDictData>(`dictionary/line/${lineId}`);
            setDictData(resp);
        } catch (err) {
            logger.error('Failed to load dictionary data:', err);
            setDictData(null);
        } finally {
            setDictLoading(false);
        }
    }, []);

    const fetchChar = useCallback(async (charId: number) => {
        setSidebarView('char');
        setCharDictLoading(true);
        currentRef.current = { type: 'char', id: charId };
        try {
            const resp = await apiFetch<CharDictData>(`dictionary/char/${charId}`);
            setCharDictData(resp);
        } catch (err) {
            logger.error('Failed to load char dictionary data:', err);
            setCharDictData(null);
        } finally {
            setCharDictLoading(false);
        }
    }, []);

    const loadLineDict = useCallback(async (lineId: number) => {
        if (currentRef.current) {
            const prev = currentRef.current;
            setHistory((h) => [...h, prev]);
        }
        await fetchLine(lineId);
    }, [fetchLine]);

    const loadCharDict = useCallback(async (charId: number) => {
        if (currentRef.current) {
            const prev = currentRef.current;
            setHistory((h) => [...h, prev]);
        }
        await fetchChar(charId);
    }, [fetchChar]);

    const goBack = useCallback(() => {
        setHistory((h) => {
            if (h.length === 0) return h;
            const last = h[h.length - 1];
            if (last.type === 'line') fetchLine(last.id);
            else fetchChar(last.id);
            return h.slice(0, -1);
        });
    }, [fetchLine, fetchChar]);

    const reset = useCallback(() => {
        setSidebarView('line');
        setDictData(null);
        setCharDictData(null);
        setDictLoading(false);
        setCharDictLoading(false);
        setHistory([]);
        currentRef.current = null;
    }, []);

    return {
        sidebarView,
        dictData,
        charDictData,
        dictLoading,
        charDictLoading,
        loadLineDict,
        loadCharDict,
        backToLine: goBack,
        goBack,
        canGoBack: history.length > 0,
        reset,
    };
}
