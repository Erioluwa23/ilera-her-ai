import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { cookies } from "next/headers";
import { sessionCookie, verifySessionToken } from "@/lib/session";
import { ExperienceProvider } from "@/lib/experience";
export const metadata: Metadata = {
  title: "ÌleraHer AI",
  description:
    "A private, voice-first menstrual health companion for Nigerian women and girls.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySessionToken(
    (await cookies()).get(sessionCookie.name)?.value,
  );
  return (
    <html lang="en-NG">
      <body>
        <ExperienceProvider
          key={session?.sub || "public"}
          owner={session?.sub || null}
          expiresAt={session?.exp}
        >
          <ServiceWorkerRegistration />
          {children}
        </ExperienceProvider>
      </body>
    </html>
  );
}
