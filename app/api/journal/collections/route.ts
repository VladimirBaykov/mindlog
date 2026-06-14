import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const COLLECTION_COLORS = [
  "slate",
  "blue",
  "purple",
  "rose",
  "amber",
  "emerald",
  "cyan",
  "pink",
] as const;

type CollectionColor = (typeof COLLECTION_COLORS)[number];

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 60);
}

function normalizeColor(value: unknown): CollectionColor {
  return COLLECTION_COLORS.includes(value as CollectionColor)
    ? (value as CollectionColor)
    : "blue";
}

function normalizePin(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidPin(value: string) {
  return /^\d{4,8}$/.test(value);
}

function hashPin(pin: string, userId: string) {
  return createHash("sha256")
    .update(`mindlog-collection-pin-v1:${userId}:${pin}`)
    .digest("hex");
}

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthed();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("journal_collections")
      .select("id, name, color, pin_hash, created_at, updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const collectionIds = (data ?? []).map((collection) => collection.id);
    const counts = new Map<string, number>();

    if (collectionIds.length > 0) {
      const { data: itemRows, error: itemError } = await supabase
        .from("journal_collection_items")
        .select("collection_id")
        .eq("user_id", user.id)
        .in("collection_id", collectionIds);

      if (itemError) {
        return NextResponse.json(
          { error: itemError.message },
          { status: 500 }
        );
      }

      for (const row of itemRows ?? []) {
        counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      items: (data ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        color: collection.color,
        locked: Boolean(collection.pin_hash),
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
        count: counts.get(collection.id) ?? 0,
      })),
    });
  } catch (error: any) {
    console.error("JOURNAL COLLECTIONS GET ERROR:", error);

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
    const name = normalizeName(body.name);
    const color = normalizeColor(body.color);
    const pin = normalizePin(body.pin);

    if (!name) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    if (pin && !isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("journal_collections")
      .insert({
        user_id: user.id,
        name,
        color,
        pin_hash: pin ? hashPin(pin, user.id) : null,
      })
      .select("id, name, color, pin_hash, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const journalIds = Array.isArray(body.journalIds)
      ? body.journalIds.filter((value: unknown) => typeof value === "string")
      : [];

    if (journalIds.length > 0) {
      const { data: ownedJournals, error: journalsError } = await supabase
        .from("journals")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("id", journalIds);

      if (journalsError) {
        return NextResponse.json(
          { error: journalsError.message },
          { status: 500 }
        );
      }

      const rows = (ownedJournals ?? []).map((journal) => ({
        user_id: user.id,
        collection_id: data.id,
        journal_id: journal.id,
      }));

      if (rows.length > 0) {
        const { error: itemsError } = await supabase
          .from("journal_collection_items")
          .upsert(rows, { onConflict: "collection_id,journal_id" });

        if (itemsError) {
          return NextResponse.json(
            { error: itemsError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      color: data.color,
      locked: Boolean(data.pin_hash),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      count: journalIds.length,
    });
  } catch (error: any) {
    console.error("JOURNAL COLLECTIONS POST ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
