import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import * as I from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  type Data,
  type Palette,
  paletteNames,
  type Kind,
  type Period,
  type Transaction,
  type Category,
  type Budget,
  type Goal,
  type Contribution,
  initial,
  load,
  uid,
  today,
  parseDate,
  localDate,
  money,
  cents,
  amountInput,
  range,
  shift,
  within,
  sum,
  periodNames,
  budgetResult,
  goalResult,
  demoData,
  validateData,
  backup,
  csv,
  download,
  STORAGE_KEY,
  cashBalance,
  startingCents,
} from "./model";
import { parseCoinBox, planCoinBox, type CoinBoxFile } from "./coinbox";
const pages = [
  ["home", "Главная", "LayoutDashboard"],
  ["transactions", "Операции", "ArrowLeftRight"],
  ["categories", "Категории", "Shapes"],
  ["budgets", "Бюджеты и лимиты", "ChartNoAxesCombined"],
  ["goals", "Финансовые цели", "Flag"],
  ["analytics", "Аналитика", "ChartPie"],
  ["settings", "Настройки", "Settings"],
] as const;
const iconNames = [
  "ShoppingBasket",
  "Coffee",
  "Bus",
  "Car",
  "House",
  "Lightbulb",
  "HeartPulse",
  "Sparkles",
  "Shirt",
  "Clapperboard",
  "Repeat",
  "GraduationCap",
  "Plane",
  "Gift",
  "Landmark",
  "Wifi",
  "PawPrint",
  "Armchair",
  "Shapes",
  "BriefcaseBusiness",
  "Award",
  "Wrench",
  "Laptop",
  "RotateCcw",
  "Undo2",
  "TrendingUp",
  "Wallet",
  "Heart",
  "Music",
  "BookOpen",
  "Bike",
  "Utensils",
  "Flower2",
  "Smartphone",
  "Target",
  "Gem",
];
const iconMap = {
  ShoppingBasket: I.ShoppingBasket,
  Coffee: I.Coffee,
  Bus: I.Bus,
  Car: I.Car,
  House: I.House,
  Lightbulb: I.Lightbulb,
  HeartPulse: I.HeartPulse,
  Sparkles: I.Sparkles,
  Shirt: I.Shirt,
  Clapperboard: I.Clapperboard,
  Repeat: I.Repeat,
  GraduationCap: I.GraduationCap,
  Plane: I.Plane,
  Gift: I.Gift,
  Landmark: I.Landmark,
  Wifi: I.Wifi,
  PawPrint: I.PawPrint,
  Armchair: I.Armchair,
  Shapes: I.Shapes,
  BriefcaseBusiness: I.BriefcaseBusiness,
  Award: I.Award,
  Wrench: I.Wrench,
  Laptop: I.Laptop,
  RotateCcw: I.RotateCcw,
  Undo2: I.Undo2,
  TrendingUp: I.TrendingUp,
  Wallet: I.Wallet,
  Heart: I.Heart,
  Music: I.Music,
  BookOpen: I.BookOpen,
  Bike: I.Bike,
  Utensils: I.Utensils,
  Flower2: I.Flower2,
  Smartphone: I.Smartphone,
  Target: I.Target,
  Gem: I.Gem,
  LayoutDashboard: I.LayoutDashboard,
  ArrowLeftRight: I.ArrowLeftRight,
  ChartNoAxesCombined: I.ChartNoAxesCombined,
  Flag: I.Flag,
  ChartPie: I.ChartPie,
  Settings: I.Settings,
  Sprout: I.Sprout,
  ArrowUpRight: I.ArrowUpRight,
  ArrowDownLeft: I.ArrowDownLeft,
  CalendarDays: I.CalendarDays,
  Sun: I.Sun,
  Moon: I.Moon,
  Monitor: I.Monitor,
  Plus: I.Plus,
};
function Icon({
  name,
  size = 20,
  ...rest
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const C =
    (
      iconMap as Record<
        string,
        React.ComponentType<{ size: number; className?: string }>
      >
    )[name] || I.Shapes;
  return <C size={size} {...rest} />;
}
const dateLabel = (s: string) =>
  parseDate(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
function CatIcon({ cat }: { cat?: Category }) {
  return (
    <span
      className="cat-icon"
      style={{ background: cat?.color + "23", color: cat?.color }}
    >
      <Icon name={cat?.icon || "Shapes"} />
    </span>
  );
}
function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="Sprout" size={35} />
      <h3>{text}</h3>
      <p>Большое спокойствие начинается с маленького шага.</p>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  let assigned = false;
  const nodes = Children.map(children, (child) => {
    if (
      !assigned &&
      isValidElement(child) &&
      ["input", "select", "textarea"].includes(String(child.type))
    ) {
      assigned = true;
      return cloneElement(child as ReactElement<{ id?: string }>, { id });
    }
    return child;
  });
  return (
    <div className="field">
      {assigned ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
      {nodes}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Закрыть" onClick={onClose}>
          <I.X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Progress({ percent, color }: { percent: number; color?: string }) {
  return (
    <div className="progress">
      <span
        style={{
          width: `${Math.max(0, Math.min(percent, 100))}%`,
          background: color || "var(--accent)",
        }}
      />
    </div>
  );
}
type Editor =
  | { type: "transaction"; item?: Transaction; kind?: Kind }
  | { type: "category"; item?: Category }
  | { type: "budget"; item?: Budget }
  | { type: "goal"; item?: Goal }
  | { type: "contribution"; goal: Goal; item?: Contribution }
  | null;
export default function App() {
  const [boot] = useState(load);
  const [real, setReal] = useState<Data>(boot.data);
  const [storageError, setStorageError] = useState(boot.error);
  const [demo, setDemo] = useState<Data | null>(null);
  const data = demo || real;
  const [page, setPage] = useState("home");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(today());
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(range("month", today())[0]);
  const [to, setTo] = useState(today());
  const selected: [string, string] = custom
    ? [from, to]
    : range(period, anchor);
  const cash = cashBalance(data);
  const [startingInput, setStartingInput] = useState<string | null>(() => {
    const v = new URLSearchParams(location.hash.slice(1)).get("starting-money");
    if (v === null) return null;
    try {
      startingCents(v);
      return v;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const onHash = () => {
      const v = new URLSearchParams(location.hash.slice(1)).get(
        "starting-money",
      );
      if (v !== null) {
        try {
          startingCents(v);
          setStartingInput(v);
        } catch {}
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const openStarting = () =>
    setStartingInput(amountInput(data.startingMoney ?? 0));
  const closeStarting = () => {
    setStartingInput(null);
    if (location.hash.startsWith("#starting-money="))
      history.replaceState(null, "", location.pathname + location.search);
  };
  const [editor, setEditor] = useState<Editor>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [catType, setCatType] = useState<Kind>("expense");
  const [pending, setPending] = useState<Data | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [granularity, setGranularity] = useState("day");
  const file = useRef<HTMLInputElement>(null);
  const csvFile = useRef<HTMLInputElement>(null);
  const [coinbox, setCoinbox] = useState<CoinBoxFile | null>(null);
  const [csvError, setCsvError] = useState("");
  const importPlan = useMemo(
    () => (coinbox ? planCoinBox(data, coinbox) : null),
    [data, coinbox],
  );
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const save = (next: Data) => {
    if (demo) {
      setDemo(next);
      return true;
    }
    try {
      if (storageError)
        throw Error("Сначала восстановите повреждённые данные в настройках");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setReal(next);
      return true;
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить: память браузера заполнена",
      );
      return false;
    }
  };
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.palette =
        data.settings.palette ?? "green";
      document.documentElement.dataset.theme =
        data.settings.theme === "system"
          ? m.matches
            ? "dark"
            : "light"
          : data.settings.theme;
      const background = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim();
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", background);
    };
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [data.settings.theme, data.settings.palette]);
  const category = (id: string) => data.categories.find((c) => c.id === id);
  const current = data.transactions.filter((t) => within(t.date, selected));
  const previousRange: [string, string] = custom
    ? (() => {
        const days =
          Math.round((+parseDate(to) - +parseDate(from)) / 86400000) + 1;
        const end = parseDate(from);
        end.setDate(end.getDate() - 1);
        const start = new Date(end);
        start.setDate(start.getDate() - days + 1);
        return [localDate(start), localDate(end)];
      })()
    : range(period, shift(period, anchor, -1));
  const previous = data.transactions.filter((t) =>
    within(t.date, previousRange),
  );
  const income = sum(current, "income"),
    expense = sum(current, "expense"),
    prevExpense = sum(previous, "expense"),
    prevResult = sum(previous, "income") - prevExpense;
  const slices = data.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      ...c,
      value: sum(
        current.filter((t) => t.categoryId === c.id),
        "expense",
      ),
      count: current.filter(
        (t) => t.categoryId === c.id && t.type === "expense",
      ).length,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const activeBudgets = data.budgets.filter((b) => b.enabled);
  const over = activeBudgets.filter(
    (b) => budgetResult(b, data, anchor).percent >= 80,
  );
  const go = (s: string) => {
    setPage(s);
    setMenu(false);
  };
  const remove = (type: "transactions" | "budgets" | "goals", id: string) => {
    if (confirm("Удалить запись? Это действие нельзя отменить.")) {
      if (save({ ...data, [type]: data[type].filter((x) => x.id !== id) }))
        notify("Запись удалена");
    }
  };
  const row = (t: Transaction) => (
    <button
      className="transaction"
      key={t.id}
      onClick={() => setEditor({ type: "transaction", item: t })}
    >
      <CatIcon cat={category(t.categoryId)} />
      <span className="transaction-text">
        <strong>{category(t.categoryId)?.name}</strong>
        <small>{t.comment || (t.type === "income" ? "Доход" : "Расход")}</small>
      </span>
      <span className="transaction-right">
        <strong className={t.type === "income" ? "income" : ""}>
          {t.type === "income" ? "+" : "−"}
          {money(t.amount)}
        </strong>
        <small>
          {parseDate(t.date).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}
        </small>
      </span>
      <I.ChevronRight size={15} />
    </button>
  );
  function budgetCard(b: Budget) {
    const r = budgetResult(b, data, anchor),
      color =
        r.percent >= 100
          ? "var(--expense)"
          : r.percent >= 80
            ? "var(--warning)"
            : "var(--income)";
    return (
      <div className="budget-card" key={b.id}>
        <div className="row">
          <CatIcon cat={category(b.categoryId)} />
          <div className="grow">
            <strong>{category(b.categoryId)?.name}</strong>
            <small>
              {periodNames[b.period]} ·{" "}
              {range(b.period, anchor)
                .map((x) =>
                  parseDate(x).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  }),
                )
                .join(" — ")}
            </small>
          </div>
          <button
            className="icon-btn"
            aria-label="Изменить лимит"
            onClick={() => setEditor({ type: "budget", item: b })}
          >
            <I.Ellipsis size={20} />
          </button>
        </div>
        <div className="row numbers">
          <strong>{money(r.spent)}</strong>
          <span>из {money(b.amount)}</span>
        </div>
        <Progress percent={r.percent} color={color} />
        <div className="row budget-caption">
          <span style={{ color }}>
            {r.left < 0
              ? "Перерасход " + money(-r.left)
              : "Осталось " + money(r.left)}
          </span>
          <span>{r.percent.toFixed(0)}%</span>
        </div>
      </div>
    );
  }
  const chartPoints = () => {
    const result: { date: string; income: number; expense: number }[] = [];
    let d = parseDate(selected[0]);
    const end = parseDate(selected[1]);
    const monthly =
      (!custom && (period === "quarter" || period === "year")) ||
      (+end - +d) / 86400000 > 93;
    while (d <= end && result.length < 3700) {
      const start = localDate(d),
        last = monthly
          ? localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
          : granularity === "week"
            ? localDate(
                new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6),
              )
            : start;
      const ts = current.filter((t) => t.date >= start && t.date <= last);
      result.push({
        date: d.toLocaleDateString(
          "ru-RU",
          monthly ? { month: "short" } : { day: "numeric", month: "short" },
        ),
        income: sum(ts, "income") / 100,
        expense: sum(ts, "expense") / 100,
      });
      if (monthly) d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      else d.setDate(d.getDate() + (granularity === "week" ? 7 : 1));
    }
    return result;
  };
  const pie = () =>
    expense > 0 ? (
      <>
        <div className="donut">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={77}
                outerRadius={101}
                paddingAngle={3}
                stroke="none"
                onClick={(_, index) => setSector(slices[index].id)}
              >
                {slices.map((c) => (
                  <Cell key={c.id} fill={c.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => money(Number(v))}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--text)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <small>Всего расходов</small>
            <strong>{money(expense)}</strong>
          </div>
        </div>
        <div className="legend">
          {(sector
            ? slices.filter((c) => c.id === sector)
            : slices.slice(0, 5)
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => setSector(sector === c.id ? null : c.id)}
            >
              <span className="dot" style={{ background: c.color }} />
              <span>
                {c.name}
                <small>{c.count} операций</small>
              </span>
              <strong>
                {money(c.value)}
                <small>{((c.value / expense) * 100).toFixed(1)}%</small>
              </strong>
            </button>
          ))}
          {sector && (
            <button onClick={() => setSector(null)}>Все категории</button>
          )}
        </div>
      </>
    ) : (
      <Empty text="Здесь появится структура расходов" />
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="logo">
            <I.Wallet size={23} />
          </span>
          <span>мои финансы</span>
        </a>
        <div className="sidebar-label">ЛИЧНОЕ ПРОСТРАНСТВО</div>
        <nav>
          {pages.map(([id, name, icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon name={icon} />
              {name}
              {id === "budgets" && over.length > 0 && (
                <span className="badge">{over.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <I.Sprout size={28} />
          <strong>Шаг за шагом к большему</strong>
          <p>
            Ваши привычки сегодня —<br />
            ваша свобода завтра.
          </p>
        </div>
        <div className="local-note">
          <I.ShieldCheck size={17} /> Данные только на устройстве
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Личное пространство <I.ChevronRight size={14} />{" "}
            <span>{pages.find((p) => p[0] === page)?.[1]}</span>
          </div>
          <div className="top-actions">
            <span className="date-top">{dateLabel(today())}</span>
            <button
              className="icon-btn mobile-menu"
              aria-label="Открыть меню"
              aria-expanded={menu}
              aria-controls="mobile-navigation"
              onClick={() => setMenu(!menu)}
            >
              <I.Menu />
            </button>
            <button
              className="avatar"
              aria-label="Открыть настройки"
              onClick={() => go("settings")}
            >
              Я
            </button>
          </div>
        </header>
        {menu && (
          <>
            <button
              className="mobile-menu-backdrop"
              aria-label="Закрыть меню"
              onClick={() => setMenu(false)}
            />
            <nav
              className="more-menu"
              id="mobile-navigation"
              aria-label="Дополнительное меню"
            >
              {pages.map(([id, name, icon]) => (
                <button key={id} onClick={() => go(id)}>
                  <Icon name={icon} />
                  {name}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="content">
          {demo && (
            <div className="banner">
              <span>
                <I.FlaskConical size={18} /> Деморежим · личные данные не
                изменяются
              </span>
              <button
                onClick={() => {
                  setDemo(null);
                  notify("Вы вернулись к личным данным");
                }}
              >
                Выйти из демо <I.X size={15} />
              </button>
            </div>
          )}
          {storageError && <div className="banner danger">{storageError}</div>}
          <div className="page-heading">
            <div>
              <div className="eyebrow">ВАШЕ ФИНАНСОВОЕ СПОКОЙСТВИЕ</div>
              <h1>
                {page === "home"
                  ? "Всё под контролем"
                  : pages.find((p) => p[0] === page)?.[1]}
              </h1>
              {!["transactions", "categories", "settings"].includes(page) && (
                <p>
                  {
                    (
                      {
                        home: "Маленькие шаги. Большие возможности.",
                        budgets: "Тратьте осознанно, оставляйте место важному.",
                        goals: "Превращайте планы в реальные достижения.",
                        analytics: "Посмотрите на свои привычки в цифрах.",
                      } as Record<string, string>
                    )[page]
                  }
                </p>
              )}
            </div>
            <div className="heading-actions">
              {["home", "transactions"].includes(page) ? (
                <>
                  <button
                    className="btn secondary"
                    onClick={() =>
                      setEditor({ type: "transaction", kind: "income" })
                    }
                  >
                    <I.Plus size={17} /> Доход
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      setEditor({ type: "transaction", kind: "expense" })
                    }
                  >
                    <I.Plus size={17} /> Расход
                  </button>
                </>
              ) : ["categories", "budgets", "goals"].includes(page) ? (
                <button
                  className="btn"
                  onClick={() =>
                    setEditor({
                      type:
                        page === "categories"
                          ? "category"
                          : page === "budgets"
                            ? "budget"
                            : "goal",
                    })
                  }
                >
                  <I.Plus size={18} />{" "}
                  {page === "categories"
                    ? "Категория"
                    : page === "budgets"
                      ? "Новый лимит"
                      : "Новая цель"}
                </button>
              ) : null}
            </div>
          </div>
          {["home", "transactions", "budgets", "analytics"].includes(page) && (
            <div className="period-toolbar">
              <div className="segmented">
                {(Object.keys(periodNames) as Period[]).map((p) => (
                  <button
                    key={p}
                    className={!custom && period === p ? "selected" : ""}
                    onClick={() => {
                      setPeriod(p);
                      setCustom(false);
                    }}
                  >
                    {periodNames[p]}
                  </button>
                ))}
              </div>
              <div className="period-date">
                <button
                  className="icon-btn"
                  aria-label="Предыдущий период"
                  onClick={() => {
                    setCustom(false);
                    setAnchor(shift(period, anchor, -1));
                  }}
                >
                  <I.ChevronLeft size={18} />
                </button>
                <span>
                  {custom
                    ? `${dateLabel(from)} — ${dateLabel(to)}`
                    : period === "month"
                      ? parseDate(anchor).toLocaleDateString("ru-RU", {
                          month: "long",
                          year: "numeric",
                        })
                      : `${parseDate(selected[0]).toLocaleDateString("ru-RU")} — ${parseDate(selected[1]).toLocaleDateString("ru-RU")}`}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Следующий период"
                  onClick={() => {
                    setCustom(false);
                    setAnchor(shift(period, anchor, 1));
                  }}
                >
                  <I.ChevronRight size={18} />
                </button>
                {page !== "budgets" && (
                  <button
                    className="icon-btn"
                    aria-label="Выбрать даты"
                    onClick={() => setCustom(!custom)}
                  >
                    <I.CalendarDays size={18} />
                  </button>
                )}
                <button
                  className="text-btn"
                  onClick={() => {
                    setAnchor(today());
                    setCustom(false);
                  }}
                >
                  Сегодня
                </button>
              </div>
              {custom && (
                <div className="custom-dates">
                  <Field label="С">
                    <input
                      type="date"
                      value={from}
                      max={to}
                      onChange={(e) =>
                        e.target.value && setFrom(e.target.value)
                      }
                    />
                  </Field>
                  <Field label="По">
                    <input
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => e.target.value && setTo(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          {page === "home" && (
            <>
              <div className="overview-grid">
                <section className="hero">
                  <div className="hero-top">
                    <span>Остаток денег</span>
                    <button
                      className="hero-edit"
                      aria-label="Начальные деньги"
                      onClick={openStarting}
                    >
                      <I.Pencil size={18} />
                    </button>
                  </div>
                  <div className="hero-number">{money(cash)}</div>
                  <div className="hero-change">
                    <span className="cash-asof">
                      За всю историю по {dateLabel(today())}
                    </span>
                  </div>
                  <div className="hero-divider" />
                  <div className="hero-period-label">За выбранный период</div>
                  <div className="hero-totals">
                    <div>
                      <span>
                        <I.ArrowDownLeft size={16} /> Доходы
                      </span>
                      <strong>{money(income)}</strong>
                    </div>
                    <div>
                      <span>
                        <I.ArrowUpRight size={16} /> Расходы
                      </span>
                      <strong>{money(expense)}</strong>
                    </div>
                  </div>
                  <div className="hero-period-net">
                    <span>Доходы минус расходы</span>
                    <strong>{money(income - expense)}</strong>
                  </div>
                </section>
                <section className="card limits-home">
                  <div className="section-head">
                    <h2>В рамках бюджета</h2>
                    <button
                      className="icon-btn"
                      aria-label="Все бюджеты"
                      onClick={() => go("budgets")}
                    >
                      <I.ArrowUpRight size={19} />
                    </button>
                  </div>
                  {activeBudgets.length ? (
                    activeBudgets.slice(0, 3).map((b) => {
                      const r = budgetResult(b, data, anchor);
                      return (
                        <button
                          className="mini-budget"
                          key={b.id}
                          onClick={() => go("budgets")}
                        >
                          <div className="row">
                            <CatIcon cat={category(b.categoryId)} />
                            <span className="grow">
                              {category(b.categoryId)?.name}
                              <small>{periodNames[b.period]}</small>
                            </span>
                            <strong>{Math.round(r.percent)}%</strong>
                          </div>
                          <Progress
                            percent={r.percent}
                            color={
                              r.percent >= 100
                                ? "var(--expense)"
                                : r.percent >= 80
                                  ? "var(--warning)"
                                  : undefined
                            }
                          />
                          <div className="row">
                            <small>
                              {money(r.spent)} из {money(b.amount)}
                            </small>
                            <small className={r.percent >= 80 ? "warning" : ""}>
                              {r.left >= 0 ? "Осталось " : "Перерасход "}
                              {money(Math.abs(r.left))}
                            </small>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <Empty text="Задайте комфортные лимиты">
                      <button
                        className="text-btn"
                        onClick={() => setEditor({ type: "budget" })}
                      >
                        Создать первый лимит →
                      </button>
                    </Empty>
                  )}
                </section>
              </div>
              {over.length > 0 && (
                <div className="budget-alert">
                  <I.Bell size={18} />
                  <span>
                    {over.length} лимита требуют внимания:{" "}
                    {over.map((b) => category(b.categoryId)?.name).join(", ")}.
                  </span>
                  <button className="text-btn" onClick={() => go("budgets")}>
                    Посмотреть →
                  </button>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>На что уходят деньги</h2>
                      <p>Структура расходов за период</p>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="Открыть аналитику"
                      onClick={() => go("analytics")}
                    >
                      <I.ArrowUpRight size={19} />
                    </button>
                  </div>
                  {pie()}
                </section>
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>Последние операции</h2>
                      <p>Ваши финансы в движении</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("transactions")}
                    >
                      Все операции <I.ArrowRight size={15} />
                    </button>
                  </div>
                  {current.length ? (
                    [...current]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 5)
                      .map(row)
                  ) : (
                    <Empty text="Начнём с первой операции">
                      <button
                        className="btn"
                        onClick={() =>
                          setEditor({ type: "transaction", kind: "expense" })
                        }
                      >
                        <I.Plus size={17} /> Добавить операцию
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => setDemo(demoData())}
                      >
                        Посмотреть демо →
                      </button>
                    </Empty>
                  )}
                  <div className="gentle-note">
                    <I.Leaf size={18} />
                    <span>Осознанность начинается с простого учёта.</span>
                  </div>
                </section>
              </div>
              <section className="card goals-preview">
                <div className="section-head">
                  <h2>Ближе к мечте</h2>
                  <button className="text-btn" onClick={() => go("goals")}>
                    Все цели <I.ArrowRight size={15} />
                  </button>
                </div>
                {data.goals.length ? (
                  <div className="goal-strips">
                    {data.goals.slice(0, 2).map((g) => {
                      const r = goalResult(g, data);
                      return (
                        <button key={g.id} onClick={() => go("goals")}>
                          <span className="cat-icon">
                            <I.Flag size={21} />
                          </span>
                          <div className="grow">
                            <strong>{g.name}</strong>
                            <Progress percent={r.percent} />
                            <small>
                              {money(r.actual)} из {money(g.amount)}
                            </small>
                          </div>
                          <I.ArrowUpRight size={19} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">
                    Создайте цель и начните двигаться к тому, что важно.{" "}
                    <button
                      className="text-btn"
                      onClick={() => setEditor({ type: "goal" })}
                    >
                      Создать цель →
                    </button>
                  </p>
                )}
              </section>
            </>
          )}
          {page === "transactions" && (
            <>
              <div className="stat-grid">
                <Stat
                  label="Доходы"
                  value={money(income)}
                  icon="ArrowDownLeft"
                />
                <Stat
                  label="Расходы"
                  value={money(expense)}
                  icon="ArrowUpRight"
                />
                <Stat
                  label="Доходы минус расходы"
                  value={money(income - expense)}
                  icon="Wallet"
                />
              </div>
              <section className="card">
                <div className="filters">
                  <label className="search">
                    <I.Search size={18} />
                    <input
                      aria-label="Поиск операций"
                      placeholder="Категория или комментарий"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Тип операции"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Все типы</option>
                    <option value="expense">Расходы</option>
                    <option value="income">Доходы</option>
                  </select>
                  <select
                    aria-label="Категория"
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                  >
                    <option value="all">Все категории</option>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.type === "income" ? "доход" : "расход"}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Сортировка"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="new">Сначала новые</option>
                    <option value="old">Сначала старые</option>
                    <option value="big">Сумма по убыванию</option>
                    <option value="small">Сумма по возрастанию</option>
                  </select>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setCustom(true);
                      setFrom(
                        [...data.transactions].sort((a, b) =>
                          a.date.localeCompare(b.date),
                        )[0]?.date || today(),
                      );
                      setTo(
                        [...data.transactions].sort((a, b) =>
                          b.date.localeCompare(a.date),
                        )[0]?.date || today(),
                      );
                    }}
                  >
                    Вся история
                  </button>
                </div>
                {(() => {
                  const ts = current
                    .filter(
                      (t) =>
                        (filter === "all" || t.type === filter) &&
                        (catFilter === "all" || t.categoryId === catFilter) &&
                        `${category(t.categoryId)?.name} ${t.comment}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .sort((a, b) =>
                      sort === "big"
                        ? b.amount - a.amount
                        : sort === "small"
                          ? a.amount - b.amount
                          : sort === "old"
                            ? a.date.localeCompare(b.date)
                            : b.date.localeCompare(a.date),
                    );
                  return ts.length ? (
                    ts.map((t, i) => (
                      <div key={t.id}>
                        {(i === 0 || ts[i - 1].date !== t.date) && (
                          <h3 className="date-group">{dateLabel(t.date)}</h3>
                        )}
                        {row(t)}
                      </div>
                    ))
                  ) : (
                    <Empty text="Операций пока нет" />
                  );
                })()}
              </section>
            </>
          )}
          {page === "categories" && (
            <>
              <div className="segmented fit">
                <button
                  className={catType === "expense" ? "selected" : ""}
                  onClick={() => setCatType("expense")}
                >
                  Расходы
                </button>
                <button
                  className={catType === "income" ? "selected" : ""}
                  onClick={() => setCatType("income")}
                >
                  Доходы
                </button>
              </div>
              <div className="category-grid">
                {data.categories
                  .filter((c) => c.type === catType)
                  .map((c) => (
                    <div
                      className={
                        "card category-card " + (c.archived ? "archived" : "")
                      }
                      key={c.id}
                    >
                      <CatIcon cat={c} />
                      <div className="grow">
                        <strong>{c.name}</strong>
                        <small>
                          {c.archived
                            ? "В архиве"
                            : `${data.transactions.filter((t) => t.categoryId === c.id).length} операций`}
                        </small>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label={`Редактировать ${c.name}`}
                        onClick={() => setEditor({ type: "category", item: c })}
                      >
                        <I.Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Переместить ${c.name} выше`}
                        onClick={() => {
                          const n = [...data.categories],
                            i = n.findIndex((x) => x.id === c.id),
                            j =
                              n
                                .map((x, k) => ({ x, k }))
                                .filter(
                                  ({ x, k }) => k < i && x.type === c.type,
                                )
                                .pop()?.k ?? -1;
                          if (j >= 0) {
                            [n[i], n[j]] = [n[j], n[i]];
                            save({ ...data, categories: n });
                          }
                        }}
                      >
                        <I.ChevronUp size={17} />
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}
          {page === "budgets" && (
            <>
              {!data.budgets.length ? (
                <section className="card">
                  <Empty text="Бюджет — это свобода выбора">
                    <button
                      className="btn"
                      onClick={() => setEditor({ type: "budget" })}
                    >
                      Установить лимит
                    </button>
                  </Empty>
                </section>
              ) : (
                <>
                  {[
                    [0, 80, "В пределах лимита"],
                    [80, 100, "Близко к превышению"],
                    [100, Infinity, "Лимит превышен"],
                  ].map(([lo, hi, title]) => {
                    const bs = activeBudgets.filter((b) => {
                      const p = budgetResult(b, data, anchor).percent;
                      return p >= Number(lo) && p < Number(hi);
                    });
                    return (
                      bs.length > 0 && (
                        <section key={String(title)}>
                          <h2 className="group-title">
                            {title} <span>{bs.length}</span>
                          </h2>
                          <div className="three-grid">{bs.map(budgetCard)}</div>
                        </section>
                      )
                    );
                  })}
                  {data.budgets.some((b) => !b.enabled) && (
                    <>
                      <h2 className="group-title">Отключённые лимиты</h2>
                      <div className="three-grid">
                        {data.budgets.filter((b) => !b.enabled).map(budgetCard)}
                      </div>
                    </>
                  )}
                  <p className="muted">
                    Лимиты считаются отдельно за календарные периоды, содержащие{" "}
                    {dateLabel(anchor)}. Остаток не переносится. Лимиты разных
                    периодов не складываются.
                  </p>
                </>
              )}
            </>
          )}
          {page === "goals" && (
            <>
              {data.goals.length ? (
                <div className="two-grid">
                  {data.goals.map((g) => {
                    const r = goalResult(g, data);
                    const elapsed = Math.max(
                        1,
                        Math.floor(
                          (Math.min(+parseDate(today()), +parseDate(g.end)) -
                            +parseDate(g.start)) /
                            86400000,
                        ) + 1,
                      ),
                      days =
                        Math.floor(
                          (+parseDate(g.end) - +parseDate(g.start)) / 86400000,
                        ) + 1;
                    return (
                      <section className="card goal-card" key={g.id}>
                        <div className="section-head">
                          <span className="goal-symbol">
                            <Icon
                              name={
                                g.type === "saving"
                                  ? "Sprout"
                                  : g.type === "expense"
                                    ? "ShieldCheck"
                                    : "TrendingUp"
                              }
                              size={25}
                            />
                          </span>
                          <span
                            className={
                              "status " +
                              (r.status === "Достигнута" ? "income" : "")
                            }
                          >
                            {r.status}
                          </span>
                          <button
                            className="icon-btn"
                            aria-label="Изменить цель"
                            onClick={() => setEditor({ type: "goal", item: g })}
                          >
                            <I.Ellipsis />
                          </button>
                        </div>
                        <small>
                          {g.type === "saving"
                            ? "НАКОПЛЕНИЯ"
                            : g.type === "income"
                              ? "ЦЕЛЬ ПО ДОХОДАМ"
                              : "КОНТРОЛЬ РАСХОДОВ"}{" "}
                          · {periodNames[g.period]}
                        </small>
                        <h2>{g.name}</h2>
                        <p>{g.comment}</p>
                        <div className="goal-amount">
                          {money(r.actual)} <span>/ {money(g.amount)}</span>
                        </div>
                        <Progress
                          percent={r.percent}
                          color={
                            g.type === "expense" && r.percent >= 100
                              ? "var(--expense)"
                              : undefined
                          }
                        />
                        <div className="row">
                          <small>
                            {g.type === "expense"
                              ? r.left < 0
                                ? "Перерасход "
                                : "Можно потратить ещё "
                              : r.left <= 0
                                ? "Сверх цели "
                                : "Осталось "}
                            {money(Math.abs(r.left))}
                          </small>
                          <strong>{r.percent.toFixed(1)}%</strong>
                        </div>
                        <p className="muted">
                          {dateLabel(g.start)} — {dateLabel(g.end)}
                        </p>
                        {g.type === "expense" && (
                          <p className="goal-hint">
                            {today() < g.start
                              ? "Период ещё не начался"
                              : today() > g.end
                                ? r.left >= 0
                                  ? "Вы уложились в бюджет."
                                  : "Бюджет превышен."
                                : `При текущем темпе прогноз: ${money(Math.round((r.actual / elapsed) * days))}. Успех определяется в конце периода.`}
                          </p>
                        )}
                        {g.type === "saving" && (
                          <>
                            <button
                              className="btn secondary full"
                              onClick={() =>
                                setEditor({ type: "contribution", goal: g })
                              }
                            >
                              <I.Plus size={17} /> Пополнить цель
                            </button>
                            <details>
                              <summary>
                                История пополнений ({g.contributions.length})
                              </summary>
                              {g.contributions.map((c) => (
                                <button
                                  className="contribution"
                                  key={c.id}
                                  onClick={() =>
                                    setEditor({
                                      type: "contribution",
                                      goal: g,
                                      item: c,
                                    })
                                  }
                                >
                                  <span>
                                    {dateLabel(c.date)}
                                    <small>{c.comment}</small>
                                  </span>
                                  <strong>+{money(c.amount)}</strong>
                                  <I.Pencil size={14} />
                                </button>
                              ))}
                            </details>
                          </>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <section className="card">
                  <Empty text="Чего хочется вам?">
                    <button
                      className="btn"
                      onClick={() => setEditor({ type: "goal" })}
                    >
                      Создать первую цель
                    </button>
                  </Empty>
                </section>
              )}
            </>
          )}
          {page === "analytics" && (
            <>
              <div className="stat-grid analytics-stats">
                <Stat
                  label="Доходы"
                  value={money(income)}
                  icon="ArrowDownLeft"
                />
                <Stat
                  label="Расходы"
                  value={money(expense)}
                  icon="ArrowUpRight"
                />
                <Stat
                  label="Разница"
                  value={money(income - expense)}
                  icon="Wallet"
                />
                <Stat
                  label="Доля расходов"
                  value={
                    income
                      ? `${((expense / income) * 100).toFixed(1)}%`
                      : "Нет доходов"
                  }
                  icon="ChartPie"
                />
                <Stat
                  label="В среднем за день"
                  value={money(
                    Math.round(
                      expense /
                        Math.max(
                          1,
                          (+parseDate(selected[1]) - +parseDate(selected[0])) /
                            86400000 +
                            1,
                        ),
                    ),
                  )}
                  icon="CalendarDays"
                />
                <Stat
                  label="Главная категория"
                  value={slices[0]?.name || "Нет расходов"}
                  icon="Shapes"
                />
              </div>
              <section className="card">
                <div className="section-head">
                  <h2>Динамика доходов и расходов</h2>
                  <select
                    aria-label="Детализация графика"
                    value={granularity}
                    onChange={(e) => setGranularity(e.target.value)}
                  >
                    <option value="day">По дням</option>
                    <option value="week">По неделям</option>
                  </select>
                </div>
                <div className="chart-key">
                  <span>
                    <i
                      className="dot"
                      style={{ background: "var(--income)" }}
                    />{" "}
                    Доходы
                  </span>
                  <span>
                    <i
                      className="dot"
                      style={{ background: "var(--expense)" }}
                    />{" "}
                    Расходы
                  </span>
                  {["quarter", "year"].includes(period) && !custom && (
                    <small>Данные сгруппированы по месяцам</small>
                  )}
                </div>
                <div className="area-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartPoints()}
                      margin={{ top: 20, right: 15, bottom: 5, left: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="incomeGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--income)"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--income)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                      />
                      <YAxis
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(n) =>
                          n >= 1000 ? `${n / 1000}к` : String(n)
                        }
                      />
                      <Tooltip
                        formatter={(v, name) => [
                          money(Math.round(Number(v) * 100)),
                          name === "income" ? "Доходы" : "Расходы",
                        ]}
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                        }}
                      />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="income"
                        stroke="var(--income)"
                        fill="url(#incomeGradient)"
                        strokeWidth={2.5}
                      />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="expense"
                        stroke="var(--expense)"
                        fill="transparent"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <div className="two-grid">
                <section className="card">
                  <h2>Структура расходов</h2>
                  {pie()}
                </section>
                <section className="card">
                  <h2>Сравнение с прошлым периодом</h2>
                  <p className="muted">
                    {dateLabel(previousRange[0])} —{" "}
                    {dateLabel(previousRange[1])}
                  </p>
                  <div className="comparison-number">
                    {expense - prevExpense >= 0 ? "+" : "−"}
                    {money(Math.abs(expense - prevExpense))}
                  </div>
                  <p>
                    {prevExpense
                      ? `${(((expense - prevExpense) / prevExpense) * 100).toFixed(1)}% к предыдущим расходам`
                      : "В прошлом периоде расходов не было"}
                  </p>
                  <h3>Изменения по категориям</h3>
                  {data.categories
                    .filter((c) => c.type === "expense")
                    .map((c) => ({
                      c,
                      delta:
                        sum(
                          current.filter((t) => t.categoryId === c.id),
                          "expense",
                        ) -
                        sum(
                          previous.filter((t) => t.categoryId === c.id),
                          "expense",
                        ),
                    }))
                    .filter((x) => x.delta !== 0)
                    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                    .slice(0, 5)
                    .map(({ c, delta }) => (
                      <div className="comparison-row" key={c.id}>
                        <span>{c.name}</span>
                        <strong className={delta > 0 ? "expense" : "income"}>
                          {delta > 0 ? "+" : "−"}
                          {money(Math.abs(delta))}
                        </strong>
                      </div>
                    ))}
                  <h3>Контроль лимитов</h3>
                  <p>
                    {
                      activeBudgets.filter(
                        (b) => budgetResult(b, data, anchor).percent < 100,
                      ).length
                    }{" "}
                    в пределах ·{" "}
                    {
                      activeBudgets.filter(
                        (b) => budgetResult(b, data, anchor).percent >= 100,
                      ).length
                    }{" "}
                    превышено
                  </p>
                  {activeBudgets
                    .filter((b) => budgetResult(b, data, anchor).percent >= 100)
                    .map((b) => (
                      <div className="comparison-row" key={b.id}>
                        <span>
                          {category(b.categoryId)?.name} ·{" "}
                          {periodNames[b.period]}
                        </span>
                        <strong className="expense">
                          {money(-budgetResult(b, data, anchor).left)}
                        </strong>
                      </div>
                    ))}
                  <small>
                    Перерасход по лимитам разных периодов не суммируется.
                  </small>
                </section>
              </div>
            </>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="card">
                <h2>Внешний вид</h2>
                <p>Уютно в любое время суток</p>
                <div className="theme-options">
                  {(
                    [
                      ["light", "Светлая", "Sun"],
                      ["dark", "Тёмная", "Moon"],
                      ["system", "Системная", "Monitor"],
                    ] as const
                  ).map(([v, n, i]) => (
                    <button
                      key={v}
                      className={data.settings.theme === v ? "selected" : ""}
                      onClick={() =>
                        save({
                          ...data,
                          settings: { ...data.settings, theme: v },
                        })
                      }
                    >
                      <Icon name={i} size={24} />
                      {n}
                    </button>
                  ))}
                </div>
                <h3>Цветовая тема</h3>
                <div
                  className="theme-palettes"
                  role="group"
                  aria-label="Цветовая тема"
                >
                  {(Object.entries(paletteNames) as [Palette, string][]).map(
                    ([value, name]) => (
                      <button
                        key={value}
                        data-palette={value}
                        className={
                          (data.settings.palette ?? "green") === value
                            ? "selected"
                            : ""
                        }
                        aria-pressed={
                          (data.settings.palette ?? "green") === value
                        }
                        onClick={() =>
                          save({
                            ...data,
                            settings: { ...data.settings, palette: value },
                          })
                        }
                      >
                        <span className="palette-sample">
                          <i />
                          {(data.settings.palette ?? "green") === value && (
                            <I.Check size={15} />
                          )}
                        </span>
                        {name}
                      </button>
                    ),
                  )}
                </div>
                <p className="palette-help">
                  Любой цвет доступен в светлом, тёмном и системном режиме.
                </p>
                <h3>Основные настройки</h3>
                <button className="setting-link" onClick={openStarting}>
                  <span>Начальные деньги до первой операции</span>
                  <strong>{money(data.startingMoney ?? 0)}</strong>
                  <I.ChevronRight size={17} />
                </button>
                <div className="setting-row">
                  <span>Остаток за всю историю</span>
                  <strong>{money(cash)}</strong>
                </div>
                <div className="setting-row">
                  <span>Валюта</span>
                  <strong>Российский рубль · ₽</strong>
                </div>
                <div className="setting-row">
                  <span>Начало недели</span>
                  <strong>Понедельник</strong>
                </div>
                {[
                  ["categories", "Категории"],
                  ["budgets", "Лимиты"],
                  ["goals", "Финансовые цели"],
                ].map(([id, n]) => (
                  <button
                    className="setting-link"
                    key={id}
                    onClick={() => go(id)}
                  >
                    {n}
                    <I.ChevronRight size={17} />
                  </button>
                ))}
                <button
                  className="btn secondary full"
                  onClick={() => {
                    setDemo(demo ? null : demoData());
                    notify(
                      demo
                        ? "Вы вышли из демо"
                        : "Демоданные отделены от вашей истории",
                    );
                  }}
                >
                  <I.FlaskConical size={18} />
                  {demo ? "Выйти из демо" : "Посмотреть демо"}
                </button>
              </section>
              <section className="card">
                <h2>Ваши данные — у вас</h2>
                <p>
                  Финансовая история хранится в этом браузере. Сохраняйте
                  резервные копии: очистка браузера удалит данные. Синхронизации
                  между устройствами нет.
                </p>
                <button className="setting-link" onClick={() => backup(data)}>
                  <span>
                    <I.Download size={19} /> Скачать резервную копию JSON
                  </span>
                  <I.ArrowUpRight size={17} />
                </button>
                <button className="setting-link" onClick={() => csv(data)}>
                  <span>
                    <I.FileSpreadsheet size={19} /> Экспорт операций в CSV
                  </span>
                  <I.ArrowUpRight size={17} />
                </button>
                <button
                  className="setting-link"
                  onClick={() => file.current?.click()}
                >
                  <span>
                    <I.Upload size={19} /> Восстановить из JSON
                  </span>
                  <I.ArrowUpRight size={17} />
                </button>
                <button
                  className="setting-link"
                  onClick={() => csvFile.current?.click()}
                >
                  <span>
                    <I.FileUp size={19} />
                    Импорт CSV
                  </span>
                  <I.ArrowUpRight size={17} />
                </button>
                <input
                  type="file"
                  aria-label="Файл CSV"
                  accept=".csv,text/csv"
                  hidden
                  ref={csvFile}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      if (f.size > 20 * 1024 * 1024)
                        throw Error("Файл больше 20 МБ");
                      const text = new TextDecoder("utf-8", {
                        fatal: true,
                      }).decode(await f.arrayBuffer());
                      setCoinbox(parseCoinBox(text, f.name));
                    } catch (err) {
                      setCsvError(
                        err instanceof Error
                          ? err.message
                          : "Не удалось прочитать CSV",
                      );
                    }
                  }}
                />
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  ref={file}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      if (f.size > 20 * 1024 * 1024)
                        throw Error("Файл больше 20 МБ");
                      setPending(validateData(JSON.parse(await f.text())));
                    } catch (err) {
                      notify(
                        err instanceof Error
                          ? err.message
                          : "Не удалось прочитать файл",
                      );
                    }
                  }}
                />
                {storageError && (
                  <button
                    className="btn secondary"
                    onClick={() =>
                      download(
                        "Необработанные-данные.txt",
                        localStorage.getItem(STORAGE_KEY) || "",
                        "text/plain",
                      )
                    }
                  >
                    Скачать исходную запись
                  </button>
                )}
                <div className="privacy">
                  <I.ShieldCheck size={24} />
                  <div>
                    <strong>Личное остаётся личным</strong>
                    <p>
                      Без регистрации, банковских подключений и передачи
                      финансовых данных третьим сторонам.
                    </p>
                  </div>
                </div>
                <button
                  className="text-btn danger"
                  onClick={() => {
                    if (
                      prompt(
                        "Все личные данные будут удалены. Без резервной копии восстановление невозможно. Введите УДАЛИТЬ для подтверждения:",
                      ) === "УДАЛИТЬ"
                    ) {
                      const d = initial();
                      if (demo) setDemo(d);
                      else {
                        try {
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
                          setStorageError(null);
                          setReal(d);
                        } catch {
                          notify("Не удалось очистить хранилище");
                          return;
                        }
                      }
                      notify("Данные очищены");
                    }
                  }}
                >
                  <I.Trash2 size={17} /> Удалить все данные
                </button>
              </section>
              <section className="card">
                <h2>Всегда под рукой</h2>
                <p>
                  На iPhone откройте приложение в Safari, нажмите «Поделиться» →
                  «На экран Домой». Для установки приложение нужно разместить на
                  HTTPS-сайте. Полноценная работа без сети пока не
                  поддерживается.
                </p>
              </section>
            </div>
          )}
          <footer>
            <span>Мои финансы</span>
          </footer>
        </div>
      </main>
      <nav className="bottom-nav">
        {[
          ["home", "Главная", "LayoutDashboard"],
          ["transactions", "Операции", "ArrowLeftRight"],
          ["add", "Добавить", "Plus"],
          ["budgets", "Бюджеты", "ChartNoAxesCombined"],
          ["analytics", "Аналитика", "ChartPie"],
        ].map(([id, name, icon]) => (
          <button
            key={id}
            className={
              (page === id ? "active " : "") + (id === "add" ? "add-nav" : "")
            }
            onClick={() =>
              id === "add"
                ? setEditor({ type: "transaction", kind: "expense" })
                : go(id)
            }
          >
            <span>
              <Icon name={icon} size={21} />
            </span>
            <small>{name}</small>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <I.Info size={19} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Закрыть уведомление"
            onClick={() => setToast("")}
          >
            <I.X size={17} />
          </button>
        </div>
      )}
      {editor && (
        <EditorModal
          key={
            editor.type + ("item" in editor ? editor.item?.id || "new" : "new")
          }
          editor={editor}
          data={data}
          onClose={() => setEditor(null)}
          onSave={(next) => {
            if (save(next)) {
              setEditor(null);
              notify("Сохранено");
            }
          }}
          onDelete={(type, id) => {
            remove(type, id);
            setEditor(null);
          }}
          notify={notify}
        />
      )}{" "}
      {startingInput !== null && (
        <StartingMoneyModal
          data={data}
          initialValue={startingInput}
          onClose={closeStarting}
          onSave={(next) => {
            if (save(next)) {
              closeStarting();
              notify("Начальная сумма сохранена. Остаток пересчитан.");
            }
          }}
        />
      )}
      {csvError && (
        <Modal title="Не удалось загрузить CSV" onClose={() => setCsvError("")}>
          <p className="csv-error" role="alert">
            {csvError}
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setCsvError("")}>
              Понятно
            </button>
          </div>
        </Modal>
      )}
      {coinbox && importPlan && (
        <Modal title="Импорт CSV" onClose={() => setCoinbox(null)}>
          <p className="csv-filename">{coinbox.name}</p>
          <p>
            Найдено: {coinbox.rows.length} операций. Будет добавлено:{" "}
            {importPlan.transactions.length}. Уже загружено:{" "}
            {importPlan.duplicates}.
          </p>
          <p className="muted">
            Период: {[...coinbox.rows].map((r) => r.date).sort()[0]} —{" "}
            {[...coinbox.rows]
              .map((r) => r.date)
              .sort()
              .at(-1)}
          </p>
          <div className="csv-totals">
            <div>
              <small>Добавляемые доходы</small>
              <strong className="income">
                {money(sum(importPlan.transactions, "income"))}
              </strong>
            </div>
            <div>
              <small>Добавляемые расходы</small>
              <strong>{money(sum(importPlan.transactions, "expense"))}</strong>
            </div>
          </div>
          <p>
            Новых категорий: {importPlan.newCategories.length}
            {importPlan.newCategories.length > 0
              ? ` — ${importPlan.newCategories.map((c) => c.name).join(", ")}`
              : ""}
            .
          </p>
          <p className="muted">
            Операции добавятся к вашей истории{demo ? " в деморежиме" : ""}.
            Лимиты, цели и настройки сохранятся. Категории совпадают по названию
            и типу, новые создаются автоматически. Даты сохраняются без сдвига
            часового пояса.
          </p>
          <p className="muted">
            CSV содержит операции, но не начальный остаток. Деньги, которые были
            до первой операции, можно указать на главной через карандаш.
          </p>
          <h3 className="csv-preview-heading">Предпросмотр первых записей</h3>
          <div className="csv-preview">
            {coinbox.rows.slice(0, 6).map((r) => (
              <div className="csv-preview-row" key={r.importKey}>
                <span>
                  <strong>{r.category}</strong>
                  <small>
                    {dateLabel(r.date)}
                    {r.comment ? ` · ${r.comment}` : ""}
                  </small>
                </span>
                <strong className={r.type === "income" ? "income" : ""}>
                  {r.type === "income" ? "+" : "−"}
                  {money(r.amount)}
                </strong>
              </div>
            ))}
          </div>
          <p className="muted">
            Повторная загрузка той же выгрузки не добавит дубликаты. Операции,
            внесённые вручную, не считаются дубликатами автоматически. Время из
            CSV используется для распознавания повторов; в истории отображается
            дата.
          </p>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => backup(data)}>
              Скачать текущую копию
            </button>
            <button
              className="btn"
              disabled={
                !importPlan.transactions.length || (!!storageError && !demo)
              }
              onClick={() => {
                const plan = planCoinBox(data, coinbox);
                if (save(plan.next)) {
                  setCoinbox(null);
                  notify(
                    `Импортировано операций: ${plan.transactions.length}. Пропущено повторов: ${plan.duplicates}.`,
                  );
                }
              }}
            >
              Добавить операции ({importPlan.transactions.length})
            </button>
          </div>
        </Modal>
      )}
      {pending && (
        <Modal title="Восстановить данные?" onClose={() => setPending(null)}>
          <p>
            В копии {pending.transactions.length} операций,{" "}
            {pending.categories.length} категорий, {pending.budgets.length}{" "}
            лимитов и {pending.goals.length} целей.
          </p>
          <p className="danger">
            Импорт полностью заменит текущие данные{demo ? " деморежима" : ""}.
            Сначала сохраните резервную копию.
          </p>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => backup(data)}>
              Скачать текущую копию
            </button>
            <button
              className="btn"
              onClick={() => {
                if (demo) {
                  setDemo(pending);
                  setPending(null);
                  notify("Демоданные заменены");
                  return;
                }
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
                  setReal(pending);
                  setStorageError(null);
                  setPending(null);
                  notify("Данные восстановлены");
                } catch {
                  notify(
                    "Недостаточно места для импорта. Текущие данные не изменены.",
                  );
                }
              }}
            >
              Заменить данные
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <section className="card stat">
      <div className="row">
        <small>{label}</small>
        <Icon name={icon} size={18} />
      </div>
      <strong>{value}</strong>
    </section>
  );
}
function EditorModal({
  editor,
  data,
  onClose,
  onSave,
  onDelete,
  notify,
}: {
  editor: NonNullable<Editor>;
  data: Data;
  onClose: () => void;
  onSave: (d: Data) => void;
  onDelete: (type: "transactions" | "budgets" | "goals", id: string) => void;
  notify: (s: string) => void;
}) {
  const item = "item" in editor ? editor.item : undefined;
  const tx = editor.type === "transaction" ? editor.item : undefined,
    cat = editor.type === "category" ? editor.item : undefined,
    budget = editor.type === "budget" ? editor.item : undefined,
    goal = editor.type === "goal" ? editor.item : undefined,
    contribution = editor.type === "contribution" ? editor.item : undefined;
  const [kind, setKind] = useState<Kind | "saving">(
    tx?.type ||
      cat?.type ||
      goal?.type ||
      (editor.type === "transaction" ? editor.kind : undefined) ||
      "expense",
  );
  const [amount, setAmount] = useState(
    item && "amount" in item ? amountInput(item.amount) : "",
  );
  const [name, setName] = useState(cat?.name || goal?.name || "");
  const [catId, setCatId] = useState(
    tx?.categoryId || budget?.categoryId || "",
  );
  const [date, setDate] = useState(tx?.date || contribution?.date || today());
  const [comment, setComment] = useState(
    tx?.comment || goal?.comment || contribution?.comment || "",
  );
  const [period, setPeriod] = useState<Period>(
    budget?.period || goal?.period || "month",
  );
  const [start, setStart] = useState(goal?.start || range("month", today())[0]);
  const [end, setEnd] = useState(goal?.end || range("month", today())[1]);
  const [icon, setIcon] = useState(cat?.icon || "Shapes");
  const [color, setColor] = useState(cat?.color || "#83A994");
  const [iconSearch, setIconSearch] = useState("");
  const [enabled, setEnabled] = useState(budget?.enabled ?? true);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const used = cat && data.transactions.some((t) => t.categoryId === cat.id);
  const linked =
    cat && (used || data.budgets.some((b) => b.categoryId === cat.id));
  const setType = (v: Kind | "saving") => {
    setKind(v);
    setCatId("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    try {
      let next = { ...data };
      if (editor.type === "transaction") {
        const chosen = data.categories.find((c) => c.id === catId);
        if (
          !chosen ||
          chosen.type !== kind ||
          (chosen.archived && tx?.categoryId !== chosen.id)
        )
          throw Error("Выберите доступную категорию");
        const t: Transaction = {
          id: tx?.id || uid(),
          ...(tx?.importKey ? { importKey: tx.importKey } : {}),
          type: kind as Kind,
          amount: cents(amount),
          categoryId: catId,
          date,
          comment,
        };
        next.transactions = tx
          ? data.transactions.map((x) => (x.id === tx.id ? t : x))
          : [...data.transactions, t];
      } else if (editor.type === "category") {
        if (!name.trim()) throw Error("Укажите название");
        if (
          data.categories.some(
            (c) =>
              c.id !== cat?.id &&
              c.type === kind &&
              c.name.toLowerCase() === name.trim().toLowerCase(),
          )
        )
          throw Error("Такая категория уже существует");
        if (linked && kind !== cat?.type)
          throw Error("Тип связанной категории менять нельзя");
        const c: Category = {
          id: cat?.id || uid(),
          name: name.trim(),
          type: kind as Kind,
          icon,
          color,
          archived: cat?.archived || false,
        };
        next.categories = cat
          ? data.categories.map((x) => (x.id === cat.id ? c : x))
          : [...data.categories, c];
      } else if (editor.type === "budget") {
        if (
          !data.categories.some((c) => c.id === catId && c.type === "expense")
        )
          throw Error("Выберите категорию расходов");
        if (
          data.budgets.some(
            (b) =>
              b.id !== budget?.id &&
              b.categoryId === catId &&
              b.period === period,
          )
        )
          throw Error("Для этой категории и периода лимит уже существует");
        const b: Budget = {
          id: budget?.id || uid(),
          categoryId: catId,
          amount: cents(amount),
          period,
          enabled,
        };
        next.budgets = budget
          ? data.budgets.map((x) => (x.id === budget.id ? b : x))
          : [...data.budgets, b];
      } else if (editor.type === "goal") {
        if (!name.trim()) throw Error("Укажите название цели");
        if (start > end)
          throw Error("Дата завершения должна быть не раньше начала");
        if (goal?.contributions.length && goal.type !== kind)
          throw Error("Нельзя менять тип цели с пополнениями");
        const g: Goal = {
          id: goal?.id || uid(),
          name: name.trim(),
          type: kind,
          amount: cents(amount),
          period: period as Goal["period"],
          start,
          end,
          comment,
          contributions: goal?.contributions || [],
        };
        next.goals = goal
          ? data.goals.map((x) => (x.id === goal.id ? g : x))
          : [...data.goals, g];
      } else {
        const g = editor.goal;
        if (date < g.start || date > g.end)
          throw Error("Дата пополнения должна быть в пределах срока цели");
        const c: Contribution = {
          id: contribution?.id || uid(),
          amount: cents(amount),
          date,
          comment,
        };
        next.goals = data.goals.map((x) =>
          x.id === g.id
            ? {
                ...x,
                contributions: contribution
                  ? x.contributions.map((y) => (y.id === c.id ? c : y))
                  : [...x.contributions, c],
              }
            : x,
        );
      }
      validateData(next);
      lock.current = true;
      onSave(next);
      queueMicrotask(() => {
        lock.current = false;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Проверьте поля");
    }
  };
  const titles = {
    transaction: tx ? "Редактировать операцию" : "Новая операция",
    category: cat ? "Настроить категорию" : "Новая категория",
    budget: budget ? "Настроить лимит" : "Новый лимит",
    goal: goal ? "Изменить цель" : "Новая финансовая цель",
    contribution: contribution ? "Исправить пополнение" : "Пополнить цель",
  };
  return (
    <Modal title={titles[editor.type]} onClose={onClose}>
      <form onSubmit={submit} className="editor-form">
        {["transaction", "category", "goal"].includes(editor.type) && (
          <div className="segmented type-switch">
            {(
              [
                ["expense", "Расход"],
                ["income", "Доход"],
                ...(editor.type === "goal" ? [["saving", "Накопления"]] : []),
              ] as [Kind | "saving", string][]
            ).map(([k, n]) => (
              <button
                type="button"
                key={k}
                disabled={!!linked || !!goal?.contributions.length}
                className={kind === k ? "selected" : ""}
                onClick={() => setType(k)}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        {["category", "goal"].includes(editor.type) && (
          <Field label="Название">
            <input
              required
              maxLength={100}
              placeholder={
                editor.type === "goal"
                  ? "Например, путешествие к морю"
                  : "Название категории"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        )}
        {editor.type !== "category" && (
          <Field
            label={
              editor.type === "goal" && kind === "expense"
                ? "Максимальный расход, ₽"
                : "Сумма, ₽"
            }
          >
            <input
              className="amount-field"
              required
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        )}
        {["transaction", "budget"].includes(editor.type) && (
          <Field label="Категория">
            <div className="category-picker">
              {data.categories
                .filter(
                  (c) =>
                    (!c.archived ||
                      c.id === tx?.categoryId ||
                      c.id === budget?.categoryId) &&
                    c.type === (editor.type === "budget" ? "expense" : kind),
                )
                .map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={catId === c.id ? "selected" : ""}
                    onClick={() => setCatId(c.id)}
                  >
                    <CatIcon cat={c} />
                    <span>
                      {c.name}
                      {c.archived ? " (архив)" : ""}
                    </span>
                  </button>
                ))}
            </div>
          </Field>
        )}
        {["transaction", "contribution"].includes(editor.type) && (
          <Field label="Дата">
            <input
              required
              type="date"
              min={
                editor.type === "contribution" ? editor.goal.start : undefined
              }
              max={editor.type === "contribution" ? editor.goal.end : undefined}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
        {["budget", "goal"].includes(editor.type) && (
          <Field label="Период">
            <select
              value={period}
              onChange={(e) => {
                const p = e.target.value as Period;
                setPeriod(p);
                if (editor.type === "goal") {
                  const [s, en] = range(p, start);
                  setStart(s);
                  setEnd(en);
                }
              }}
            >
              {(Object.keys(periodNames) as Period[])
                .filter((p) => editor.type !== "goal" || p !== "week")
                .map((p) => (
                  <option key={p} value={p}>
                    {periodNames[p]}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {editor.type === "budget" && (
          <label className="check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Лимит включён
          </label>
        )}
        {editor.type === "goal" && (
          <div className="two-grid">
            <Field label="Начало">
              <input
                required
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Завершение">
              <input
                required
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
        )}
        {["transaction", "goal", "contribution"].includes(editor.type) && (
          <Field label="Комментарий · необязательно">
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Пара слов для себя"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        )}
        {editor.type === "category" && (
          <>
            <Field label="Иконка">
              <input
                placeholder="Поиск: кофе, дом, gift…"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
              />
              <div className="icon-catalog">
                {iconNames
                  .filter((n) => {
                    const label =
                      initial().categories.find((c) => c.icon === n)?.name ||
                      "";
                    return (n + " " + label)
                      .toLowerCase()
                      .includes(iconSearch.toLowerCase());
                  })
                  .map((n) => (
                    <button
                      type="button"
                      title={n}
                      aria-label={n}
                      key={n}
                      className={n === icon ? "selected" : ""}
                      onClick={() => setIcon(n)}
                    >
                      <Icon name={n} />
                    </button>
                  ))}
              </div>
            </Field>
            <Field label="Цвет">
              <div className="swatches">
                {[
                  "#83A994",
                  "#D1AD76",
                  "#8FA7BF",
                  "#B69DC0",
                  "#C99485",
                  "#9BAA78",
                  "#7AACA7",
                  "#C76556",
                  "#276A57",
                ].map((c) => (
                  <button
                    type="button"
                    aria-label={`Цвет ${c}`}
                    key={c}
                    style={{ background: c }}
                    className={c === color ? "selected" : ""}
                    onClick={() => setColor(c)}
                  >
                    {c === color && <I.Check size={17} />}
                  </button>
                ))}
                <input
                  type="color"
                  aria-label="Свой цвет"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </Field>
            <div className="category-preview">
              <CatIcon
                cat={{
                  id: "preview",
                  name,
                  type: kind as Kind,
                  icon,
                  color,
                  archived: false,
                }}
              />
              <strong>{name || "Ваша категория"}</strong>
              <small>Предпросмотр</small>
            </div>
            {linked && (
              <small>
                Тип категории закреплён за её операциями или лимитами. Для
                сохранения истории используйте архив.
              </small>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn">
            <I.Check size={17} /> Сохранить
          </button>
        </div>
        {item && (
          <div className="editor-danger">
            {editor.type === "category" && cat ? (
              <>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    onSave({
                      ...data,
                      categories: data.categories.map((c) =>
                        c.id === cat.id ? { ...c, archived: !c.archived } : c,
                      ),
                    })
                  }
                >
                  <I.Archive size={17} />
                  {cat.archived ? "Восстановить из архива" : "Архивировать"}
                </button>
                {!linked && (
                  <button
                    type="button"
                    className="text-btn danger"
                    onClick={() => {
                      if (confirm("Удалить неиспользуемую категорию?"))
                        onSave({
                          ...data,
                          categories: data.categories.filter(
                            (c) => c.id !== cat.id,
                          ),
                        });
                    }}
                  >
                    Удалить
                  </button>
                )}
              </>
            ) : editor.type === "contribution" ? (
              <button
                type="button"
                className="text-btn danger"
                onClick={() => {
                  if (confirm("Удалить пополнение?"))
                    onSave({
                      ...data,
                      goals: data.goals.map((g) =>
                        g.id === editor.goal.id
                          ? {
                              ...g,
                              contributions: g.contributions.filter(
                                (c) => c.id !== item.id,
                              ),
                            }
                          : g,
                      ),
                    });
                }}
              >
                Удалить пополнение
              </button>
            ) : (
              <button
                type="button"
                className="text-btn danger"
                onClick={() =>
                  onDelete(
                    editor.type === "transaction"
                      ? "transactions"
                      : editor.type === "budget"
                        ? "budgets"
                        : "goals",
                    item.id,
                  )
                }
              >
                <I.Trash2 size={16} /> Удалить{" "}
                {editor.type === "transaction"
                  ? "операцию"
                  : editor.type === "budget"
                    ? "лимит"
                    : "цель"}
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

function StartingMoneyModal({
  data,
  initialValue,
  onClose,
  onSave,
}: {
  data: Data;
  initialValue: string;
  onClose: () => void;
  onSave: (d: Data) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  let parsed: number | null = null;
  try {
    parsed = startingCents(value);
  } catch {}
  const net = cashBalance(data) - (data.startingMoney ?? 0);
  return (
    <Modal title="Начальные деньги" onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(
              validateData({ ...data, startingMoney: startingCents(value) }),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Проверьте сумму");
          }
        }}
      >
        <p>
          Сколько денег было на всех картах и наличными до самой первой операции
          в вашей истории. Эта сумма не является доходом.
        </p>
        <Field label="Начальная сумма, ₽">
          <input
            required
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <div className="starting-calculation">
          <div>
            <span>Начальные деньги</span>
            <strong>{parsed === null ? "—" : money(parsed)}</strong>
          </div>
          <div>
            <span>Доходы минус расходы за всю историю</span>
            <strong>{money(net)}</strong>
          </div>
          <div>
            <span>Остаток на сегодня</span>
            <strong>{parsed === null ? "—" : money(parsed + net)}</strong>
          </div>
        </div>
        <p className="muted">
          Сумма применяется один раз ко всей истории. Операции и аналитика
          доходов и расходов не изменятся. Начальные деньги сохраняются в
          JSON-копии; CSV CoinBox их не содержит.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn" type="submit">
            Сохранить и пересчитать
          </button>
        </div>
      </form>
    </Modal>
  );
}
