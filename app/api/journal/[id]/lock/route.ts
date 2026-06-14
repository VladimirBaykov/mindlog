import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidCode(value: string) {
  return /^\d{4,8}$/.test(value);
}

function hashCode(code: string, userId: string, journalId: string) {
  return createHash("sha256")
    .update(`mindlog-journal-lock-v1:${userId}:${journalId}:${code}`)
    .digest("hex");
}

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.clear === true) {
      const { data, error } = await supabase
        .from("journals")
        .update({ lock_hash: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Journal not found" },
          { status: error ? 500 : 404 }
        );
      }

      return NextResponse.json({ locked: false });
    }

    const code = normalizeCode(body.code);

    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("journals")
      .update({
        lock_hash: hashCode(code, user.id, id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Journal not found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ locked: true });
  } catch (error: any) {
    console.error("JOURNAL LOCK PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code);

    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("journals")
      .select("lock_hash")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Journal not found" },
        { status: error ? 500 : 404 }
      );
    }

    if (!data.lock_hash) {
      return NextResponse.json({ verified: true, locked: false });
    }

    const verified = data.lock_hash === hashCode(code, user.id, id);

    if (!verified) {
      return NextResponse.json(
        { error: "Incorrect code", verified: false },
        { status: 403 }
      );
    }

    return NextResponse.json({ verified: true, locked: true });
  } catch (error: any) {
    console.error("JOURNAL LOCK VERIFY ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
