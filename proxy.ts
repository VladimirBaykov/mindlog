import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  const isAuthPage =
    pathname === "/sign-in" || pathname === "/sign-up";

  const isPublicPage = pathname === "/";
  const isApiRoute = pathname.startsWith("/api");
  const isWelcomePage = pathname === "/welcome";

  const onboardingCompleted = Boolean(
    user?.user_metadata?.onboarding_completed
  );

  const isProtectedPage =
    !isPublicPage && !isAuthPage && !isApiRoute;

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(
      new URL(
        onboardingCompleted ? "/journal" : "/welcome",
        req.url
      )
    );
  }

  if (user && pathname === "/") {
    return NextResponse.redirect(
      new URL(
        onboardingCompleted ? "/chat" : "/welcome",
        req.url
      )
    );
  }

  if (
    user &&
    !onboardingCompleted &&
    !isWelcomePage &&
    !isApiRoute
  ) {
    return NextResponse.redirect(new URL("/welcome", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};