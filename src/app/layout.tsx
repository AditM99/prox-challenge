import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prox - AI Product Support",
  description: "Expert AI support for your products. Get instant help with setup, troubleshooting, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-900 h-full text-white">{children}</body>
    </html>
  );
}
