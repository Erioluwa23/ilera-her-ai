import type { IlaraLanguage } from "../languages";
import { publishable, type Review } from "./policies";
export type CareContent = Review & {
  contentId: string;
  topic: string;
  stage: string;
  sourceUrl: string;
  evidenceVersion: string;
  translations: Partial<
    Record<IlaraLanguage, Review & { text: string; audioUrl?: string }>
  >;
};
// Candidate metadata, not reviewed passages. No new clinical interpretation or
// native-language care instruction becomes available merely by adding a route.
export const CARE_CONTENT: CareContent[] = [
  {
    contentId: "fertility-standard-days-v1",
    topic: "fertility",
    stage: "eligible-calendar-history",
    sourceUrl:
      "https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning",
    evidenceVersion: "implementation-spec-2026-10-10",
    status: "draft",
    reviewer: null,
    reviewedOn: null,
    expiresOn: null,
    translations: {},
  },
  {
    contentId: "pregnancy-dating-v1",
    topic: "pregnancy",
    stage: "dating",
    sourceUrl:
      "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date",
    evidenceVersion: "implementation-spec-2026-10-10",
    status: "draft",
    reviewer: null,
    reviewedOn: null,
    expiresOn: null,
    translations: {},
  },
  {
    contentId: "infant-temperature-v1",
    topic: "newborn",
    stage: "under-three-calendar-months",
    sourceUrl: "https://www.nhs.uk/conditions/fever-in-children/",
    evidenceVersion: "implementation-spec-2026-10-10",
    status: "draft",
    reviewer: null,
    reviewedOn: null,
    expiresOn: null,
    translations: {},
  },
];
export function reviewedContent(
  topic: string,
  language: IlaraLanguage,
  asOf: string,
) {
  return CARE_CONTENT.filter(
    (entry) =>
      entry.topic === topic &&
      publishable(entry, asOf) &&
      !!entry.translations[language]?.text &&
      publishable(entry.translations[language]!, asOf),
  );
}
