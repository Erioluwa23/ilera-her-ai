import { describe, it, expect } from "vitest";
import { UI_KEYS, uiText, symptomText } from "./ui-language";
import { LANGUAGE_OPTIONS } from "./languages";
describe("interface language catalogue", () => {
  it.each(LANGUAGE_OPTIONS)(
    "has a nonempty string for every key in $label",
    ({ code }) => {
      for (const key of UI_KEYS)
        expect(uiText(key, code).trim(), `${code}:${key}`).not.toBe("");
    },
  );
  it("localizes symptom labels without translating or altering a user's original notes", () => {
    expect(symptomText("Cramps", (key) => uiText(key, "yo"))).toBe(
      uiText("cramps", "yo"),
    );
    expect(
      symptomText("My original personal note", (key) => uiText(key, "yo")),
    ).toBe("My original personal note");
  });
});
