import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Drawwell: prepare your G5 drawdown",
  description:
    "Drawwell checks a Department of Education G5 payment request against your ledger, budget, receipts and 2 CFR 200, then helps you write the 255-character justification.",
};

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 9h16M8 14h16M8 19h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 22.5l2.6 2.6L27 19.5" stroke="var(--color-ledger)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${newsreader.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <header className="no-print border-b border-rule/80 bg-paper/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 text-ink">
              <Mark />
              <span className="font-display text-xl font-semibold tracking-tight">Drawwell</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm text-ink-soft overflow-x-auto">
              <Link className="px-2.5 py-1.5 rounded whitespace-nowrap hover:bg-paper-deep hover:text-ink" href="/review">Review a drawdown</Link>
              <Link className="px-2.5 py-1.5 rounded whitespace-nowrap hover:bg-paper-deep hover:text-ink" href="/how-it-works">How it works</Link>
              <Link className="px-2.5 py-1.5 rounded whitespace-nowrap hover:bg-paper-deep hover:text-ink" href="/evaluation">Evaluation</Link>
              <Link className="px-2.5 py-1.5 rounded whitespace-nowrap hover:bg-paper-deep hover:text-ink" href="/sources">Sources</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-rule mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-sm text-ink-faint flex flex-col sm:flex-row gap-3 sm:justify-between">
            <p>
              Drawwell helps you prepare a payment request. It does not approve payments or give legal advice; the Department of Education decides.
            </p>
            <p className="font-mono text-xs">Built on SERV Reasoning · OpenServ Hackathon 02</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
