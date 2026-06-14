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

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 60);
}

function normalizeColor(value: unknown): CollectionColor | null {
  if (typeof value === "undefined") return null;
  return COLLECTION_COLORS.includes(value as CollectionColor)
    ? (value as CollectionColor)
    : "blue";
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

export async function GET(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: collection, error: collectionError } = await supabase
      .from("journal_collections")
      .select("id, name, color, pin_hash, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const { data: itemLinks, error: linksError } = await supabase
      .from("journal_collection_items")
      .select("journal_id, created_at")
      .eq("collection_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    const journalIds = (itemLinks ?? []).map((item) => item.journal_id);

    let journals: any[] = [];

    if (journalIds.length > 0) {
      const { data: journalRows, error: journalsError } = await supabase
        .from("journals")
        .select("id, title, mood, created_at, updated_at, deleted_at, content, metadata, is_favorite, hidden_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("id", journalIds);

      if (journalsError) {
        return NextResponse.json(
          { error: journalsError.message },
          { status: 500 }
        );
      }

      const order = new Map(
        journalIds.map((journalId, index) => [journalId, index])
      );

      journals = (journalRows ?? []).sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      );
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        color: collection.color,
        locked: Boolean(collection.pin_hash),
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
        count: journals.length,
      },
      items: journals,
    });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION GET ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const payload: Record<string, unknown> = {};

    if ("name" in body) {
      const name = normalizeName(body.name);
      if (!name) {
        return NextResponse.json(
          { error: "Collection name is required" },
          { status: 400 }
        );
      }
      payload.name = name;
    }

    if ("color" in body) {
      payload.color = normalizeColor(body.color) ?? "blue";
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { data, error } = await supabase
      .from("journal_collections")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id, name, color, pin_hash, created_at, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Collection not found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      color: data.color,
      locked: Boolean(data.pin_hash),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION PATCH ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("journal_collections")
      .update({ deleted_at: now })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION DELETE ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
