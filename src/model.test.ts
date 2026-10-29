import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  range,
  shift,
  initial,
  sum,
  within,
  budgetResult,
  goalResult,
  validateData,
  demoData,
} from "./model";
test("деньги хранятся в целых копейках", () => {
  assert.equal(cents("12500,50"), 1250050);
  assert.equal(cents("0.01"), 1);
  assert.equal(cents("12.1"), 1210);
  for (const s of ["0", "-1", "1.001", "1e3", "NaN", ""])
    assert.throws(() => cents(s));
});
test("календарные периоды и переходы года", () => {
  assert.deepEqual(range("week", "2026-11-01"), ["2026-10-26", "2026-11-01"]);
  assert.deepEqual(range("quarter", "2026-10-29"), [
    "2026-10-01",
    "2026-12-31",
  ]);
  assert.deepEqual(range("month", "2024-02-15"), ["2024-02-01", "2024-02-29"]);
  assert.equal(shift("month", "2026-01-31", -1), "2025-12-01");
  assert.equal(shift("quarter", "2026-11-30", 1), "2027-01-01");
});
test("лимиты разных периодов независимы, доход не считается расходом", () => {
  const d = initial();
  d.transactions = [
    {
      id: "a",
      type: "expense",
      categoryId: "category-0",
      amount: 1850050,
      date: "2026-10-29",
      comment: "",
    },
    {
      id: "b",
      type: "expense",
      categoryId: "category-0",
      amount: 500000,
      date: "2026-09-29",
      comment: "",
    },
    {
      id: "c",
      type: "income",
      categoryId: "category-19",
      amount: 5000000,
      date: "2026-10-29",
      comment: "",
    },
  ];
  const b = {
    id: "b1",
    categoryId: "category-0",
    amount: 2000000,
    period: "month" as const,
    enabled: true,
  };
  assert.deepEqual(budgetResult(b, d, "2026-10-29"), {
    spent: 1850050,
    left: 149950,
    percent: 92.5025,
  });
  assert.equal(
    sum(
      d.transactions.filter((t) =>
        within(t.date, range("quarter", "2026-10-29")),
      ),
      "expense",
    ),
    1850050,
  );
  d.transactions = d.transactions.filter((t) => t.id !== "a");
  assert.equal(budgetResult(b, d, "2026-10-29").spent, 0);
});
test("накопления только вручную; расходная цель успешна после завершения", () => {
  const d = initial();
  const g = {
    id: "g",
    name: "Лимит",
    type: "expense" as const,
    amount: 5000000,
    period: "month" as const,
    start: "2026-10-01",
    end: "2026-10-31",
    comment: "",
    contributions: [],
  };
  assert.equal(goalResult(g, d, "2026-10-29").status, "Активна");
  assert.equal(goalResult(g, d, "2026-11-01").status, "Достигнута");
  const saving = {
    ...g,
    type: "saving" as const,
    contributions: [
      { id: "con", amount: 10000, date: "2026-10-29", comment: "" },
    ],
  };
  assert.equal(goalResult(saving, d).actual, 10000);
  d.transactions = [
    {
      id: "income",
      type: "income",
      amount: 10000000,
      date: "2026-10-29",
      categoryId: "category-19",
      comment: "",
    },
  ];
  assert.equal(goalResult(saving, d).actual, 10000);
});
test("импорт отвергает дубликаты, битые ссылки, даты и неверные копейки", () => {
  assert.doesNotThrow(() => validateData(initial()));
  assert.doesNotThrow(() => validateData(demoData()));
  for (const mutate of [
    (d: ReturnType<typeof initial>) => d.categories.push(d.categories[0]),
    (d: ReturnType<typeof initial>) =>
      d.transactions.push({
        id: "t",
        type: "expense",
        categoryId: "missing",
        amount: 100,
        date: "2026-10-29",
        comment: "",
      }),
    (d: ReturnType<typeof initial>) =>
      d.transactions.push({
        id: "t",
        type: "expense",
        categoryId: "category-0",
        amount: 1.5,
        date: "2026-10-29",
        comment: "",
      }),
    (d: ReturnType<typeof initial>) =>
      d.transactions.push({
        id: "t",
        type: "expense",
        categoryId: "category-0",
        amount: 100,
        date: "2026-02-31",
        comment: "",
      }),
  ]) {
    const d = initial();
    mutate(d);
    assert.throws(() => validateData(d));
  }
});
