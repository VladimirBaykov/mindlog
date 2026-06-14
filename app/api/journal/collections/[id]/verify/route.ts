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

function hashCode(code: string, userId: string) {
  return createHash("sha256")
    .update(`mindlog-collection-pin-v1:${userId}:${code}`)
    .digest("hex");
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code);

    const { data, error } = await supabase
      .from("journal_collections")
      .select("id, pin_hash")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (!data.pin_hash) {
      return NextResponse.json({ verified: true });
    }

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const verified = hashCode(code, user.id) === data.pin_hash;

    if (!verified) {
      return NextResponse.json(
        { error: "Incorrect code" },
        { status: 403 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error("JOURNAL COLLECTION VERIFY ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
