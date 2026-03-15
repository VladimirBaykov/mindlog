"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function SignIn() {

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  const handleSignIn = async () => {

    if(loading) return

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    setLoading(false)

    if(error){
      alert(error.message)
      return
    }

    router.push("/journal")
    router.refresh()

  }

  return (

    <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">

      <div className="w-[360px] space-y-4">

        <h1 className="text-2xl font-semibold">Welcome back</h1>

        <input
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full p-3 rounded-lg bg-white text-black font-medium"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="text-sm text-zinc-400">
          No account? <a href="/sign-up" className="underline">Create one</a>
        </p>

      </div>

    </div>

  )

}