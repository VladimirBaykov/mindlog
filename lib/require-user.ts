import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export async function requireUser() {

  const cookieStore = cookies()

  const supabase = createSupabaseServerClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return { supabase, user }
}