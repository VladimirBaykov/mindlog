export type BottomNavTab = "journal" | "chat" | "stats" | "profile";

const hiddenExactPaths = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/welcome",
  "/privacy",
  "/terms",
  "/support",
  "/feedback",
  "/launch-checklist",
  "/billing/success",
]);

export function shouldShowBottomNav(pathname: string) {
  if (!pathname) return false;

  if (hiddenExactPaths.has(pathname)) {
    return false;
  }

  if (pathname.startsWith("/journal/") && pathname.endsWith("/export")) {
    return false;
  }

  return true;
}

export function getActiveBottomNavTab(
  pathname: string
): BottomNavTab | null {
  if (!pathname) return null;

  if (pathname.startsWith("/journal")) {
    return "journal";
  }

  if (pathname.startsWith("/chat")) {
    return "chat";
  }

  if (pathname.startsWith("/stats")) {
    return "stats";
  }

  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/upgrade")
  ) {
    return "profile";
  }

  return null;
}