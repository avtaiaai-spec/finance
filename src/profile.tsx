import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./cloud-config";
export const AVATAR_BUCKET = "finance-avatars";
export function profileName(user: User | null) {
  const n = user?.user_metadata?.display_name;
  return typeof n === "string" ? n.trim().slice(0, 60) : "";
}
export function profileInitials(user: User | null) {
  return (
    profileName(user)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => Array.from(s)[0])
      .join("")
      .toLocaleUpperCase("ru-RU") || "Я"
  );
}
export function avatarPath(user: User | null) {
  const path = user?.user_metadata?.avatar_path;
  return user &&
    typeof path === "string" &&
    new RegExp("^" + user.id + "/[0-9a-f-]{36}\\.jpg$").test(path)
    ? path
    : null;
}
export function useProfileAvatar(user: User | null) {
  const path = avatarPath(user);
  const [avatar, setAvatar] = useState<{
    owner: string;
    path: string;
    url: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const owner = user?.id;
    if (!owner || !path) {
      setAvatar(null);
      return;
    }
    const refresh = async () => {
      try {
        const { data, error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(path, 3600);
        if (!error && data?.signedUrl && active) {
          const u = new URL(data.signedUrl);
          if (u.origin === SUPABASE_URL)
            setAvatar({ owner, path, url: u.href });
        }
      } catch {}
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 45 * 60000);
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [user?.id, path]);
  return avatar && avatar.owner === user?.id && avatar.path === path
    ? avatar.url
    : null;
}
export function Avatar({
  user,
  url,
}: {
  user: User | null;
  url: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url ? (
    <img
      className="avatar-image"
      src={url}
      alt="Фото профиля"
      referrerPolicy="no-referrer"
      onError={() => setFailed(url)}
    />
  ) : (
    <span>{profileInitials(user)}</span>
  );
}
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error(
      "Выберите фото JPEG, PNG или WebP. При необходимости сохраните фото с iPhone в JPEG.",
    );
  if (file.size > 10 * 1024 * 1024)
    throw Error("Фото должно быть не больше 10 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(Error("Не удалось открыть фото. Выберите другой файл."));
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw Error(
        "Фото слишком большое по разрешению. Выберите уменьшенную копию.",
      );
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Не удалось обработать фото.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Не удалось подготовить фото."))),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function requireOwner(id: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== id)
    throw Error("Войдите в аккаунт заново.");
  return data.session.access_token;
}
export async function saveProfile(
  user: User,
  name: string,
  photo: Blob | null,
  remove: boolean,
  changeName = true,
) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length > 60) throw Error("Имя должно быть не длиннее 60 символов.");
  await requireOwner(user.id);
  const previous = avatarPath(user);
  let uploaded: string | null = null;
  let path = remove ? null : previous;
  let metadataAttempted = false;
  let token = "";
  try {
    if (photo) {
      uploaded = `${user.id}/${crypto.randomUUID()}.jpg`;
      const r = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(uploaded, photo, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "3600",
        });
      if (r.error)
        throw Error(
          "Не удалось загрузить фото. Проверьте интернет и настройку хранилища профиля в Supabase.",
        );
      path = uploaded;
    }
    token = await requireOwner(user.id);
    metadataAttempted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            ...(changeName ? { display_name: clean } : {}),
            ...(photo || remove ? { avatar_path: path } : {}),
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const result = await response.json();
    const updated = (result.user || result) as User;
    if (!response.ok || updated?.id !== user.id)
      throw Error("Не удалось сохранить профиль. Попробуйте ещё раз.");
    window.dispatchEvent(new Event("finance-profile-updated"));
    if (previous && previous !== path) {
      try {
        await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
      } catch {}
    }
    return updated;
  } catch (e) {
    if (uploaded) {
      let safeToDelete = !metadataAttempted;
      if (metadataAttempted && token) {
        try {
          const check = await supabase.auth.getUser(token);
          if (!check.error && check.data.user?.id === user.id)
            safeToDelete = avatarPath(check.data.user) !== uploaded;
        } catch {}
      }
      if (safeToDelete) {
        try {
          await supabase.storage.from(AVATAR_BUCKET).remove([uploaded]);
        } catch {}
      }
    }
    window.dispatchEvent(new Event("finance-profile-updated"));
    if (e instanceof Error && /[А-Яа-яЁё]/.test(e.message)) throw e;
    throw Error(
      "Не удалось подтвердить сохранение профиля. Проверьте интернет и повторите попытку.",
    );
  }
}
export function ProfileForm({
  user,
  avatarUrl,
}: {
  user: User;
  avatarUrl: string | null;
}) {
  const [name, setName] = useState(profileName(user)),
    [photo, setPhoto] = useState<Blob | null>(null),
    [remove, setRemove] = useState(false),
    [preview, setPreview] = useState<string | null>(null),
    [processing, setProcessing] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null),
    serial = useRef(0),
    locked = useRef(false),
    dirty = useRef(false),
    nameEdited = useRef(false);
  useEffect(() => {
    if (dirty.current) return;
    setName(profileName(user));
    setPhoto(null);
    setRemove(false);
  }, [
    user.id,
    user.user_metadata?.display_name,
    user.user_metadata?.avatar_path,
  ]);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(
    () => () => {
      serial.current++;
    },
    [user.id],
  );
  return (
    <form
      className="profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current || processing) return;
        locked.current = true;
        setSaving(true);
        setMessage("");
        try {
          const updated = await saveProfile(
            user,
            name,
            photo,
            remove,
            nameEdited.current,
          );
          dirty.current = false;
          nameEdited.current = false;
          setName(profileName(updated));
          setPhoto(null);
          setRemove(false);
          setMessage("Профиль сохранён.");
        } catch (err) {
          setMessage(
            err instanceof Error
              ? err.message
              : "Не удалось сохранить профиль.",
          );
        } finally {
          locked.current = false;
          setSaving(false);
        }
      }}
    >
      <h3>Мой профиль</h3>
      <div className="profile-photo-row">
        <div className="profile-photo">
          {preview ? (
            <img src={preview} alt="Предпросмотр фото" />
          ) : remove ? (
            <span>
              {profileInitials({
                ...user,
                user_metadata: { ...user.user_metadata, display_name: name },
              })}
            </span>
          ) : (
            <Avatar user={user} url={avatarUrl} />
          )}
        </div>
        <div>
          <button
            type="button"
            className="btn secondary"
            disabled={saving || processing}
            onClick={() => file.current?.click()}
          >
            {processing ? "Готовим фото…" : "Загрузить фото"}
          </button>
          {(avatarPath(user) || photo) && (
            <button
              type="button"
              className="text-btn danger"
              disabled={saving || processing}
              onClick={() => {
                serial.current++;
                dirty.current = true;
                setPhoto(null);
                setRemove(true);
                setMessage("");
              }}
            >
              Удалить фото
            </button>
          )}
        </div>
      </div>
      <input
        type="file"
        aria-label="Фото профиля"
        ref={file}
        hidden
        accept="image/jpeg,image/png,image/webp"
        disabled={saving}
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          const id = ++serial.current;
          setProcessing(true);
          setMessage("");
          try {
            const b = await prepareAvatar(selected);
            if (id === serial.current) {
              dirty.current = true;
              setPhoto(b);
              setRemove(false);
            }
          } catch (err) {
            if (id === serial.current)
              setMessage(
                err instanceof Error
                  ? err.message
                  : "Не удалось обработать фото.",
              );
          } finally {
            if (id === serial.current) setProcessing(false);
          }
        }}
      />
      <p className="profile-help">
        JPEG, PNG или WebP до 10 МБ. Фото обрежется по центру в квадрат.
      </p>
      <label className="field">
        <span>Ваше имя</span>
        <input
          type="text"
          autoComplete="name"
          maxLength={60}
          value={name}
          disabled={saving}
          placeholder="Как вас называть"
          onChange={(e) => {
            dirty.current = true;
            nameEdited.current = true;
            setName(e.target.value);
          }}
        />
      </label>
      <div className="account-actions">
        <button type="submit" className="btn" disabled={saving || processing}>
          {saving ? "Сохраняем…" : "Сохранить профиль"}
        </button>
        <button
          type="button"
          className="text-btn"
          disabled={saving || processing}
          onClick={() => {
            serial.current++;
            dirty.current = false;
            nameEdited.current = false;
            setName(profileName(user));
            setPhoto(null);
            setRemove(false);
            setMessage("");
          }}
        >
          Отмена изменений
        </button>
      </div>
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
