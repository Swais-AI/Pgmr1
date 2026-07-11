// Shared multilingual utilities:
//   SPEECH_LANG_MAP  – BCP-47 codes for supported languages
//   translateCached  – translate with module-level in-memory cache
//   translateBatch   – batch translation helper
//   useSpeechInput   – browser speech-to-text hook (webkitSpeechRecognition)
//   useTTS           – AI text-to-speech hook (Google TTS via /parent/speak endpoint)
//   useTranslation   – convenience hook: manages translated-text state + loading flag

import { useState, useRef, useCallback, useEffect } from 'react';
import { translateText } from './api';
import { speakWithAI } from './aiService';

// ── Language codes ────────────────────────────────────────────────────────

export const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  or: 'or-IN',
};

// ── Translation cache (module-level, shared across all components) ────────

const _cache = new Map<string, string>();

export async function translateCached(text: string, lang: string): Promise<string> {
  if (!text || !text.trim() || lang === 'en') return text;
  const key = `${lang}\x00${text}`;
  if (_cache.has(key)) return _cache.get(key)!;
  try {
    const result = await translateText(text, lang);
    const translated = result?.translated_text || text;
    _cache.set(key, translated);
    return translated;
  } catch {
    return text; // graceful fallback — original text if API fails
  }
}

export async function translateBatch(texts: string[], lang: string): Promise<string[]> {
  if (lang === 'en') return texts;
  return Promise.all(texts.map(t => translateCached(t, lang)));
}

// ── useTranslation — single-source-of-truth translation hook ─────────────
// Manages a translated string array that stays in sync with `texts` and
// `language`. Resets to raw text immediately on any change to prevent stale
// translated content from a previous language appearing on screen.
//
// Returns { displayed, translating }
//   displayed  – array of currently shown strings (raw until translation arrives)
//   translating – true while an async batch translation is in flight

export function useTranslation(texts: string[], language: string) {
  const [displayed,   setDisplayed]   = useState<string[]>(texts);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    // Immediately show raw text so stale translations never linger
    setDisplayed(texts);

    if (language === 'en' || texts.length === 0) {
      setTranslating(false);
      return;
    }

    setTranslating(true);
    let live = true;

    translateBatch(texts, language)
      .then(results => {
        if (live) {
          setDisplayed(results);
          setTranslating(false);
        }
      })
      .catch(() => {
        // On error keep raw originals; already set above
        if (live) setTranslating(false);
      });

    return () => { live = false; };
    // texts identity changes when the source array ref changes — that's
    // intentional: callers should memoize if they want deduplication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.join('\x00'), language]);

  return { displayed, translating };
}

// ── useTranslatedText — single-string translation, no English flash ───────
// Wraps translateCached for one piece of text (e.g. AI insight response).
// Holds `displayed` as null while the translation is in-flight so callers
// can keep a loading state rather than briefly showing raw English.
//
// Two-cache model:
//   AI cache (aiService.ts)        — stores original English AI response
//   Translation cache (translateCached) — keyed by lang + text
// Changing language never regenerates AI; only the translate endpoint is called.
// Stale-request protection: `cancelled` flag set by effect cleanup discards
// results from previous language or text changes.

export function useTranslatedText(
  text: string | null,
  language: string,
): { displayed: string | null; translating: boolean } {
  const [displayed,   setDisplayed]   = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (text === null) {
      setDisplayed(null);
      setTranslating(false);
      return;
    }
    if (language === 'en') {
      setDisplayed(text);
      setTranslating(false);
      return;
    }
    let cancelled = false;
    setDisplayed(null);   // hold until translated — prevents English flash
    setTranslating(true);
    translateCached(text, language)
      .then(result => {
        if (cancelled) return;
        setDisplayed(result);
        setTranslating(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDisplayed(text); // fallback to English if translation fails
        setTranslating(false);
      });
    return () => { cancelled = true; };
  }, [text, language]);

  return { displayed, translating };
}

// ── Speech-to-text hook ───────────────────────────────────────────────────
// Uses webkitSpeechRecognition (Chrome/Edge) with SpeechRecognition fallback.
// `activeField` holds the key of the currently listening field (or null).

export function useSpeechInput(language: string) {
  const [activeField, setActiveField] = useState<string | null>(null);

  const startFor = useCallback(
    (fieldKey: string, onResult: (text: string) => void) => {
      const SR =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      if (!SR) {
        alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
        return;
      }
      const rec = new SR();
      rec.lang = SPEECH_LANG_MAP[language] ?? 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        onResult(e.results[0][0].transcript);
        setActiveField(null);
      };
      rec.onerror = () => setActiveField(null);
      rec.onend   = () => setActiveField(null);
      rec.start();
      setActiveField(fieldKey);
    },
    [language],
  );

  return { activeField, startFor };
}

// ── Text-to-speech hook ───────────────────────────────────────────────────
// Uses the AI /parent/speak endpoint (Google Cloud TTS) instead of browser
// SpeechSynthesis. Preserves the same external interface as the old hook so
// all call sites (notices, remarks, communication) require no changes.
//
// `speaking`    – key of the item currently loading or playing (or null)
// `fallbackLang` – always null; AI TTS has no fallback concept
// Toggle behaviour: clicking speak on the same key stops playback.
// Race-condition safe: a ref tracks the expected key so stale API responses
// from a superseded call are discarded.

export function useTTS() {
  const [speaking, setSpeaking] = useState<string | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const urlRef    = useRef<string | null>(null);
  const keyRef    = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    keyRef.current = null;
    cleanup();
    setSpeaking(null);
  }, [cleanup]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const speak = useCallback(async (text: string, lang: string, key: string) => {
    // Toggle off if this key is already loading or playing
    if (keyRef.current === key) { stop(); return; }

    cleanup();
    keyRef.current = key;
    setSpeaking(key); // optimistic — button shows pulsing blue during load and play

    const result = await speakWithAI({ text, targetLang: lang });

    // Discard if stop() was called or a different speak() started while loading
    if (keyRef.current !== key) return;

    if (!result.success) {
      keyRef.current = null;
      setSpeaking(null);
      return;
    }

    try {
      const binary = atob(result.data);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url  = URL.createObjectURL(blob);
      urlRef.current  = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { keyRef.current = null; setSpeaking(null); cleanup(); };
      audio.onerror = () => { keyRef.current = null; setSpeaking(null); cleanup(); };
      await audio.play();
    } catch {
      keyRef.current = null;
      setSpeaking(null);
      cleanup();
    }
  }, [stop, cleanup]);

  return { speaking, speak, stop, fallbackLang: null as string | null };
}
