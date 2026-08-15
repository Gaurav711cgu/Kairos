import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Distributed State Time Machine',
  description: 'Causal state capture and deterministic replay for distributed microservices',
  keywords: ['distributed systems', 'debugging', 'vector clocks', 'replay', 'microservices'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav">
          <div className="nav-brand">
            <span className="nav-icon">[STM]</span>
            <span className="nav-title">State Time Machine</span>
          </div>
          <div className="nav-links">
            <a href="/" className="nav-link">Incidents</a>
            <a href="https://github.com" target="_blank" rel="noopener" className="nav-link">GitHub</a>
          </div>
        </nav>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
