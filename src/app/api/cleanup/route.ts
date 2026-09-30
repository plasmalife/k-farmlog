import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Cleanup not configured" },
      { status: 503 },
    );
  const db = createClient(url, key, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data, error } = await db
    .from("note_photos")
    .select("path,note_id,slot")
    .lt("created_at", cutoff)
    .limit(1000);
  if (error)
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  if (data?.length) {
    const { error: removeError } = await db.storage
      .from("farm-photos")
      .remove(data.map((p) => p.path));
    if (removeError)
      return NextResponse.json(
        { error: "File cleanup failed" },
        { status: 500 },
      );
    const { error: rowError } = await db
      .from("note_photos")
      .delete()
      .in(
        "path",
        data.map((p) => p.path),
      )
      .lt("created_at", cutoff);
    if (rowError)
      return NextResponse.json(
        { error: "Metadata cleanup failed" },
        { status: 500 },
      );
  }
  await db
    .from("ai_usage")
    .delete()
    .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  return NextResponse.json({ removed: data?.length || 0 });
}
