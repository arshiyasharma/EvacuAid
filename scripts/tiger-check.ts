import postgres from "postgres";
const sql = postgres(process.env.TIGER_DATABASE_URL!, { ssl: "require", max: 1 });
const [v] = await sql`select version() as v`;
const ext = await sql`select extversion from pg_extension where extname = 'timescaledb'`;
console.log(String(v.v).split(",")[0], "| timescaledb", ext[0]?.extversion);
await sql.end();
