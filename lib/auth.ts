import { supabase } from "./supabase"

export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}