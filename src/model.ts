export type Palette = "green" | "pink" | "yellow" | "burgundy" | "brown";
export const paletteNames: Record<Palette, string> = {
  green: "Зелёная",
  pink: "Розовая",
  yellow: "Жёлтая",
  burgundy: "Бордовая",
  brown: "Коричневая",
};
export type Kind = "income" | "expense";
export type Period = "week" | "month" | "quarter" | "year";
export type Category = {
  id: string;
  name: string;
  type: Kind;
  icon: string;
  color: string;
  archived: boolean;
};
export type Transaction = {
  importKey?: string;
  id: string;
  type: Kind;
  amount: number;
  categoryId: string;
  date: string;
  comment: string;
};
export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  period: Period;
  enabled: boolean;
};
export type Contribution = {
  id: string;
  amount: number;
  date: string;
  comment: string;
};
export type Goal = {
  id: string;
  name: string;
  type: Kind | "saving";
  amount: number;
  period: Exclude<Period, "week">;
  start: string;
  end: string;
  comment: string;
  contributions: Contribution[];
};
export type CashBalance = { opening: number; date: string };
export type BackupReminder = {
  enabled: boolean;
  startedOn: string;
  lastBackupOn?: string;
  snoozedUntil?: string;
};
export type Data = {
  startingMoney?: number;
  cash?: CashBalance;
  version: 1;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  settings: {
    theme: "light" | "dark" | "system";
    palette?: Palette;
    lastExpenseDate?: string;
    backupReminder?: BackupReminder;
  };
};
export const uid = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const parseDate = (s: string) => new Date(s + "T12:00:00");
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: n % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
export function cents(s: string) {
  if (!/^\d{1,10}([.,]\d{1,2})?$/.test(s.trim()))
    throw Error(
      "Укажите положительную сумму, не более двух знаков после запятой",
    );
  const [a, b = ""] = s.trim().replace(",", ".").split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0)
    throw Error("Сумма должна быть больше нуля");
  return n;
}
export const amountInput = (n: number) => (n / 100).toFixed(2);
export const periodNames: Record<Period, string> = {
  week: "Неделя",
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
};
export function range(period: Period, anchor: string): [string, string] {
  const d = parseDate(anchor);
  let start: Date, end: Date;
  const y = d.getFullYear(),
    m = d.getMonth();
  if (period === "week") {
    start = new Date(y, m, d.getDate() - ((d.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else {
    const mm =
      period === "year" ? 0 : period === "quarter" ? Math.floor(m / 3) * 3 : m;
    const count = period === "year" ? 12 : period === "quarter" ? 3 : 1;
    start = new Date(y, mm, 1);
    end = new Date(y, mm + count, 0);
  }
  return [localDate(start), localDate(end)];
}
export function shift(period: Period, anchor: string, n: number) {
  const [s] = range(period, anchor),
    d = parseDate(s);
  if (period === "week") d.setDate(d.getDate() + 7 * n);
  else
    d.setMonth(
      d.getMonth() +
        n * (period === "month" ? 1 : period === "quarter" ? 3 : 12),
    );
  return localDate(d);
}
export const within = (date: string, r: [string, string]) =>
  date >= r[0] && date <= r[1];
export const sum = (ts: Transaction[], type: Kind) =>
  ts.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
export function budgetResult(b: Budget, data: Data, anchor: string) {
  const spent = sum(
    data.transactions.filter(
      (t) =>
        t.categoryId === b.categoryId &&
        within(t.date, range(b.period, anchor)),
    ),
    "expense",
  );
  return { spent, left: b.amount - spent, percent: (spent / b.amount) * 100 };
}
export function goalResult(g: Goal, data: Data, now = today()) {
  const actual =
    g.type === "saving"
      ? g.contributions.reduce((a, c) => a + c.amount, 0)
      : sum(
          data.transactions.filter((t) => within(t.date, [g.start, g.end])),
          g.type,
        );
  const ended = now > g.end;
  const success =
    g.type === "expense" ? ended && actual <= g.amount : actual >= g.amount;
  return {
    actual,
    left: g.amount - actual,
    percent: (actual / g.amount) * 100,
    status: success
      ? "Достигнута"
      : ended
        ? "Завершена без достижения"
        : "Активна",
  };
}
const palette = [
  "#83A994",
  "#D1AD76",
  "#8FA7BF",
  "#B69DC0",
  "#C99485",
  "#9BAA78",
  "#7AACA7",
];
const expenses = [
  ["Продукты", "ShoppingBasket"],
  ["Кафе и рестораны", "Coffee"],
  ["Транспорт", "Bus"],
  ["Автомобиль", "Car"],
  ["Жильё", "House"],
  ["Коммунальные платежи", "Lightbulb"],
  ["Здоровье", "HeartPulse"],
  ["Красота и уход", "Sparkles"],
  ["Одежда и обувь", "Shirt"],
  ["Развлечения", "Clapperboard"],
  ["Подписки", "Repeat"],
  ["Образование", "GraduationCap"],
  ["Путешествия", "Plane"],
  ["Подарки", "Gift"],
  ["Кредиты и займы", "Landmark"],
  ["Связь и интернет", "Wifi"],
  ["Домашние животные", "PawPrint"],
  ["Покупки для дома", "Armchair"],
  ["Прочее", "Shapes"],
];
const incomes = [
  ["Зарплата", "BriefcaseBusiness"],
  ["Премия", "Award"],
  ["Подработка", "Wrench"],
  ["Фриланс", "Laptop"],
  ["Подарки", "Gift"],
  ["Кешбэк", "RotateCcw"],
  ["Возвраты", "Undo2"],
  ["Проценты и инвестиционный доход", "TrendingUp"],
  ["Прочее", "Shapes"],
];
export function initial(): Data {
  return {
    version: 1,
    categories: [
      ...expenses.map((x) => [...x, "expense"]),
      ...incomes.map((x) => [...x, "income"]),
    ].map(([name, icon, type], i) => ({
      id: `category-${i}`,
      name,
      icon,
      type: type as Kind,
      color: palette[i % palette.length],
      archived: false,
    })),
    transactions: [],
    budgets: [],
    goals: [],
    settings: { theme: "system" },
  };
}
export function demoData(): Data {
  const d = initial(),
    now = today(),
    [s, e] = range("month", now);
  const add = (
    type: Kind,
    amount: number,
    c: number,
    day: number,
    comment: string,
  ) =>
    d.transactions.push({
      id: uid(),
      type,
      amount: amount * 100,
      categoryId: d.categories[c].id,
      date:
        s.slice(0, 8) +
        String(Math.min(day, parseDate(now).getDate())).padStart(2, "0"),
      comment,
    });
  add("income", 125000, 19, 1, "Зарплата за месяц");
  add("income", 18000, 22, 12, "Дизайн-проект");
  for (let i = 0; i < 18; i++)
    add(
      "expense",
      [2350, 890, 450, 3200, 1750, 680][i % 6],
      i % 3,
      2 + i,
      "Ежедневные покупки",
    );
  add("expense", 28000, 4, 5, "Аренда квартиры");
  add("expense", 4300, 8, 18, "Новая рубашка");
  d.budgets = [
    {
      id: uid(),
      categoryId: "category-0",
      amount: 2000000,
      period: "month",
      enabled: true,
    },
    {
      id: uid(),
      categoryId: "category-1",
      amount: 700000,
      period: "month",
      enabled: true,
    },
    {
      id: uid(),
      categoryId: "category-2",
      amount: 500000,
      period: "month",
      enabled: true,
    },
  ];
  d.goals = [
    {
      id: uid(),
      name: "Подушка спокойствия",
      type: "saving",
      amount: 30000000,
      period: "year",
      start: s,
      end: range("year", now)[1],
      comment: "На шесть месяцев жизни",
      contributions: [
        { id: uid(), amount: 8500000, date: now, comment: "Первый шаг" },
      ],
    },
    {
      id: uid(),
      name: "Жить в своём ритме",
      type: "expense",
      amount: 8000000,
      period: "month",
      start: s,
      end: e,
      comment: "Бюджет на месяц",
      contributions: [],
    },
  ];
  return d;
}
export const STORAGE_KEY = "calm-finance-v1";
const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(parseDate(v).getTime()) &&
  localDate(parseDate(v)) === v;
export function validateData(raw: unknown): Data {
  const d = raw as Data;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.categories) ||
    !Array.isArray(d.transactions) ||
    !Array.isArray(d.budgets) ||
    !Array.isArray(d.goals) ||
    !d.settings ||
    !["light", "dark", "system"].includes(d.settings.theme)
  )
    throw Error("Неподдерживаемая структура резервной копии");
  if (
    d.cash !== undefined &&
    (!d.cash ||
      !Number.isSafeInteger(d.cash.opening) ||
      Math.abs(d.cash.opening) > 999999999999 ||
      !isDate(d.cash.date))
  )
    throw Error("Некорректная отправная сумма остатка");
  if (
    d.startingMoney !== undefined &&
    (!Number.isSafeInteger(d.startingMoney) ||
      Math.abs(d.startingMoney) > 999999999999)
  )
    throw Error("Некорректная начальная сумма");
  if (
    d.settings.palette !== undefined &&
    !Object.hasOwn(paletteNames, d.settings.palette)
  )
    throw Error("Неизвестная цветовая тема");
  if (
    d.settings.lastExpenseDate !== undefined &&
    !isDate(d.settings.lastExpenseDate)
  )
    throw Error("Некорректная дата последнего расхода");
  const reminder = d.settings.backupReminder;
  if (
    reminder !== undefined &&
    (!reminder ||
      typeof reminder.enabled !== "boolean" ||
      !isDate(reminder.startedOn) ||
      (reminder.lastBackupOn !== undefined && !isDate(reminder.lastBackupOn)) ||
      (reminder.snoozedUntil !== undefined && !isDate(reminder.snoozedUntil)))
  )
    throw Error("Некорректные настройки напоминания");
  const ids = new Set<string>();
  const id = (v: unknown) => {
    if (typeof v !== "string" || !v || ids.has(v))
      throw Error("Некорректные или повторяющиеся идентификаторы");
    ids.add(v);
  };
  const text = (s: unknown) => typeof s === "string" && s.length <= 10000;
  const amount = (n: unknown) =>
    typeof n === "number" &&
    Number.isSafeInteger(n) &&
    n > 0 &&
    n <= 999999999999;
  const kind = (s: unknown) => s === "income" || s === "expense";
  for (const c of d.categories) {
    id(c.id);
    if (
      !text(c.name) ||
      !c.name.trim() ||
      !kind(c.type) ||
      !text(c.icon) ||
      !/^#[0-9a-f]{6}$/i.test(c.color) ||
      typeof c.archived !== "boolean"
    )
      throw Error("Некорректная категория");
  }
  const cat = (s: string) => d.categories.find((c) => c.id === s);
  for (const t of d.transactions) {
    id(t.id);
    if (
      !kind(t.type) ||
      !amount(t.amount) ||
      !isDate(t.date) ||
      !text(t.comment) ||
      (t.importKey !== undefined &&
        (typeof t.importKey !== "string" ||
          !t.importKey.startsWith("coinbox:") ||
          t.importKey.length > 22000)) ||
      cat(t.categoryId)?.type !== t.type
    )
      throw Error("Некорректная операция");
  }
  const keys = new Set();
  for (const b of d.budgets) {
    id(b.id);
    const k = b.categoryId + b.period;
    if (
      keys.has(k) ||
      !amount(b.amount) ||
      !Object.keys(periodNames).includes(b.period) ||
      cat(b.categoryId)?.type !== "expense" ||
      typeof b.enabled !== "boolean"
    )
      throw Error("Некорректный или повторяющийся лимит");
    keys.add(k);
  }
  for (const g of d.goals) {
    id(g.id);
    if (
      !text(g.name) ||
      !g.name.trim() ||
      !text(g.comment) ||
      !["income", "expense", "saving"].includes(g.type) ||
      !["month", "quarter", "year"].includes(g.period) ||
      !amount(g.amount) ||
      !isDate(g.start) ||
      !isDate(g.end) ||
      g.start > g.end ||
      !Array.isArray(g.contributions)
    )
      throw Error("Некорректная цель");
    for (const c of g.contributions) {
      id(c.id);
      if (
        g.type !== "saving" ||
        !amount(c.amount) ||
        !isDate(c.date) ||
        c.date < g.start ||
        c.date > g.end ||
        !text(c.comment)
      )
        throw Error("Некорректное пополнение");
    }
  }
  return {
    version: 1,
    ...(d.cash ? { cash: { opening: d.cash.opening, date: d.cash.date } } : {}),
    ...(d.startingMoney !== undefined
      ? { startingMoney: d.startingMoney }
      : {}),
    categories: d.categories,
    transactions: d.transactions,
    budgets: d.budgets,
    goals: d.goals,
    settings: {
      theme: d.settings.theme,
      ...(d.settings.palette ? { palette: d.settings.palette } : {}),
      ...(d.settings.lastExpenseDate
        ? { lastExpenseDate: d.settings.lastExpenseDate }
        : {}),
      ...(reminder
        ? {
            backupReminder: {
              enabled: reminder.enabled,
              startedOn: reminder.startedOn,
              ...(reminder.lastBackupOn
                ? { lastBackupOn: reminder.lastBackupOn }
                : {}),
              ...(reminder.snoozedUntil
                ? { snoozedUntil: reminder.snoozedUntil }
                : {}),
            },
          }
        : {}),
    },
  };
}
export function load(): { data: Data; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      data: raw ? validateData(JSON.parse(raw)) : initial(),
      error: null,
    };
  } catch {
    return {
      data: initial(),
      error:
        "Не удалось прочитать сохранённые данные. Исходная запись сохранена. Скачайте её в настройках перед восстановлением.",
    };
  }
}
export function download(
  name: string,
  body: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const backup = (d: Data) =>
  download(
    `Мои-финансы-${today()}.json`,
    JSON.stringify({ ...d, exportedAt: new Date().toISOString() }, null, 2),
  );
export function csv(d: Data) {
  const cell = (v: string) =>
    '"' + (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
  const rows = [
    ["Дата", "Тип", "Категория", "Сумма, ₽", "Комментарий"],
    ...d.transactions.map((t) => [
      t.date,
      t.type === "income" ? "Доход" : "Расход",
      d.categories.find((c) => c.id === t.categoryId)?.name || "",
      (t.amount / 100).toFixed(2).replace(".", ","),
      t.comment,
    ]),
  ];
  download(
    `Операции-${today()}.csv`,
    "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}

// The balance is the cumulative result of all recorded operations through asOf.
// Legacy manual cash settings remain readable in backups but never affect it.
export function cashBalance(data: Data, asOf = today()): number {
  return data.transactions
    .filter((t) => t.date <= asOf)
    .reduce(
      (n, t) => n + (t.type === "income" ? t.amount : -t.amount),
      data.startingMoney ?? 0,
    );
}

export function startingCents(value: string): number {
  const v = value.trim();
  if (/^-?0([.,]0{1,2})?$/.test(v)) return 0;
  return v.startsWith("-") ? -cents(v.slice(1)) : cents(v);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function backupReminderDue(data: Data, now = today()): boolean {
  const r = data.settings.backupReminder;
  if (!r || !r.enabled) return false;
  if (r.snoozedUntil && now < r.snoozedUntil) return false;
  return now >= addDays(r.lastBackupOn || r.startedOn, 7);
}
export function confirmedBackup(data: Data, now = today()): Data {
  const r = data.settings.backupReminder;
  return {
    ...data,
    settings: {
      ...data.settings,
      backupReminder: {
        enabled: r?.enabled ?? true,
        startedOn: r?.startedOn || now,
        lastBackupOn: now,
      },
    },
  };
}
