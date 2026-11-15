// Tiger Data (TimescaleDB): the incident's memory. Every text, case, dispatch,
// Nessie transaction and Solana release is a time-stamped row in a hypertable;
// a continuous aggregate rolls it up every 5 minutes for the live charts and the
// after-action report. Writes never block the app: if Tiger is unreachable, the
// rescue keeps going and the row is skipped.

import "server-only";
import postgres from "postgres";

export type TigerKind =
  | "text_in"
  | "text_out"
  | "case_ride"
  | "case_aid"
  | "case_check"
  | "dispatch"
  | "aid_created"
  | "aid_approved"
  | "aid_held"
  | "aid_blocked"
  | "aid_settled"
  | "solana_release"
  | "solana_refused"
  | "solana_gift"
  | "card_ok"
  | "card_declined"
  | "trip_billed"
  | "drill";

type Row = { kind: TigerKind; run: number; system: string; household?: string; cents?: number; detail?: string; ref?: string; at?: number };

const g = globalThis as unknown as { __evacuaidTiger?: { sql: postgres.Sql; ready: Promise<void> } | null };

function client() {
  if (g.__evacuaidTiger !== undefined) return g.__evacuaidTiger;
  const url = process.env.TIGER_DATABASE_URL;
  if (!url) return (g.__evacuaidTiger = null);
  const sql = postgres(url, { ssl: "require", max: 3, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  const ready = (async () => {
    await sql`create table if not exists evac_events (
      time timestamptz not null,
      run int not null,
      system text not null,
      kind text not null,
      household text,
      cents bigint,
      detail text,
      ref text
    )`;
    await sql`select create_hypertable('evac_events', by_range('time', interval '1 day'), if_not_exists => true)`;
    await sql`create index if not exists evac_events_run_kind on evac_events (run, kind, time desc)`;
    await sql.unsafe(`
      create materialized view if not exists evac_events_5min
      with (timescaledb.continuous, timescaledb.materialized_only = false) as
      select time_bucket('5 minutes', time) as bucket, run, kind,
             count(*) as n, coalesce(sum(cents), 0)::bigint as cents
      from evac_events group by bucket, run, kind
      with no data`);
    await sql`select add_continuous_aggregate_policy('evac_events_5min',
      start_offset => interval '2 days', end_offset => interval '1 minute',
      schedule_interval => interval '1 minute', if_not_exists => true)`;
    await sql.unsafe(`alter table evac_events set (timescaledb.compress, timescaledb.compress_segmentby = 'run, kind')`).catch(() => undefined);
    await sql`select add_compression_policy('evac_events', interval '7 days', if_not_exists => true)`.catch(() => undefined);
  })().catch((e) => console.warn("[tiger] schema:", (e as Error).message));
  return (g.__evacuaidTiger = { sql, ready });
}

export const tigerConfigured = () => Boolean(process.env.TIGER_DATABASE_URL);

/** Write one event. Fire and forget: never slows down a rescue. */
export function tigerEvent(r: Row) {
  const c = client();
  if (!c) return;
  c.ready
    .then(
      () => c.sql`insert into evac_events (time, run, system, kind, household, cents, detail, ref)
        values (${new Date(r.at ?? Date.now())}, ${r.run}, ${r.system}, ${r.kind}, ${r.household ?? null}, ${r.cents ?? null}, ${r.detail ?? null}, ${r.ref ?? null})`,
    )
    .catch((e) => console.warn("[tiger] insert:", (e as Error).message));
}

export type Metrics = {
  ok: boolean;
  ms: number;
  run: number;
  totals: Record<string, { n: number; cents: number }>;
  series: { bucket: string; kind: string; n: number; cents: number }[];
  rows: number;
};

/** Live charts for one run, from the continuous aggregate. */
export async function metrics(run: number): Promise<Metrics> {
  const c = client();
  const empty: Metrics = { ok: false, ms: 0, run, totals: {}, series: [], rows: 0 };
  if (!c) return empty;
  const t0 = Date.now();
  try {
    await c.ready;
    const [series, totals, [{ rows }]] = await Promise.all([
      c.sql<{ bucket: Date; kind: string; n: string; cents: string }[]>`
        select bucket, kind, n, cents from evac_events_5min
        where run = ${run} and bucket > now() - interval '6 hours'
        order by bucket`,
      c.sql<{ kind: string; n: string; cents: string }[]>`
        select kind, sum(n) as n, sum(cents) as cents from evac_events_5min
        where run = ${run} group by kind`,
      c.sql<{ rows: string }[]>`select count(*) as rows from evac_events`,
    ]);
    return {
      ok: true,
      ms: Date.now() - t0,
      run,
      totals: Object.fromEntries(totals.map((t) => [t.kind, { n: Number(t.n), cents: Number(t.cents) }])),
      series: series.map((s) => ({ bucket: s.bucket.toISOString(), kind: s.kind, n: Number(s.n), cents: Number(s.cents) })),
      rows: Number(rows),
    };
  } catch (e) {
    console.warn("[tiger] metrics:", (e as Error).message);
    return { ...empty, ms: Date.now() - t0 };
  }
}
