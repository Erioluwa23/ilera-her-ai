import type { IlaraLanguage } from "../languages";
// A provisional safety notice is conditional help, never a saved clinical finding.
export function affirmedReport(text: string, language: IlaraLanguage) {
  let x = text.toLocaleLowerCase();
  if (language === "en-NG")
    x = x.replace(
      /\b(?:did not|do not|don't|didn't|not|no)\s+(?:(?:feel|have|any|feeling)\s+)*(?:faint(?:ing|ed)?|collapse(?:d)?|dizz(?:y|iness)|weak(?:ness)?|severe pain|heavy bleeding|pregnan(?:t|cy))\b/g,
      "",
    );
  return x;
}
export function possibleDangerReport(text: string, language: IlaraLanguage) {
  const x = affirmedReport(text, language);
  const signs =
    language === "yo"
      ? /dákú|daku|ẹ̀jẹ̀.*pọ̀|eje.*po|ìrora.*lágbára/
      : language === "ha"
        ? /suma|jini.*yawa|ciwo.*tsanani/
        : language === "ig"
          ? /ọbara.*ọtụtụ|obara.*otutu|mgbu.*siri ike|amaghị onwe/
          : /\bfaint(?:ing|ed)?\b|\bcollapse(?:d)?\b|severe (?:abdominal )?pain|trouble breathing|heavy bleeding|soak.*pad.*hour/;
  return signs.test(x);
}
