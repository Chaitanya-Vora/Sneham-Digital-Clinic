import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Every table with real clinic data — a full logical snapshot, not just
// the tables that happen to have foreign keys to patients. Kept as an
// explicit list (not introspected from information_schema) so a new
// table added later doesn't silently start being backed up before
// someone's deliberately decided that's correct.
const TABLES = [
  "practitioners", "patients", "appointments", "prescriptions",
  "investigation_orders", "invoices", "dose_reminders", "check_ins",
  "handoffs", "documents", "second_opinions", "outcomes", "case_data",
  "case_visits", "messages", "notifications", "time_blocks",
  "remedy_stock", "video_rooms",
] as const;

const RETENTION_DAYS = 90;

Deno.serve(async (req: Request) => {
  // The cron invocation authenticates with the project's own anon key
  // (a valid signed JWT, satisfying the function gateway's verify_jwt
  // check) — that's a separate concern from data access. Actual reads
  // below use the service-role key, injected automatically into every
  // Edge Function's environment by Supabase, never passed over HTTP.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const snapshot: Record<string, unknown> = {
    takenAt: new Date().toISOString(),
    tables: {},
  };
  const errors: string[] = [];

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      errors.push(`${table}: ${error.message}`);
      (snapshot.tables as Record<string, unknown>)[table] = null;
    } else {
      (snapshot.tables as Record<string, unknown>)[table] = data;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const path = `weekly/${today}.json`;
  const body = JSON.stringify(snapshot);

  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(path, new Blob([body], { type: "application/json" }), { upsert: true });

  if (uploadError) errors.push(`upload: ${uploadError.message}`);

  // Prune backups older than the retention window so storage doesn't
  // grow unbounded — this is a safety net, not a permanent archive.
  const { data: existing } = await supabase.storage.from("backups").list("weekly", { limit: 1000 });
  if (existing) {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const stale = existing
      .filter((f) => {
        const m = f.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
        if (!m) return false;
        return new Date(m[1] + "T00:00:00Z").getTime() < cutoff;
      })
      .map((f) => `weekly/${f.name}`);
    if (stale.length > 0) await supabase.storage.from("backups").remove(stale);
  }

  const ok = errors.length === 0;
  return new Response(JSON.stringify({ ok, path, errors, tableCount: TABLES.length }), {
    status: ok ? 200 : 207,
    headers: { "Content-Type": "application/json" },
  });
});
