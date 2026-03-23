"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"

export default function AuthGate({ children }: { children: React.ReactNode }) {

  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const checkUser = async () => {

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/sign-in")
      } else {
        setLoading(false)
      }

    }

    checkUser()

  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Loading...
      </div>
    )
  }

  return <>{children}</>
}