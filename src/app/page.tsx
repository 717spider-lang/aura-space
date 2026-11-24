"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Edit3,
  Forward,
  Hash,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Pencil,
  PhoneCall,
  PhoneOff,
  Pin,
  Plus,
  Repeat,
  Save,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { SaturnMascot, SaturnState } from "@/components/SaturnMascot";
import {
  hasEasterEggForPost,
  PostCornerPeelHandle,
  PostPeelUnderlay,
} from "@/components/SocialNetworkEasterEgg";
import { CloudPostRecord, getSupabaseClient } from "@/lib/supabasePosts";

const REACTION_EMOJIS = ["🔥", "💀", "👾", "❤️"] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
type ReactionMap = Partial<Record<ReactionEmoji, string[]>>;

type PresenceKind = "online" | "building" | "orbit";

const PRESENCE_META: Record<
  PresenceKind,
  { label: string; dotClass: string; badgeClass: string }
> = {
  online: {
    label: "Онлайн",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]",
    badgeClass: "border-emerald-400/35 bg-emerald-950/50 text-emerald-200",
  },
  building: {
    label: "В сборке",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]",
    badgeClass: "border-amber-400/35 bg-amber-950/50 text-amber-200",
  },
  orbit: {
    label: "На орбите",
    dotClass: "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.85)]",
    badgeClass: "border-fuchsia-400/35 bg-fuchsia-950/50 text-pink-200",
  },
};

const BANNER_PRESETS: { id: string; label: string; gradient: string }[] = [
  {
    id: "nebula",
    label: "Неоновая туманность",
    gradient:
      "linear-gradient(125deg, #240B36 0%, #7B2CBF 48%, #FF2A85 100%)",
  },
  {
    id: "eclipse",
    label: "Затмение Сатурна",
    gradient:
      "linear-gradient(125deg, #090414 0%, #3C096C 52%, #9D4EDD 100%)",
  },
  {
    id: "cyber",
    label: "Ночной эфир",
    gradient:
      "linear-gradient(125deg, #0D1B2A 0%, #1B263B 45%, #B5179E 100%)",
  },
  {
    id: "supernova",
    label: "Сверхновая",
    gradient:
      "linear-gradient(125deg, #3A0CA3 0%, #F72585 55%, #FF9E00 100%)",
  },
];

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "tempail.com",
  "mohmal.com",
  "emailondeck.com",
]);

const TYPO_DOMAIN_SUGGESTIONS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.ru": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "mial.ru": "mail.ru",
  "maul.ru": "mail.ru",
  "yadnex.ru": "yandex.ru",
  "yandx.ru": "yandex.ru",
  "icloud.ru": "icloud.com",
};

interface EmailValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
  suggestion?: string;
}

function validateEmailAddress(raw: string): EmailValidationResult {
  const normalized = (typeof raw === "string" ? raw : "").trim().toLowerCase();

  if (!normalized) {
    return { valid: false, normalized, error: "Введи адрес электронной почты." };
  }

  if (normalized.length > 254 || /\s/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Некорректный формат email (проверь пробелы и длину адреса).",
    };
  }

  const atParts = normalized.split("@");
  if (atParts.length !== 2) {
    return {
      valid: false,
      normalized,
      error: "Email должен содержать ровно один символ @.",
    };
  }

  const [localPart, domainPart] = atParts;

  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
  ) {
    return {
      valid: false,
      normalized,
      error: "Некорректное имя пользователя до @.",
    };
  }

  if (
    !domainPart ||
    domainPart.startsWith(".") ||
    domainPart.endsWith(".") ||
    domainPart.startsWith("-") ||
    domainPart.endsWith("-") ||
    domainPart.includes("..") ||
    !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domainPart)
  ) {
    return {
      valid: false,
      normalized,
      error: "Некорректный домен почты (например, name@gmail.com).",
    };
  }

  const tld = domainPart.split(".").pop() || "";
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return {
      valid: false,
      normalized,
      error: "Укажи реальную доменную зону почты (например, .com, .ru, .org).",
    };
  }

  if (
    domainPart === "example.com" ||
    domainPart === "example.org" ||
    domainPart === "example.net" ||
    domainPart === "localhost" ||
    domainPart.endsWith(".test") ||
    domainPart.endsWith(".invalid") ||
    domainPart.endsWith(".local")
  ) {
    return {
      valid: false,
      normalized,
      error: "Тестовые и вымышленные домены не принимаются. Укажи реальную почту.",
    };
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return {
      valid: false,
      normalized,
      error: "Одноразовые и временные почтовые сервисы запрещены.",
    };
  }

  const suggestedDomain = TYPO_DOMAIN_SUGGESTIONS[domainPart];
  if (suggestedDomain) {
    const suggestion = `${localPart}@${suggestedDomain}`;
    return {
      valid: false,
      normalized,
      suggestion,
      error: `Похоже на опечатку в домене. Возможно, ты имел в виду ${suggestion}?`,
    };
  }

  return { valid: true, normalized };
}

async function domainHasMxRecords(domain: string): Promise<boolean | null> {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number }>;
    };
    if (data.Status === 3) return false;
    if (Array.isArray(data.Answer) && data.Answer.some((a) => a.type === 15)) {
      return true;
    }
    return data.Status === 0 ? false : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

interface CommentItem {
  id: string;
  author: string;
  handle: string;
  avatar: string | null;
  text: string;
  createdAt: string;
}

interface RepostSnapshot {
  originalPostId: string;
  originalRoomId: string;
  author: string;
  handle: string;
  text: string;
  image?: string | null;
  createdAt: string;
}

interface PostItem {
  id: string;
  roomId: string;
  author: string;
  handle: string;
  avatar: string | null;
  text: string;
  image?: string | null;
  createdAt: string;
  editedAt?: string | null;
  pinned?: boolean;
  likes: number;
  likedByMe: boolean;
  reactions?: ReactionMap;
  repostOf?: RepostSnapshot | null;
  comments: CommentItem[];
}

interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  handle: string;
  avatar: string | null;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  pinned?: boolean;
  reactions?: ReactionMap;
}

interface RoomItem {
  id: string;
  name: string;
  topic: string;
  ownerHandle?: string;
}

type AccountKind = "official" | "personal";

interface UserAccount {
  id: string;
  username: string;
  handle: string;
  email: string;
  accountType: AccountKind;
  subscribers: number;
  bio: string;
  mood: string;
  presence: PresenceKind;
  lastActive: string;
  avatar: string | null;
  banner: string | null;
  friends: string[];
  passwordHash: string;
  salt: string;
  saturnState: SaturnState;
  createdAt: string;
}

interface VoiceSignalPacket {
  type: "join" | "leave" | "offer" | "answer" | "ice";
  peerId: string;
  targetPeerId?: string;
  roomId: string;
  username: string;
  handle: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface RemoteVoicePeer {
  peerId: string;
  username: string;
  handle: string;
}

const ACCOUNTS_KEY = "aura_space_accounts_v2";
const SESSION_KEY = "aura_space_session_v2";
const LAST_LOGIN_KEY = "aura_space_last_login_v2";
const DATA_KEY = "aura_space_data_v2";
const VOICE_CHANNEL_NAME = "aura_space_voice_rtc_v1";
const SYNC_CHANNEL_NAME = "aura_space_live_sync_v1";
const MILESTONE_SUBSCRIBERS = 100_000;
const MAX_POST_IMAGE_BYTES = 2_500_000;
const MAX_BANNER_IMAGE_BYTES = 2_000_000;

const CREATOR_ACCOUNTS_SEED: Array<{
  id: string;
  username: string;
  handle: string;
  email: string;
  bio: string;
  mood: string;
  presence: PresenceKind;
  banner: string;
  friends: string[];
  defaultPassword: string;
}> = [
  {
    id: "creator-system-404",
    username: "system_404",
    handle: "@system_404",
    email: "system_404@auraspace.local",
    bio: "Создатель и разработчик Aura Space.",
    mood: "В сборке Aura Space",
    presence: "online",
    banner: BANNER_PRESETS[0].gradient,
    friends: [],
    defaultPassword: "system_404",
  },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const DEFAULT_ROOMS: RoomItem[] = [
  {
    id: "general",
    name: "орбита",
    topic: "Главный поток Aura Space и всё, что происходит сейчас",
  },
  {
    id: "dev",
    name: "сборка",
    topic: "Код, идеи, тесты и запуск новых фич без лишнего шума",
  },
  {
    id: "chill",
    name: "ночной-эфир",
    topic: "Музыка, вайб, ссылки и свободные разговоры",
  },
];

const INITIAL_POSTS: PostItem[] = [
  {
    id: "post-1",
    roomId: "general",
    author: "system_404",
    handle: "@system_404",
    avatar: null,
    text: "Орбита запущена, каналы, реакции, закреп и обложки профиля подключены. Погнали тестировать!",
    image: null,
    createdAt: "только что",
    pinned: true,
    likes: 3,
    likedByMe: false,
    reactions: {
      "🔥": ["@system_404"],
      "👾": ["@system_404"],
    },
    comments: [],
  },
  {
    id: "post-2",
    roomId: "dev",
    author: "system_404",
    handle: "@system_404",
    avatar: null,
    text: "Аватарка, статус активности и баннер подтягиваются к профилю автоматически.",
    image: null,
    createdAt: "5 мин назад",
    likes: 4,
    likedByMe: true,
    reactions: {
      "❤️": ["@system_404"],
    },
    comments: [],
  },
  {
    id: "post-3",
    roomId: "chill",
    author: "system_404",
    handle: "@system_404",
    avatar: null,
    text: "Тёмный неон и пустота вокруг — самое то для ночных сессий.",
    image: null,
    createdAt: "12 мин назад",
    likes: 2,
    likedByMe: false,
    reactions: {
      "💀": ["@system_404"],
    },
    comments: [],
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m-1",
    roomId: "general",
    author: "system_404",
    handle: "@system_404",
    avatar: null,
    text: "Всем привет в Aura Space. Закрепил правила эфира вверху канала.",
    createdAt: "14:02",
    pinned: true,
    reactions: {
      "🔥": ["@system_404"],
    },
  },
];

function safeLower(val: unknown): string {
  return typeof val === "string" ? val.toLowerCase() : "";
}

function nowTimeLabel(): string {
  const d = new Date();
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function normalizeHandle(raw: unknown): string {
  const cleaned = (typeof raw === "string" ? raw : "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);
  return cleaned ? `@${cleaned}` : "";
}

function normalizeChannelSlug(raw: unknown): string {
  return (typeof raw === "string" ? raw : "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9_-]/gi, "")
    .slice(0, 24);
}

function isReservedCreatorHandle(handle: string): boolean {
  const lower = safeLower(handle);
  return CREATOR_ACCOUNTS_SEED.some((c) => safeLower(c.handle) === lower);
}

function hasVerifiedBadge(
  account?: Pick<UserAccount, "accountType" | "subscribers"> | null
): boolean {
  if (!account) return false;
  if (account.accountType === "official") return true;
  return (
    typeof account.subscribers === "number" &&
    account.subscribers >= MILESTONE_SUBSCRIBERS
  );
}

function verifiedBadgeTitle(
  account?: Pick<UserAccount, "accountType" | "subscribers"> | null
): string {
  if (!account) return "Подтверждённый аккаунт";
  if (account.accountType === "official") {
    return "Официальный аккаунт создателя";
  }
  return "100 000+ подписчиков";
}

function formatSubscribers(count?: number): string {
  const safe =
    typeof count === "number" && Number.isFinite(count) ? Math.max(0, count) : 0;
  return safe.toLocaleString("ru-RU");
}

function toggleReactionMap(
  current: ReactionMap | undefined,
  emoji: ReactionEmoji,
  userHandle: string
): ReactionMap {
  const next: ReactionMap = { ...(current || {}) };
  const list = Array.isArray(next[emoji]) ? [...next[emoji]] : [];
  const lower = safeLower(userHandle);
  const idx = list.findIndex((h) => safeLower(h) === lower);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else if (userHandle) {
    list.push(userHandle);
  }
  if (list.length === 0) {
    delete next[emoji];
  } else {
    next[emoji] = list;
  }
  return next;
}

function textMentionsHandle(text: string, handle: string): boolean {
  if (!text || !handle) return false;
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}(?=$|[^a-zA-Z0-9_])`, "i");
  return regex.test(text);
}

function toCloudPostRow(post: PostItem): CloudPostRecord {
  return {
    id: post.id,
    room_id: post.roomId,
    author: post.author,
    handle: post.handle,
    avatar: post.avatar ?? null,
    text: post.text ?? "",
    image: post.image ?? null,
    created_at: post.createdAt,
    edited_at: post.editedAt ?? null,
    pinned: Boolean(post.pinned),
    likes: typeof post.likes === "number" ? post.likes : 0,
    liked_by_me: Boolean(post.likedByMe),
    reactions: (post.reactions as Record<string, string[]>) ?? {},
    repost_of: post.repostOf ?? null,
    comments: Array.isArray(post.comments) ? post.comments : [],
  };
}

function fromCloudPostRow(row: CloudPostRecord): PostItem {
  return {
    id: row.id,
    roomId: row.room_id || "general",
    author: row.author || "Участник",
    handle: row.handle || "@user",
    avatar: row.avatar ?? null,
    text: row.text ?? "",
    image: row.image ?? null,
    createdAt: row.created_at || "только что",
    editedAt: row.edited_at ?? null,
    pinned: Boolean(row.pinned),
    likes: typeof row.likes === "number" ? row.likes : 0,
    likedByMe: Boolean(row.liked_by_me),
    reactions: (row.reactions as ReactionMap) ?? {},
    repostOf: (row.repost_of as RepostSnapshot | null) ?? null,
    comments: Array.isArray(row.comments) ? (row.comments as CommentItem[]) : [],
  };
}

async function upsertCloudPost(post: PostItem) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.from("posts").upsert(toCloudPostRow(post), { onConflict: "id" });
}

async function deleteCloudPost(postId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.from("posts").delete().eq("id", postId);
}

function RichTextWithMentions({
  text,
  knownHandles,
  currentUserHandle,
  onSelectHandle,
}: {
  text: string;
  knownHandles: Set<string>;
  currentUserHandle?: string | null;
  onSelectHandle: (handle: string) => void;
}) {
  const parts = (typeof text === "string" ? text : "").split(
    /(@[a-zA-Z0-9_]{2,18})/g
  );
  return (
    <>
      {parts.map((part, idx) => {
        if (/^@[a-zA-Z0-9_]{2,18}$/.test(part)) {
          const lower = safeLower(part);
          const isKnown = knownHandles.has(lower);
          const isMe =
            !!currentUserHandle && lower === safeLower(currentUserHandle);
          return (
            <button
              key={`${part}-${idx}`}
              type="button"
              onClick={() => onSelectHandle(lower)}
              title={
                isKnown ? `Открыть профиль ${lower}` : `Участник ${lower}`
              }
              className={`mx-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 font-bold transition ${
                isMe
                  ? "border border-pink-400/50 bg-[#FF2A85]/30 text-white hover:bg-[#FF2A85]/45"
                  : isKnown
                  ? "bg-[#9D4EDD]/25 text-pink-200 hover:bg-[#9D4EDD]/40 hover:text-white"
                  : "bg-white/10 text-purple-200 hover:bg-white/15"
              }`}
            >
              {part}
            </button>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
}

function VerifiedBadge({
  account,
  size = "sm",
}: {
  account?: Pick<UserAccount, "accountType" | "subscribers"> | null;
  size?: "sm" | "md";
}) {
  if (!hasVerifiedBadge(account)) return null;
  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const title = verifiedBadgeTitle(account);

  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex shrink-0 items-center text-[#FF70B8] drop-shadow-[0_0_8px_rgba(255,42,133,0.55)]"
    >
      <BadgeCheck className={`${iconClass} fill-[#FF2A85]/25 text-[#FF70B8]`} />
    </span>
  );
}

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  );
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const payload = `${salt}:${password}`;
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.digest === "function"
  ) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return fallbackHash(payload);
    }
  }
  return fallbackHash(payload);
}

function generateSalt(): string {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Math.random().toString(16).slice(2, 14)}${Date.now().toString(16)}`;
}

function accountBadgeLabel(kind?: AccountKind): string {
  return kind === "official" ? "Создатель" : "Личный";
}

function AvatarBadge({
  name,
  src,
  size = "md",
  presence,
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
  presence?: PresenceKind;
}) {
  const sizeClass =
    size === "sm"
      ? "h-7 w-7 text-[11px]"
      : size === "lg"
      ? "h-16 w-16 text-xl"
      : "h-9 w-9 text-xs";

  const dotSizeClass =
    size === "sm"
      ? "h-2 w-2 border"
      : size === "lg"
      ? "h-3.5 w-3.5 border-2"
      : "h-2.5 w-2.5 border";

  const safeName = typeof name === "string" && name.trim() ? name.trim() : "?";
  const letter = safeName[0].toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={safeName}
          className={`${sizeClass} rounded-full border border-pink-400/40 object-cover bg-[#090414]`}
        />
      ) : (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full border border-fuchsia-500/35 bg-gradient-to-br from-[#9D4EDD]/45 to-[#FF2A85]/45 font-extrabold text-white`}
        >
          {letter}
        </div>
      )}
      {presence && (
        <span
          title={PRESENCE_META[presence].label}
          className={`absolute bottom-0 right-0 rounded-full border-[#090414] ${dotSizeClass} ${PRESENCE_META[presence].dotClass}`}
        />
      )}
    </div>
  );
}

function VoiceLevelBar({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  const speaking = clamped > 12;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#090414] border border-purple-500/25">
        <div
          className={`h-full transition-all duration-75 ${
            speaking
              ? "bg-gradient-to-r from-[#9D4EDD] via-[#FF70B8] to-emerald-400"
              : "bg-pink-400/50"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 text-right text-[11px] font-bold text-purple-200/80">
        {clamped}%
      </span>
    </div>
  );
}

function ReactionBar({
  reactions,
  currentUserHandle,
  onToggle,
}: {
  reactions?: ReactionMap;
  currentUserHandle: string;
  onToggle: (emoji: ReactionEmoji) => void;
}) {
  const meLower = safeLower(currentUserHandle);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const users = Array.isArray(reactions?.[emoji]) ? reactions[emoji] : [];
        const reacted = !!meLower && users.some((h) => safeLower(h) === meLower);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            title={
              users.length > 0
                ? `${emoji}: ${users.join(", ")}`
                : `Поставить ${emoji}`
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold transition ${
              reacted
                ? "border-pink-400/55 bg-[#FF2A85]/25 text-white"
                : users.length > 0
                ? "border-purple-500/30 bg-white/5 text-purple-100 hover:border-pink-400/40"
                : "border-transparent bg-white/5 text-purple-300/70 hover:border-purple-500/25 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>{emoji}</span>
            {users.length > 0 && <span>{users.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [hydrated, setHydrated] = useState(false);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [regUsername, setRegUsername] = useState("");
  const [regHandle, setRegHandle] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuggestion, setAuthSuggestion] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccUsername, setAddAccUsername] = useState("");
  const [addAccHandle, setAddAccHandle] = useState("");
  const [addAccEmail, setAddAccEmail] = useState("");
  const [addAccPassword, setAddAccPassword] = useState("");
  const [addAccPasswordConfirm, setAddAccPasswordConfirm] = useState("");
  const [addAccError, setAddAccError] = useState<string | null>(null);
  const [addAccSuggestion, setAddAccSuggestion] = useState<string | null>(null);
  const [addAccSubmitting, setAddAccSubmitting] = useState(false);

  const [rooms, setRooms] = useState<RoomItem[]>(DEFAULT_ROOMS);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [channelError, setChannelError] = useState<string | null>(null);
  const [showChannelForm, setShowChannelForm] = useState(false);

  const [activeRoomId, setActiveRoomId] = useState<string>("general");
  const [activeTab, setActiveTab] = useState<
    "feed" | "chat" | "profile" | "friends"
  >("feed");
  const [inspectedHandle, setInspectedHandle] = useState<string | null>(null);

  const [friendHandleInput, setFriendHandleInput] = useState("");
  const [friendMessage, setFriendMessage] = useState<string | null>(null);

  const [profileUsername, setProfileUsername] = useState("");
  const [profilePresence, setProfilePresence] = useState<PresenceKind>("online");
  const [profileMood, setProfileMood] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileBanner, setProfileBanner] = useState<string | null>(
    BANNER_PRESETS[0].gradient
  );
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [posts, setPosts] = useState<PostItem[]>(INITIAL_POSTS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [repostTarget, setRepostTarget] = useState<PostItem | null>(null);
  const [repostNote, setRepostNote] = useState("");

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState("");

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );
  const [chatText, setChatText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);

  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemoteVoicePeer[]>([]);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const postImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const peerIdRef = useRef<string>(
    `peer-${Math.random().toString(36).slice(2, 10)}`
  );
  const voiceChannelRef = useRef<BroadcastChannel | null>(null);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const remoteSyncLockRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef>(new Map());
  const remoteAudioElsRef = useRef>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const inCallRef = useRef(false);
  const activeRoomIdRef = useRef("general");

  useEffect(() => {
    mutedRef.current = muted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, [muted]);

  useEffect(() => {
    deafenedRef.current = deafened;
    remoteAudioElsRef.current.forEach((audioEl) => {
      audioEl.muted = deafened;
    });
  }, [deafened]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    let cancelled = false;

    async function initStore() {
      const seededCreators: UserAccount[] = [];
      for (const seed of CREATOR_ACCOUNTS_SEED) {
        const salt = `aura-seed-${seed.id}`;
        const passwordHash = await hashPassword(seed.defaultPassword, salt);
        seededCreators.push({
          id: seed.id,
          username: seed.username,
          handle: seed.handle,
          email: seed.email,
          accountType: "official",
          subscribers: MILESTONE_SUBSCRIBERS,
          bio: seed.bio,
          mood: seed.mood,
          presence: seed.presence,
          lastActive: "в сети",
          avatar: null,
          banner: seed.banner,
          friends: [...seed.friends],
          passwordHash,
          salt,
          saturnState: "idle",
          createdAt: "основатель",
        });
      }

      let loadedAccounts: UserAccount[] = [];
      let savedSessionId: string | null = null;
      let savedLastLogin = "";
      let loadedRooms: RoomItem[] = DEFAULT_ROOMS;
      let loadedPosts: PostItem[] = INITIAL_POSTS;
      let loadedMessages: ChatMessage[] = INITIAL_MESSAGES;

      try {
        const rawAccounts = localStorage.getItem(ACCOUNTS_KEY);
        if (rawAccounts) {
          const parsed = JSON.parse(rawAccounts);
          if (Array.isArray(parsed)) {
            loadedAccounts = parsed.filter(
              (a) => a && typeof a.id === "string" && typeof a.handle === "string"
            );
          }
        }
      } catch {
        loadedAccounts = [];
      }

      const mergedMap = new Map<string, UserAccount>();
      for (const creator of seededCreators) {
        const existing = loadedAccounts.find(
          (a) => safeLower(a.handle) === safeLower(creator.handle)
        );
        if (existing) {
          mergedMap.set(existing.id, {
            ...existing,
            accountType: "official",
            subscribers: Math.max(
              typeof existing.subscribers === "number" ? existing.subscribers : 0,
              MILESTONE_SUBSCRIBERS
            ),
            presence: existing.presence || creator.presence,
            lastActive: existing.lastActive || "в сети",
            banner: existing.banner || creator.banner,
          });
        } else {
          mergedMap.set(creator.id, creator);
        }
      }

      for (const acc of loadedAccounts) {
        if (isReservedCreatorHandle(acc.handle)) continue;
        const normalizedSubs =
          typeof acc.subscribers === "number" && Number.isFinite(acc.subscribers)
            ? Math.max(0, acc.subscribers)
            : 0;
        mergedMap.set(acc.id, {
          ...acc,
          accountType: acc.accountType === "official" ? "official" : "personal",
          subscribers: normalizedSubs,
          presence: acc.presence || "online",
          lastActive: acc.lastActive || "в сети",
          banner: acc.banner || BANNER_PRESETS[0].gradient,
        });
      }

      const finalAccounts = Array.from(mergedMap.values());

      try {
        savedSessionId = sessionStorage.getItem(SESSION_KEY);
        savedLastLogin = localStorage.getItem(LAST_LOGIN_KEY) || "";
      } catch {
        savedSessionId = null;
        savedLastLogin = "";
      }

      const validSessionUser = savedSessionId
        ? finalAccounts.find((a) => a.id === savedSessionId) || null
        : null;

      try {
        const rawData = localStorage.getItem(DATA_KEY);
        if (rawData) {
          const parsedData = JSON.parse(rawData);
          if (Array.isArray(parsedData.rooms) && parsedData.rooms.length > 0) {
            loadedRooms = parsedData.rooms;
          }
          if (Array.isArray(parsedData.posts)) {
            loadedPosts = parsedData.posts;
          }
          if (Array.isArray(parsedData.messages)) {
            loadedMessages = parsedData.messages;
          }
        }
      } catch {
        // ignore corrupted local data
      }

      if (cancelled) return;

      setAccounts(finalAccounts);
      setCurrentUserId(validSessionUser ? validSessionUser.id : null);
      if (savedLastLogin) {
        setLoginIdentifier(savedLastLogin);
      }
      setRooms(loadedRooms);
      setPosts(loadedPosts);
      setMessages(loadedMessages);
      setHydrated(true);
    }

    initStore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // ignore storage quota errors
    }
  }, [accounts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (currentUserId) {
        sessionStorage.setItem(SESSION_KEY, currentUserId);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [currentUserId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        DATA_KEY,
        JSON.stringify({ rooms, posts, messages })
      );
    } catch {
      // ignore storage errors
    }
    if (!remoteSyncLockRef.current && syncChannelRef.current) {
      syncChannelRef.current.postMessage({ type: "posts", payload: posts });
    }
  }, [rooms, posts, messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let active = true;

    async function loadCloudPosts() {
      const { data, error } = await supabase!
        .from("posts")
        .select("*")
        .order("inserted_at", { ascending: false })
        .limit(100);

      if (!active || error || !Array.isArray(data)) return;

      const cloudPosts = (data as CloudPostRecord[]).map(fromCloudPostRow);
      setPosts((prev) => {
        const byId = new Map<string, PostItem>();
        for (const cp of cloudPosts) {
          byId.set(cp.id, cp);
        }
        for (const lp of prev) {
          if (!byId.has(lp.id)) {
            byId.set(lp.id, lp);
          }
        }
        return Array.from(byId.values());
      });
    }

    loadCloudPosts();

    const channel = supabase
      .channel("aura-space-public-posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          loadCloudPosts();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [hydrated]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.BroadcastChannel !== "function"
    ) {
      return;
    }

    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    syncChannelRef.current = bc;

    bc.onmessage = (
      event: MessageEvent<{
        type?: "posts" | "messages" | "rooms";
        payload?: unknown;
      }>
    ) => {
      const msg = event.data;
      if (!msg?.type) return;
      remoteSyncLockRef.current = true;
      try {
        if (msg.type === "posts" && Array.isArray(msg.payload)) {
          setPosts(msg.payload as PostItem[]);
        } else if (msg.type === "messages" && Array.isArray(msg.payload)) {
          setMessages(msg.payload as ChatMessage[]);
        } else if (msg.type === "rooms" && Array.isArray(msg.payload)) {
          setRooms(msg.payload as RoomItem[]);
        }
      } finally {
        window.setTimeout(() => {
          remoteSyncLockRef.current = false;
        }, 0);
      }
    };

    return () => {
      bc.close();
      syncChannelRef.current = null;
    };
  }, []);

  const currentUser = useMemo(
    () => accounts.find((a) => a.id === currentUserId) || null,
    [accounts, currentUserId]
  );

  const accountByHandle = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of accounts) {
      map.set(safeLower(acc.handle), acc);
    }
    return map;
  }, [accounts]);

  const knownCommunityHandles = useMemo(() => {
    const set = new Set<string>();
    for (const acc of accounts) {
      set.add(safeLower(acc.handle));
    }
    for (const p of posts) {
      if (p.handle) set.add(safeLower(p.handle));
      for (const c of p.comments || []) {
        if (c.handle) set.add(safeLower(c.handle));
      }
    }
    for (const m of messages) {
      if (m.handle) set.add(safeLower(m.handle));
    }
    return set;
  }, [accounts, posts, messages]);

  const inspectedAccount = useMemo(() => {
    if (!inspectedHandle) return null;
    return accountByHandle.get(safeLower(inspectedHandle)) || null;
  }, [inspectedHandle, accountByHandle]);

  const inspectedPosts = useMemo(() => {
    if (!inspectedHandle) return [];
    const target = safeLower(inspectedHandle);
    return posts.filter((p) => safeLower(p.handle) === target);
  }, [inspectedHandle, posts]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileUsername(currentUser.username);
    setProfilePresence(currentUser.presence || "online");
    setProfileMood(currentUser.mood || "");
    setProfileBio(currentUser.bio || "");
    setProfileAvatar(currentUser.avatar || null);
    setProfileBanner(currentUser.banner || BANNER_PRESETS[0].gradient);
    setProfileNewPassword("");
    setProfileError(null);
    setProfileSaved(false);
  }, [currentUser]);

  const setSaturnState = useCallback(
    (nextState: SaturnState) => {
      if (!currentUserId) return;
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === currentUserId ? { ...acc, saturnState: nextState } : acc
        )
      );
    },
    [currentUserId]
  );

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || rooms[0] || DEFAULT_ROOMS[0],
    [rooms, activeRoomId]
  );

  const roomPosts = useMemo(() => {
    const list = posts.filter((p) => p.roomId === activeRoom.id);
    return [...list].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [posts, activeRoom.id]);

  const pinnedPost = useMemo(
    () => roomPosts.find((p) => Boolean(p.pinned)) || null,
    [roomPosts]
  );

  const roomMessages = useMemo(
    () => messages.filter((m) => m.roomId === activeRoom.id),
    [messages, activeRoom.id]
  );

  const pinnedMessage = useMemo(
    () => roomMessages.find((m) => Boolean(m.pinned)) || null,
    [roomMessages]
  );

  const friendsList = useMemo(() => {
    if (!currentUser) return [];
    const friendSet = new Set(
      (currentUser.friends || []).map((h) => safeLower(h))
    );
    return accounts.filter((a) => friendSet.has(safeLower(a.handle)));
  }, [currentUser, accounts]);

  const suggestedAccounts = useMemo(() => {
    if (!currentUser) return [];
    const friendSet = new Set(
      (currentUser.friends || []).map((h) => safeLower(h))
    );
    return accounts.filter(
      (a) =>
        a.id !== currentUser.id && !friendSet.has(safeLower(a.handle))
    );
  }, [currentUser, accounts]);

  const otherAccounts = useMemo(() => {
    if (!currentUser) return [];
    return accounts.filter((a) => a.id !== currentUser.id);
  }, [accounts, currentUser]);

  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [roomMessages.length, activeTab, activeRoom.id]);

  const cleanupVoice = useCallback((sendLeaveSignal: boolean) => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }

    if (sendLeaveSignal && voiceChannelRef.current && inCallRef.current) {
      const leavePacket: VoiceSignalPacket = {
        type: "leave",
        peerId: peerIdRef.current,
        roomId: activeRoomIdRef.current,
        username: "",
        handle: "",
      };
      voiceChannelRef.current.postMessage(leavePacket);
    }

    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore close error
      }
    });
    peerConnectionsRef.current.clear();

    remoteAudioElsRef.current.forEach((audioEl) => {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {
        // ignore cleanup error
      }
    });
    remoteAudioElsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    inCallRef.current = false;
    setInCall(false);
    setCallSeconds(0);
    setVoiceLevel(0);
    setRemotePeers([]);
  }, []);

  const createPeerConnection = useCallback(
    (targetPeerId: string, targetUsername: string, targetHandle: string) => {
      const existing = peerConnectionsRef.current.get(targetPeerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && voiceChannelRef.current) {
          const pkt: VoiceSignalPacket = {
            type: "ice",
            peerId: peerIdRef.current,
            targetPeerId,
            roomId: activeRoomIdRef.current,
            username: currentUser?.username || "Участник",
            handle: currentUser?.handle || "@user",
            candidate: event.candidate.toJSON(),
          };
          voiceChannelRef.current.postMessage(pkt);
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        let audioEl = remoteAudioElsRef.current.get(targetPeerId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.muted = deafenedRef.current;
          document.body.appendChild(audioEl);
          remoteAudioElsRef.current.set(targetPeerId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          pc.close();
          peerConnectionsRef.current.delete(targetPeerId);
          const audioEl = remoteAudioElsRef.current.get(targetPeerId);
          if (audioEl) {
            audioEl.srcObject = null;
            audioEl.remove();
            remoteAudioElsRef.current.delete(targetPeerId);
          }
          setRemotePeers((prev) =>
            prev.filter((p) => p.peerId !== targetPeerId)
          );
        }
      };

      peerConnectionsRef.current.set(targetPeerId, pc);
      setRemotePeers((prev) => {
        if (prev.some((p) => p.peerId === targetPeerId)) return prev;
        return [
          ...prev,
          {
            peerId: targetPeerId,
            username: targetUsername || "Участник",
            handle: targetHandle || "@user",
          },
        ];
      });

      return pc;
    },
    [currentUser]
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.BroadcastChannel !== "function"
    ) {
      return;
    }

    const bc = new BroadcastChannel(VOICE_CHANNEL_NAME);
    voiceChannelRef.current = bc;

    bc.onmessage = async (event: MessageEvent<VoiceSignalPacket>) => {
      const msg = event.data;
      if (!msg || msg.peerId === peerIdRef.current) return;
      if (!inCallRef.current || msg.roomId !== activeRoomIdRef.current) return;
      if (msg.targetPeerId && msg.targetPeerId !== peerIdRef.current) return;

      if (msg.type === "join") {
        const pc = createPeerConnection(msg.peerId, msg.username, msg.handle);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const answerOfferPacket: VoiceSignalPacket = {
            type: "offer",
            peerId: peerIdRef.current,
            targetPeerId: msg.peerId,
            roomId: activeRoomIdRef.current,
            username: currentUser?.username || "Участник",
            handle: currentUser?.handle || "@user",
            sdp: pc.localDescription || offer,
          };
          bc.postMessage(answerOfferPacket);
        } catch {
          // ignore signaling error
        }
      } else if (msg.type === "offer" && msg.sdp) {
        const pc = createPeerConnection(msg.peerId, msg.username, msg.handle);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const answerPacket: VoiceSignalPacket = {
            type: "answer",
            peerId: peerIdRef.current,
            targetPeerId: msg.peerId,
            roomId: activeRoomIdRef.current,
            username: currentUser?.username || "Участник",
            handle: currentUser?.handle || "@user",
            sdp: pc.localDescription || answer,
          };
          bc.postMessage(answerPacket);
        } catch {
          // ignore signaling error
        }
      } else if (msg.type === "answer" && msg.sdp) {
        const pc = peerConnectionsRef.current.get(msg.peerId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } catch {
            // ignore signaling error
          }
        }
      } else if (msg.type === "ice" && msg.candidate) {
        const pc = peerConnectionsRef.current.get(msg.peerId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            // ignore ice error
          }
        }
      } else if (msg.type === "leave") {
        const pc = peerConnectionsRef.current.get(msg.peerId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(msg.peerId);
        }
        const audioEl = remoteAudioElsRef.current.get(msg.peerId);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioElsRef.current.delete(msg.peerId);
        }
        setRemotePeers((prev) => prev.filter((p) => p.peerId !== msg.peerId));
      }
    };

    return () => {
      cleanupVoice(false);
      bc.close();
      voiceChannelRef.current = null;
    };
  }, [cleanupVoice, createPeerConnection, currentUser]);

  useEffect(() => {
    if (!inCall) return;
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  const startVoiceMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current || !inCallRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        if (mutedRef.current) {
          setVoiceLevel(0);
        } else {
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setVoiceLevel(Math.min(100, Math.round((avg / 140) * 100)));
        }
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // ignore audio meter errors
    }
  }, []);

  const handleToggleCall = async () => {
    if (!currentUser) return;
    setCallStatus(null);

    if (inCall) {
      cleanupVoice(true);
      setCallStatus("Ты вышел из голосового канала.");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCallStatus("Браузер не поддерживает доступ к микрофону.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !mutedRef.current;
      });
      localStreamRef.current = stream;
      inCallRef.current = true;
      setInCall(true);
      setCallSeconds(0);
      setSaturnState("celebrate");
      startVoiceMeter(stream);

      if (voiceChannelRef.current) {
        const joinPacket: VoiceSignalPacket = {
          type: "join",
          peerId: peerIdRef.current,
          roomId: activeRoom.id,
          username: currentUser.username,
          handle: currentUser.handle,
        };
        voiceChannelRef.current.postMessage(joinPacket);
      }

      setCallStatus(
        `Подключён к голосу в #${activeRoom.name} (WebRTC активен).`
      );
    } catch {
      cleanupVoice(false);
      setCallStatus(
        "Доступ к микрофону отклонён или недоступен. Разреши микрофон в браузере."
      );
    }
  };

  const handleSwitchRoom = (roomId: string) => {
    if (roomId === activeRoomId) return;
    if (inCallRef.current) {
      cleanupVoice(true);
      setCallStatus("Отключён от голоса при смене канала.");
    }
    setActiveRoomId(roomId);
    setEditingPostId(null);
    setEditingMessageId(null);
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setChannelError(null);

    const slug = normalizeChannelSlug(newChannelName);
    if (slug.length < 2) {
      setChannelError("Название канала — минимум 2 символа (например, music).");
      return;
    }

    if (rooms.some((r) => safeLower(r.name) === safeLower(slug))) {
      setChannelError(`Канал #${slug} уже существует.`);
      return;
    }

    const id = `${slug}-${Date.now().toString(36)}`;
    const topic =
      newChannelTopic.trim() || `Канал сообщества, созданный ${currentUser.handle}`;

    const nextRoom: RoomItem = {
      id,
      name: slug,
      topic,
      ownerHandle: currentUser.handle,
    };

    setRooms((prev) => [...prev, nextRoom]);
    setActiveRoomId(id);
    setNewChannelName("");
    setNewChannelTopic("");
    setShowChannelForm(false);
    setSaturnState("celebrate");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuggestion(null);

    const username = regUsername.trim();
    const handle = normalizeHandle(regHandle || regUsername);
    const emailCheck = validateEmailAddress(regEmail);

    if (username.length < 2) {
      setAuthError("Имя должно быть не короче 2 символов.");
      return;
    }
    if (handle.length < 3) {
      setAuthError(
        "Укажи корректный @handle (минимум 2 символа: латиница, цифры, _)."
      );
      return;
    }
    if (isReservedCreatorHandle(handle)) {
      setAuthError(
        `Хэндл ${handle} зарезервирован за создателем Aura Space. Выбери другой @handle.`
      );
      return;
    }
    if (!emailCheck.valid) {
      setAuthError(emailCheck.error || "Укажи корректный email.");
      if (emailCheck.suggestion) {
        setAuthSuggestion(emailCheck.suggestion);
      }
      return;
    }
    if (regPassword.length < 4) {
      setAuthError("Пароль должен быть не короче 4 символов.");
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setAuthError("Пароли не совпадают.");
      return;
    }

    const handleTaken = accounts.some(
      (a) => safeLower(a.handle) === safeLower(handle)
    );
    if (handleTaken) {
      setAuthError(`Хэндл ${handle} уже занят. Выбери другой.`);
      return;
    }

    const emailTaken = accounts.some(
      (a) => safeLower(a.email) === emailCheck.normalized
    );
    if (emailTaken) {
      setAuthError(
        "Аккаунт с таким email уже зарегистрирован. Войди в него или укажи другой адрес."
      );
      return;
    }

    setAuthSubmitting(true);
    try {
      const domain = emailCheck.normalized.split("@")[1];
      const mxResult = await domainHasMxRecords(domain);
      if (mxResult === false) {
        setAuthError(
          `Почтовый домен ${domain} не принимает входящую почту (MX-записи не найдены).`
        );
        return;
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(regPassword, salt);

      const newAcc: UserAccount = {
        id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        username,
        handle,
        email: emailCheck.normalized,
        accountType: "personal",
        subscribers: 0,
        bio: "Новый участник Aura Space.",
        mood: "Исследует орбиту",
        presence: "online",
        lastActive: "в сети",
        avatar: null,
        banner: BANNER_PRESETS[0].gradient,
        friends: [],
        passwordHash,
        salt,
        saturnState: "celebrate",
        createdAt: new Date().toLocaleDateString("ru-RU"),
      };

      setAccounts((prev) => [...prev, newAcc]);
      setCurrentUserId(newAcc.id);
      try {
        localStorage.setItem(LAST_LOGIN_KEY, newAcc.handle);
      } catch {
        // ignore
      }
      setRegUsername("");
      setRegHandle("");
      setRegEmail("");
      setRegPassword("");
      setRegPasswordConfirm("");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuggestion(null);

    const rawId = loginIdentifier.trim().toLowerCase();
    if (!rawId) {
      setAuthError("Введи @handle, email или имя аккаунта.");
      return;
    }
    if (!loginPassword) {
      setAuthError("Введи пароль.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const normalizedHandle = normalizeHandle(rawId);
      const found = accounts.find(
        (a) =>
          safeLower(a.handle) === rawId ||
          (normalizedHandle && safeLower(a.handle) === normalizedHandle) ||
          safeLower(a.email) === rawId ||
          safeLower(a.username) === rawId
      );

      if (!found) {
        setAuthError(
          "Аккаунт не найден. Проверь @handle / email или зарегистрируйся."
        );
        return;
      }

      const candidateHash = await hashPassword(loginPassword, found.salt);
      if (candidateHash !== found.passwordHash) {
        setAuthError("Неверный пароль.");
        return;
      }

      const updatedAcc: UserAccount = {
        ...found,
        presence: found.presence || "online",
        lastActive: "в сети",
        saturnState: "idle",
      };

      setAccounts((prev) =>
        prev.map((a) => (a.id === found.id ? updatedAcc : a))
      );
      setCurrentUserId(found.id);
      try {
        localStorage.setItem(LAST_LOGIN_KEY, found.handle);
      } catch {
        // ignore
      }
      setLoginPassword("");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleQuickSwitchAccount = (targetId: string) => {
    if (targetId === currentUserId) return;
    if (inCallRef.current) {
      cleanupVoice(true);
    }
    const target = accounts.find((a) => a.id === targetId);
    if (!target) return;
    setCurrentUserId(target.id);
    setInspectedHandle(null);
    try {
      localStorage.setItem(LAST_LOGIN_KEY, target.handle);
    } catch {
      // ignore
    }
  };

  const handleAddAnotherAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccError(null);
    setAddAccSuggestion(null);

    const username = addAccUsername.trim();
    const handle = normalizeHandle(addAccHandle || addAccUsername);
    const emailCheck = validateEmailAddress(addAccEmail);

    if (username.length < 2) {
      setAddAccError("Имя должно быть не короче 2 символов.");
      return;
    }
    if (handle.length < 3) {
      setAddAccError(
        "Укажи корректный @handle (минимум 2 символа: латиница, цифры, _)."
      );
      return;
    }
    if (isReservedCreatorHandle(handle)) {
      setAddAccError(
        `Хэндл ${handle} зарезервирован за создателем Aura Space.`
      );
      return;
    }
    if (!emailCheck.valid) {
      setAddAccError(emailCheck.error || "Укажи корректный email.");
      if (emailCheck.suggestion) {
        setAddAccSuggestion(emailCheck.suggestion);
      }
      return;
    }
    if (addAccPassword.length < 4) {
      setAddAccError("Пароль должен быть не короче 4 символов.");
      return;
    }
    if (addAccPassword !== addAccPasswordConfirm) {
      setAddAccError("Пароли не совпадают.");
      return;
    }

    if (accounts.some((a) => safeLower(a.handle) === safeLower(handle))) {
      setAddAccError(`Хэндл ${handle} уже занят.`);
      return;
    }
    if (
      accounts.some((a) => safeLower(a.email) === emailCheck.normalized)
    ) {
      setAddAccError("Этот email уже используется другим аккаунтом.");
      return;
    }

    setAddAccSubmitting(true);
    try {
      const domain = emailCheck.normalized.split("@")[1];
      const mxResult = await domainHasMxRecords(domain);
      if (mxResult === false) {
        setAddAccError(
          `Почтовый домен ${domain} не принимает входящую почту (MX-записи не найдены).`
        );
        return;
      }

      if (inCallRef.current) {
        cleanupVoice(true);
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(addAccPassword, salt);

      const created: UserAccount = {
        id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        username,
        handle,
        email: emailCheck.normalized,
        accountType: "personal",
        subscribers: 0,
        bio: "Дополнительный профиль в Aura Space.",
        mood: "В сети",
        presence: "online",
        lastActive: "в сети",
        avatar: null,
        banner: BANNER_PRESETS[1].gradient,
        friends: [],
        passwordHash,
        salt,
        saturnState: "celebrate",
        createdAt: new Date().toLocaleDateString("ru-RU"),
      };

      setAccounts((prev) => [...prev, created]);
      setCurrentUserId(created.id);
      try {
        localStorage.setItem(LAST_LOGIN_KEY, created.handle);
      } catch {
        // ignore
      }
      setAddAccUsername("");
      setAddAccHandle("");
      setAddAccEmail("");
      setAddAccPassword("");
      setAddAccPasswordConfirm("");
      setShowAddAccountModal(false);
    } finally {
      setAddAccSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (inCallRef.current) {
      cleanupVoice(true);
    }
    setCurrentUserId(null);
    setInspectedHandle(null);
    setAuthMode("login");
    setAuthError(null);
    setAuthSuggestion(null);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Выбери файл изображения (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > MAX_POST_IMAGE_BYTES) {
      setProfileError("Файл аватарки слишком большой (максимум 2.5 МБ).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileAvatar(reader.result);
        setProfileError(null);
        setProfileSaved(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Для шапки профиля выбери изображение (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > MAX_BANNER_IMAGE_BYTES) {
      setProfileError("Файл шапки слишком большой (максимум 2 МБ).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileBanner(reader.result);
        setProfileError(null);
        setProfileSaved(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePostImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPostError("К посту можно прикрепить только изображение.");
      return;
    }
    if (file.size > MAX_POST_IMAGE_BYTES) {
      setPostError("Изображение не должно превышать 2.5 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPostImage(reader.result);
        setPostError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileError(null);
    setProfileSaved(false);

    const nextName = profileUsername.trim();
    if (nextName.length < 2) {
      setProfileError("Имя должно быть не короче 2 символов.");
      return;
    }

    let nextPasswordHash = currentUser.passwordHash;
    let nextSalt = currentUser.salt;
    if (profileNewPassword.trim().length > 0) {
      if (profileNewPassword.trim().length < 4) {
        setProfileError("Новый пароль должен быть не короче 4 символов.");
        return;
      }
      nextSalt = generateSalt();
      nextPasswordHash = await hashPassword(
        profileNewPassword.trim(),
        nextSalt
      );
    }

    const updatedUser: UserAccount = {
      ...currentUser,
      username: nextName,
      presence: profilePresence,
      mood: profileMood.trim() || "В сети",
      bio: profileBio.trim(),
      avatar: profileAvatar,
      banner: profileBanner || BANNER_PRESETS[0].gradient,
      lastActive: "в сети",
      passwordHash: nextPasswordHash,
      salt: nextSalt,
      saturnState: "celebrate",
    };

    setAccounts((prev) =>
      prev.map((a) => (a.id === currentUser.id ? updatedUser : a))
    );

    const handleLower = safeLower(currentUser.handle);
    setPosts((prev) =>
      prev.map((p) => {
        const authorUpdated =
          safeLower(p.handle) === handleLower
            ? { ...p, author: nextName, avatar: profileAvatar }
            : p;
        const commentsUpdated = (authorUpdated.comments || []).map((c) =>
          safeLower(c.handle) === handleLower
            ? { ...c, author: nextName, avatar: profileAvatar }
            : c
        );
        return { ...authorUpdated, comments: commentsUpdated };
      })
    );

    setMessages((prev) =>
      prev.map((m) =>
        safeLower(m.handle) === handleLower
          ? { ...m, author: nextName, avatar: profileAvatar }
          : m
      )
    );

    setProfileNewPassword("");
    setProfileSaved(true);
  };

  const handleAddFriend = (targetHandleRaw?: string) => {
    if (!currentUser) return;
    setFriendMessage(null);
    const normalized = normalizeHandle(targetHandleRaw ?? friendHandleInput);
    if (!normalized || normalized.length < 3) {
      setFriendMessage("Введи корректный @handle друга (например, @alex).");
      return;
    }
    if (safeLower(normalized) === safeLower(currentUser.handle)) {
      setFriendMessage("Нельзя добавить самого себя в друзья.");
      return;
    }

    const exists = accounts.some(
      (a) => safeLower(a.handle) === safeLower(normalized)
    );
    if (!exists) {
      setFriendMessage(
        `Пользователь ${normalized} пока не зарегистрирован в Aura Space.`
      );
      return;
    }

    const alreadyFriend = (currentUser.friends || []).some(
      (h) => safeLower(h) === safeLower(normalized)
    );
    if (alreadyFriend) {
      setFriendMessage(`${normalized} уже есть в твоём списке друзей.`);
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === currentUser.id
          ? { ...a, friends: [...(a.friends || []), normalized] }
          : a
      )
    );
    if (!targetHandleRaw) {
      setFriendHandleInput("");
    }
    setFriendMessage(`Добавил ${normalized} в друзья!`);
    setSaturnState("celebrate");
  };

  const handleRemoveFriend = (targetHandle: string) => {
    if (!currentUser) return;
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === currentUser.id
          ? {
              ...a,
              friends: (a.friends || []).filter(
                (h) => safeLower(h) !== safeLower(targetHandle)
              ),
            }
          : a
      )
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPostError(null);

    const trimmed = postText.trim();
    const noteTrimmed = repostNote.trim();
    const effectiveText = repostTarget ? noteTrimmed : trimmed;

    if (!effectiveText && !postImage && !repostTarget) {
      setPostError("Напиши текст поста или прикрепи картинку.");
      return;
    }

    const newPost: PostItem = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: activeRoom.id,
      author: currentUser.username,
      handle: currentUser.handle,
      avatar: currentUser.avatar || null,
      text: effectiveText,
      image: repostTarget ? null : postImage,
      createdAt: "только что",
      pinned: false,
      likes: 0,
      likedByMe: false,
      reactions: {},
      repostOf: repostTarget
        ? {
            originalPostId: repostTarget.id,
            originalRoomId: repostTarget.roomId,
            author: repostTarget.author,
            handle: repostTarget.handle,
            text: repostTarget.text,
            image: repostTarget.image || null,
            createdAt: repostTarget.createdAt,
          }
        : null,
      comments: [],
    };

    setPosts((prev) => [newPost, ...prev]);
    void upsertCloudPost(newPost);
    setPostText("");
    setPostImage(null);
    setRepostTarget(null);
    setRepostNote("");
    if (postImageInputRef.current) {
      postImageInputRef.current.value = "";
    }
    setSaturnState("celebrate");
  };

  const handleStartEditPost = (post: PostItem) => {
    setEditingPostId(post.id);
    setEditingPostText(post.text);
  };

  const handleSaveEditPost = (postId: string) => {
    const trimmed = editingPostText.trim();
    if (!trimmed) return;
    let updatedPost: PostItem | null = null;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        updatedPost = { ...p, text: trimmed, editedAt: nowTimeLabel() };
        return updatedPost;
      })
    );
    if (updatedPost) {
      void upsertCloudPost(updatedPost);
    }
    setEditingPostId(null);
    setEditingPostText("");
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    void deleteCloudPost(postId);
    if (editingPostId === postId) {
      setEditingPostId(null);
      setEditingPostText("");
    }
  };

  const handleTogglePinPost = (postId: string) => {
    const affectedPosts: PostItem[] = [];
    setPosts((prev) => {
      const target = prev.find((p) => p.id === postId);
      if (!target) return prev;
      const nextPinnedState = !Boolean(target.pinned);
      return prev.map((p) => {
        if (p.id === postId) {
          const updated = { ...p, pinned: nextPinnedState };
          affectedPosts.push(updated);
          return updated;
        }
        if (
          nextPinnedState &&
          p.roomId === target.roomId &&
          Boolean(p.pinned)
        ) {
          const updated = { ...p, pinned: false };
          affectedPosts.push(updated);
          return updated;
        }
        return p;
      });
    });
    for (const item of affectedPosts) {
      void upsertCloudPost(item);
    }
  };

  const handleToggleLike = (postId: string) => {
    let updatedPost: PostItem | null = null;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMe;
        updatedPost = {
          ...p,
          likedByMe: nextLiked,
          likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
        };
        return updatedPost;
      })
    );
    if (updatedPost) {
      void upsertCloudPost(updatedPost);
    }
  };

  const handleTogglePostReaction = (postId: string, emoji: ReactionEmoji) => {
    if (!currentUser) return;
    let updatedPost: PostItem | null = null;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        updatedPost = {
          ...p,
          reactions: toggleReactionMap(p.reactions, emoji, currentUser.handle),
        };
        return updatedPost;
      })
    );
    if (updatedPost) {
      void upsertCloudPost(updatedPost);
    }
  };

  const handleAddComment = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const raw = commentInputs[postId] || "";
    const trimmed = raw.trim();
    if (!trimmed) return;

    const newComment: CommentItem = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: currentUser.username,
      handle: currentUser.handle,
      avatar: currentUser.avatar || null,
      text: trimmed,
      createdAt: "только что",
    };

    let updatedPost: PostItem | null = null;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        updatedPost = {
          ...p,
          comments: [...(p.comments || []), newComment],
        };
        return updatedPost;
      })
    );
    if (updatedPost) {
      void upsertCloudPost(updatedPost);
    }
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const trimmed = chatText.trim();
    if (!trimmed) return;

    const msg: ChatMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: activeRoom.id,
      author: currentUser.username,
      handle: currentUser.handle,
      avatar: currentUser.avatar || null,
      text: trimmed,
      createdAt: nowTimeLabel(),
      pinned: false,
      reactions: {},
    };

    setMessages((prev) => [...prev, msg]);
    setChatText("");
  };

  const handleStartEditMessage = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.text);
  };

  const handleSaveEditMessage = (msgId: string) => {
    const trimmed = editingMessageText.trim();
    if (!trimmed) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, text: trimmed, editedAt: nowTimeLabel() } : m
      )
    );
    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const handleDeleteMessage = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (editingMessageId === msgId) {
      setEditingMessageId(null);
      setEditingMessageText("");
    }
  };

  const handleTogglePinMessage = (msgId: string) => {
    setMessages((prev) => {
      const target = prev.find((m) => m.id === msgId);
      if (!target) return prev;
      const nextPinned = !Boolean(target.pinned);
      return prev.map((m) => {
        if (m.id === msgId) return { ...m, pinned: nextPinned };
        if (nextPinned && m.roomId === target.roomId && Boolean(m.pinned)) {
          return { ...m, pinned: false };
        }
        return m;
      });
    });
  };

  const handleToggleMessageReaction = (msgId: string, emoji: ReactionEmoji) => {
    if (!currentUser) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              reactions: toggleReactionMap(
                m.reactions,
                emoji,
                currentUser.handle
              ),
            }
          : m
      )
    );
  };

  const handleOpenProfile = (handle: string) => {
    const normalized = normalizeHandle(handle);
    if (!normalized) return;
    setInspectedHandle(normalized);
    setCopiedHandle(false);
  };

  const handleCopyHandle = (handle: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(handle).catch(() => {});
    }
    setCopiedHandle(true);
    window.setTimeout(() => setCopiedHandle(false), 1600);
  };

  const canManageItem = (authorHandle: string) => {
    if (!currentUser) return false;
    return (
      currentUser.accountType === "official" ||
      safeLower(authorHandle) === safeLower(currentUser.handle)
    );
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#090414] text-[#F8F5FF] flex items-center justify-center">
        <div className="text-sm font-bold tracking-wider text-purple-200/80">
          Загрузка Aura Space...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090414] text-[#F8F5FF] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-purple-500/25 bg-[#130926]/95 p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-5">
            <SaturnMascot
              state="idle"
              size={84}
              onInteract={() => {}}
            />
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
              Aura Space
            </h1>
            <p className="mt-1 text-xs text-purple-200/75">
              Войди в свой аккаунт или зарегистрируйся, чтобы попасть в орбиту
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#090414] p-1 border border-purple-500/20 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
                setAuthSuggestion(null);
              }}
              className={`rounded-lg py-2 text-xs font-extrabold transition ${
                authMode === "login"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "text-purple-200/75 hover:text-white"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
                setAuthSuggestion(null);
              }}
              className={`rounded-lg py-2 text-xs font-extrabold transition ${
                authMode === "register"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "text-purple-200/75 hover:text-white"
              }`}
            >
              Регистрация
            </button>
          </div>

          {authError && (
            <div className="mb-4 rounded-xl border border-pink-500/40 bg-pink-950/40 px-3.5 py-2.5 text-xs font-semibold text-pink-200">
              <div>{authError}</div>
              {authSuggestion && (
                <button
                  type="button"
                  onClick={() => {
                    setRegEmail(authSuggestion);
                    setAuthSuggestion(null);
                    setAuthError(null);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-pink-400/40 bg-[#FF2A85]/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#FF2A85]/35"
                >
                  Подставить {authSuggestion}
                </button>
              )}
            </div>
          )}

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-purple-200/85 mb-1">
                  @handle, email или имя
                </label>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="@handle или name@gmail.com"
                  autoComplete="username"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200/85 mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-2.5 text-sm font-extrabold text-white shadow-lg hover:opacity-95 disabled:opacity-50 transition"
              >
                {authSubmitting ? "Входим..." : "Войти в Aura Space"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-purple-200/85 mb-1">
                  Имя
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Как тебя называть"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200/85 mb-1">
                  Уникальный @handle
                </label>
                <input
                  type="text"
                  value={regHandle}
                  onChange={(e) => setRegHandle(e.target.value)}
                  placeholder="@your_handle"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200/85 mb-1">
                  Электронная почта
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (authSuggestion) setAuthSuggestion(null);
                  }}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-purple-200/85 mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Мин. 4 симв."
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-200/85 mb-1">
                    Повтор пароля
                  </label>
                  <input
                    type="password"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    placeholder="Повтори пароль"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-2.5 text-sm font-extrabold text-white shadow-lg hover:opacity-95 disabled:opacity-50 transition mt-1"
              >
                {authSubmitting ? "Создаём..." : "Создать аккаунт"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090414] text-[#F8F5FF] flex flex-col">
      <header className="sticky top-0 z-30 border-b border-purple-500/20 bg-[#090414]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <SaturnMascot
              state={currentUser.saturnState || "idle"}
              size={42}
              onInteract={() =>
                setSaturnState(
                  currentUser.saturnState === "celebrate" ? "idle" : "celebrate"
                )
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">
                  Aura Space
                </span>
                <span className="rounded-full border border-fuchsia-500/30 bg-[#9D4EDD]/15 px-2 py-0.5 text-[10px] font-bold text-pink-200">
                  #{activeRoom.name}
                </span>
              </div>
              <p className="truncate text-[11px] text-purple-200/70">
                {activeRoom.topic}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("feed")}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                activeTab === "feed"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "bg-white/5 text-purple-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              Лента
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                activeTab === "chat"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "bg-white/5 text-purple-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              Чат
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("friends")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                activeTab === "friends"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "bg-white/5 text-purple-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Друзья ({friendsList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                activeTab === "profile"
                  ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                  : "bg-white/5 text-purple-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              Профиль
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenProfile(currentUser.handle)}
              className="hidden sm:flex items-center gap-2 rounded-xl border border-purple-500/20 bg-[#130926] px-2.5 py-1.5 text-left hover:border-pink-400/40 transition"
            >
              <AvatarBadge
                name={currentUser.username}
                src={currentUser.avatar}
                size="sm"
                presence={currentUser.presence}
              />
              <div className="leading-tight">
                <div className="flex items-center gap-1 text-xs font-extrabold text-white">
                  <span>{currentUser.username}</span>
                  <VerifiedBadge account={currentUser} size="sm" />
                </div>
                <div className="text-[10px] text-purple-200/70">
                  {currentUser.handle}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAddAccError(null);
                setAddAccSuggestion(null);
                setShowAddAccountModal(true);
              }}
              title="Добавить или создать ещё один аккаунт"
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/25 bg-white/5 px-2.5 py-2 text-xs font-bold text-purple-100 hover:border-pink-400/40 hover:bg-white/10 transition"
            >
              <UserPlus className="h-3.5 w-3.5 text-pink-300" />
              <span className="hidden md:inline">Аккаунт</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Выйти из аккаунта"
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/25 bg-white/5 px-2.5 py-2 text-xs font-bold text-purple-200/80 hover:border-pink-500/40 hover:text-white transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-200/70">
                Каналы
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowChannelForm((v) => !v);
                  setChannelError(null);
                }}
                title="Создать новый канал"
                className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-500/30 bg-[#9D4EDD]/15 px-2 py-1 text-[11px] font-bold text-pink-200 hover:bg-[#9D4EDD]/25 transition"
              >
                <Plus className="h-3 w-3" />
                <span>Новый</span>
              </button>
            </div>

            {showChannelForm && (
              <form
                onSubmit={handleCreateChannel}
                className="mb-3 space-y-2 rounded-xl border border-purple-500/25 bg-[#090414]/90 p-2.5"
              >
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="название-канала"
                  className="w-full rounded-lg border border-purple-500/25 bg-[#130926] px-2.5 py-1.5 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
                <input
                  type="text"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  placeholder="Тема канала (необязательно)"
                  className="w-full rounded-lg border border-purple-500/25 bg-[#130926] px-2.5 py-1.5 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
                {channelError && (
                  <p className="text-[11px] font-semibold text-pink-300">
                    {channelError}
                  </p>
                )}
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChannelForm(false);
                      setChannelError(null);
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold text-purple-200/70 hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-2.5 py-1 text-[11px] font-extrabold text-white"
                  >
                    Создать
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {rooms.map((room) => {
                const active = room.id === activeRoom.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleSwitchRoom(room.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                      active
                        ? "bg-gradient-to-r from-[#9D4EDD]/30 to-[#FF2A85]/25 text-white border border-pink-400/35"
                        : "text-purple-200/75 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Hash className="h-3.5 w-3.5 shrink-0 text-pink-400" />
                      <span className="truncate">{room.name}</span>
                    </span>
                    {active && inCall && (
                      <span className="ml-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-200/70">
                Голос · #{activeRoom.name}
              </span>
              {inCall && (
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
                  {formatCallDuration(callSeconds)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleCall}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${
                inCall
                  ? "bg-rose-600/90 text-white hover:bg-rose-500"
                  : "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white hover:opacity-95"
              }`}
            >
              {inCall ? (
                <>
                  <PhoneOff className="h-4 w-4" />
                  <span>Выйти из голоса</span>
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4" />
                  <span>Войти в голос</span>
                </>
              )}
            </button>

            {inCall && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                      muted
                        ? "border-rose-400/40 bg-rose-950/50 text-rose-200"
                        : "border-purple-500/25 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    {muted ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        <span>Микрофон выкл</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Микрофон вкл</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeafened((d) => !d)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                      deafened
                        ? "border-amber-400/40 bg-amber-950/50 text-amber-200"
                        : "border-purple-500/25 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    {deafened ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5" />
                        <span>Звук выкл</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-pink-300" />
                        <span>Звук вкл</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-purple-200/70 mb-1">
                    Уровень микрофона
                  </div>
                  <VoiceLevelBar level={voiceLevel} />
                </div>

                <div className="space-y-1.5 pt-1 border-t border-purple-500/15">
                  <div className="text-[11px] font-bold text-purple-200/75">
                    В комнате ({1 + remotePeers.length})
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[#090414]/80 px-2.5 py-1.5 text-xs">
                    <span className="font-bold text-white truncate">
                      {currentUser.username} (ты)
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-300">
                      {muted ? "muted" : "live"}
                    </span>
                  </div>
                  {remotePeers.map((peer) => (
                    <div
                      key={peer.peerId}
                      className="flex items-center justify-between rounded-lg bg-[#090414]/80 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-bold text-pink-200 truncate">
                        {peer.username}
                      </span>
                      <span className="text-[10px] text-purple-200/70">
                        {peer.handle}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {callStatus && (
              <p className="text-[11px] leading-snug text-purple-200/80">
                {callStatus}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-200/70">
                Участники ({accounts.length})
              </span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {accounts.map((acc) => {
                const pMeta = PRESENCE_META[acc.presence || "online"];
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleOpenProfile(acc.handle)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#090414]/65 px-2.5 py-2 text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarBadge
                        name={acc.username}
                        src={acc.avatar}
                        size="sm"
                        presence={acc.presence}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-bold text-white truncate">
                          <span className="truncate">{acc.username}</span>
                          <VerifiedBadge account={acc} size="sm" />
                        </div>
                        <div className="truncate text-[10px] text-purple-200/65">
                          {acc.mood || pMeta.label}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${pMeta.badgeClass}`}
                    >
                      {pMeta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-4 lg:col-span-9">
          {activeTab === "feed" && (
            <>
              <form
                onSubmit={handleCreatePost}
                className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <AvatarBadge
                    name={currentUser.username}
                    src={currentUser.avatar}
                    size="md"
                    presence={currentUser.presence}
                  />
                  <div className="flex-1 space-y-2.5">
                    {repostTarget ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl border border-fuchsia-500/30 bg-[#090414]/80 px-3 py-2 text-xs">
                          <span className="font-bold text-pink-200">
                            Репост поста от {repostTarget.handle}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRepostTarget(null);
                              setRepostNote("");
                            }}
                            className="text-purple-200/70 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={repostNote}
                          onChange={(e) => setRepostNote(e.target.value)}
                          placeholder="Добавь свой комментарий к репосту (необязательно)..."
                          className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                        />
                        <div className="rounded-xl border border-purple-500/20 bg-[#090414]/60 p-3 text-xs text-purple-100/90">
                          <div className="font-bold text-pink-200 mb-1">
                            {repostTarget.author} · {repostTarget.handle}
                          </div>
                          <p className="whitespace-pre-wrap break-words">
                            {repostTarget.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder={`Что нового в #${activeRoom.name}? Используй @handle для упоминаний...`}
                        className="w-full resize-none rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                      />
                    )}

                    {postImage && !repostTarget && (
                      <div className="relative inline-block">
                        <img
                          src={postImage}
                          alt="Предпросмотр"
                          className="max-h-56 rounded-xl border border-purple-500/25 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPostImage(null);
                            if (postImageInputRef.current) {
                              postImageInputRef.current.value = "";
                            }
                          }}
                          className="absolute top-2 right-2 rounded-full bg-[#090414]/85 p-1 text-white hover:bg-rose-600 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {postError && (
                      <p className="text-xs font-semibold text-pink-300">
                        {postError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        {!repostTarget && (
                          <>
                            <input
                              ref={postImageInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePostImageUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => postImageInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/25 bg-white/5 px-3 py-1.5 text-xs font-bold text-purple-100 hover:border-pink-400/40 hover:bg-white/10 transition"
                            >
                              <ImagePlus className="h-3.5 w-3.5 text-pink-300" />
                              <span>Фото</span>
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white shadow-md hover:opacity-95 transition"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{repostTarget ? "Сделать репост" : "Опубликовать"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {pinnedPost && (
                <div className="rounded-2xl border border-amber-400/35 bg-amber-950/20 px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                      <Pin className="h-3.5 w-3.5" />
                      <span>Закреплённый пост · {pinnedPost.handle}</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-50/95 line-clamp-2">
                      {pinnedPost.text || "Медиапост"}
                    </p>
                  </div>
                  {canManageItem(pinnedPost.handle) && (
                    <button
                      type="button"
                      onClick={() => handleTogglePinPost(pinnedPost.id)}
                      className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-950/50 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-900/50"
                    >
                      Открепить
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3.5">
                {roomPosts.length === 0 ? (
                  <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/80 p-8 text-center text-sm text-purple-200/70">
                    В канале #{activeRoom.name} пока нет постов. Напиши первый!
                  </div>
                ) : (
                  roomPosts.map((post) => {
                    const authorAcc = accountByHandle.get(safeLower(post.handle));
                    const authorAvatar = authorAcc
                      ? authorAcc.avatar
                      : post.avatar || null;
                    const authorName = authorAcc ? authorAcc.username : post.author;
                    const isEditing = editingPostId === post.id;
                    const canManage = canManageItem(post.handle);
                    const hasEgg = hasEasterEggForPost(post.id);
                    const commentDraft = commentInputs[post.id] || "";

                    return (
                      <article
                        key={post.id}
                        className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 space-y-3"
                      >
                        {hasEgg && <PostPeelUnderlay postId={post.id} />}
                        {hasEgg && <PostCornerPeelHandle postId={post.id} />}

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenProfile(post.handle)}
                              className="shrink-0"
                            >
                              <AvatarBadge
                                name={authorName}
                                src={authorAvatar}
                                size="md"
                                presence={authorAcc?.presence}
                              />
                            </button>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(post.handle)}
                                  className="text-sm font-extrabold text-white hover:text-pink-300 transition truncate"
                                >
                                  {authorName}
                                </button>
                                <VerifiedBadge account={authorAcc} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(post.handle)}
                                  className="text-xs font-semibold text-purple-200/70 hover:text-pink-200"
                                >
                                  {post.handle}
                                </button>
                                {post.pinned && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                    <Pin className="h-2.5 w-2.5" />
                                    <span>Закреп</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-purple-200/60">
                                {post.createdAt}
                                {post.editedAt ? ` · ред. ${post.editedAt}` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePinPost(post.id)}
                                  title={post.pinned ? "Открепить" : "Закрепить"}
                                  className={`rounded-lg p-1.5 text-xs transition ${
                                    post.pinned
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "text-purple-200/65 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <Pin className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPost(post)}
                                  title="Редактировать пост"
                                  className="rounded-lg p-1.5 text-purple-200/65 hover:bg-white/10 hover:text-white transition"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePost(post.id)}
                                  title="Удалить пост"
                                  className="rounded-lg p-1.5 text-purple-200/65 hover:bg-rose-950/60 hover:text-rose-300 transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={editingPostText}
                              onChange={(e) =>
                                setEditingPostText(e.target.value)
                              }
                              className="w-full rounded-xl border border-purple-500/30 bg-[#090414] p-3 text-sm text-white focus:border-[#FF2A85] focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPostId(null);
                                  setEditingPostText("");
                                }}
                                className="rounded-lg px-3 py-1 text-xs font-bold text-purple-200/75 hover:text-white"
                              >
                                Отмена
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditPost(post.id)}
                                className="rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-3 py-1 text-xs font-extrabold text-white"
                              >
                                Сохранить
                              </button>
                            </div>
                          </div>
                        ) : (
                          post.text && (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#F8F5FF]">
                              <RichTextWithMentions
                                text={post.text}
                                knownHandles={knownCommunityHandles}
                                currentUserHandle={currentUser.handle}
                                onSelectHandle={handleOpenProfile}
                              />
                            </p>
                          )
                        )}

                        {post.repostOf && (
                          <div className="rounded-xl border border-purple-500/25 bg-[#090414]/75 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-200">
                              <Repeat className="h-3.5 w-3.5 text-fuchsia-400" />
                              <span>
                                {post.repostOf.author} ({post.repostOf.handle})
                              </span>
                              <span className="text-[11px] font-normal text-purple-200/60">
                                · {post.repostOf.createdAt}
                              </span>
                            </div>
                            {post.repostOf.text && (
                              <p className="whitespace-pre-wrap break-words text-xs text-purple-100/90">
                                {post.repostOf.text}
                              </p>
                            )}
                            {post.repostOf.image && (
                              <img
                                src={post.repostOf.image}
                                alt="Вложение репоста"
                                onClick={() =>
                                  setLightboxImage(post.repostOf?.image || null)
                                }
                                className="max-h-52 cursor-zoom-in rounded-lg border border-purple-500/20 object-cover"
                              />
                            )}
                          </div>
                        )}

                        {post.image && (
                          <div className="relative inline-block">
                            <img
                              src={post.image}
                              alt="Вложение поста"
                              onClick={() => setLightboxImage(post.image || null)}
                              className="max-h-80 cursor-zoom-in rounded-xl border border-purple-500/25 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setLightboxImage(post.image || null)}
                              title="Открыть полностью"
                              className="absolute bottom-2 right-2 rounded-lg bg-[#090414]/80 p-1.5 text-white hover:bg-[#090414]"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-purple-500/15">
                          <ReactionBar
                            reactions={post.reactions}
                            currentUserHandle={currentUser.handle}
                            onToggle={(emoji) =>
                              handleTogglePostReaction(post.id, emoji)
                            }
                          />

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleLike(post.id)}
                              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                                post.likedByMe
                                  ? "border-pink-400/50 bg-[#FF2A85]/25 text-pink-200"
                                  : "border-purple-500/20 bg-white/5 text-purple-200/80 hover:border-pink-400/35 hover:text-white"
                              }`}
                            >
                              <Heart
                                className={`h-3.5 w-3.5 ${
                                  post.likedByMe
                                    ? "fill-[#FF2A85] text-[#FF2A85]"
                                    : ""
                                }`}
                              />
                              <span>{post.likes}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRepostTarget(post);
                                setRepostNote("");
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-purple-200/80 hover:border-pink-400/35 hover:text-white transition"
                            >
                              <Forward className="h-3.5 w-3.5" />
                              <span>Репост</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          {(post.comments || []).map((c) => {
                            const cAcc = accountByHandle.get(safeLower(c.handle));
                            return (
                              <div
                                key={c.id}
                                className="flex items-start gap-2 rounded-xl bg-[#090414]/65 px-3 py-2 text-xs"
                              >
                                <AvatarBadge
                                  name={cAcc ? cAcc.username : c.author}
                                  src={cAcc ? cAcc.avatar : c.avatar}
                                  size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProfile(c.handle)}
                                      className="font-bold text-white hover:text-pink-300"
                                    >
                                      {cAcc ? cAcc.username : c.author}
                                    </button>
                                    <span className="text-[11px] text-purple-200/60">
                                      {c.handle} · {c.createdAt}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-purple-100/90 break-words">
                                    <RichTextWithMentions
                                      text={c.text}
                                      knownHandles={knownCommunityHandles}
                                      currentUserHandle={currentUser.handle}
                                      onSelectHandle={handleOpenProfile}
                                    />
                                  </p>
                                </div>
                              </div>
                            );
                          })}

                          <form
                            onSubmit={(e) => handleAddComment(post.id, e)}
                            className="flex items-center gap-2"
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-purple-300/60" />
                            <input
                              type="text"
                              value={commentDraft}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Написать комментарий..."
                              className="flex-1 rounded-xl border border-purple-500/20 bg-[#090414] px-3 py-1.5 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#FF2A85]/35 transition"
                            >
                              Ответить
                            </button>
                          </form>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}

          {activeTab === "chat" && (
            <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 flex flex-col min-h-[520px]">
              <div className="flex items-center justify-between border-b border-purple-500/15 pb-3 mb-3">
                <div>
                  <h2 className="text-sm font-black text-white">
                    Чат канала #{activeRoom.name}
                  </h2>
                  <p className="text-xs text-purple-200/70">
                    {activeRoom.topic}
                  </p>
                </div>
              </div>

              {pinnedMessage && (
                <div className="mb-3 rounded-xl border border-amber-400/35 bg-amber-950/20 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-extrabold text-amber-300">
                      Закреплено ({pinnedMessage.handle}):{" "}
                    </span>
                    <span className="text-amber-50/90">
                      {pinnedMessage.text}
                    </span>
                  </div>
                  {canManageItem(pinnedMessage.handle) && (
                    <button
                      type="button"
                      onClick={() => handleTogglePinMessage(pinnedMessage.id)}
                      className="shrink-0 text-[11px] font-bold text-amber-200 hover:underline"
                    >
                      Открепить
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 max-h-[420px]">
                {roomMessages.map((msg) => {
                  const senderAcc = accountByHandle.get(safeLower(msg.handle));
                  const isEditing = editingMessageId === msg.id;
                  const canManage = canManageItem(msg.handle);
                  const mentionsMe = textMentionsHandle(
                    msg.text,
                    currentUser.handle
                  );

                  return (
                    <div
                      key={msg.id}
                      className={`rounded-xl border px-3 py-2.5 space-y-1.5 ${
                        mentionsMe
                          ? "border-pink-400/45 bg-[#FF2A85]/10"
                          : "border-purple-500/15 bg-[#090414]/75"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarBadge
                            name={senderAcc ? senderAcc.username : msg.author}
                            src={senderAcc ? senderAcc.avatar : msg.avatar}
                            size="sm"
                            presence={senderAcc?.presence}
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(msg.handle)}
                            className="text-xs font-extrabold text-white hover:text-pink-300 truncate"
                          >
                            {senderAcc ? senderAcc.username : msg.author}
                          </button>
                          <VerifiedBadge account={senderAcc} size="sm" />
                          <span className="text-[11px] text-purple-200/60">
                            {msg.handle} · {msg.createdAt}
                            {msg.editedAt ? ` · ред. ${msg.editedAt}` : ""}
                          </span>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTogglePinMessage(msg.id)}
                              title="Закрепить сообщение"
                              className="rounded p-1 text-purple-200/60 hover:bg-white/10 hover:text-amber-300"
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditMessage(msg)}
                              title="Редактировать"
                              className="rounded p-1 text-purple-200/60 hover:bg-white/10 hover:text-white"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Удалить"
                              className="rounded p-1 text-purple-200/60 hover:bg-rose-950/60 hover:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={editingMessageText}
                            onChange={(e) =>
                              setEditingMessageText(e.target.value)
                            }
                            className="flex-1 rounded-lg border border-purple-500/30 bg-[#130926] px-2.5 py-1 text-xs text-white focus:border-[#FF2A85] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditMessage(msg.id)}
                            className="rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-2.5 py-1 text-xs font-bold text-white"
                          >
                            Сохранить
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-[#F8F5FF] break-words">
                          <RichTextWithMentions
                            text={msg.text}
                            knownHandles={knownCommunityHandles}
                            currentUserHandle={currentUser.handle}
                            onSelectHandle={handleOpenProfile}
                          />
                        </p>
                      )}

                      <ReactionBar
                        reactions={msg.reactions}
                        currentUserHandle={currentUser.handle}
                        onToggle={(emoji) =>
                          handleToggleMessageReaction(msg.id, emoji)
                        }
                      />
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendChat}
                className="mt-3 flex items-center gap-2 border-t border-purple-500/15 pt-3"
              >
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder={`Сообщение в #${activeRoom.name}...`}
                  className="flex-1 rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-95 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Отправить</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === "friends" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 space-y-3">
                <h2 className="text-base font-black text-white">
                  Добавить друга по @handle
                </h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={friendHandleInput}
                    onChange={(e) => setFriendHandleInput(e.target.value)}
                    placeholder="@handle пользователя"
                    className="flex-1 rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddFriend()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Добавить</span>
                  </button>
                </div>
                {friendMessage && (
                  <p className="text-xs font-semibold text-pink-200">
                    {friendMessage}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 space-y-3">
                <h3 className="text-sm font-black text-white">
                  Мои друзья ({friendsList.length})
                </h3>
                {friendsList.length === 0 ? (
                  <p className="text-xs text-purple-200/70">
                    Пока никого нет в друзьях. Добавь участника по @handle или из
                    списка ниже.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {friendsList.map((fr) => (
                      <div
                        key={fr.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-purple-500/20 bg-[#090414]/75 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(fr.handle)}
                          className="flex items-center gap-2.5 min-w-0 text-left"
                        >
                          <AvatarBadge
                            name={fr.username}
                            src={fr.avatar}
                            size="md"
                            presence={fr.presence}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-xs font-extrabold text-white truncate">
                              <span className="truncate">{fr.username}</span>
                              <VerifiedBadge account={fr} size="sm" />
                            </div>
                            <div className="text-[11px] text-purple-200/70 truncate">
                              {fr.handle} · {fr.mood || "В сети"}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(fr.handle)}
                          title="Удалить из друзей"
                          className="rounded-lg p-1.5 text-purple-200/65 hover:bg-rose-950/60 hover:text-rose-300"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {suggestedAccounts.length > 0 && (
                <div className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 p-4 space-y-3">
                  <h3 className="text-sm font-black text-white">
                    Участники орбиты
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {suggestedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-purple-500/20 bg-[#090414]/75 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(acc.handle)}
                          className="flex items-center gap-2.5 min-w-0 text-left"
                        >
                          <AvatarBadge
                            name={acc.username}
                            src={acc.avatar}
                            size="md"
                            presence={acc.presence}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-xs font-extrabold text-white truncate">
                              <span className="truncate">{acc.username}</span>
                              <VerifiedBadge account={acc} size="sm" />
                            </div>
                            <div className="text-[11px] text-purple-200/70 truncate">
                              {acc.handle}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddFriend(acc.handle)}
                          className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-500/35 bg-[#9D4EDD]/20 px-2.5 py-1.5 text-[11px] font-bold text-pink-200 hover:bg-[#9D4EDD]/35"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>В друзья</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <form
              onSubmit={handleSaveProfile}
              className="rounded-2xl border border-purple-500/20 bg-[#130926]/90 overflow-hidden"
            >
              <div
                className="relative h-36 w-full bg-cover bg-center"
                style={
                  profileBanner?.startsWith("data:")
                    ? { backgroundImage: `url(${profileBanner})` }
                    : {
                        background:
                          profileBanner || BANNER_PRESETS[0].gradient,
                      }
                }
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#130926] via-transparent to-black/25" />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#090414]/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-[#090414]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-pink-300" />
                    <span>Своя шапка</span>
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-4 -mt-12">
                  <div className="flex items-end gap-3.5">
                    <div className="relative">
                      <AvatarBadge
                        name={profileUsername || currentUser.username}
                        src={profileAvatar}
                        size="lg"
                        presence={profilePresence}
                      />
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        title="Загрузить аватарку"
                        className="absolute -bottom-1 -right-1 rounded-full border border-white/25 bg-[#9D4EDD] p-1.5 text-white shadow hover:bg-[#FF2A85] transition"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="pb-1">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-lg font-black text-white">
                          {profileUsername || currentUser.username}
                        </h2>
                        <VerifiedBadge account={currentUser} size="md" />
                      </div>
                      <div className="text-xs text-purple-200/75">
                        {currentUser.handle} ·{" "}
                        {accountBadgeLabel(currentUser.accountType)} ·{" "}
                        {formatSubscribers(currentUser.subscribers)} подписчиков
                      </div>
                    </div>
                  </div>

                  {profileAvatar && (
                    <button
                      type="button"
                      onClick={() => setProfileAvatar(null)}
                      className="rounded-xl border border-purple-500/25 bg-white/5 px-3 py-1.5 text-xs font-bold text-purple-200/80 hover:text-white"
                    >
                      Убрать аватарку
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-200/85 mb-2">
                    Готовые градиенты шапки
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setProfileBanner(preset.gradient)}
                        className={`rounded-xl border p-2 text-left text-[11px] font-bold text-white transition ${
                          profileBanner === preset.gradient
                            ? "border-pink-400 ring-2 ring-pink-400/30"
                            : "border-purple-500/20 opacity-85 hover:opacity-100"
                        }`}
                        style={{ background: preset.gradient }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-purple-200/85 mb-1">
                      Отображаемое имя
                    </label>
                    <input
                      type="text"
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white focus:border-[#FF2A85] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-200/85 mb-1">
                      Статус присутствия
                    </label>
                    <select
                      value={profilePresence}
                      onChange={(e) =>
                        setProfilePresence(e.target.value as PresenceKind)
                      }
                      className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white focus:border-[#FF2A85] focus:outline-none"
                    >
                      <option value="online">Онлайн</option>
                      <option value="building">В сборке</option>
                      <option value="orbit">На орбите</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-200/85 mb-1">
                    Текущее настроение / активность
                  </label>
                  <input
                    type="text"
                    value={profileMood}
                    onChange={(e) => setProfileMood(e.target.value)}
                    placeholder="Например: Собираю новый релиз"
                    className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-200/85 mb-1">
                    О себе
                  </label>
                  <textarea
                    rows={3}
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Расскажи коротко о себе..."
                    className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-purple-200/85 mb-1">
                    <KeyRound className="h-3.5 w-3.5 text-pink-300" />
                    <span>Новый пароль (оставь пустым, если не меняешь)</span>
                  </label>
                  <input
                    type="password"
                    value={profileNewPassword}
                    onChange={(e) => setProfileNewPassword(e.target.value)}
                    placeholder="Новый пароль (мин. 4 символа)"
                    className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                  />
                </div>

                {profileError && (
                  <p className="text-xs font-semibold text-pink-300">
                    {profileError}
                  </p>
                )}

                {profileSaved && (
                  <p className="text-xs font-bold text-emerald-300">
                    Изменения профиля сохранены!
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:opacity-95 transition"
                  >
                    <Save className="h-4 w-4" />
                    <span>Сохранить профиль</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#130926] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                Переключение или создание аккаунта
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="rounded-lg p-1 text-purple-200/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {otherAccounts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-200/70">
                  Быстрый вход в существующий аккаунт
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {otherAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        handleQuickSwitchAccount(acc.id);
                        setShowAddAccountModal(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-purple-500/20 bg-[#090414]/80 px-3 py-2 text-left hover:border-pink-400/40 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarBadge
                          name={acc.username}
                          src={acc.avatar}
                          size="sm"
                          presence={acc.presence}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-xs font-bold text-white truncate">
                            <span className="truncate">{acc.username}</span>
                            <VerifiedBadge account={acc} size="sm" />
                          </div>
                          <div className="text-[10px] text-purple-200/65">
                            {acc.handle}
                          </div>
                        </div>
                      </div>
                      <UserCheck className="h-4 w-4 shrink-0 text-pink-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleAddAnotherAccount}
              className="space-y-2.5 border-t border-purple-500/20 pt-3"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-200/70">
                Создать новый аккаунт
              </div>

              {addAccError && (
                <div className="rounded-xl border border-pink-500/40 bg-pink-950/40 px-3 py-2 text-xs font-semibold text-pink-200">
                  <div>{addAccError}</div>
                  {addAccSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddAccEmail(addAccSuggestion);
                        setAddAccSuggestion(null);
                        setAddAccError(null);
                      }}
                      className="mt-1 rounded bg-[#FF2A85]/25 px-2 py-0.5 text-[11px] font-bold text-white"
                    >
                      Подставить {addAccSuggestion}
                    </button>
                  )}
                </div>
              )}

              <input
                type="text"
                value={addAccUsername}
                onChange={(e) => setAddAccUsername(e.target.value)}
                placeholder="Имя"
                className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
              />
              <input
                type="text"
                value={addAccHandle}
                onChange={(e) => setAddAccHandle(e.target.value)}
                placeholder="@handle"
                className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
              />
              <input
                type="email"
                value={addAccEmail}
                onChange={(e) => setAddAccEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={addAccPassword}
                  onChange={(e) => setAddAccPassword(e.target.value)}
                  placeholder="Пароль"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
                <input
                  type="password"
                  value={addAccPasswordConfirm}
                  onChange={(e) => setAddAccPasswordConfirm(e.target.value)}
                  placeholder="Повтор пароля"
                  className="w-full rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:border-[#FF2A85] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={addAccSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-2 text-xs font-extrabold text-white disabled:opacity-50"
              >
                {addAccSubmitting ? "Создаём..." : "Создать и войти"}
              </button>
            </form>
          </div>
        </div>
      )}

      {inspectedHandle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-purple-500/30 bg-[#130926] shadow-2xl">
            <div
              className="relative h-28 w-full"
              style={
                inspectedAccount?.banner?.startsWith("data:")
                  ? {
                      backgroundImage: `url(${inspectedAccount.banner})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {
                      background:
                        inspectedAccount?.banner || BANNER_PRESETS[0].gradient,
                    }
              }
            >
              <button
                type="button"
                onClick={() => setInspectedHandle(null)}
                className="absolute top-3 right-3 rounded-full bg-[#090414]/80 p-1.5 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-end justify-between gap-3 -mt-12">
                <div className="flex items-end gap-3">
                  <AvatarBadge
                    name={inspectedAccount?.username || inspectedHandle}
                    src={inspectedAccount?.avatar || null}
                    size="lg"
                    presence={inspectedAccount?.presence}
                  />
                  <div className="pb-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-lg font-black text-white">
                        {inspectedAccount?.username || inspectedHandle}
                      </h3>
                      <VerifiedBadge account={inspectedAccount} size="md" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-purple-200/75">
                      <AtSign className="h-3 w-3 text-pink-300" />
                      <span>{inspectedHandle.replace(/^@/, "")}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyHandle(inspectedHandle)}
                        className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-white/20"
                      >
                        {copiedHandle ? (
                          <>
                            <Check className="h-2.5 w-2.5 text-emerald-300" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-2.5 w-2.5" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {inspectedAccount?.mood && (
                <div className="rounded-xl border border-purple-500/20 bg-[#090414]/70 px-3 py-2 text-xs text-pink-200">
                  Статус: {inspectedAccount.mood}
                </div>
              )}

              {inspectedAccount?.bio && (
                <p className="text-xs leading-relaxed text-purple-100/90">
                  {inspectedAccount.bio}
                </p>
              )}

              <div className="space-y-2 pt-2 border-t border-purple-500/15">
                <div className="text-xs font-extrabold text-purple-200/80">
                  Посты участника ({inspectedPosts.length})
                </div>
                {inspectedPosts.length === 0 ? (
                  <p className="text-xs text-purple-200/60">
                    Пока нет опубликованных постов.
                  </p>
                ) : (
                  inspectedPosts.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-purple-500/15 bg-[#090414]/75 p-3 text-xs space-y-1"
                    >
                      <div className="text-[11px] text-purple-200/60">
                        {p.createdAt}
                      </div>
                      <p className="whitespace-pre-wrap text-white">
                        {p.text || "Медиапост"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <img
            src={lightboxImage}
            alt="Просмотр изображения"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-2xl border border-purple-500/30 object-contain"
          />
        </div>
      )}
    </div>
  );
}