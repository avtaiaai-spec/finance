import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoinBox, planCoinBox, readCsv } from "./coinbox";
import { initial, validateData, sum } from "./model";
const header = "Date,Type,Category,Amount,Currency,Note\n";
const line = "2026-10-27 10:19:15,expense,Продукты,934.25,RUB,Ужин\n";
test("CoinBox: корректные копейки, даты, категории и добавление вместо замены", () => {
  const d = initial();
  d.transactions.push({
    id: "manual",
    type: "income",
    categoryId: "category-19",
    amount: 100,
    date: "2026-10-27",
    comment: "",
  });
  const f = parseCoinBox(
    header + line + "2026-10-28 09:10:11,income, Баллы ,2555.00,RUB,\n",
  );
  const p = planCoinBox(d, f);
  assert.equal(p.transactions.length, 2);
  assert.equal(p.next.transactions.length, 3);
  assert.equal(p.transactions[0].amount, 93425);
  assert.equal(p.transactions[0].date, "2026-10-27");
  assert.equal(p.newCategories.length, 1);
  assert.equal(p.newCategories[0].name, "Баллы");
  assert.equal(p.next.settings, d.settings);
  assert.equal(p.next.goals, d.goals);
  assert.equal(d.transactions.length, 1);
});
test("повторный и пересекающийся импорт не создаёт дубликаты", () => {
  const f = parseCoinBox(header + line);
  const first = planCoinBox(initial(), f);
  const next = planCoinBox(first.next, f);
  assert.equal(next.transactions.length, 0);
  assert.equal(next.duplicates, 1);
  const overlap = parseCoinBox(
    header + line + "2026-10-28 10:00:00,expense,Продукты,20.00,RUB,\n",
  );
  assert.equal(planCoinBox(first.next, overlap).transactions.length, 1);
});
test("одинаковые реальные операции в одном файле сохраняются отдельно", () => {
  const f = parseCoinBox(header + line + line);
  const p = planCoinBox(initial(), f);
  assert.equal(p.transactions.length, 2);
  assert.notEqual(p.transactions[0].importKey, p.transactions[1].importKey);
  assert.equal(planCoinBox(p.next, f).transactions.length, 0);
});
test("разное время не смешивается; ручные операции не считаются повторами", () => {
  const f = parseCoinBox(header + line + line.replace("10:19:15", "10:19:16"));
  assert.equal(planCoinBox(initial(), f).transactions.length, 2);
});
test("CSV-кавычки, запятые, двойные кавычки, переводы строк, BOM, CRLF", () => {
  const f = parseCoinBox(
    "\uFEFF" +
      header.replace("\n", "\r\n") +
      '2026-10-27 10:19:15,expense,"Кафе, кофе",10.50,RUB,"Ужин, ""вкусно""\nи чай"\r\n',
  );
  assert.equal(f.rows[0].category, "Кафе, кофе");
  assert.equal(f.rows[0].comment, 'Ужин, "вкусно"\nи чай');
  assert.deepEqual(readCsv('a;b\n"a;b";c', ";"), [
    ["a", "b"],
    ["a;b", "c"],
  ]);
});
test("невалидный файл блокируется целиком, без частичного импорта", () => {
  for (const invalid of [
    line.replace("RUB", "USD"),
    line.replace("934.25", "-2"),
    line.replace("934.25", "0"),
    line.replace("934.25", "1.234"),
    line.replace("2026-10-27", "2026-02-31"),
    line.replace("10:19:15", "25:19:15"),
    line.replace("expense", "transfer"),
    line.replace("Продукты", ""),
    line.slice(0, -1) + ",extra\n",
  ])
    assert.throws(() => parseCoinBox(header + line + invalid));
  assert.throws(() => parseCoinBox(header));
  assert.throws(() => parseCoinBox("foo,bar\n1,2"));
  assert.throws(() => parseCoinBox(header + '"unclosed'));
});
test("категории сопоставляются по типу и названию, включая пробелы и регистр", () => {
  const d = initial();
  const f = parseCoinBox(
    header +
      line.replace("Продукты", "  продукты  ") +
      "2026-10-27,income,Продукты,5,RUB,\n",
  );
  const p = planCoinBox(d, f);
  assert.equal(p.transactions[0].categoryId, "category-0");
  assert.equal(p.newCategories.length, 1);
  assert.equal(p.newCategories[0].type, "income");
});
test("JSON-резервная копия сохраняет защиту от повторного импорта", () => {
  const f = parseCoinBox(header + line);
  const p = planCoinBox(initial(), f);
  const restored = validateData(JSON.parse(JSON.stringify(p.next)));
  assert.equal(planCoinBox(restored, f).transactions.length, 0);
  assert.equal(sum(restored.transactions, "expense"), 93425);
});
