import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./cloud-config";
import { type CloudRow, type Transport } from "./cloud-store";
import { type Data, validateData } from "./model";
// Capture recovery intent before the SDK consumes and removes the URL fragment.
const landing = new URL(window.location.href);
const fragment = new URLSearchParams(landing.hash.slice(1));
export const authLinkError =
  fragment.has("error") || landing.searchParams.has("error");
export const recoveryLanding =
  fragment.get("type") === "recovery" ||
  landing.searchParams.has("code") ||
  authLinkError;
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: landing.searchParams.has("code") ? "pkce" : "implicit",
  },
});
// Check the old password in an isolated, non-persistent session. This neither
// replaces the active account nor depends on a project-wide Auth setting.
export async function changePasswordWithCurrent(
  owner: User,
  currentPassword: string,
  password: string,
) {
  if (!owner.email) throw Error("У аккаунта нет почты");
  const verification = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  try {
    const signedIn = await verification.auth.signInWithPassword({
      email: owner.email,
      password: currentPassword,
    });
    if (signedIn.error) throw signedIn.error;
    if (signedIn.data.user?.id !== owner.id) throw Error("Аккаунт изменился");
    const changed = await verification.auth.updateUser({ password });
    if (changed.error) throw changed.error;
  } finally {
    // Only revoke the short-lived verification session; keep the app signed in.
    await verification.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
export async function cloudRequest(user: User, path: string, body?: unknown) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== user.id)
    throw Object.assign(Error("Войдите заново"), { code: "401" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const result = await res.json();
    if (!res.ok)
      throw Object.assign(
        Error(
          typeof result.message === "string" ? result.message : "Ошибка облака",
        ),
        { code: String(result.code || res.status) },
      );
    return result;
  } finally {
    clearTimeout(timer);
  }
}
export function transportFor(user: User): Transport {
  let cached: CloudRow | null = null;
  const owner = encodeURIComponent(user.id);
  return {
    async read() {
      const meta = await cloudRequest(
        user,
        `finance_state?user_id=eq.${owner}&select=revision,updated_at`,
      );
      if (!Array.isArray(meta) || meta.length > 1)
        throw Error("Некорректный ответ облака");
      if (!meta.length) {
        cached = null;
        return null;
      }
      if (cached && cached.revision === meta[0].revision) return cached;
      const rows = await cloudRequest(
        user,
        `finance_state?user_id=eq.${owner}&select=revision,payload,updated_at`,
      );
      if (!Array.isArray(rows) || rows.length !== 1)
        throw Error("Версия облака изменилась; повторите синхронизацию");
      cached = parseCloudRow(rows[0]);
      return cached;
    },
    async write(revision: number, payload: Data) {
      cached = parseCloudRow(
        await cloudRequest(user, "rpc/save_finance_state", {
          p_expected_revision: revision,
          p_data: payload,
        }),
      );
      return cached;
    },
  };
}
export function parseCloudRow(row: CloudRow): CloudRow {
  if (
    !row ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.updated_at !== "string"
  )
    throw Error("Некорректная версия облачных данных");
  return { ...row, payload: validateData(row.payload) };
}
