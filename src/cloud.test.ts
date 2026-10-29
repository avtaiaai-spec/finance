import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, type Data } from "./model";
import { equal, mergeFinance } from "./cloud-merge";
import { CloudStore, type CloudRow, type Transport } from "./cloud-store";
const clone = <T>(d: T): T => structuredClone(d);
const transaction = (id: string, amount = 100) => ({
  id,
  type: "expense" as const,
  amount,
  categoryId: "category-0",
  date: "2026-10-29",
  comment: "",
});
function backend() {
  let row: CloudRow | null = null;
  let fail = false;
  const transport: Transport = {
    async read() {
      if (fail) throw Error("offline");
      return clone(row);
    },
    async write(revision, payload) {
      if (fail) throw Error("offline");
      if (revision !== (row?.revision || 0))
        throw Object.assign(Error("conflict"), { code: "40001" });
      row = {
        revision: revision + 1,
        payload: clone(payload),
        updated_at: new Date().toISOString(),
      };
      return clone(row);
    },
  };
  return {
    transport,
    get row() {
      return row;
    },
    set fail(v: boolean) {
      fail = v;
    },
  };
}
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
test("independent additions and settings merge without mutating inputs", () => {
  const b = initial(),
    l = clone(b),
    r = clone(b);
  l.transactions.push(transaction("a"));
  r.transactions.push(transaction("b"));
  l.settings.palette = "pink";
  r.settings.lastExpenseDate = "2026-10-28";
  const before = JSON.stringify([b, l, r]);
  const result = mergeFinance(b, l, r);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.data.transactions.length, 2);
  assert.equal(result.data.settings.palette, "pink");
  assert.equal(result.data.settings.lastExpenseDate, "2026-10-28");
  assert.equal(JSON.stringify([b, l, r]), before);
});
test("deletions, conflicting edits and resolution preserve unrelated records", () => {
  const b = initial();
  b.transactions = [transaction("a")];
  const l = clone(b),
    r = clone(b);
  l.transactions[0].amount = 200;
  r.transactions[0].amount = 300;
  r.transactions.push(transaction("b"));
  assert.ok(mergeFinance(b, l, r).conflicts.length);
  const result = mergeFinance(b, l, r, "remote");
  assert.equal(result.data.transactions.find((t) => t.id === "a")?.amount, 300);
  assert.equal(result.data.transactions.length, 2);
  l.transactions = [];
  assert.ok(mergeFinance(b, l, r).conflicts.length);
  assert.equal(mergeFinance(b, l, b).data.transactions.length, 0);
});
test("same CSV imported on different devices is not counted twice", () => {
  const b = initial(),
    l = clone(b),
    r = clone(b);
  l.transactions = [{ ...transaction("a"), importKey: "coinbox:example:1" }];
  r.transactions = [{ ...transaction("b"), importKey: "coinbox:example:1" }];
  assert.equal(mergeFinance(b, l, r).data.transactions.length, 1);
  r.transactions[0].amount = 900;
  assert.ok(mergeFinance(b, l, r).conflicts.length);
  assert.equal(
    mergeFinance(b, l, r, "remote").data.transactions[0].amount,
    900,
  );
});
test("two devices synchronize independent offline changes; user caches remain isolated", async () => {
  const server = backend(),
    storage = memory();
  const a = new CloudStore("one", server.transport, storage),
    b = new CloudStore("one", server.transport, memory());
  await a.sync();
  await b.sync();
  server.fail = true;
  const x = clone(a.data);
  x.transactions.push(transaction("a"));
  a.update(x);
  await a.sync();
  assert.equal(a.dirty, true);
  const y = clone(b.data);
  y.transactions.push(transaction("b"));
  b.update(y);
  server.fail = false;
  await b.sync();
  await a.sync();
  await b.sync();
  assert.equal(server.row?.payload.transactions.length, 2);
  assert.equal(a.dirty, false);
  assert.equal(b.dirty, false);
  const restored = new CloudStore("one", server.transport, storage);
  assert.equal(restored.data.transactions.length, 2);
  const other = new CloudStore("two", server.transport, storage);
  assert.equal(other.data.transactions.length, 0);
  a.stop();
  b.stop();
  restored.stop();
  other.stop();
});
test("in-flight local changes survive the server response", async () => {
  const server = backend();
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const arrived = new Promise<void>((r) => (entered = r));
  const gate = new Promise<void>((r) => (release = r));
  let first = true;
  const transport: Transport = {
    read: () => server.transport.read(),
    async write(revision, data) {
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return server.transport.write(revision, data);
    },
  };
  const a = new CloudStore("one", transport, memory());
  const d = initial();
  d.transactions = [transaction("a")];
  a.update(d);
  const syncing = a.sync();
  await arrived;
  const later = clone(a.data);
  later.transactions.push(transaction("b"));
  a.update(later);
  release();
  await syncing;
  assert.equal(a.data.transactions.length, 2);
  assert.equal(server.row?.payload.transactions.length, 2);
  a.stop();
});
test("a committed request with a lost response does not duplicate a transaction", async () => {
  const server = backend();
  let failResponse = true;
  const transport: Transport = {
    read: () => server.transport.read(),
    async write(r, d) {
      const row = await server.transport.write(r, d);
      if (failResponse) {
        failResponse = false;
        throw Error("response lost");
      }
      return row;
    },
  };
  const a = new CloudStore("one", transport, memory());
  const d = initial();
  d.transactions = [transaction("a")];
  a.update(d);
  await a.sync();
  assert.equal(a.dirty, true);
  await a.sync();
  assert.equal(a.dirty, false);
  assert.equal(server.row?.revision, 1);
  assert.equal(a.data.transactions.length, 1);
  a.stop();
});
test("a full queue survives reload, and conflicting edits are not pushed until resolved", async () => {
  const server = backend(),
    storage = memory();
  const a = new CloudStore("one", server.transport, storage);
  const d = initial();
  d.transactions = [transaction("a")];
  a.update(d);
  await a.sync();
  const b = new CloudStore("one", server.transport, memory());
  await b.sync();
  const l = clone(a.data);
  l.transactions[0].amount = 200;
  a.update(l);
  a.stop();
  const restored = new CloudStore("one", server.transport, storage);
  assert.equal(restored.dirty, true);
  const r = clone(b.data);
  r.transactions[0].amount = 300;
  b.update(r);
  await b.sync();
  await restored.sync();
  assert.ok(restored.conflicts.length);
  assert.equal(server.row?.payload.transactions[0].amount, 300);
  restored.resolve("local");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(server.row?.payload.transactions[0].amount, 200);
  a.stop();
  b.stop();
  restored.stop();
});

test("expense entry dates remain device-local and never block independent financial edits", async () => {
  const server = backend();
  const a = new CloudStore("one", server.transport, memory()),
    b = new CloudStore("one", server.transport, memory());
  await a.sync();
  await b.sync();
  const x = clone(a.data);
  x.settings.lastExpenseDate = "2026-10-28";
  x.transactions = [{ ...transaction("a"), date: "2026-10-28" }];
  a.update(x);
  await a.sync();
  await b.sync();
  assert.equal(b.data.settings.lastExpenseDate, undefined);
  const y = clone(b.data);
  y.settings.lastExpenseDate = "2026-10-27";
  y.transactions.push({ ...transaction("b"), date: "2026-10-27" });
  b.update(y);
  await b.sync();
  await a.sync();
  assert.equal(a.data.settings.lastExpenseDate, "2026-10-28");
  assert.equal(b.data.settings.lastExpenseDate, "2026-10-27");
  assert.equal(server.row?.payload.settings.lastExpenseDate, undefined);
  assert.equal(a.data.transactions.length, 2);
  assert.equal(a.conflicts.length, 0);
  a.stop();
  b.stop();
});
