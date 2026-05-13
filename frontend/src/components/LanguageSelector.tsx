'use client';

interface LanguageSelectorProps {
  currentLang: string;
  onSelect: (lang: string) => void;
  disabled?: boolean;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'or', label: 'Odia' },
];

export default function LanguageSelector({ currentLang, onSelect, disabled }: LanguageSelectorProps) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold text-gray-600 mb-1">Translate To</label>
      <select
        value={currentLang}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className="px-4 py-2 border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-800"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
