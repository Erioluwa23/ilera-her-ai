import { sessionCookie, verifySessionToken } from "./session";
export function requestSession(request: Request) {
  const value = (request.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(sessionCookie.name + "="))
    ?.slice(sessionCookie.name.length + 1);
  return verifySessionToken(value);
}
