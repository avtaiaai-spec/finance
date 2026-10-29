import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("private avatar bucket and owner-only Storage policies", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id serial primary key,bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon,authenticated;grant insert,delete on storage.objects to authenticated;grant usage,select on sequence storage.objects_id_seq to authenticated;`,
  );
  const sql = await fs.readFile(
    new URL("../supabase/profile.sql", import.meta.url),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  const bucket = (
    await db.query<any>(
      "select * from storage.buckets where id='finance-avatars'",
    )
  ).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 1048576);
  assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg"]);
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  const path = owner + "/33333333-3333-4333-8333-333333333333.jpg";
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}'`);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('finance-avatars',$1)",
    [path],
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name) values('finance-avatars',$1)",
      [other + "/33333333-3333-4333-8333-333333333333.jpg"],
    ),
    (e: any) => e.code === "42501",
  );
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name) values('finance-avatars',$1)",
      [owner + "/../other.jpg"],
    ),
    (e: any) => e.code === "42501",
  );
  await db.exec(`set request.jwt.claim.sub='${other}'`);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await db.query("delete from storage.objects where name=$1", [path]);
  await db.exec("reset role;set role anon");
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${owner}'`,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  await db.query("delete from storage.objects where name=$1", [path]);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await db.close();
});
