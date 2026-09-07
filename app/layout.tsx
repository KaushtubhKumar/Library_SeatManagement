import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import CountdownBadge from "@/components/CountdownBadge";
import { ToastProvider } from "@/lib/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Library Seats",
  description: "Reserve a seat, claim it when you arrive.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-16">
        <ToastProvider>
          {children}
          <CountdownBadge />
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}