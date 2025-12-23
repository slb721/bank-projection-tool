import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Bank Cash Projections',
  description:
    'Scenario-based cash runway, income, expenses, and credit card visibility with Supabase + Next.js.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-slate-950 text-slate-50`}>
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-[-10%] h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="absolute right-1/4 top-10 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_55%)]" />
          </div>
          <div className="relative">{children}</div>
        </div>
      </body>
    </html>
  );
}
