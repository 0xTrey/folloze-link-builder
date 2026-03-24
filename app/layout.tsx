import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folloze Link Builder",
  description: "Generate personalized Folloze board links for your email sequences.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
