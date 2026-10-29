import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./cloud-config";
import { type CloudRow, type Transport } from "./cloud-store";
import { type Data, validateData } from "./model";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
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
