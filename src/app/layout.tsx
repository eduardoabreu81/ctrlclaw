import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CtrlClaw",
  description: "Secure web interface for Claw ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
