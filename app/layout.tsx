import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AirHack — Smart Airport Connectivity",
  description:
    "Orange CAMARA Network API demo: identity verification & location-aware notifications for passenger journeys.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#0b0f1a] text-gray-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
