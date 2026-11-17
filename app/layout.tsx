import type { Metadata } from "next";
import "./globals.css";

// The home page (/) is the garpez.tv television, a static page in public/tv/
// served through the rewrite in next.config.ts. This layout is for future Next.js pages.

export const metadata: Metadata = {
  title: "Garpez",
  description: "Garpez is a branding studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
