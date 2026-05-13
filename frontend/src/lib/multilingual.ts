// Shared multilingual utilities:
//   SPEECH_LANG_MAP  – BCP-47 codes for supported languages
//   translateCached  – translate with module-level in-memory cache
//   translateBatch   – batch translation helper
//   useSpeechInput   – browser speech-to-text hook (webkitSpeechRecognition)
//   useTTS           – browser text-to-speech hook (SpeechSynthesis) with voice fallback
//   useTranslation   – convenience hook: manages translated-text state + loading flag

import { useState, useRef, useCallback, useEffect } from 'react';
import { translateText } from './api';

// ── Language codes ────────────────────────────────────────────────────────

export const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  or: 'or-IN',
};

// Fallback voice chains — tried left-to-right until a browser voice matches.
// Telugu and Odia rarely have native browser voices; they fall back to Hindi
// then English so speech always plays rather than failing silently.
const VOICE_FALLBACKS: Record<string, string[]> = {
  'te-IN': ['te-IN', 'te', 'hi-IN', 'hi', 'en-IN', 'en-US', 'en'],
  'or-IN': ['or-IN', 'or', 'hi-IN', 'hi', 'en-IN', 'en-US', 'en'],
  'hi-IN': ['hi-IN', 'hi', 'en-IN', 'en-US', 'en'],
  'en-IN': ['en-IN', 'en-US', 'en-GB', 'en'],
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

// ── Voice picker (TTS) ────────────────────────────────────────────────────
// Walks the fallback chain for the target BCP-47 tag until a browser voice
// is found. Logs selection and fallback usage to the console.

function pickVoice(
  voices: SpeechSynthesisVoice[],
  targetLang: string,
): { voice: SpeechSynthesisVoice | null; isFallback: boolean } {
  const chain = VOICE_FALLBACKS[targetLang] ?? [
    targetLang,
    targetLang.split('-')[0],
    'en-IN',
    'en',
  ];

  console.log(
    `[TTS] Language: ${targetLang} | Available voices: ${
      voices.map(v => `${v.name} (${v.lang})`).join(', ') || 'none'
    }`,
  );

  for (const code of chain) {
    // 1. Exact lang match
    let voice = voices.find(v => v.lang === code);
    // 2. Prefix match (e.g. 'te' matches 'te-IN', 'te-XX')
    if (!voice) {
      const prefix = code.split('-')[0].toLowerCase();
      voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix + '-') || v.lang.toLowerCase() === prefix);
    }
    // 3. Name contains language word (e.g. voice.name includes "Telugu")
    if (!voice) {
      const nameHint = code.split('-')[0];
      const langNames: Record<string, string> = { te: 'Telugu', or: 'Odia', hi: 'Hindi', en: 'English' };
      const hint = langNames[nameHint];
      if (hint) voice = voices.find(v => v.name.includes(hint));
    }

    if (voice) {
      const isFallback = code !== targetLang;
      console.log(
        `[TTS] ${isFallback ? '⚠ FALLBACK' : '✓ Matched'} voice: "${voice.name}" (${voice.lang})`,
      );
      return { voice, isFallback };
    }
  }

  // Last resort: any voice rather than silence
  const voice = voices[0] ?? null;
  console.log(`[TTS] ✗ No chain match — using first available: "${voice?.name ?? 'none'}" (${voice?.lang ?? 'n/a'})`);
  return { voice, isFallback: true };
}

// ── Text-to-speech hook ───────────────────────────────────────────────────
// Uses browser SpeechSynthesis API with voice fallback for Telugu/Odia.
// `speaking`    – key of the currently playing utterance (or null)
// `fallbackLang` – non-null when a fallback voice was used on the last play
// Toggle behaviour: clicking speak on the same key stops playback.
// Stops any previous utterance before starting a new one.

export function useTTS() {
  const [speaking,    setSpeaking]    = useState<string | null>(null);
  const [fallbackLang, setFallbackLang] = useState<string | null>(null);
  const speakingRef = useRef<string | null>(null);

  const speak = useCallback((text: string, lang: string, key: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Toggle off if already speaking this item
    if (speakingRef.current === key) {
      speakingRef.current = null;
      setSpeaking(null);
      setFallbackLang(null);
      return;
    }

    const targetLang = SPEECH_LANG_MAP[lang] ?? 'en-IN';
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = targetLang;
    utt.rate = 0.9;

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const { voice, isFallback } = pickVoice(voices, targetLang);

      if (voice) utt.voice = voice;

      utt.onend   = () => { speakingRef.current = null; setSpeaking(null); setFallbackLang(null); };
      utt.onerror = (ev) => {
        console.warn('[TTS] SpeechSynthesis error:', ev.error);
        speakingRef.current = null;
        setSpeaking(null);
        setFallbackLang(null);
      };

      window.speechSynthesis.speak(utt);
      speakingRef.current = key;
      setSpeaking(key);
      setFallbackLang(isFallback ? targetLang : null);
    };

    // Voices may not be loaded yet on the first call — wait for the event
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = doSpeak;
    } else {
      doSpeak();
    }
  }, []); // speakingRef is stable; no stale closure risk

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    speakingRef.current = null;
    setSpeaking(null);
    setFallbackLang(null);
  }, []);

  return { speaking, speak, stop, fallbackLang };
}
