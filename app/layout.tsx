"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import { HeaderProvider } from "@/components/header/HeaderContext";
import { Header } from "@/components/header/Header";
import { JournalProvider } from "@/components/journal/JournalContext";
import { ToastProvider } from "@/components/ui/ToastContext";
import { AnimatedLayout } from "@/components/layout/AnimatedLayout";
import { BottomNav } from "@/components/navigation/BottomNav";
import { shouldShowBottomNav } from "@/lib/navigation";

const HEADERLESS_EXACT_PATHS = new Set([
  "/privacy",
  "/terms",
  "/support",
]);

function getMainClassName(pathname: string, showBottomNav: boolean) {
  if (HEADERLESS_EXACT_PATHS.has(pathname)) {
    return "";
  }

  if (pathname.startsWith("/chat")) {
    return "pt-[58px]";
  }

  if (showBottomNav) {
    return "pt-[58px] pb-[50px]";
  }

  return "pt-[58px]";
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showBottomNav = shouldShowBottomNav(pathname);
  const mainClassName = getMainClassName(pathname, showBottomNav);

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <HeaderProvider>
          <ToastProvider>
            <JournalProvider>
              <Header />

              <main className={mainClassName}>
                <AnimatedLayout key={pathname}>
                  {children}
                </AnimatedLayout>
              </main>

              <BottomNav />
            </JournalProvider>
          </ToastProvider>
        </HeaderProvider>
      </body>
    </html>
  );
}