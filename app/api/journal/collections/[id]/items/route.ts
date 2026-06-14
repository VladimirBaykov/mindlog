import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

function getJournalIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string"))
  );
}

async function hasCollectionAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  collectionId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("journal_collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAuthed();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await hasCollectionAccess(supabase, id, user.id);

    if (!canAccess) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const journalIds = getJournalIds(body.journalIds);

    if (!journalIds.length) {
      return NextResponse.json({ error: "No journal ids provided" }, { status: 400 });
    }

    const { data: ownedJournals, error: journalsError } = await supabase
      .from("journals")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("id", journalIds);

    if (journalsError) {
      return NextResponse.json({ error: journalsError.message }, { status: 500 });
    }

    const rows = (ownedJournals ?? []).map((journal) => ({
      user_id: user.id,
      collection_id: id,
      journal_id: journal.id,
    }));

    if (rows.length > 0) {
      const { error: writeError } = await supabase
        .from("journal_collection_items")
        .upsert(rows, { onConflict: "collection_id,journal_id" });

      if (writeError) {
        return NextResponse.json({ error: writeError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, added: rows.length });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION ITEMS ADD ERROR:", error);

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

    const canAccess = await hasCollectionAccess(supabase, id, user.id);

    if (!canAccess) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const journalIds = getJournalIds(body.journalIds);

    if (!journalIds.length) {
      return NextResponse.json({ error: "No journal ids provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("journal_collection_items")
      .delete()
      .eq("collection_id", id)
      .eq("user_id", user.id)
      .in("journal_id", journalIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION ITEMS REMOVE ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
