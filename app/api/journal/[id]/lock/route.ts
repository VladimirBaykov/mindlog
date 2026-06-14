import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SupabaseMaybeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
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

function getSupabaseErrorStatus(error: SupabaseMaybeError | null | undefined) {
  if (!error) return 404;

  if (error.code === "PGRST116") {
    return 404;
  }

  if (
    error.code === "PGRST204" ||
    error.message?.toLowerCase().includes("lock_hash") ||
    error.message?.toLowerCase().includes("schema cache")
  ) {
    return 409;
  }

  return 500;
}

function getSupabaseErrorMessage(error: SupabaseMaybeError | null | undefined) {
  if (!error) return "Journal not found";

  if (error.code === "PGRST116") {
    return "Journal not found";
  }

  if (
    error.code === "PGRST204" ||
    error.message?.toLowerCase().includes("lock_hash") ||
    error.message?.toLowerCase().includes("schema cache")
  ) {
    return "Journal lock column is not ready yet. Re-run the Supabase SQL migration or refresh the Supabase schema cache.";
  }

  return error.message || "Journal lock failed";
}

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function ensureOwnedJournal(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  journalId: string;
}) {
  const { data, error } = await params.supabase
    .from("journals")
    .select("id, lock_hash")
    .eq("id", params.journalId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error,
      response: NextResponse.json(
        { error: getSupabaseErrorMessage(error), code: error.code },
        { status: getSupabaseErrorStatus(error) }
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: null,
      response: NextResponse.json(
        { error: "Journal not found" },
        { status: 404 }
      ),
    };
  }

  return { data, error: null, response: null };
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await ensureOwnedJournal({
      supabase,
      userId: user.id,
      journalId: id,
    });

    if (owned.response) {
      return owned.response;
    }

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const payload =
      body.clear === true
        ? {
            lock_hash: null,
            updated_at: now,
          }
        : (() => {
            const code = normalizeCode(body.code);

            if (!isValidCode(code)) {
              return null;
            }

            return {
              lock_hash: hashCode(code, user.id, id),
              updated_at: now,
            };
          })();

    if (!payload) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("journals")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id, lock_hash")
      .maybeSingle();

    if (error) {
      console.error("JOURNAL LOCK UPDATE ERROR:", error);

      return NextResponse.json(
        { error: getSupabaseErrorMessage(error), code: error.code },
        { status: getSupabaseErrorStatus(error) }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Journal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      locked: Boolean(data.lock_hash),
    });
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

    const owned = await ensureOwnedJournal({
      supabase,
      userId: user.id,
      journalId: id,
    });

    if (owned.response) {
      return owned.response;
    }

    if (!owned.data?.lock_hash) {
      return NextResponse.json({ verified: true, locked: false });
    }

    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code);

    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: "Code must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const verified = owned.data.lock_hash === hashCode(code, user.id, id);

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
