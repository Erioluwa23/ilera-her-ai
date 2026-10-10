"use client";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
export default function EnglishContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language } = useLanguage();
  return (
    <>
      {language !== "en-NG" && (
        <p className="notice">{copy(language, "englishNotice")}</p>
      )}
      <div lang="en-NG">{children}</div>
    </>
  );
}
