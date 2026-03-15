import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ================= GET =================
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return NextResponse.json([], { status: 500 });
    }

    const items = data.map((entry) => ({
      id: entry.id,
      title: entry.title,
      mood: entry.mood,
      createdAt: new Date(entry.created_at).getTime(),
      messages: entry.content || [],
      deleted: false,
    }));

    return NextResponse.json(items);
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}