import type { Metadata } from "next";
import { Inter, Outfit, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "NômFlow",
  description: "Advanced Nôm Study Tool",
  icons: {
    icon: '/icon.svg',
  },
};

import { Navbar } from "@/components/Navigation/Navbar";
import { Footer } from "@/components/Navigation/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${outfit.variable} ${lora.variable}`}>
      <body className="antialiased font-outfit">
        <div id="app-background"></div>
        <div id="page-scroller">
          <div className="main-wrapper container mx-auto px-4 pb-4 pt-4 md:p-8 w-full max-w-6xl">
            <Navbar />
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}

