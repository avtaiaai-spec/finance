import { initial, validateData, type Data } from "./model";
export const stable = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  ) ?? "undefined";
export const equal = (a: unknown, b: unknown) => stable(a) === stable(b);
export type MergeResult = { data: Data; conflicts: string[] };
// Three-way merge retains independent edits and deletions. Same-record conflicts are explicit.
export function mergeFinance(
  base: Data,
  local: Data,
  remote: Data,
  choice?: "local" | "remote",
): MergeResult {
  const conflicts: string[] = [];
  const merge = (b: any, l: any, r: any, path: string): any => {
    if (equal(l, r)) return l;
    if (equal(l, b)) return r;
    if (equal(r, b)) return l;
    // Appearance and reminder preferences must not block financial synchronization.
    if (
      path.startsWith("/settings/") &&
      (l === undefined ||
        r === undefined ||
        typeof l !== "object" ||
        typeof r !== "object")
    ) {
      if (path.endsWith("/lastBackupOn") || path.endsWith("/snoozedUntil"))
        return [l, r]
          .filter((v) => typeof v === "string")
          .sort()
          .at(-1);
      if (path.endsWith("/startedOn"))
        return [l, r].filter((v) => typeof v === "string").sort()[0];
      return l;
    }
    if (l === undefined || r === undefined) {
      conflicts.push(path);
      return choice === "remote" ? r : l;
    }
    if (
      Array.isArray(l) &&
      Array.isArray(r) &&
      l.every((x) => x && typeof x.id === "string") &&
      r.every((x) => x && typeof x.id === "string")
    ) {
      const ba = Array.isArray(b) ? b : [],
        bm = new Map(ba.map((x: any) => [x.id, x])),
        lm = new Map(l.map((x) => [x.id, x])),
        rm = new Map(r.map((x) => [x.id, x]));
      const order = [
        ...l.map((x) => x.id),
        ...r.map((x) => x.id).filter((id) => !lm.has(id)),
      ];
      return order
        .map((id) => merge(bm.get(id), lm.get(id), rm.get(id), `${path}/${id}`))
        .filter((x) => x !== undefined);
    }
    if (
      l &&
      r &&
      typeof l === "object" &&
      typeof r === "object" &&
      !Array.isArray(l) &&
      !Array.isArray(r)
    ) {
      return Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(b || {}),
            ...Object.keys(l),
            ...Object.keys(r),
          ]),
        ].flatMap((k) => {
          const v = merge(b?.[k], l[k], r[k], `${path}/${k}`);
          return v === undefined ? [] : [[k, v]];
        }),
      );
    }
    conflicts.push(path);
    return choice === "remote" ? r : l;
  };
  let merged = structuredClone(merge(base, local, remote, "")) as Data;
  // A category created independently with the same name/type represents the same category.
  const aliases = new Map<string, string>();
  const grouped = new Map<string, Data["categories"][number]>();
  const baseIds = new Set(base.categories.map((c) => c.id));
  for (const c of [...merged.categories].sort(
    (a, b) =>
      Number(baseIds.has(b.id)) - Number(baseIds.has(a.id)) ||
      a.id.localeCompare(b.id),
  )) {
    const k = c.type + ":" + c.name.trim().replace(/\s+/g, " ").toLowerCase();
    const prior = grouped.get(k);
    if (prior) aliases.set(c.id, prior.id);
    else grouped.set(k, c);
  }
  merged.categories = merged.categories.filter((c) => !aliases.has(c.id));
  merged.transactions = merged.transactions.map((t) => ({
    ...t,
    categoryId: aliases.get(t.categoryId) || t.categoryId,
  }));
  merged.budgets = merged.budgets.map((b) => ({
    ...b,
    categoryId: aliases.get(b.categoryId) || b.categoryId,
  }));
  const transactions: Data["transactions"] = [];
  const seen = new Map<string, number>();
  for (const t of merged.transactions) {
    if (!t.importKey) {
      transactions.push(t);
      continue;
    }
    const index = seen.get(t.importKey);
    if (index === undefined) {
      seen.set(t.importKey, transactions.length);
      transactions.push(t);
      continue;
    }
    const prior = transactions[index];
    const comparable = (x: typeof t) => ({ ...x, id: "" });
    if (!equal(comparable(prior), comparable(t))) {
      conflicts.push("Одна импортированная операция изменена по-разному");
      const selected = (choice === "remote" ? remote : local).transactions.find(
        (x) => x.importKey === t.importKey,
      );
      if (selected)
        transactions[index] = {
          ...selected,
          categoryId: aliases.get(selected.categoryId) || selected.categoryId,
        };
    }
  }
  merged.transactions = transactions;
  try {
    merged = validateData(merged);
  } catch {
    // For example, one device deletes a category while another adds an operation in it.
    conflicts.push("Связанные категории, операции или лимиты");
    merged = choice === "remote" ? remote : local;
  }
  return { data: merged, conflicts: [...new Set(conflicts)] };
}
export function hasFinance(d: Data) {
  const clean = initial();
  return (
    d.transactions.length > 0 ||
    d.budgets.length > 0 ||
    d.goals.length > 0 ||
    d.startingMoney !== undefined ||
    !equal(d.categories, clean.categories)
  );
}
