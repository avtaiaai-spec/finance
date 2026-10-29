import { useEffect, useMemo, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, transportFor, cloudRequest } from "./supabase";
import { CloudStore, cloudError } from "./cloud-store";
import { AUTH_REDIRECT } from "./cloud-config";
import { type Data, backup, load, validateData } from "./model";
import { hasFinance } from "./cloud-merge";
import { ProfileForm, useProfileAvatar } from "./profile";
export type Account = {
  user: User | null;
  store: CloudStore | null;
  loading: boolean;
  recovery: boolean;
  authError: string;
  finishRecovery: () => void;
  avatarUrl: string | null;
  justSignedIn: boolean;
};
export function useAccount(): Account {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false),
    [authError, setAuthError] = useState("");
  const identity = useRef<string | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          identity.current = data.session?.user.id || null;
          setUser(data.session?.user || null);
          setLoading(false);
          if (error)
            setAuthError(
              "Не удалось проверить вход. Проверьте интернет и войдите заново.",
            );
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setAuthError("Не удалось проверить вход.");
        }
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const changed = identity.current !== (session?.user.id || null);
      if (event === "SIGNED_IN" && changed) setJustSignedIn(true);
      if (event === "SIGNED_OUT") setJustSignedIn(false);
      identity.current = session?.user.id || null;
      setUser(session?.user || null);
      if (session) setAuthError("");
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const avatarUrl = useProfileAvatar(user);
  useEffect(() => {
    const owner = user?.id;
    if (!owner) return;
    let active = true;
    const refresh = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (
          active &&
          !error &&
          data.user?.id === owner &&
          identity.current === owner
        )
          setUser(data.user);
      } catch {}
    };
    void refresh();
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", visible);
    window.addEventListener("finance-profile-updated", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("finance-profile-updated", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [user?.id]);
  const store = useMemo(() => {
    if (!user) return null;
    const s = new CloudStore(user.id, transportFor(user));
    s.canWrite = false;
    return s;
  }, [user?.id]);
  useEffect(() => {
    if (!store) return;
    let active = true,
      owner = false,
      attempting = false;
    let release = () => {};
    const acquire = () => {
      if (!active || owner || attempting) return;
      if (!navigator.locks) {
        store.access(
          false,
          "Для кабинета нужен современный браузер с поддержкой безопасного доступа к локальной копии.",
        );
        return;
      }
      attempting = true;
      void navigator.locks
        .request(
          "finance-writer:" + store.owner,
          { ifAvailable: true },
          async (lock) => {
            if (!active) return;
            if (!lock) {
              store.access(
                false,
                "Этот аккаунт открыт в другом окне. Закройте другое окно, чтобы продолжить здесь.",
              );
              return;
            }
            owner = true;
            store.reloadCache();
            store.access(true);
            store.start();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            owner = false;
          },
        )
        .finally(() => {
          attempting = false;
        });
    };
    acquire();
    const poll = setInterval(() => {
      if (owner) void store.sync();
    }, 12000);
    const retry = setInterval(acquire, 2000);
    const sync = () => {
      if (!document.hidden) {
        if (owner) void store.sync();
        else acquire();
      }
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      active = false;
      release();
      clearInterval(poll);
      clearInterval(retry);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      store.stop();
    };
  }, [store]);
  return {
    user,
    store,
    loading,
    recovery,
    authError,
    finishRecovery: () => setRecovery(false),
    avatarUrl,
    justSignedIn,
  };
}
export function AccountPanel({
  account,
  current,
  onChanged,
}: {
  account: Account;
  current: Data;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "password">(
    "login",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [history, setHistory] = useState<
      { revision: number; created_at: string }[]
    >([]),
    [preview, setPreview] = useState<Data | null>(null);
  const store = account.store;
  useEffect(() => {
    if (account.recovery) setMode("password");
  }, [account.recovery]);
  const [guest] = useState(load);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        const r = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (r.error) throw r.error;
        setPassword("");
        setMessage("Вы вошли в аккаунт.");
      }
      if (mode === "signup") {
        const r = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: AUTH_REDIRECT },
        });
        if (r.error) throw r.error;
        setPassword("");
        setMessage(
          r.data.session
            ? "Аккаунт создан."
            : "Проверьте почту и подтвердите регистрацию по ссылке. Если письмо не пришло, проверьте «Спам».",
        );
      }
      if (mode === "reset") {
        const r = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: AUTH_REDIRECT,
        });
        if (r.error) throw r.error;
        setMessage(
          "Если аккаунт существует, письмо со ссылкой для смены пароля отправлено.",
        );
      }
      if (mode === "password") {
        const r = await supabase.auth.updateUser({ password });
        if (r.error) throw r.error;
        setPassword("");
        setMode("login");
        setMessage("Пароль обновлён.");
        account.finishRecovery();
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMessage(
        code === "invalid_credentials"
          ? "Неверная почта или пароль."
          : code === "email_not_confirmed"
            ? "Сначала подтвердите адрес по ссылке в письме."
            : code === "over_email_send_rate_limit"
              ? "Слишком много писем. Подождите и попробуйте снова."
              : code === "weak_password"
                ? "Выберите более надёжный пароль."
                : "Не удалось выполнить запрос. Проверьте данные и интернет; повторите попытку.",
      );
    } finally {
      setBusy(false);
    }
  };
  const restore = async (revision: number) => {
    if (!account.user) return;
    setBusy(true);
    try {
      const rows = await cloudRequest(
        account.user,
        `finance_history?user_id=eq.${encodeURIComponent(account.user.id)}&revision=eq.${revision}&select=payload`,
      );
      if (!rows?.length) throw Error();
      setPreview(validateData(rows[0].payload));
    } catch (e) {
      setMessage(cloudError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card account-card">
      <h2>Учётная запись</h2>
      {account.user && store ? (
        <>
          <p className="account-email">{account.user.email}</p>
          <ProfileForm
            key={account.user.id}
            user={account.user}
            avatarUrl={account.avatarUrl}
          />
          <p className="sync-status" role="status">
            {store.status}
          </p>
          {store.lastSynced && (
            <small>
              Последняя синхронизация:{" "}
              {new Date(store.lastSynced).toLocaleString("ru-RU")}
            </small>
          )}
          {store.error && (
            <button
              className="btn secondary"
              onClick={async () => {
                if (
                  confirm(
                    "Локальная копия повреждена. Сначала скачайте исходную запись в настройках. Загрузить облачную копию вместо повреждённой?",
                  )
                ) {
                  try {
                    await store.recover();
                  } catch (e) {
                    setMessage(cloudError(e));
                  }
                }
              }}
            >
              Загрузить облачную копию заново
            </button>
          )}
          <div className="account-actions">
            <button className="btn secondary" onClick={() => void store.sync()}>
              Синхронизировать
            </button>
            <button
              className="text-btn"
              onClick={async () => {
                if (
                  store.dirty &&
                  !confirm(
                    "Есть изменения, ещё не отправленные в облако. Они останутся в локальной копии этого аккаунта на этом устройстве. Перед выходом рекомендуется скачать JSON. Выйти?",
                  )
                )
                  return;
                const r = await supabase.auth.signOut({ scope: "local" });
                if (r.error)
                  setMessage("Не удалось выйти. Проверьте подключение.");
              }}
            >
              Выйти
            </button>
          </div>
          <p className="muted">
            Копия аккаунта хранится на этом устройстве. Открытое приложение
            сохраняет изменения без сети и отправляет их после подключения.
            Полностью автономный запуск без сети пока не поддерживается.
          </p>
          {store.initialized &&
            !hasFinance(current) &&
            hasFinance(guest.data) &&
            !guest.error && (
              <div className="cloud-migration">
                <h3>Перенести историю с этого устройства?</h3>
                <p>
                  {guest.data.transactions.length} операций,{" "}
                  {guest.data.categories.length} категорий,{" "}
                  {guest.data.budgets.length} лимитов и{" "}
                  {guest.data.goals.length} целей. Локальная история останется
                  отдельной копией.
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    if (
                      confirm(
                        "Загрузить показанную локальную историю в ваш аккаунт Supabase?",
                      )
                    ) {
                      try {
                        store.update(guest.data);
                        onChanged();
                      } catch {
                        setMessage(
                          "Не удалось сохранить перенос. Сначала скачайте JSON-копию.",
                        );
                      }
                    }
                  }}
                >
                  Перенести мои данные в облако
                </button>
              </div>
            )}
          {store.conflicts.length > 0 && (
            <div className="cloud-conflict">
              <h3>Изменения на двух устройствах</h3>
              <p>
                Спорных полей: {store.conflicts.length}. Независимые изменения
                объединяются. Для спорных выберите версию. Если нарушены связи
                категорий и операций, потребуется выбрать целую версию истории.
              </p>
              <button className="text-btn" onClick={() => backup(current)}>
                Скачать мою копию
              </button>
              <div className="account-actions">
                <button className="btn" onClick={() => store.resolve("local")}>
                  Мои версии
                </button>
                <button
                  className="btn secondary"
                  onClick={() => store.resolve("remote")}
                >
                  Облачные версии
                </button>
              </div>
            </div>
          )}
          <details>
            <summary>Восстановление из облачной истории</summary>
            <p className="muted">
              Предыдущие версии хранятся до 30 дней. Восстановление заменяет
              текущую историю; сначала скачайте JSON-копию.
            </p>
            <button
              className="text-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setHistory(
                    await cloudRequest(
                      account.user!,
                      `finance_history?user_id=eq.${encodeURIComponent(account.user!.id)}&select=revision,created_at&order=revision.desc&limit=30`,
                    ),
                  );
                  setMessage("Список версий обновлён.");
                } catch (e) {
                  setMessage(cloudError(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Показать последние версии
            </button>
            {history.map((h) => (
              <button
                className="setting-link"
                key={h.revision}
                disabled={busy}
                onClick={() => void restore(h.revision)}
              >
                <span>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
                <span>Открыть</span>
              </button>
            ))}
            {preview && (
              <div className="cloud-conflict">
                <p>
                  В версии {preview.transactions.length} операций,{" "}
                  {preview.goals.length} целей. Восстановление применится ко
                  всем устройствам аккаунта.
                </p>
                <button className="text-btn" onClick={() => backup(current)}>
                  Скачать текущую копию
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    if (
                      confirm("Заменить данные аккаунта выбранной версией?")
                    ) {
                      try {
                        store.update(preview);
                        setPreview(null);
                        onChanged();
                      } catch {
                        setMessage("Не удалось сохранить восстановление.");
                      }
                    }
                  }}
                >
                  Восстановить эту версию
                </button>
              </div>
            )}
          </details>
        </>
      ) : (
        <>
          <p>
            Войдите с телефона и компьютера, чтобы использовать одну историю. До
            входа данные остаются только в этом браузере. Перенос в облако
            потребует отдельного подтверждения.
          </p>
          <div className="segmented fit account-tabs">
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Вход
            </button>
            <button
              className={mode === "signup" ? "selected" : ""}
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
            >
              Регистрация
            </button>
          </div>
        </>
      )}
      {(!account.user || mode === "password") && (
        <form className="account-form" onSubmit={submit}>
          <h3>
            {mode === "reset"
              ? "Восстановление пароля"
              : mode === "password"
                ? "Новый пароль"
                : mode === "signup"
                  ? "Создать аккаунт"
                  : "Войти в аккаунт"}
          </h3>
          {mode !== "password" && (
            <label className="field">
              <span>Электронная почта</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              <span>Пароль</span>
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button className="btn" disabled={busy} type="submit">
            {busy
              ? "Подождите…"
              : mode === "signup"
                ? "Зарегистрироваться"
                : mode === "reset"
                  ? "Отправить письмо"
                  : mode === "password"
                    ? "Сохранить пароль"
                    : "Войти"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="text-btn"
              onClick={() => setMode("reset")}
            >
              Забыли пароль?
            </button>
          )}
        </form>
      )}
      {account.authError && <p className="form-error">{account.authError}</p>}
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
