import type { Metadata } from "next";
import "./globals.css";
import "./design.css";
import "./cycle.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
export const metadata: Metadata = {
  title: "ÌleraHer AI",
  description:
    "A private, voice-first menstrual health companion for Nigerian women and girls.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
