import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lived Experience Insights Engine",
  description: "Lived Experience Insights Engine - Documenting and amplifying women’s lived experiences",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
        <div className="absolute top-6 right-6 md:top-8 md:right-8 z-50 flex items-center justify-center">
          <Image 
            src="/logo.png" 
            alt="Under The Sister Hood" 
            width={100} 
            height={100} 
            priority
            className="w-16 h-16 md:w-20 md:h-20 object-contain"
          />
        </div>
        {children}
      </body>
    </html>
  );
}
