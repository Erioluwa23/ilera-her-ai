import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"ÌleraHer AI",description:"A private, voice-first menstrual health companion for Nigerian women and girls."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}