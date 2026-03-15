"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import { HeaderProvider } from "@/components/header/HeaderContext";
import { Header } from "@/components/header/Header";
import { JournalProvider } from "@/components/journal/JournalContext";
import { ToastProvider } from "@/components/ui/ToastContext";
import { AnimatedLayout } from "@/components/layout/AnimatedLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <HeaderProvider>
          <ToastProvider>
            <JournalProvider>
              <Header />

              {/* Отступ под фиксированный header */}
              <main className="pt-[72px]">
                <AnimatedLayout key={pathname}>
                  {children}
                </AnimatedLayout>
              </main>
            </JournalProvider>
          </ToastProvider>
        </HeaderProvider>
      </body>
    </html>
  );
}