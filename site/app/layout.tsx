import type { Metadata } from 'next';
import { Instrument_Serif, Onest, IBM_Plex_Mono } from 'next/font/google';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SITE } from '@/lib/site';
import './globals.css';

const serif = Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-instrument', display: 'optional' });
const sans = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'optional' });
const mono = IBM_Plex_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-plex-mono', display: 'optional' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: '%s · Tavero' },
  description: SITE.description,
  openGraph: { title: SITE.title, description: SITE.description, url: SITE.url, siteName: 'Tavero', type: 'website' },
  twitter: { card: 'summary_large_image', title: SITE.title, description: SITE.description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
