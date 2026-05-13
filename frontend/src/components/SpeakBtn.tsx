'use client';
import { SpeakerWaveIcon } from '@heroicons/react/24/outline';

export default function SpeakBtn({
  textKey,
  speaking,
  onSpeak,
  fallback = false,
}: {
  textKey: string;
  speaking: string | null;
  onSpeak: () => void;
  fallback?: boolean;
}) {
  const active = speaking === textKey;
  const title = active
    ? 'Stop reading'
    : fallback
    ? 'Read aloud (using fallback voice for this language)'
    : 'Read aloud';

  return (
    <button
      type="button"
      onClick={onSpeak}
      title={title}
      className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
        active
          ? 'bg-blue-50 text-blue-500 animate-pulse'
          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
      }`}
    >
      <SpeakerWaveIcon className="w-3.5 h-3.5" />
      {fallback && !active && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-white" />
      )}
    </button>
  );
}
