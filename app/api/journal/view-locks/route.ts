import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LockScope = "favorites" | "hidden";

const LOCK_SCOPES: LockScope[] = ["favorites", "hidden"];

function normalizeScope(value: unknown): LockScope | null {
  return LOCK_SCOPES.includes(value as LockScope)
    ? (value as LockScope)
    : null;
}

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidCode(value: string) {
  return /^\d{4,8}$/.test(value);
}

function hashCode(code: string, userId: string, scope: LockScope) {
  return createHash("sha256")
    .update(`mindlog-view-lock-v1:${userId}:${scope}:${code}`)
    .digest("hex");
}

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthed();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("journal_view_locks")
      .select("scope")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lockedScopes = new Set((data ?? []).map((row) => row.scope));

    return NextResponse.json({
      favorites: lockedScopes.has("favorites"),
      hidden: lockedScopes.has("hidden"),
    });
  } catch (error: any) {
    console.error("JOURNAL VIEW LOCKS GET ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await getAuthed();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scope = normalizeScope(body.scope);

    if (!scope) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    if (body.clear === true) {
      const { error } = await supabase
        .from("journal_view_locks")
        .delete()
        .eq("user_id", user.id)
        .eq("scope", scope);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ scope, locked: false });
    }

    const code = normalizeCode(body.code);

    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("journal_view_locks").upsert(
      {
        user_id: user.id,
        scope,
        lock_hash: hashCode(code, user.id, scope),
      },
      { onConflict: "user_id,scope" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scope, locked: true });
  } catch (error: any) {
    console.error("JOURNAL VIEW LOCKS PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthed();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scope = normalizeScope(body.scope);
    const code = normalizeCode(body.code);

    if (!scope) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("journal_view_locks")
      .select("lock_hash")
      .eq("user_id", user.id)
      .eq("scope", scope)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.lock_hash) {
      return NextResponse.json({ verified: true, locked: false });
    }

    const verified = data.lock_hash === hashCode(code, user.id, scope);

    if (!verified) {
      return NextResponse.json(
        { error: "Incorrect code", verified: false },
        { status: 403 }
      );
    }

    return NextResponse.json({ verified: true, locked: true });
  } catch (error: any) {
    console.error("JOURNAL VIEW LOCKS VERIFY ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
