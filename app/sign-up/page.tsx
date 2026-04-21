"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

function PasswordToggleIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3 21 21" />
      <path d="M10.58 10.58A2 2 0 0 0 10 12a2 2 0 0 0 2 2c.53 0 1.01-.2 1.38-.58" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.04 3.81" />
      <path d="M6.61 6.61C3.83 8.17 2 12 2 12a17.3 17.3 0 0 0 5.39 5.39" />
      <path d="M14.12 18.91A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 3.04-3.81" />
    </svg>
  );
}

export default function SignUp() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (loading) return;

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          onboarding_completed: false,
        },
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
    router.push("/welcome");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            ← Home
          </Link>

          <Link
            href="/sign-in"
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            Sign in
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[380px] space-y-5">
            <div>
              <h1 className="text-3xl font-semibold">Create account</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Start building your private reflection space.
              </p>
            </div>

            <input
              id="email"
              name="email"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 pr-11"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-white"
              >
                <PasswordToggleIcon visible={showPassword} />
              </button>
            </div>

            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-xl bg-white p-3 font-medium text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>

            <p className="text-sm text-zinc-400">
              Already have an account?{" "}
              <Link href="/sign-in" className="underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}