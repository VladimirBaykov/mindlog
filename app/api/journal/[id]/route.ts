import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ================= GET =================
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    mood: data.mood,
    createdAt: new Date(data.created_at).getTime(),
    messages: data.content || [],
  });
}

// ================= PATCH =================
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const patch = await req.json();

  const { error } = await supabase
    .from("journals")
    .update(patch)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// ================= DELETE =================
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { error } = await supabase
    .from("journals")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}