"use client";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
export default function LanguagePicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  return (
    <label>
      {copy(language, "language")}
      <select
        disabled={disabled}
        value={language}
        onChange={(e) => setLanguage(e.target.value as typeof language)}
      >
        {LANGUAGE_OPTIONS.map((x) => (
          <option key={x.code} value={x.code}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
