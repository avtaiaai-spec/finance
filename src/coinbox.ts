import {
  type Data,
  type Kind,
  type Transaction,
  type Category,
  cents,
  uid,
  parseDate,
  localDate,
  validateData,
} from "./model";
export type CoinBoxRow = {
  type: Kind;
  amount: number;
  date: string;
  category: string;
  comment: string;
  importKey: string;
};
export type CoinBoxFile = { name: string; rows: CoinBoxRow[] };
const normalize = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
// CSV state machine: escaped quotes, delimiters and line breaks inside quoted fields.
export function readCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  let line = 1;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((s) => s.trim() !== "")) rows.push(row);
    row = [];
    if (rows.length > 100001)
      throw Error(
        "В файле больше 100 000 операций. Разделите его на несколько файлов.",
      );
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === "\n") line++;
      }
      continue;
    }
    if (c === delimiter) pushCell();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      line++;
    } else if (c === '"') {
      if (cell || closed) throw Error(`Некорректная кавычка, строка ${line}`);
      quoted = true;
    } else {
      if (closed)
        throw Error(
          `После закрывающей кавычки ожидается разделитель, строка ${line}`,
        );
      cell += c;
    }
  }
  if (quoted) throw Error("В CSV не закрыта кавычка. Проверьте файл.");
  if (cell || row.length || closed) pushRow();
  return rows;
}
export function parseCoinBox(text: string, name = "CoinBox.csv"): CoinBoxFile {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = first.includes(";") ? ";" : ",";
  const table = readCsv(text, delimiter);
  if (!table.length) throw Error("CSV-файл пуст");
  const header = table[0].map((s) => s.trim());
  const required = ["Date", "Type", "Category", "Amount", "Currency", "Note"];
  if (
    new Set(header).size !== header.length ||
    !required.every((s) => header.includes(s))
  )
    throw Error(
      "Ожидается CSV CoinBox с колонками Date, Type, Category, Amount, Currency, Note.",
    );
  const indexes = required.map((s) => header.indexOf(s));
  const rows: CoinBoxRow[] = [];
  const errors: string[] = [];
  const occurrences = new Map<string, number>();
  for (let i = 1; i < table.length; i++) {
    try {
      if (table[i].length !== header.length)
        throw Error("число полей не совпадает с заголовком");
      const [timestamp, rawType, rawCategory, rawAmount, rawCurrency, comment] =
        indexes.map((n) => table[i][n]);
      const type = rawType.trim().toLowerCase();
      if (type !== "expense" && type !== "income")
        throw Error("неизвестный тип операции (ожидается income или expense)");
      if (rawCurrency.trim().toUpperCase() !== "RUB")
        throw Error(
          "поддерживается только валюта RUB; конвертация не выполняется",
        );
      const date = timestamp.trim().slice(0, 10);
      const pattern = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
      if (
        !pattern.test(timestamp.trim()) ||
        isNaN(+parseDate(date)) ||
        localDate(parseDate(date)) !== date
      )
        throw Error(
          "неверная дата; ожидается YYYY-MM-DD или YYYY-MM-DD HH:mm:ss",
        );
      const time = timestamp.trim().slice(11);
      if (time) {
        const [h, m, s = "0"] = time.split(":").map(Number);
        if (h > 23 || m > 59 || Number(s) > 59) throw Error("неверное время");
      }
      const category = rawCategory.normalize("NFC").trim().replace(/\s+/g, " ");
      if (!category || category.length > 100)
        throw Error("название категории пустое или длиннее 100 символов");
      if (comment.length > 2000)
        throw Error("комментарий длиннее 2000 символов");
      const amount = cents(rawAmount);
      const canonical = JSON.stringify([
        timestamp.trim().replace("T", " "),
        type,
        normalize(category),
        amount,
        comment,
      ]);
      const ordinal = (occurrences.get(canonical) || 0) + 1;
      occurrences.set(canonical, ordinal);
      rows.push({
        type,
        amount,
        date,
        category,
        comment,
        importKey: `coinbox:${canonical}:${ordinal}`,
      });
    } catch (e) {
      errors.push(
        `Запись ${i + 1}: ${e instanceof Error ? e.message : "неверные данные"}`,
      );
    }
  }
  if (errors.length)
    throw Error(
      `Импорт отменён: ошибок — ${errors.length}. Текущие данные не изменены.\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? "\n… Исправьте файл и выберите его снова." : ""}`,
    );
  if (!rows.length) throw Error("В файле нет операций");
  return { name, rows };
}
export function planCoinBox(data: Data, file: CoinBoxFile) {
  const existing = new Set(
    data.transactions.flatMap((t) => (t.importKey ? [t.importKey] : [])),
  );
  const newRows = file.rows.filter((r) => !existing.has(r.importKey));
  const categories = new Map(
    data.categories.map((c) => [`${c.type}:${normalize(c.name)}`, c]),
  );
  const newCategories: Category[] = [];
  const transactions: Transaction[] = [];
  const colors = [
    "#83A994",
    "#D1AD76",
    "#8FA7BF",
    "#B69DC0",
    "#C99485",
    "#9BAA78",
    "#7AACA7",
  ];
  for (const row of newRows) {
    const key = `${row.type}:${normalize(row.category)}`;
    let cat = categories.get(key);
    if (!cat) {
      cat = {
        id: uid(),
        name: row.category,
        type: row.type,
        icon: row.type === "income" ? "Wallet" : "Shapes",
        color: colors[newCategories.length % colors.length],
        archived: false,
      };
      categories.set(key, cat);
      newCategories.push(cat);
    }
    transactions.push({
      id: uid(),
      type: row.type,
      amount: row.amount,
      date: row.date,
      categoryId: cat.id,
      comment: row.comment,
      importKey: row.importKey,
    });
  }
  const next = {
    ...data,
    categories: [...data.categories, ...newCategories],
    transactions: [...data.transactions, ...transactions],
  };
  validateData(next);
  return {
    next,
    transactions,
    newCategories,
    duplicates: file.rows.length - newRows.length,
  };
}
