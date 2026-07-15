import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GTFS-to-HTML: Turn GTFS into transit timetables for your website',
  description:
    "Free, open source tool that turns your transit agency's GTFS into ready-to-publish timetables and route maps in HTML, PDF or CSV format. Paste a URL or upload a zip - no signup required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
