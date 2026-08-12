import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Codex Usage Manager", description: "Local Codex account usage dashboard" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('codex-usage-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch{}` }} /></head><body>{children}</body></html>; }
