import { POLICIES, publishable } from "./health/policies";
import { todayIn } from "./health/date-only";
export type CapabilityState =
  | "hidden"
  | "education_only"
  | "record_only"
  | "ready"
  | "temporarily_unavailable";
export type FeatureCapability = {
  id:
    "periods" | "fertility" | "pregnancy" | "conception" | "newborn" | "growth";
  state: CapabilityState;
  labelKey: string;
  route: string;
  dependency?: string;
};
export function capabilities(asOf = todayIn()): FeatureCapability[] {
  return [
    { id: "periods", state: "ready", labelKey: "periods", route: "/cycle" },
    {
      id: "fertility",
      state: publishable(POLICIES.fertility, asOf) ? "ready" : "education_only",
      labelKey: "fertility",
      route: "/fertility",
      dependency: "Clinical sign-off of calendar policy and translations",
    },
    {
      id: "pregnancy",
      state: "record_only",
      labelKey: "pregnancy",
      route: "/pregnancy",
      dependency: "Local dating and care-content review",
    },
    {
      id: "conception",
      state: "record_only",
      labelKey: "conception",
      route: "/conception",
      dependency: "Preconception content and referral-policy review",
    },
    {
      id: "newborn",
      state: "record_only",
      labelKey: "baby",
      route: "/baby",
      dependency: "Paediatric and maternal-care content review",
    },
    {
      id: "growth",
      state: "record_only",
      labelKey: "growth",
      route: "/growth",
      dependency:
        "WHO licence, pinned tables, independent oracle and paediatric review",
    },
  ];
}
