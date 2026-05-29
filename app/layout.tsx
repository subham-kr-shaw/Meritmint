import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "MeritMint",
  description:
    "Mint and verify non-transferable academic credentials on Stellar Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
