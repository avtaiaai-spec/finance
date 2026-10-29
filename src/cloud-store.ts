import { initial, validateData, type Data } from "./model";
import { equal, mergeFinance } from "./cloud-merge";
export type CloudRow = { revision: number; payload: Data; updated_at: string };
export interface Transport {
  read(): Promise<CloudRow | null>;
  write(revision: number, data: Data): Promise<CloudRow>;
}
type Cache = {
  lastExpenseDate?: string;
  data: Data;
  base: Data;
  revision: number;
  initialized: boolean;
};
export class CloudStore {
  readonly key: string;
  data: Data = initial();
  base: Data = initial();
  revision = 0;
  initialized = false;
  canWrite = true;
  error: string | null = null;
  status = "Подключение…";
  conflicts: string[] = [];
  exists = false;
  lastSynced: string | null = null;
  private listeners = new Set<() => void>();
  private running = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private resolution: "local" | "remote" | undefined;
  private held = false;
  private localExpenseDate: string | undefined;
  private wire(d: Data): Data {
    const settings = { ...d.settings };
    delete settings.lastExpenseDate;
    return { ...d, settings };
  }
  private localize(d: Data): Data {
    const data = this.wire(d);
    if (this.localExpenseDate)
      data.settings.lastExpenseDate = this.localExpenseDate;
    return data;
  }
  constructor(
    readonly owner: string,
    private transport: Transport,
    private storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  ) {
    this.key = `calm-finance-account:${owner}`;
    try {
      const raw = storage.getItem(this.key);
      if (raw) {
        const c = JSON.parse(raw) as Cache;
        if (
          typeof c.initialized !== "boolean" ||
          !Number.isSafeInteger(c.revision) ||
          c.revision < 0
        )
          throw Error();
        this.data = validateData(c.data);
        this.base = validateData(c.base);
        this.localExpenseDate =
          c.lastExpenseDate || this.data.settings.lastExpenseDate;
        if (this.localExpenseDate)
          validateData({
            ...initial(),
            settings: {
              theme: "system",
              lastExpenseDate: this.localExpenseDate,
            },
          });
        this.data = this.localize(this.data);
        this.base = this.localize(this.base);
        this.revision = c.revision;
        this.initialized = c.initialized;
        this.exists = c.revision > 0;
      }
    } catch {
      this.error =
        "Локальная копия аккаунта повреждена. Скачайте исходную запись в настройках, затем загрузите облачную копию заново.";
      this.held = true;
    }
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit() {
    if (!this.stopped) this.listeners.forEach((fn) => fn());
  }
  private persist(
    data = this.data,
    base = this.base,
    revision = this.revision,
    initialized = this.initialized,
    lastExpenseDate: string | null | undefined = this.localExpenseDate,
  ) {
    this.storage.setItem(
      this.key,
      JSON.stringify({
        data,
        base,
        revision,
        initialized,
        ...(lastExpenseDate ? { lastExpenseDate } : {}),
      }),
    );
    this.localExpenseDate = lastExpenseDate ?? undefined;
    this.data = data;
    this.base = base;
    this.revision = revision;
    this.initialized = initialized;
  }
  read() {
    return { data: this.data, error: this.error };
  }
  get dirty() {
    return !equal(this.wire(this.data), this.wire(this.base));
  }
  update(next: Data) {
    if (!this.canWrite)
      throw Error(
        "Этот аккаунт уже открыт в другом окне. Закройте другое окно или дождитесь подключения.",
      );
    if (this.held)
      throw Error(
        "Локальная копия повреждена. Сначала загрузите облачную копию заново.",
      );
    const valid = validateData(next);
    this.persist(
      valid,
      this.base,
      this.revision,
      this.initialized,
      valid.settings.lastExpenseDate ?? null,
    );
    this.error = null;
    this.held = false;
    this.status = "Сохранено на устройстве · ожидает облака";
    this.emit();
    this.schedule();
  }
  async recover() {
    if (!this.canWrite) throw Error("Аккаунт открыт в другом окне.");
    const remote = await this.transport.read();
    if (this.stopped) return;
    const d = this.localize(remote ? validateData(remote.payload) : initial());
    this.persist(d, d, remote?.revision || 0, true);
    this.held = false;
    this.error = null;
    this.exists = !!remote;
    this.status = "Облачная копия загружена";
    this.emit();
  }
  access(allowed: boolean, message = "Ожидаем доступ к локальной копии…") {
    this.canWrite = allowed;
    if (!allowed) this.status = message;
    this.emit();
  }
  reloadCache() {
    const raw = this.storage.getItem(this.key);
    if (!raw) return;
    try {
      const c = JSON.parse(raw) as Cache;
      if (
        !Number.isSafeInteger(c.revision) ||
        c.revision < 0 ||
        typeof c.initialized !== "boolean"
      )
        throw Error();
      this.data = validateData(c.data);
      this.base = validateData(c.base);
      this.localExpenseDate =
        c.lastExpenseDate || this.data.settings.lastExpenseDate;
      if (this.localExpenseDate)
        validateData({
          ...initial(),
          settings: { theme: "system", lastExpenseDate: this.localExpenseDate },
        });
      this.data = this.localize(this.data);
      this.base = this.localize(this.base);
      this.revision = c.revision;
      this.initialized = c.initialized;
      this.exists = c.revision > 0;
      this.emit();
    } catch {
      this.error =
        "Локальная копия аккаунта повреждена. Скачайте исходную запись в настройках.";
      this.held = true;
      this.emit();
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(() => void this.sync(), 600);
  }
  start() {
    this.stopped = false;
    void this.sync();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  async sync() {
    if (this.running || this.stopped || this.held || !this.canWrite) return;
    this.running = true;
    this.status = "Синхронизация…";
    this.emit();
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await this.transport.read();
        if (this.stopped) return;
        this.exists = !!remote;
        const remoteData = this.localize(
          remote ? validateData(remote.payload) : initial(),
        );
        const remoteRevision = remote?.revision || 0;
        const result = mergeFinance(
          this.wire(this.base),
          this.wire(this.data),
          this.wire(remoteData),
          this.resolution,
        );
        if (result.conflicts.length && !this.resolution) {
          this.conflicts = result.conflicts;
          this.status = "Нужно сверить изменения";
          this.emit();
          return;
        }
        const merged = this.localize(result.data);
        this.persist(merged, remoteData, remoteRevision, true);
        this.emit();
        if (equal(this.wire(merged), this.wire(remoteData))) {
          this.conflicts = [];
          this.resolution = undefined;
          this.status = remote
            ? "Все изменения в облаке"
            : "Аккаунт подключён. История в облаке пока пустая.";
          this.lastSynced = remote?.updated_at || null;
          this.emit();
          return;
        }
        const outgoing = merged;
        try {
          const saved = await this.transport.write(
            remoteRevision,
            this.wire(outgoing),
          );
          if (this.stopped) return;
          const valid = this.localize(validateData(saved.payload));
          // New local edits during the request must remain pending, rather than being overwritten by the response.
          const rebased = mergeFinance(
            this.wire(outgoing),
            this.wire(this.data),
            this.wire(valid),
          );
          this.persist(
            this.localize(rebased.data),
            valid,
            saved.revision,
            true,
          );
          this.exists = true;
          this.conflicts = rebased.conflicts;
          this.lastSynced = saved.updated_at;
          this.resolution = undefined;
          if (this.conflicts.length) {
            this.status = "Нужно сверить изменения";
            this.emit();
            return;
          }
          if (this.dirty) continue;
          this.status = "Все изменения в облаке";
          this.emit();
          return;
        } catch (e) {
          if ((e as { code?: string }).code === "40001") continue;
          throw e;
        }
      }
      this.status =
        "Есть новые изменения на другом устройстве. Повторим синхронизацию.";
      this.schedule();
    } catch (e) {
      this.status = cloudError(e);
      this.emit();
    } finally {
      this.running = false;
    }
  }
  resolve(choice: "local" | "remote") {
    this.resolution = choice;
    this.conflicts = [];
    void this.sync();
  }
}
export function cloudError(e: unknown) {
  const code = (e as { code?: string })?.code;
  const message = e instanceof Error ? e.message : "";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42501"].includes(code || ""))
    return "База ещё не настроена. Выполните SQL-скрипт подключения в Supabase.";
  if (code === "401" || code === "PGRST301")
    return "Сессия истекла. Войдите в аккаунт заново. Данные остались на устройстве.";
  if (code === "22023")
    return "Облако отклонило формат или размер данных. Локальная копия сохранена.";
  return message.startsWith("Локаль")
    ? message
    : "Нет связи с облаком. Изменения сохранены на устройстве; повторим после подключения.";
}
