import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
    .select("id, metadata")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidCode(value: string) {
  return /^\d{4,8}$/.test(value);
}

function hashEntryCode(itemId: string, code: string) {
  return createHash("sha256")
    .update(`mindlog-entry-access-v1:${itemId}:${code}`)
    .digest("hex");
}

function getMetadataAccessHash(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return typeof value.accessHash === "string" ? value.accessHash : "";
}

function hasMetadataAccessHash(row: any) {
  return getMetadataAccessHash(row?.metadata).length > 0;
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
  delete payload.currentCode;

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

function getRequestedMetadataAccessChange(patch: Record<string, any>) {
  if (patch.restore || !("metadata" in patch)) {
    return { touched: false, nextHash: "" };
  }

  const metadata = patch.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { touched: true, nextHash: "" };
  }

  return {
    touched: true,
    nextHash: getMetadataAccessHash(metadata),
  };
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
    const accessChange = getRequestedMetadataAccessChange(patch);
    const existingAccessHash = getMetadataAccessHash(owned.metadata);

    if (
      accessChange.touched &&
      existingAccessHash &&
      accessChange.nextHash !== existingAccessHash
    ) {
      const currentCode = normalizeCode(patch.currentCode);

      if (!isValidCode(currentCode)) {
        return withNoStore(
          NextResponse.json(
            { error: "Current code is required", verified: false },
            { status: 403 }
          )
        );
      }

      const verified = hashEntryCode(id, currentCode) === existingAccessHash;

      if (!verified) {
        return withNoStore(
          NextResponse.json(
            { error: "Incorrect current code", verified: false },
            { status: 403 }
          )
        );
      }
    }

    const payload = sanitizeJournalPatch(patch);
    const writer = createSupabaseAdminClient();

    const { data, error } = await writer
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
      const { data: afterUpdate, error: afterError } = await writer
        .from("journals")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (afterError) {
        console.error("PATCH JOURNAL VERIFY SELECT ERROR:", afterError, {
          id,
          payload,
        });

        return withNoStore(
          NextResponse.json(
            { error: afterError.message || "Failed to verify journal update" },
            { status: 500 }
          )
        );
      }

      if (!afterUpdate) {
        console.error("PATCH JOURNAL EMPTY UPDATE RESULT:", { id, payload });

        return withNoStore(
          NextResponse.json(
            { error: "Journal update did not return an updated row" },
            { status: 409 }
          )
        );
      }

      if (accessChange.touched) {
        const savedHash = getMetadataAccessHash(afterUpdate.metadata);

        if (savedHash !== accessChange.nextHash) {
          console.error("PATCH JOURNAL ACCESS METADATA MISMATCH:", {
            id,
            expected: Boolean(accessChange.nextHash),
            saved: Boolean(savedHash),
          });

          return withNoStore(
            NextResponse.json(
              { error: "Access code metadata was not saved" },
              { status: 409 }
            )
          );
        }
      }

      return withNoStore(
        NextResponse.json({
          success: true,
          item: normalizeJournalRow(afterUpdate),
        })
      );
    }

    if (accessChange.touched) {
      const savedHash = getMetadataAccessHash(data.metadata);

      if (savedHash !== accessChange.nextHash) {
        console.error("PATCH JOURNAL ACCESS METADATA MISMATCH:", {
          id,
          expected: Boolean(accessChange.nextHash),
          saved: Boolean(savedHash),
        });

        return withNoStore(
          NextResponse.json(
            { error: "Access code metadata was not saved" },
            { status: 409 }
          )
        );
      }
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
    const writer = createSupabaseAdminClient();

    const { error } = await writer
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
