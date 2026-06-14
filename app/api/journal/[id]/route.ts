import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getAuthedUserId() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    userId: user?.id ?? null,
  };
}

async function ensureOwnedJournal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("journals")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function hasMetadataAccessHash(row: any) {
  return Boolean(
    row?.metadata &&
      typeof row.metadata === "object" &&
      typeof row.metadata.accessHash === "string" &&
      row.metadata.accessHash.length > 0
  );
}

function normalizeJournalRow(row: any) {
  const { lock_hash: _lockHash, ...safeRow } = row;

  return {
    ...safeRow,
    locked: Boolean(row.lock_hash || hasMetadataAccessHash(row)),
  };
}

function sanitizeJournalPatch(patch: Record<string, any>) {
  const payload: Record<string, any> = patch.restore
    ? {
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }
    : {
        ...patch,
        updated_at: new Date().toISOString(),
      };

  delete payload.id;
  delete payload.user_id;
  delete payload.created_at;
  delete payload.updated_at_client;
  delete payload.deleted;
  delete payload.lock_hash;
  delete payload.locked;

  if ("metadata" in payload) {
    const metadata = payload.metadata;

    if (
      metadata === null ||
      typeof metadata !== "object" ||
      Array.isArray(metadata)
    ) {
      payload.metadata = {};
    }
  }

  return payload;
}

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

// ================= GET =================
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await getAuthedUserId();
    const { id } = await context.params;

    if (!userId) {
      return withNoStore(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("GET JOURNAL SELECT ERROR:", error);
      return withNoStore(
        NextResponse.json(
          { error: error.message || "Failed to load journal" },
          { status: 500 }
        )
      );
    }

    if (!data) {
      return withNoStore(
        NextResponse.json({ error: "Journal not found" }, { status: 404 })
      );
    }

    return withNoStore(NextResponse.json(normalizeJournalRow(data)));
  } catch (e) {
    console.error("GET JOURNAL ERROR:", e);

    return withNoStore(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

// ================= PATCH =================
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await getAuthedUserId();
    const { id } = await context.params;

    if (!userId) {
      return withNoStore(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const owned = await ensureOwnedJournal(supabase, id, userId);

    if (!owned) {
      return withNoStore(
        NextResponse.json({ error: "Journal not found" }, { status: 404 })
      );
    }

    const patch = await req.json().catch(() => ({}));
    const payload = sanitizeJournalPatch(patch);

    const { data, error } = await supabase
      .from("journals")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("PATCH JOURNAL UPDATE ERROR:", error, { id, payload });

      return withNoStore(
        NextResponse.json(
          { error: error.message || "Failed to update journal" },
          { status: 500 }
        )
      );
    }

    if (!data) {
      console.error("PATCH JOURNAL EMPTY UPDATE RESULT:", { id, payload });

      return withNoStore(
        NextResponse.json(
          { error: "Journal update did not return an updated row" },
          { status: 409 }
        )
      );
    }

    return withNoStore(
      NextResponse.json({
        success: true,
        item: normalizeJournalRow(data),
      })
    );
  } catch (e) {
    console.error("PATCH JOURNAL ERROR:", e);

    return withNoStore(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

// ================= DELETE =================
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await getAuthedUserId();
    const { id } = await context.params;

    if (!userId) {
      return withNoStore(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const owned = await ensureOwnedJournal(supabase, id, userId);

    if (!owned) {
      return withNoStore(
        NextResponse.json({ error: "Journal not found" }, { status: 404 })
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("journals")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("DELETE JOURNAL UPDATE ERROR:", error);

      return withNoStore(
        NextResponse.json(
          { error: error.message || "Failed to delete journal" },
          { status: 500 }
        )
      );
    }

    return withNoStore(NextResponse.json({ success: true }));
  } catch (e) {
    console.error("DELETE JOURNAL ERROR:", e);

    return withNoStore(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
