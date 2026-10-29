import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { initial } from "./model";
test("SQL: authenticated owners only, compare-and-swap, history isolation, denied direct writes", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`,
  );
  const sql = await fs.readFile(
    new URL("../supabase/setup.sql", import.meta.url),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select * from public.finance_state"),
    (e: any) => e.code === "42501",
  );
  await assert.rejects(
    db.query("select public.save_finance_state(0,$1::jsonb)", [
      JSON.stringify(initial()),
    ]),
    (e: any) => e.code === "42501",
  );
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';`,
  );
  const d = initial();
  const saved = await db.query<{ result: any }>(
    "select public.save_finance_state(0,$1::jsonb) as result",
    [JSON.stringify(d)],
  );
  assert.equal(saved.rows[0].result.revision, 1);
  await assert.rejects(
    db.query("select public.save_finance_state(0,$1::jsonb)", [
      JSON.stringify(d),
    ]),
    (e: any) => e.code === "40001",
  );
  d.startingMoney = 12300;
  await db.query("select public.save_finance_state(1,$1::jsonb)", [
    JSON.stringify(d),
  ]);
  assert.equal(
    (await db.query("select * from public.finance_history")).rows.length,
    1,
  );
  await assert.rejects(
    db.query("update public.finance_state set revision=999"),
    (e: any) => e.code === "42501",
  );
  await db.exec(
    `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'`,
  );
  assert.equal(
    (await db.query("select * from public.finance_state")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.finance_history")).rows.length,
    0,
  );
  await db.query("select public.save_finance_state(0,$1::jsonb)", [
    JSON.stringify(initial()),
  ]);
  await db.exec(
    `set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'`,
  );
  assert.equal(
    (await db.query<any>("select revision from public.finance_state")).rows[0]
      .revision,
    2,
  );
  await db.close();
});
