import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// ================= GET =================
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Journal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("GET JOURNAL ERROR:", e);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ================= PATCH =================
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const patch = await req.json();

    const payload =
      patch.restore
        ? {
            deleted_at: null,
            updated_at: new Date().toISOString(),
          }
        : {
            ...patch,
            updated_at: new Date().toISOString(),
          };

    const { error } = await supabase
      .from("journals")
      .update(payload)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update journal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH JOURNAL ERROR:", e);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ================= DELETE =================
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const { error } = await supabase
      .from("journals")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete journal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE JOURNAL ERROR:", e);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}