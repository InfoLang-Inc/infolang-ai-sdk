import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "InfoLang Chatbot",
  description: "A Vercel AI Chatbot that remembers you, powered by InfoLang.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
