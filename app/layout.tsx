import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {AppSidebar} from "@/components/app-sidebar";
import {SidebarProvider} from "@/components/ui/sidebar";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nestool-web",
  description: "Herramienta para generar código al api-base-nestjs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
      <SidebarProvider>
        <div className="grid grid-cols-[auto_1fr] min-h-screen w-full">
          <div className="z-10">
            <AppSidebar />
          </div>
          <div className="relative w-full h-screen">
            <main className="absolute inset-0 flex items-center justify-center min-h-screen">
              {children}
            </main>
          </div>
        </div>
        <SonnerToaster  richColors position="top-right" />
      </SidebarProvider>
      </body>
    </html>
  );
}
