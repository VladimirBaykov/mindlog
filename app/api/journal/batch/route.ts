import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH_SIZE = 100;

type BatchPatch = {
  is_favorite?: boolean;
  hidden_at?: string | null;
};

async function getAuthedUserId() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    userId: user?.id ?? null,
  };
}

function hasMetadataAccessHash(row: any) {
  const metadata = row?.metadata;

  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      typeof metadata.accessHash === "string" &&
      metadata.accessHash.length > 0,
  );
}

function normalizeJournalRow(row: any) {
  const { lock_hash: _lockHash, ...safeRow } = row;

  return {
    ...safeRow,
    locked: Boolean(row.lock_hash || hasMetadataAccessHash(row)),
  };
}

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

function sanitizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_BATCH_SIZE);
}

function sanitizePatch(value: unknown): BatchPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const patch: BatchPatch = {};

  if ("is_favorite" in input) {
    patch.is_favorite = Boolean(input.is_favorite);
  }

  if ("hidden_at" in input) {
    patch.hidden_at =
      typeof input.hidden_at === "string" && input.hidden_at.length > 0
        ? input.hidden_at
        : null;
  }

  return patch;
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await getAuthedUserId();

    if (!userId) {
      return withNoStore(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = sanitizeIds(body.ids);
    const patch = sanitizePatch(body.patch);
    const patchKeys = Object.keys(patch);

    if (ids.length === 0) {
      return withNoStore(
        NextResponse.json({ error: "No journal ids provided" }, { status: 400 }),
      );
    }

    if (patchKeys.length === 0) {
      return withNoStore(
        NextResponse.json({ error: "No supported patch fields provided" }, { status: 400 }),
      );
    }

    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const writer = createSupabaseAdminClient();

    const { data, error } = await writer
      .from("journals")
      .update(payload)
      .eq("user_id", userId)
      .in("id", ids)
      .select("*");

    if (error) {
      console.error("BATCH JOURNAL UPDATE ERROR:", error, { ids, payload });

      return withNoStore(
        NextResponse.json(
          { error: error.message || "Failed to update journals" },
          { status: 500 },
        ),
      );
    }

    const items = (data ?? []).map(normalizeJournalRow);

    if (items.length !== ids.length) {
      return withNoStore(
        NextResponse.json(
          {
            error: "Some selected journals were not found",
            items,
          },
          { status: 404 },
        ),
      );
    }

    return withNoStore(
      NextResponse.json({
        success: true,
        items,
      }),
    );
  } catch (error) {
    console.error("BATCH JOURNAL ERROR:", error);

    return withNoStore(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}
