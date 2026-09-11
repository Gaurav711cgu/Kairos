import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kairos Auditor",
  description: "Agentic Actions & Vector Clock Replay Auditor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-agentic-dark text-agentic-text flex flex-col">
        {/* Subtle global ambient glow */}
        <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-agentic-cyan/30 blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-agentic-purple/30 blur-[120px]" />
        </div>
        <main className="relative z-10 flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
