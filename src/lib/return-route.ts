import { validDate } from "./health/date-only";
const ROUTES = new Set([
  "/",
  "/home",
  "/track",
  "/cycle",
  "/log",
  "/voice",
  "/history",
  "/help",
  "/lite",
  "/settings",
  "/feedback",
  "/admin",
  "/onboarding",
  "/pregnancy",
  "/conception",
  "/baby",
  "/growth",
  "/fertility",
  "/late-period",
]);
export function safeReturn(value: unknown, fallback = "/") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://ileraher.invalid");
    if (url.origin !== "https://ileraher.invalid" || !ROUTES.has(url.pathname))
      return fallback;
    const query = new URLSearchParams();
    if (url.pathname === "/log" && validDate(url.searchParams.get("date")))
      query.set("date", url.searchParams.get("date")!);
    // Only non-sensitive identifiers of saved objects survive authentication.
    for (const key of ["id", "thread"]) {
      const id = url.searchParams.get(key);
      if (
        (url.pathname === "/log" ||
          url.pathname === "/voice" ||
          url.pathname === "/history") &&
        id &&
        /^[a-zA-Z0-9_-]{1,120}$/.test(id)
      )
        query.set(key, id);
    }
    return url.pathname + (query.size ? "?" + query : "");
  } catch {
    return fallback;
  }
}
