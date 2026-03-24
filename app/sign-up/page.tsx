"use client";

import { useState } from "react";
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
    <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">
      <div className="w-[360px] space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>

        <input
          id="email"
          name="email"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          id="password"
          name="password"
          type="password"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full rounded-lg bg-white p-3 font-medium text-black"
        >
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <p className="text-sm text-zinc-400">
          Already have account?{" "}
          <a href="/sign-in" className="underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
