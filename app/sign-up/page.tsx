"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (loading) return;

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
    router.push("/journal");
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

            <input
              id="password"
              name="password"
              type="password"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

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