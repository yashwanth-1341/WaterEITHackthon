import type { Metadata } from "next";
// Bundled locally (weight + width axes) so the demo works without internet.
import "@fontsource-variable/archivo/standard.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AquaTrace: mine water intelligence",
  description: "Where mining's water goes, whether the numbers add up, and what happens next. 16 companies, every figure traced to its source.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
