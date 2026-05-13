'use client';
import { MicrophoneIcon } from '@heroicons/react/24/outline';

export default function MicBtn({
  fieldKey,
  activeField,
  onClick,
  size = 'md',
}: {
  fieldKey: string;
  activeField: string | null;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  const active = activeField === fieldKey;
  const dim    = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const icon   = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? 'Listening… (click to stop)' : 'Speak to fill'}
      className={`${dim} rounded-lg flex items-center justify-center transition-all shrink-0 border ${
        active
          ? 'bg-red-50 border-red-200 text-red-500'
          : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      <MicrophoneIcon className={`${icon} ${active ? 'animate-pulse' : ''}`} />
    </button>
  );
}
