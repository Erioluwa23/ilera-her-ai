import type { SessionPayload } from "./session";

function adminPhones() {
  return (process.env.ADMIN_PHONE_NUMBERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAdminSession(session: SessionPayload | null) {
  return !!session && adminPhones().includes(session.phone);
}
