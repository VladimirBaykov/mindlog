import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
    new Set(value.filter((item): item is string => typeof item === "string")),
  );
}

async function hasCollectionAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  collectionId: string,
  userId: string,
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

async function getOwnedJournalIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  journalIds: string[],
  userId: string,
) {
  const { data, error } = await supabase
    .from("journals")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", journalIds);

  if (error) throw error;
  return (data ?? []).map((journal) => journal.id as string);
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

    const ownedJournalIds = await getOwnedJournalIds(supabase, journalIds, user.id);

    if (!ownedJournalIds.length) {
      return NextResponse.json({ error: "No owned journals found" }, { status: 404 });
    }

    const rows = ownedJournalIds.map((journalId) => ({
      user_id: user.id,
      collection_id: id,
      journal_id: journalId,
    }));

    const writer = createSupabaseAdminClient();
    const { error: writeError } = await writer
      .from("journal_collection_items")
      .upsert(rows, { onConflict: "collection_id,journal_id" });

    if (writeError) {
      console.error("JOURNAL COLLECTION ITEMS UPSERT ERROR:", writeError, {
        collectionId: id,
        journalIds: ownedJournalIds,
      });

      return NextResponse.json(
        { error: writeError.message || "Could not add to this collection" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, added: rows.length });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION ITEMS ADD ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
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

    const ownedJournalIds = await getOwnedJournalIds(supabase, journalIds, user.id);

    if (!ownedJournalIds.length) {
      return NextResponse.json({ success: true, removed: 0 });
    }

    const writer = createSupabaseAdminClient();
    const { error } = await writer
      .from("journal_collection_items")
      .delete()
      .eq("collection_id", id)
      .eq("user_id", user.id)
      .in("journal_id", ownedJournalIds);

    if (error) {
      console.error("JOURNAL COLLECTION ITEMS DELETE ERROR:", error, {
        collectionId: id,
        journalIds: ownedJournalIds,
      });

      return NextResponse.json(
        { error: error.message || "Could not remove from this collection" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, removed: ownedJournalIds.length });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION ITEMS REMOVE ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
