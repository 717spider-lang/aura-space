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
  {
    id: "m-2",
    roomId: "dev",
    author: "system_404",
    handle: "@system_404",
    avatar: null,
    text: "Проверяем каналы, друзей, репосты и аватарки.",
    createdAt: "14:05",
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
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccUsername, setAddAccUsername] = useState("");
  const [addAccHandle, setAddAccHandle] = useState("");
  const [addAccEmail, setAddAccEmail] = useState("");
  const [addAccPassword, setAddAccPassword] = useState("");
  const [addAccPasswordConfirm, setAddAccPasswordConfirm] = useState("");
  const [addAccError, setAddAccError] = useState<string | null>(null);
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
  const [postPeelMap, setPostPeelMap] = useState<Record<string, number>>({});

  const [postInput, setPostInput] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postImageUrl, setPostImageUrl] = useState("");
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState("");

  const [repostingPost, setRepostingPost] = useState<PostItem | null>(null);
  const [repostTargetRoomId, setRepostTargetRoomId] = useState<string>("general");
  const [repostNote, setRepostNote] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState("");

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({
    "post-1": true,
  });

  // Голосовой чат (WebRTC + Web Audio API)
  const [inVoiceCall, setInVoiceCall] = useState(false);
  const [voiceRoomId, setVoiceRoomId] = useState<string>("general");
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [remotePeers, setRemotePeers] = useState<Record<string, RemoteVoicePeer>>(
    {}
  );
  const [manualOfferText, setManualOfferText] = useState("");
  const [manualAnswerInput, setManualAnswerInput] = useState("");
  const [copiedOffer, setCopiedOffer] = useState(false);

  const localPeerIdRef = useRef("");
  const voiceRoomIdRef = useRef("general");
  const currentUserRef = useRef<UserAccount | null>(null);
  const speakerMutedRef = useRef(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafLevelRef = useRef<number | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteAudioMapRef = useRef(new Map<string, HTMLAudioElement>());
  const manualPcRef = useRef<RTCPeerConnection | null>(null);

  const getLocalPeerId = useCallback(() => {
    if (!localPeerIdRef.current) {
      localPeerIdRef.current = `peer-${Math.random().toString(36).slice(2, 9)}`;
    }
    return localPeerIdRef.current;
  }, []);

  useEffect(() => {
    getLocalPeerId();
  }, [getLocalPeerId]);

  useEffect(() => {
    let cancelled = false;

    async function initStorage() {
      try {
        let loadedAccounts: UserAccount[] = [];
        const rawAccounts = window.localStorage.getItem(ACCOUNTS_KEY);
        if (rawAccounts) {
          const parsedAccounts = JSON.parse(rawAccounts);
          if (Array.isArray(parsedAccounts)) {
            loadedAccounts = parsedAccounts
              .filter(
                (acc): acc is UserAccount => !!acc && typeof acc === "object"
              )
              .map((acc) => {
                const normalizedH =
                  typeof acc.handle === "string" && acc.handle.trim()
                    ? normalizeHandle(acc.handle) || "@user"
                    : "@user";
                const isCreator = isReservedCreatorHandle(normalizedH);
                return {
                  ...acc,
                  id:
                    typeof acc.id === "string"
                      ? acc.id
                      : `usr-${Math.random().toString(36).slice(2, 8)}`,
                  username:
                    typeof acc.username === "string" ? acc.username : "Участник",
                  handle: normalizedH,
                  email: typeof acc.email === "string" ? acc.email : "",
                  accountType: isCreator ? "official" : "personal",
                  subscribers:
                    typeof acc.subscribers === "number" &&
                    Number.isFinite(acc.subscribers)
                      ? Math.max(0, Math.floor(acc.subscribers))
                      : 0,
                  bio: typeof acc.bio === "string" ? acc.bio : "",
                  mood: typeof acc.mood === "string" ? acc.mood : "На орбите",
                  presence:
                    acc.presence === "online" ||
                    acc.presence === "building" ||
                    acc.presence === "orbit"
                      ? acc.presence
                      : "online",
                  lastActive:
                    typeof acc.lastActive === "string"
                      ? acc.lastActive
                      : "только что",
                  avatar: typeof acc.avatar === "string" ? acc.avatar : null,
                  banner:
                    typeof acc.banner === "string"
                      ? acc.banner
                      : BANNER_PRESETS[0].gradient,
                  friends: Array.isArray(acc.friends)
                    ? acc.friends.filter((f): f is string => typeof f === "string")
                    : [],
                  saturnState:
                    acc.saturnState === "blackhole" ||
                    acc.saturnState === "slow1" ||
                    (typeof acc.saturnState === "number" &&
                      acc.saturnState >= 1 &&
                      acc.saturnState <= 7)
                      ? acc.saturnState
                      : 1,
                  createdAt:
                    typeof acc.createdAt === "string" ? acc.createdAt : "сегодня",
                };
              });
          }
        }

        // Встроенный аккаунт создателя @system_404 (вход только по паролю system_404)
        for (const seed of CREATOR_ACCOUNTS_SEED) {
          const exists = loadedAccounts.some(
            (a) => safeLower(a.handle) === safeLower(seed.handle)
          );
          if (!exists) {
            const salt = generateSalt();
            const passwordHash = await hashPassword(seed.defaultPassword, salt);
            loadedAccounts.unshift({
              id: seed.id,
              username: seed.username,
              handle: seed.handle,
              email: seed.email,
              accountType: "official",
              subscribers: 0,
              bio: seed.bio,
              mood: seed.mood,
              presence: seed.presence,
              lastActive: "в сети",
              avatar: null,
              banner: seed.banner,
              friends: seed.friends,
              passwordHash,
              salt,
              saturnState: 1,
              createdAt: "основание",
            });
          }
        }

        if (cancelled) return;
        setAccounts(loadedAccounts);

        const rawSession = window.localStorage.getItem(SESSION_KEY);
        if (rawSession && loadedAccounts.some((a) => a.id === rawSession)) {
          setCurrentUserId(rawSession);
        }

        const rawLastLogin = window.localStorage.getItem(LAST_LOGIN_KEY);
        if (rawLastLogin) {
          setLoginIdentifier(rawLastLogin);
        }

        const rawData = window.localStorage.getItem(DATA_KEY);
        if (rawData) {
          const parsedData = JSON.parse(rawData);
          if (Array.isArray(parsedData.rooms) && parsedData.rooms.length > 0) {
            setRooms(parsedData.rooms);
          }
          if (Array.isArray(parsedData.posts)) {
            setPosts(
              parsedData.posts
                .filter((p: unknown): p is PostItem => !!p && typeof p === "object")
                .map((p: PostItem) => ({
                  ...p,
                  author: typeof p.author === "string" ? p.author : "Участник",
                  handle:
                    typeof p.handle === "string" && p.handle.trim()
                      ? p.handle
                      : "@user",
                  text: typeof p.text === "string" ? p.text : "",
                  comments: Array.isArray(p.comments) ? p.comments : [],
                }))
            );
          }
          if (Array.isArray(parsedData.messages)) {
            setMessages(
              parsedData.messages
                .filter((m: unknown): m is ChatMessage => !!m && typeof m === "object")
                .map((m: ChatMessage) => ({
                  ...m,
                  author: typeof m.author === "string" ? m.author : "Участник",
                  handle:
                    typeof m.handle === "string" && m.handle.trim()
                      ? m.handle
                      : "@user",
                  text: typeof m.text === "string" ? m.text : "",
                }))
            );
          }
          if (typeof parsedData.activeRoomId === "string") {
            setActiveRoomId(parsedData.activeRoomId);
          }
          if (
            parsedData.activeTab === "feed" ||
            parsedData.activeTab === "chat" ||
            parsedData.activeTab === "profile" ||
            parsedData.activeTab === "friends"
          ) {
            setActiveTab(parsedData.activeTab);
          }
        }
      } catch {
        // Игнорируем ошибки чтения хранилища
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    initStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // Игнорируем ошибки записи
    }
  }, [hydrated, accounts]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (currentUserId) {
        window.localStorage.setItem(SESSION_KEY, currentUserId);
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Игнорируем ошибки записи
    }
  }, [hydrated, currentUserId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        DATA_KEY,
        JSON.stringify({
          rooms,
          posts,
          messages,
          activeRoomId,
          activeTab,
        })
      );
    } catch {
      // Игнорируем ошибки записи
    }
  }, [hydrated, rooms, posts, messages, activeRoomId, activeTab]);

  const currentUser = useMemo(
    () => accounts.find((u) => u.id === currentUserId) ?? null,
    [accounts, currentUserId]
  );

  // В быстром переключении показываем только личные аккаунты (и текущий активный)
  const quickSwitchAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) => acc.accountType !== "official" || acc.id === currentUserId
      ),
    [accounts, currentUserId]
  );

  const currentUserHandle = currentUser?.handle ?? "";
  const currentUserHandleLower = safeLower(currentUserHandle);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    remoteAudioMapRef.current.forEach((audioEl) => {
      audioEl.muted = speakerMuted;
    });
  }, [speakerMuted]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileUsername(currentUser.username || "");
    setProfilePresence(currentUser.presence || "online");
    setProfileMood(currentUser.mood || "На орбите");
    setProfileBio(currentUser.bio || "");
    setProfileAvatar(currentUser.avatar ?? null);
    setProfileBanner(currentUser.banner ?? BANNER_PRESETS[0].gradient);
    setProfileNewPassword("");
    setProfileError(null);
  }, [currentUser]);

  useEffect(() => {
    if (!inVoiceCall) return;
    const timer = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inVoiceCall]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = micEnabled;
    }
  }, [micEnabled]);

  const cleanupVoiceSession = useCallback(
    (notifyPeer = true) => {
      if (rafLevelRef.current !== null) {
        window.cancelAnimationFrame(rafLevelRef.current);
        rafLevelRef.current = null;
      }
      analyserRef.current = null;

      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      if (manualPcRef.current) {
        manualPcRef.current.close();
        manualPcRef.current = null;
      }

      remoteAudioMapRef.current.forEach((el) => {
        el.srcObject = null;
        el.remove();
      });
      remoteAudioMapRef.current.clear();

      if (notifyPeer && broadcastRef.current) {
        try {
          const user = currentUserRef.current;
          const pkt: VoiceSignalPacket = {
            type: "leave",
            peerId: getLocalPeerId(),
            roomId: voiceRoomIdRef.current,
            username: user?.username || "Участник",
            handle: user?.handle || "@user",
          };
          broadcastRef.current.postMessage(pkt);
        } catch {
          // Игнорируем ошибки закрытого канала
        }
      }

      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }

      setRemotePeers({});
      setVoiceLevel(0);
      setCallSeconds(0);
      setInVoiceCall(false);
      setManualOfferText("");
      setManualAnswerInput("");
      setCopiedOffer(false);
    },
    [getLocalPeerId]
  );

  useEffect(() => {
    return () => {
      cleanupVoiceSession(false);
    };
  }, [cleanupVoiceSession]);

  const attachRemoteAudioStream = useCallback(
    (peerId: string, username: string, handle: string, stream: MediaStream) => {
      let audioEl = remoteAudioMapRef.current.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        remoteAudioMapRef.current.set(peerId, audioEl);
      }
      audioEl.muted = speakerMutedRef.current;
      audioEl.srcObject = stream;
      audioEl.play().catch(() => {});

      setRemotePeers((prev) => ({
        ...prev,
        [peerId]: {
          peerId,
          username,
          handle,
        },
      }));
    },
    []
  );

  const createPeerConnectionFor = useCallback(
    (
      remotePeerId: string,
      remoteUsername: string,
      remoteHandle: string,
      roomId: string,
      localStream: MediaStream
    ) => {
      const existing = peerConnectionsRef.current.get(remotePeerId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(remotePeerId, pc);

      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          attachRemoteAudioStream(
            remotePeerId,
            remoteUsername,
            remoteHandle,
            remoteStream
          );
        }
      };

      pc.onicecandidate = (event) => {
        const user = currentUserRef.current;
        if (event.candidate && broadcastRef.current && user) {
          const pkt: VoiceSignalPacket = {
            type: "ice",
            peerId: getLocalPeerId(),
            targetPeerId: remotePeerId,
            roomId,
            username: user.username,
            handle: user.handle || "@user",
            candidate: event.candidate.toJSON(),
          };
          broadcastRef.current.postMessage(pkt);
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          pc.close();
          peerConnectionsRef.current.delete(remotePeerId);
          const audioEl = remoteAudioMapRef.current.get(remotePeerId);
          if (audioEl) {
            audioEl.srcObject = null;
            audioEl.remove();
            remoteAudioMapRef.current.delete(remotePeerId);
          }
          setRemotePeers((prev) => {
            const copy = { ...prev };
            delete copy[remotePeerId];
            return copy;
          });
        }
      };

      return pc;
    },
    [attachRemoteAudioStream, getLocalPeerId]
  );

  const startVoiceLevelMeter = useCallback(
    (stream: MediaStream, monitorSelf: boolean) => {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return;

      const ctx = new AudioContextCtor();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      if (monitorSelf) {
        source.connect(ctx.destination);
      }

      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const pct = Math.min(100, Math.round(rms * 320));
        setVoiceLevel(pct);
        rafLevelRef.current = window.requestAnimationFrame(tick);
      };

      rafLevelRef.current = window.requestAnimationFrame(tick);
    },
    []
  );

  async function handleJoinVoiceChannel(targetRoomId: string) {
    if (!currentUser) return;
    setVoiceError(null);
    setVoiceStatus(null);

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setVoiceError(
        "Браузер не поддерживает getUserMedia или страница открыта не по HTTPS / localhost."
      );
      return;
    }

    cleanupVoiceSession(true);
    const myPeerId = getLocalPeerId();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      for (const track of stream.getAudioTracks()) {
        track.enabled = micEnabled;
      }

      localStreamRef.current = stream;
      voiceRoomIdRef.current = targetRoomId;
      setVoiceRoomId(targetRoomId);
      setCallSeconds(0);
      setInVoiceCall(true);
      setVoiceStatus(
        "Микрофон активен. Можно говорить в этой вкладке или открыть вторую вкладку Aura Space для теста звонка."
      );
      startVoiceLevelMeter(stream, selfMonitor);

      if (typeof window.BroadcastChannel === "function") {
        const bc = new BroadcastChannel(VOICE_CHANNEL_NAME);
        broadcastRef.current = bc;

        bc.onmessage = async (event: MessageEvent<VoiceSignalPacket>) => {
          const pkt = event.data;
          const activeUser = currentUserRef.current;
          if (!activeUser || !pkt || pkt.peerId === myPeerId) {
            return;
          }
          if (pkt.roomId !== targetRoomId) return;
          if (pkt.targetPeerId && pkt.targetPeerId !== myPeerId) {
            return;
          }

          if (pkt.type === "join") {
            setRemotePeers((prev) => ({
              ...prev,
              [pkt.peerId]: {
                peerId: pkt.peerId,
                username: pkt.username,
                handle: pkt.handle,
              },
            }));

            const pc = createPeerConnectionFor(
              pkt.peerId,
              pkt.username,
              pkt.handle,
              targetRoomId,
              stream
            );
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const offerPkt: VoiceSignalPacket = {
              type: "offer",
              peerId: myPeerId,
              targetPeerId: pkt.peerId,
              roomId: targetRoomId,
              username: activeUser.username,
              handle: activeUser.handle || "@user",
              sdp: pc.localDescription ?? offer,
            };
            bc.postMessage(offerPkt);
          } else if (pkt.type === "offer" && pkt.sdp) {
            const pc = createPeerConnectionFor(
              pkt.peerId,
              pkt.username,
              pkt.handle,
              targetRoomId,
              stream
            );
            await pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const ansPkt: VoiceSignalPacket = {
              type: "answer",
              peerId: myPeerId,
              targetPeerId: pkt.peerId,
              roomId: targetRoomId,
              username: activeUser.username,
              handle: activeUser.handle || "@user",
              sdp: pc.localDescription ?? answer,
            };
            bc.postMessage(ansPkt);
          } else if (pkt.type === "answer" && pkt.sdp) {
            const pc = peerConnectionsRef.current.get(pkt.peerId);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp));
            }
          } else if (pkt.type === "ice" && pkt.candidate) {
            const pc = peerConnectionsRef.current.get(pkt.peerId);
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(pkt.candidate));
              } catch {
                // Игнорируем дубликаты ICE-кандидатов
              }
            }
          } else if (pkt.type === "leave") {
            const pc = peerConnectionsRef.current.get(pkt.peerId);
            if (pc) {
              pc.close();
              peerConnectionsRef.current.delete(pkt.peerId);
            }
            const audioEl = remoteAudioMapRef.current.get(pkt.peerId);
            if (audioEl) {
              audioEl.srcObject = null;
              audioEl.remove();
              remoteAudioMapRef.current.delete(pkt.peerId);
            }
            setRemotePeers((prev) => {
              const copy = { ...prev };
              delete copy[pkt.peerId];
              return copy;
            });
          }
        };

        const joinPkt: VoiceSignalPacket = {
          type: "join",
          peerId: myPeerId,
          roomId: targetRoomId,
          username: currentUser.username,
          handle: currentUser.handle || "@user",
        };
        bc.postMessage(joinPkt);
      }
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: string }).name)
          : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceError(
          "Доступ к микрофону отклонён. Разреши микрофон в настройках браузера и попробуй снова."
        );
      } else if (name === "NotFoundError") {
        setVoiceError("Микрофон не найден на устройстве.");
      } else {
        setVoiceError(
          "Не удалось включить микрофон. Проверь подключение устройства и права браузера."
        );
      }
      cleanupVoiceSession(false);
    }
  }

  async function handleToggleSelfMonitor() {
    const next = !selfMonitor;
    setSelfMonitor(next);
    if (inVoiceCall && localStreamRef.current) {
      if (rafLevelRef.current !== null) {
        window.cancelAnimationFrame(rafLevelRef.current);
        rafLevelRef.current = null;
      }
      analyserRef.current = null;
      if (audioCtxRef.current) {
        await audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      startVoiceLevelMeter(localStreamRef.current, next);
    }
  }

  async function handleGenerateManualInvite() {
    if (!localStreamRef.current || !currentUser) return;
    setVoiceError(null);
    if (manualPcRef.current) {
      manualPcRef.current.close();
      manualPcRef.current = null;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    manualPcRef.current = pc;

    for (const track of localStreamRef.current.getAudioTracks()) {
      pc.addTrack(track, localStreamRef.current);
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        attachRemoteAudioStream(
          "manual-peer",
          "Собеседник",
          "@remote",
          stream
        );
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      const onState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", onState);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", onState);
      window.setTimeout(resolve, 1200);
    });

    setManualOfferText(JSON.stringify(pc.localDescription));
    setCopiedOffer(false);
  }

  async function handleApplyManualAnswer() {
    if (!manualPcRef.current || !manualAnswerInput.trim()) return;
    setVoiceError(null);
    try {
      const parsed = JSON.parse(
        manualAnswerInput.trim()
      ) as RTCSessionDescriptionInit;
      await manualPcRef.current.setRemoteDescription(
        new RTCSessionDescription(parsed)
      );
      setVoiceStatus("Соединение с собеседником установлено.");
    } catch {
      setVoiceError("Некорректный SDP-ответ. Вставь JSON-ответ собеседника.");
    }
  }

  function handleCopyOfferText() {
    if (!manualOfferText) return;
    navigator.clipboard?.writeText(manualOfferText).catch(() => {});
    setCopiedOffer(true);
    window.setTimeout(() => setCopiedOffer(false), 1800);
  }

  const accountByHandle = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const acc of accounts) {
      const key = safeLower(acc?.handle);
      if (key) {
        map.set(key, acc);
      }
    }
    return map;
  }, [accounts]);

  const knownHandlesSet = useMemo(() => {
    const set = new Set<string>(["@system_404"]);
    for (const acc of accounts) {
      const key = safeLower(acc?.handle);
      if (key) set.add(key);
    }
    for (const p of posts) {
      const key = safeLower(p?.handle);
      if (key) set.add(key);
    }
    return set;
  }, [accounts, posts]);

  const inspectedAccount = useMemo(() => {
    const target = safeLower(inspectedHandle);
    if (!target) return null;
    return accounts.find((u) => safeLower(u?.handle) === target) ?? null;
  }, [accounts, inspectedHandle]);

  const inspectedPosts = useMemo(() => {
    const targetHandle = safeLower(
      inspectedAccount?.handle ?? currentUser?.handle
    );
    if (!targetHandle) return [];
    return posts.filter((p) => safeLower(p?.handle) === targetHandle);
  }, [posts, inspectedAccount, currentUser]);

  const inspectedMessagesCount = useMemo(() => {
    const targetHandle = safeLower(
      inspectedAccount?.handle ?? currentUser?.handle
    );
    if (!targetHandle) return 0;
    return messages.filter((m) => safeLower(m?.handle) === targetHandle).length;
  }, [messages, inspectedAccount, currentUser]);

  const saturnState: SaturnState = currentUser?.saturnState ?? 1;

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? rooms[0] ?? DEFAULT_ROOMS[0],
    [rooms, activeRoomId]
  );

  const voiceRoom = useMemo(
    () => rooms.find((r) => r.id === voiceRoomId) ?? activeRoom,
    [rooms, voiceRoomId, activeRoom]
  );

  const roomPosts = useMemo(() => {
    const filtered = posts.filter((p) => p.roomId === activeRoom.id);
    const pinned = filtered.filter((p) => p.pinned);
    const regular = filtered.filter((p) => !p.pinned);
    return [...pinned, ...regular];
  }, [posts, activeRoom.id]);

  const roomMessages = useMemo(
    () => messages.filter((m) => m.roomId === activeRoom.id),
    [messages, activeRoom.id]
  );

  const pinnedRoomMessage = useMemo(
    () => roomMessages.find((m) => m.pinned) ?? null,
    [roomMessages]
  );

  function openUserProfile(handle: string) {
    setInspectedHandle(handle || null);
    setActiveTab("profile");
  }

  function touchCurrentUserActivity() {
    if (!currentUserId) return;
    const label = nowTimeLabel();
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUserId ? { ...acc, lastActive: label } : acc
      )
    );
  }

  function switchActiveAccount(accountId: string) {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;
    if (target.accountType === "official" && target.id !== currentUserId) {
      return;
    }
    setCurrentUserId(target.id);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === target.id ? { ...acc, lastActive: nowTimeLabel() } : acc
      )
    );
    setInspectedHandle(null);
    setProfileSaved(false);
    setProfileError(null);
    try {
      if (target.email) {
        window.localStorage.setItem(LAST_LOGIN_KEY, target.email);
      }
    } catch {
      // Игнорируем ошибки записи
    }
  }

  function updateCurrentUserSaturn(updater: (prev: SaturnState) => SaturnState) {
    if (!currentUserId) return;
    const label = nowTimeLabel();
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUserId
          ? {
              ...acc,
              saturnState: updater(acc.saturnState ?? 1),
              lastActive: label,
            }
          : acc
      )
    );
  }

  function bumpStreakOnActivity() {
    updateCurrentUserSaturn((prev) => {
      if (prev === "blackhole" || prev === "slow1") return 1;
      return prev + 1;
    });
  }

  function handleRevive() {
    updateCurrentUserSaturn(() => 1);
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    setProfileSaved(false);

    if (!file.type.startsWith("image/")) {
      setProfileError("Выбери файл изображения (PNG, JPG, GIF, WEBP).");
      return;
    }

    if (file.size > 1_500_000) {
      setProfileError("Картинка должна быть легче 1.5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProfileError(null);
    setProfileSaved(false);

    if (!file.type.startsWith("image/")) {
      setProfileError("Выбери файл изображения для баннера (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > MAX_BANNER_IMAGE_BYTES) {
      setProfileError("Обложка профиля должна быть легче 2 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileBanner(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handlePostImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPostError(null);

    if (!file.type.startsWith("image/")) {
      setPostError("Выбери файл фотографии или изображения (PNG, JPG, GIF, WEBP).");
      return;
    }

    if (file.size > MAX_POST_IMAGE_BYTES) {
      setPostError("Фотография должна быть легче 2.5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPostImage(reader.result);
        setPostImageUrl("");
        setShowImageUrlInput(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleApplyPostImageUrl() {
    setPostError(null);
    const trimmed = postImageUrl.trim();
    if (!trimmed) {
      setPostError("Вставь ссылку на изображение (http://, https:// или data:image/).");
      return;
    }
    const isHttp = /^https?:\/\/\S+/i.test(trimmed);
    const isDataImg = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed);
    if (!isHttp && !isDataImg) {
      setPostError("Ссылка должна начинаться с http:// или https://.");
      return;
    }
    setPostImage(trimmed);
    setShowImageUrlInput(false);
  }

  function handleClearPostImage() {
    setPostImage(null);
    setPostImageUrl("");
    setPostError(null);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setProfileError(null);
    setProfileSaved(false);

    const nextName = profileUsername.trim();
    const nextMood = profileMood.trim() || "На орбите";
    const nextBio = profileBio.trim();
    const nextPasswordRaw = profileNewPassword.trim();

    if (nextName.length < 2) {
      setProfileError("Имя должно быть не короче 2 символов.");
      return;
    }

    if (nextPasswordRaw && nextPasswordRaw.length < 6) {
      setProfileError("Новый пароль должен быть не короче 6 символов.");
      return;
    }

    let updatedSalt = currentUser.salt;
    let updatedPasswordHash = currentUser.passwordHash;
    if (nextPasswordRaw) {
      updatedSalt = generateSalt();
      updatedPasswordHash = await hashPassword(nextPasswordRaw, updatedSalt);
    }

    const activeHandleLower = safeLower(currentUser.handle);

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUser.id
          ? {
              ...acc,
              username: nextName,
              presence: profilePresence,
              lastActive: nowTimeLabel(),
              mood: nextMood,
              bio: nextBio,
              avatar: profileAvatar,
              banner: profileBanner,
              salt: updatedSalt,
              passwordHash: updatedPasswordHash,
            }
          : acc
      )
    );

    setPosts((prev) =>
      prev.map((post) => {
        const isPostAuthor =
          !!activeHandleLower && safeLower(post.handle) === activeHandleLower;
        return {
          ...post,
          author: isPostAuthor ? nextName : post.author,
          avatar: isPostAuthor ? profileAvatar : post.avatar,
          comments: (post.comments || []).map((c) =>
            !!activeHandleLower && safeLower(c.handle) === activeHandleLower
              ? { ...c, author: nextName, avatar: profileAvatar }
              : c
          ),
        };
      })
    );

    setMessages((prev) =>
      prev.map((msg) =>
        !!activeHandleLower && safeLower(msg.handle) === activeHandleLower
          ? { ...msg, author: nextName, avatar: profileAvatar }
          : msg
      )
    );

    setProfileNewPassword("");
    setProfileSaved(true);
  }

  function handleChangePresenceQuick(nextPresence: PresenceKind) {
    if (!currentUser) return;
    setProfilePresence(nextPresence);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUser.id
          ? { ...acc, presence: nextPresence, lastActive: nowTimeLabel() }
          : acc
      )
    );
  }

  function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setChannelError(null);

    const slug = normalizeChannelSlug(newChannelName);
    if (slug.length < 2) {
      setChannelError("Название канала должно быть не короче 2 символов.");
      return;
    }

    const exists = rooms.some(
      (r) => safeLower(r.name) === slug || r.id === slug
    );
    if (exists) {
      setChannelError(`Канал #${slug} уже существует.`);
      return;
    }

    const id = `room-${slug}-${Date.now()}`;
    const created: RoomItem = {
      id,
      name: slug,
      topic:
        newChannelTopic.trim() ||
        `Канал пользователя ${currentUser.username} (${currentUser.handle})`,
      ownerHandle: currentUser.handle,
    };

    setRooms((prev) => [...prev, created]);
    setActiveRoomId(id);
    setNewChannelName("");
    setNewChannelTopic("");
    setShowChannelForm(false);
    setInspectedHandle(null);
    if (activeTab === "profile" || activeTab === "friends") {
      setActiveTab("feed");
    }
    bumpStreakOnActivity();
  }

  function handleDeleteChannel(roomId: string) {
    if (DEFAULT_ROOMS.some((d) => d.id === roomId)) return;
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setPosts((prev) => prev.filter((p) => p.roomId !== roomId));
    setMessages((prev) => prev.filter((m) => m.roomId !== roomId));
    if (activeRoomId === roomId) {
      setActiveRoomId("general");
    }
  }

  function handleAddFriendByHandle(rawHandle: string) {
    if (!currentUser) return;
    setFriendMessage(null);

    const targetHandle = normalizeHandle(rawHandle);
    if (targetHandle.length < 3) {
      setFriendMessage("Введи корректный @handle.");
      return;
    }

    const targetLower = safeLower(targetHandle);
    if (targetLower === currentUserHandleLower) {
      setFriendMessage("Нельзя добавить самого себя в друзья.");
      return;
    }

    const currentFriends = Array.isArray(currentUser.friends)
      ? currentUser.friends
      : [];
    const alreadyFriend = currentFriends.some(
      (f) => safeLower(f) === targetLower
    );
    if (alreadyFriend) {
      setFriendMessage(`${targetHandle} уже в списке друзей.`);
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUser.id
          ? {
              ...acc,
              friends: [
                ...(Array.isArray(acc.friends) ? acc.friends : []),
                targetHandle,
              ],
            }
          : acc
      )
    );
    setFriendHandleInput("");
    setFriendMessage(`Добавлено в друзья: ${targetHandle}`);
  }

  function handleRemoveFriend(targetHandle: string) {
    if (!currentUser) return;
    const targetLower = safeLower(targetHandle);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === currentUser.id
          ? {
              ...acc,
              friends: (Array.isArray(acc.friends) ? acc.friends : []).filter(
                (f) => safeLower(f) !== targetLower
              ),
            }
          : acc
      )
    );
  }

  async function handleCreateExtraAccount(e: React.FormEvent) {
    e.preventDefault();
    setAddAccError(null);

    const cleanName = addAccUsername.trim();
    const cleanHandle = normalizeHandle(addAccHandle || cleanName);
    const cleanEmail = addAccEmail.trim().toLowerCase();

    if (cleanName.length < 2) {
      setAddAccError("Имя должно быть не короче 2 символов.");
      return;
    }
    if (cleanHandle.length < 3) {
      setAddAccError(
        "Укажи корректный @handle (минимум 2 латинских символа или цифр)."
      );
      return;
    }
    if (isReservedCreatorHandle(cleanHandle)) {
      setAddAccError(
        `Хэндл ${cleanHandle} зарезервирован за создателем Aura Space.`
      );
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAddAccError("Введи корректный email.");
      return;
    }
    if (addAccPassword.length < 6) {
      setAddAccError("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (addAccPassword !== addAccPasswordConfirm) {
      setAddAccError("Пароли не совпадают.");
      return;
    }

    const handleTaken = accounts.some(
      (a) => safeLower(a?.handle) === safeLower(cleanHandle)
    );
    if (handleTaken) {
      setAddAccError(`Хэндл ${cleanHandle} уже занят.`);
      return;
    }

    const emailTaken = accounts.some(
      (a) => safeLower(a?.email) === cleanEmail
    );
    if (emailTaken) {
      setAddAccError("Аккаунт с таким email уже зарегистрирован.");
      return;
    }

    setAddAccSubmitting(true);
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(addAccPassword, salt);
      const createdTime = nowTimeLabel();

      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        username: cleanName,
        handle: cleanHandle,
        email: cleanEmail,
        accountType: "personal",
        subscribers: 0,
        bio: "",
        mood: "На орбите",
        presence: "online",
        lastActive: createdTime,
        avatar: null,
        banner: BANNER_PRESETS[0].gradient,
        friends: [],
        passwordHash,
        salt,
        saturnState: 1,
        createdAt: createdTime,
      };

      setAccounts((prev) => [...prev, newUser]);
      setCurrentUserId(newUser.id);
      setLoginIdentifier(cleanEmail);
      try {
        window.localStorage.setItem(LAST_LOGIN_KEY, cleanEmail);
      } catch {
        // Игнорируем ошибки записи
      }
      setAddAccUsername("");
      setAddAccHandle("");
      setAddAccEmail("");
      setAddAccPassword("");
      setAddAccPasswordConfirm("");
      setShowAddAccountModal(false);
      setInspectedHandle(null);
    } finally {
      setAddAccSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const cleanName = regUsername.trim();
    const cleanHandle = normalizeHandle(regHandle || cleanName);
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanName.length < 2) {
      setAuthError("Имя должно быть не короче 2 символов.");
      return;
    }
    if (cleanHandle.length < 3) {
      setAuthError(
        "Укажи корректный @handle (минимум 2 латинских символа или цифр)."
      );
      return;
    }
    if (isReservedCreatorHandle(cleanHandle)) {
      setAuthError(
        `Хэндл ${cleanHandle} зарезервирован за создателем Aura Space.`
      );
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Введи корректный email.");
      return;
    }
    if (regPassword.length < 6) {
      setAuthError("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setAuthError("Пароли не совпадают.");
      return;
    }

    const handleTaken = accounts.some(
      (a) => safeLower(a?.handle) === safeLower(cleanHandle)
    );
    if (handleTaken) {
      setAuthError(`Хэндл ${cleanHandle} уже занят.`);
      return;
    }

    const emailTaken = accounts.some(
      (a) => safeLower(a?.email) === cleanEmail
    );
    if (emailTaken) {
      setAuthError("Аккаунт с таким email уже зарегистрирован.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(regPassword, salt);
      const createdTime = nowTimeLabel();

      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        username: cleanName,
        handle: cleanHandle,
        email: cleanEmail,
        accountType: "personal",
        subscribers: 0,
        bio: "",
        mood: "На орбите",
        presence: "online",
        lastActive: createdTime,
        avatar: null,
        banner: BANNER_PRESETS[0].gradient,
        friends: [],
        passwordHash,
        salt,
        saturnState: 1,
        createdAt: createdTime,
      };

      setAccounts((prev) => [...prev, newUser]);
      setCurrentUserId(newUser.id);
      setLoginIdentifier(cleanEmail);
      try {
        window.localStorage.setItem(LAST_LOGIN_KEY, cleanEmail);
      } catch {
        // Игнорируем ошибки записи
      }
      setInspectedHandle(null);
      setActiveTab("feed");
      setRegUsername("");
      setRegHandle("");
      setRegEmail("");
      setRegPassword("");
      setRegPasswordConfirm("");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const rawId = loginIdentifier.trim().toLowerCase();
    const normalizedIdHandle = normalizeHandle(rawId);

    if (!rawId || !loginPassword) {
      setAuthError("Введи email, @handle или имя и пароль.");
      return;
    }

    const found = accounts.find(
      (a) =>
        safeLower(a?.email) === rawId ||
        safeLower(a?.username).trim() === rawId ||
        safeLower(a?.handle) === rawId ||
        (!!normalizedIdHandle &&
          safeLower(a?.handle) === safeLower(normalizedIdHandle))
    );

    if (!found) {
      setAuthError("Аккаунт с такими данными не найден.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const candidateHash = await hashPassword(loginPassword, found.salt);
      if (candidateHash !== found.passwordHash) {
        setAuthError("Неверный пароль.");
        return;
      }

      setCurrentUserId(found.id);
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === found.id ? { ...acc, lastActive: nowTimeLabel() } : acc
        )
      );
      setLoginIdentifier(found.email || found.handle);
      try {
        if (found.email) {
          window.localStorage.setItem(LAST_LOGIN_KEY, found.email);
        }
      } catch {
        // Игнорируем ошибки записи
      }
      setInspectedHandle(null);
      setActiveTab("feed");
      setLoginPassword("");
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleLogout() {
    cleanupVoiceSession(true);
    if (currentUser?.email) {
      setLoginIdentifier(currentUser.email);
      try {
        window.localStorage.setItem(LAST_LOGIN_KEY, currentUser.email);
      } catch {
        // Игнорируем ошибки записи
      }
    }
    setCurrentUserId(null);
    setShowAddAccountModal(false);
    setAuthMode("login");
    setInspectedHandle(null);
    setAuthError(null);
  }

  function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setPostError(null);

    const clean = postInput.trim();
    if (!clean && !postImage) {
      setPostError("Напиши текст поста или прикрепи фотографию.");
      return;
    }

    const newPost: PostItem = {
      id: `post-${Date.now()}`,
      roomId: activeRoom.id,
      author: currentUser.username,
      handle: currentUser.handle || "@user",
      avatar: currentUser.avatar ?? null,
      text: clean,
      image: postImage,
      createdAt: nowTimeLabel(),
      likes: 0,
      likedByMe: false,
      reactions: {},
      comments: [],
    };

    setPosts((prev) => [newPost, ...prev]);
    setPostInput("");
    setPostImage(null);
    setPostImageUrl("");
    setShowImageUrlInput(false);
    bumpStreakOnActivity();
  }

  function handleStartEditPost(post: PostItem) {
    setEditingPostId(post.id);
    setEditingPostText(post.text);
  }

  function handleSaveEditPost(postId: string) {
    const trimmed = editingPostText.trim();
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        if (!trimmed && !p.image && !p.repostOf) return p;
        return {
          ...p,
          text: trimmed,
          editedAt: nowTimeLabel(),
        };
      })
    );
    setEditingPostId(null);
    setEditingPostText("");
    touchCurrentUserActivity();
  }

  function handleTogglePinPost(postId: string) {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.roomId !== activeRoom.id) return p;
        if (p.id === postId) {
          return { ...p, pinned: !p.pinned };
        }
        return { ...p, pinned: false };
      })
    );
    touchCurrentUserActivity();
  }

  function handleTogglePostReaction(postId: string, emoji: ReactionEmoji) {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              reactions: toggleReactionMap(
                p.reactions,
                emoji,
                currentUser.handle || "@user"
              ),
            }
          : p
      )
    );
    touchCurrentUserActivity();
  }

  function handleOpenRepost(post: PostItem) {
    const alternativeRoom =
      rooms.find((r) => r.id !== post.roomId)?.id ?? activeRoom.id;
    setRepostingPost(post);
    setRepostTargetRoomId(alternativeRoom);
    setRepostNote("");
  }

  function handleConfirmRepost(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !repostingPost) return;

    const source = repostingPost.repostOf
      ? repostingPost.repostOf
      : {
          originalPostId: repostingPost.id,
          originalRoomId: repostingPost.roomId,
          author: repostingPost.author,
          handle: repostingPost.handle,
          text: repostingPost.text,
          image: repostingPost.image ?? null,
          createdAt: repostingPost.createdAt,
        };

    const newPost: PostItem = {
      id: `post-${Date.now()}`,
      roomId: repostTargetRoomId,
      author: currentUser.username,
      handle: currentUser.handle || "@user",
      avatar: currentUser.avatar ?? null,
      text: repostNote.trim(),
      image: null,
      createdAt: nowTimeLabel(),
      likes: 0,
      likedByMe: false,
      reactions: {},
      repostOf: source,
      comments: [],
    };

    setPosts((prev) => [newPost, ...prev]);
    setActiveRoomId(repostTargetRoomId);
    setActiveTab("feed");
    setRepostingPost(null);
    setRepostNote("");
    bumpStreakOnActivity();
  }

  function handleToggleLike(postId: string) {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextLiked = !post.likedByMe;
        return {
          ...post,
          likedByMe: nextLiked,
          likes: nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
        };
      })
    );
    touchCurrentUserActivity();
  }

  function handleDeletePost(postId: string) {
    if (!currentUser) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (editingPostId === postId) {
      setEditingPostId(null);
    }
  }

  function handleAddComment(e: React.FormEvent, postId: string) {
    e.preventDefault();
    if (!currentUser) return;
    const draft = (commentDrafts[postId] ?? "").trim();
    if (!draft) return;

    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      author: currentUser.username,
      handle: currentUser.handle || "@user",
      avatar: currentUser.avatar ?? null,
      text: draft,
      createdAt: nowTimeLabel(),
    };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments: [...(post.comments || []), newComment] }
          : post
      )
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setOpenComments((prev) => ({ ...prev, [postId]: true }));
    bumpStreakOnActivity();
  }

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    const clean = chatInput.trim();
    if (!clean) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      roomId: activeRoom.id,
      author: currentUser.username,
      handle: currentUser.handle || "@user",
      avatar: currentUser.avatar ?? null,
      text: clean,
      createdAt: nowTimeLabel(),
      reactions: {},
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInput("");
    bumpStreakOnActivity();
  }

  function handleStartEditMessage(msg: ChatMessage) {
    setEditingMsgId(msg.id);
    setEditingMsgText(msg.text);
  }

  function handleSaveEditMessage(msgId: string) {
    const trimmed = editingMsgText.trim();
    if (!trimmed) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, text: trimmed, editedAt: nowTimeLabel() }
          : m
      )
    );
    setEditingMsgId(null);
    setEditingMsgText("");
    touchCurrentUserActivity();
  }

  function handleTogglePinMessage(msgId: string) {
    if (!currentUser) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.roomId !== activeRoom.id) return m;
        if (m.id === msgId) {
          return { ...m, pinned: !m.pinned };
        }
        return { ...m, pinned: false };
      })
    );
    touchCurrentUserActivity();
  }

  function handleToggleMessageReaction(msgId: string, emoji: ReactionEmoji) {
    if (!currentUser) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              reactions: toggleReactionMap(
                m.reactions,
                emoji,
                currentUser.handle || "@user"
              ),
            }
          : m
      )
    );
    touchCurrentUserActivity();
  }

  function handleDeleteMessage(msgId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (editingMsgId === msgId) {
      setEditingMsgId(null);
    }
  }

  const displayedProfileUser = inspectedAccount ?? currentUser;
  const isOwnProfile =
    !!currentUser &&
    !!displayedProfileUser &&
    currentUser.id === displayedProfileUser.id;

  const knownCommunityHandles = useMemo(() => {
    const map = new Map<
      string,
      {
        username: string;
        handle: string;
        avatar: string | null;
        accountType: AccountKind;
        subscribers: number;
        presence: PresenceKind;
      }
    >();
    for (const acc of accounts) {
      const key = safeLower(acc?.handle);
      if (!key) continue;
      map.set(key, {
        username: acc.username,
        handle: acc.handle,
        avatar: acc.avatar ?? null,
        accountType: acc.accountType,
        subscribers: acc.subscribers ?? 0,
        presence: acc.presence || "online",
      });
    }
    for (const p of posts) {
      const key = safeLower(p?.handle);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          username: p.author,
          handle: p.handle,
          avatar: p.avatar ?? null,
          accountType: "personal",
          subscribers: 0,
          presence: "orbit",
        });
      }
    }
    return Array.from(map.values());
  }, [accounts, posts]);

  const remotePeerList = useMemo(
    () => Object.values(remotePeers),
    [remotePeers]
  );

  return (
    <main className="min-h-screen bg-[#090414] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Верхняя панель */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-fuchsia-500/20 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setInspectedHandle(null);
                setActiveTab("feed");
              }}
              className="bg-gradient-to-r from-[#E0AAFF] via-[#FF70B8] to-[#FF2A85] bg-clip-text text-3xl font-black tracking-tight text-transparent text-left"
            >
              Aura Space
            </button>
            <span className="rounded-full border border-fuchsia-500/30 bg-[#140D2B] px-2.5 py-0.5 text-[11px] font-semibold text-pink-200">
              {rooms.length} кан. • {accounts.length} акк. • {posts.length} постов
            </span>
          </div>

          {currentUser ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {quickSwitchAccounts.length > 1 && (
                <div className="flex items-center gap-1 rounded-xl border border-purple-500/30 bg-[#090414] p-1">
                  <Repeat className="ml-1.5 h-3.5 w-3.5 text-pink-300" />
                  {quickSwitchAccounts.map((acc) => {
                    const active = acc.id === currentUser.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => switchActiveAccount(acc.id)}
                        title={`${acc.username} (${acc.handle})`}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          active
                            ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                            : "text-purple-200/80 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <AvatarBadge
                          name={acc.username}
                          src={acc.avatar}
                          size="sm"
                          presence={acc.presence}
                        />
                        <span className="max-w-[90px] truncate">{acc.handle}</span>
                        <VerifiedBadge account={acc} size="sm" />
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setAddAccError(null);
                  setShowAddAccountModal((v) => !v);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-pink-400/40 bg-[#24103B] px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#331552]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                + Личный аккаунт
              </button>

              <button
                type="button"
                onClick={() => {
                  setInspectedHandle(null);
                  setActiveTab("profile");
                }}
                className="flex items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-[#140D2B] px-2.5 py-1 text-xs hover:border-pink-400/70 transition"
              >
                <AvatarBadge
                  name={currentUser.username}
                  src={currentUser.avatar}
                  size="sm"
                  presence={currentUser.presence}
                />
                <span className="font-bold text-white">{currentUser.username}</span>
                <VerifiedBadge account={currentUser} size="sm" />
                <span className="text-pink-300">{currentUser.handle}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-pink-200">
                  {accountBadgeLabel(currentUser.accountType)}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-[#240B20] px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-[#36102F]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                }}
                className={`rounded-xl px-3.5 py-1.5 font-bold transition ${
                  authMode === "login"
                    ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                    : "border border-purple-500/30 bg-[#140D2B] text-purple-200 hover:text-white"
                }`}
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                }}
                className={`rounded-xl px-3.5 py-1.5 font-bold transition ${
                  authMode === "register"
                    ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                    : "border border-purple-500/30 bg-[#140D2B] text-purple-200 hover:text-white"
                }`}
              >
                Создать аккаунт
              </button>
            </div>
          )}
        </header>

        {/* Панель активного голосового звонка */}
        {currentUser && (inVoiceCall || voiceError) && (
          <section className="rounded-2xl border border-emerald-400/35 bg-[#120D29]/95 p-4 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    inVoiceCall
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  <PhoneCall className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-white">
                    <span>
                      {inVoiceCall
                        ? `Голосовой эфир в #${voiceRoom.name}`
                        : "Голосовой чат"}
                    </span>
                    {inVoiceCall && (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                        {formatCallDuration(callSeconds)}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-pink-300">
                      Собеседников в эфире: {remotePeerList.length}
                    </span>
                  </div>
                  {voiceStatus && (
                    <p className="text-xs text-purple-200/75">{voiceStatus}</p>
                  )}
                </div>
              </div>

              {inVoiceCall && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMicEnabled((m) => !m)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      micEnabled
                        ? "border-emerald-400/35 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50"
                        : "border-amber-400/40 bg-amber-950/50 text-amber-200"
                    }`}
                  >
                    {micEnabled ? (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        Микрофон вкл
                      </>
                    ) : (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        Микрофон выкл
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpeakerMuted((s) => !s)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      !speakerMuted
                        ? "border-purple-500/35 bg-[#1C123B] text-purple-100 hover:border-pink-400/50"
                        : "border-rose-400/40 bg-rose-950/50 text-rose-200"
                    }`}
                  >
                    {!speakerMuted ? (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-pink-300" />
                        Звук вкл
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-3.5 w-3.5" />
                        Звук выкл
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSelfMonitor}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selfMonitor
                        ? "border-pink-400/50 bg-[#FF2A85]/25 text-white"
                        : "border-purple-500/30 bg-[#090414] text-purple-200/80 hover:text-white"
                    }`}
                  >
                    {selfMonitor ? "Слышу себя: да" : "Прослушать себя"}
                  </button>

                  <button
                    type="button"
                    onClick={() => cleanupVoiceSession(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-rose-500"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    Выйти
                  </button>
                </div>
              )}
            </div>

            {voiceError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2 text-xs font-semibold text-rose-200">
                {voiceError}
              </div>
            )}

            {inVoiceCall && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-purple-500/25 bg-[#090414]/90 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-pink-200">
                      Уровень микрофона ({currentUser.username})
                    </span>
                    <span className="text-purple-300/75">
                      {!micEnabled
                        ? "Заглушён"
                        : voiceLevel > 12
                        ? "Говорит"
                        : "Тишина"}
                    </span>
                  </div>
                  <VoiceLevelBar level={micEnabled ? voiceLevel : 0} />

                  {remotePeerList.length > 0 && (
                    <div className="border-t border-purple-500/15 pt-2 space-y-1.5">
                      <div className="text-[11px] font-bold text-purple-300/75">
                        Подключённые собеседники:
                      </div>
                      {remotePeerList.map((peer) => (
                        <div
                          key={peer.peerId}
                          className="flex items-center justify-between rounded-lg bg-[#140D2B] px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-bold text-white">
                            {peer.username}{" "}
                            <span className="text-pink-300">{peer.handle}</span>
                          </span>
                          <span className="text-[11px] text-emerald-300">
                            {speakerMuted ? "Звук выкл" : "Аудио идёт"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <details className="rounded-xl border border-purple-500/25 bg-[#090414]/90 p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-pink-200">
                    Звонок с другого устройства / браузера (SDP)
                  </summary>
                  <div className="mt-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={handleGenerateManualInvite}
                      className="rounded-lg bg-[#FF2A85]/25 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#FF2A85]/40"
                    >
                      Создать код приглашения
                    </button>

                    {manualOfferText && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-purple-300/80">
                            Код приглашения:
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyOfferText}
                            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-white/15"
                          >
                            {copiedOffer ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-300" />
                                Скопировано
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Копировать
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={2}
                          value={manualOfferText}
                          className="w-full rounded-lg border border-purple-500/25 bg-[#140D2B] p-2 text-[11px] text-purple-100 outline-none"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualAnswerInput}
                        onChange={(e) => setManualAnswerInput(e.target.value)}
                        placeholder="Вставь JSON-ответ собеседника..."
                        className="flex-1 rounded-lg border border-purple-500/25 bg-[#140D2B] px-2.5 py-1.5 text-xs text-white placeholder-purple-300/35 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyManualAnswer}
                        className="rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Соединить
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </section>
        )}

        {/* Блок добавления дополнительного личного аккаунта без выхода */}
        {currentUser && showAddAccountModal && (
          <section className="rounded-2xl border border-pink-400/35 bg-[#140D2B]/95 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-pink-300">
                  Добавить личный аккаунт
                </h3>
                <p className="text-xs text-purple-200/75">
                  Регистрация доступна только для личных аккаунтов.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="rounded-lg p-1.5 text-purple-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {addAccError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2 text-xs font-semibold text-rose-200">
                {addAccError}
              </div>
            )}

            <form onSubmit={handleCreateExtraAccount} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-bold text-pink-200">Имя</span>
                  <input
                    type="text"
                    value={addAccUsername}
                    onChange={(e) => setAddAccUsername(e.target.value)}
                    placeholder="Имя аккаунта"
                    maxLength={28}
                    className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-bold text-pink-200">Хэндл (@handle)</span>
                  <input
                    type="text"
                    value={addAccHandle}
                    onChange={(e) => setAddAccHandle(e.target.value)}
                    placeholder="@personal_handle"
                    maxLength={20}
                    className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-bold text-pink-200">Email</span>
                  <input
                    type="email"
                    value={addAccEmail}
                    onChange={(e) => setAddAccEmail(e.target.value)}
                    placeholder="second@example.com"
                    className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs">
                  <span className="font-bold text-pink-200">Пароль</span>
                  <input
                    type="password"
                    value={addAccPassword}
                    onChange={(e) => setAddAccPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-bold text-pink-200">Повтор пароля</span>
                  <input
                    type="password"
                    value={addAccPasswordConfirm}
                    onChange={(e) => setAddAccPasswordConfirm(e.target.value)}
                    placeholder="Ещё раз пароль"
                    className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="rounded-xl border border-purple-500/30 bg-[#090414] px-4 py-2 text-xs font-bold text-purple-200 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addAccSubmitting}
                  className="rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {addAccSubmitting ? "Создаём..." : "Создать личный аккаунт"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Если пользователь не вошёл — вход или регистрация */}
        {!currentUser ? (
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[300px_1fr]">
            <aside>
              <SaturnMascot state={1} onRevive={() => {}} />
            </aside>

            <section className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-6 space-y-5">
              <div className="flex gap-2 rounded-xl border border-purple-500/25 bg-[#090414] p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                    authMode === "login"
                      ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                      : "text-purple-200/75 hover:text-white"
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Войти в аккаунт
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                    authMode === "register"
                      ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                      : "text-purple-200/75 hover:text-white"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Новый аккаунт
                </button>
              </div>

              {authError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  {authError}
                </div>
              )}

              {authMode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <label className="block space-y-1.5 text-xs">
                    <span className="font-bold text-pink-200">
                      Email, @handle или имя
                    </span>
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="@system_404 или email"
                      className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs">
                    <span className="font-bold text-pink-200">Пароль</span>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Введите пароль"
                      className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                  >
                    {authSubmitting ? "Входим..." : "Войти в Aura Space"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="rounded-xl border border-purple-500/20 bg-[#090414]/80 px-3.5 py-2 text-xs text-purple-200/80">
                    Создаётся личный аккаунт участника Aura Space.
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-pink-200">Имя</span>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Твоё имя"
                        maxLength={28}
                        className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                      />
                    </label>

                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-pink-200">Хэндл (@handle)</span>
                      <input
                        type="text"
                        value={regHandle}
                        onChange={(e) => setRegHandle(e.target.value)}
                        placeholder="@my_handle"
                        maxLength={20}
                        className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5 text-xs">
                    <span className="font-bold text-pink-200">Email</span>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-pink-200">Пароль</span>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Минимум 6 символов"
                        className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                      />
                    </label>

                    <label className="block space-y-1.5 text-xs">
                      <span className="font-bold text-pink-200">Повтор пароля</span>
                      <input
                        type="password"
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        placeholder="Ещё раз пароль"
                        className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2.5 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                  >
                    {authSubmitting
                      ? "Создаём аккаунт..."
                      : "Зарегистрироваться в Aura Space"}
                  </button>
                </form>
              )}

              {accounts.filter((a) => a.accountType !== "official").length > 0 && (
                <div className="border-t border-purple-500/20 pt-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300/75">
                    Выбрать сохранённый личный аккаунт для входа
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accounts
                      .filter((a) => a.accountType !== "official")
                      .map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAuthMode("login");
                            setLoginIdentifier(acc.email);
                            setAuthError(null);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-[#090414] px-2.5 py-1 text-xs text-purple-100 hover:border-pink-400/60"
                        >
                          <AvatarBadge
                            name={acc.username}
                            src={acc.avatar}
                            size="sm"
                            presence={acc.presence}
                          />
                          {acc.username}{" "}
                          <VerifiedBadge account={acc} size="sm" />
                          <span className="text-pink-300">{acc.handle}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Авторизованный рабочий экран Aura Space */
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-5">
              <SaturnMascot state={saturnState} onRevive={handleRevive} />

              {/* Карточка текущего профиля + переключатель статуса активности */}
              <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarBadge
                      name={currentUser.username}
                      src={currentUser.avatar}
                      size="md"
                      presence={currentUser.presence}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-extrabold text-white">
                          {currentUser.username}
                        </span>
                        <VerifiedBadge account={currentUser} size="sm" />
                        <span className="shrink-0 rounded bg-[#FF2A85]/20 px-1.5 py-0.5 text-[10px] font-bold text-pink-200">
                          {accountBadgeLabel(currentUser.accountType)}
                        </span>
                      </div>
                      <div className="truncate text-xs font-semibold text-pink-300">
                        {currentUser.handle} •{" "}
                        {formatSubscribers(currentUser.subscribers)} подп.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedHandle(null);
                      setActiveTab("profile");
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-pink-400/35 bg-[#24103B] px-2.5 py-1 text-[11px] font-bold text-pink-200 hover:bg-[#331552]"
                  >
                    <Edit3 className="h-3 w-3" />
                    Профиль
                  </button>
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-purple-500/20 bg-[#090414] p-1">
                  {(Object.keys(PRESENCE_META) as PresenceKind[]).map((key) => {
                    const active = currentUser.presence === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleChangePresenceQuick(key)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-bold transition ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-purple-300/65 hover:text-white"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${PRESENCE_META[key].dotClass}`}
                        />
                        {PRESENCE_META[key].label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-purple-200">
                    {currentUser.mood || "На орбите"}
                  </span>
                  <span className="text-purple-300/65">
                    активность: {currentUser.lastActive}
                  </span>
                </div>

                {currentUser.bio ? (
                  <p className="text-xs leading-relaxed text-purple-200/80">
                    {currentUser.bio}
                  </p>
                ) : (
                  <p className="text-xs italic text-purple-300/50">
                    Описание профиля ещё не заполнено
                  </p>
                )}

                {quickSwitchAccounts.length > 0 && (
                  <div className="border-t border-purple-500/20 pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-purple-300/75">
                      <span>Мои аккаунты ({quickSwitchAccounts.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddAccError(null);
                          setShowAddAccountModal(true);
                        }}
                        className="text-pink-300 hover:underline"
                      >
                        + Ещё
                      </button>
                    </div>
                    <div className="space-y-1">
                      {quickSwitchAccounts.map((acc) => {
                        const isCurrent = acc.id === currentUser.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => switchActiveAccount(acc.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition ${
                              isCurrent
                                ? "border border-pink-400/40 bg-gradient-to-r from-[#9D4EDD]/30 to-[#FF2A85]/20 text-white"
                                : "border border-transparent bg-[#090414]/60 text-purple-200/80 hover:border-purple-500/30 hover:text-white"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <AvatarBadge
                                name={acc.username}
                                src={acc.avatar}
                                size="sm"
                                presence={acc.presence}
                              />
                              <span className="truncate font-bold">
                                {acc.username}
                              </span>
                              <VerifiedBadge account={acc} size="sm" />
                              <span className="truncate text-[11px] text-pink-300">
                                {acc.handle}
                              </span>
                            </span>
                            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-pink-200">
                              {isCurrent
                                ? "Активен"
                                : accountBadgeLabel(acc.accountType)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Каналы + создание своего канала */}
              <div className="rounded-2xl border border-fuchsia-500/20 bg-[#140D2B]/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-300">
                    <Users className="h-3.5 w-3.5" />
                    Каналы
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChannelForm((v) => !v);
                      setChannelError(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-pink-400/35 bg-[#24103B] px-2 py-0.5 text-[11px] font-bold text-pink-200 hover:bg-[#331552]"
                  >
                    <Plus className="h-3 w-3" />
                    Создать
                  </button>
                </div>

                {showChannelForm && (
                  <form
                    onSubmit={handleCreateChannel}
                    className="rounded-xl border border-purple-500/25 bg-[#090414] p-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="название-канала"
                      maxLength={24}
                      className="w-full rounded-lg border border-purple-500/30 bg-[#140D2B] px-2.5 py-1.5 text-xs text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                    />
                    <input
                      type="text"
                      value={newChannelTopic}
                      onChange={(e) => setNewChannelTopic(e.target.value)}
                      placeholder="Тема канала (необязательно)"
                      maxLength={80}
                      className="w-full rounded-lg border border-purple-500/30 bg-[#140D2B] px-2.5 py-1.5 text-xs text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                    />
                    {channelError && (
                      <div className="text-[11px] font-semibold text-rose-300">
                        {channelError}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] py-1.5 text-xs font-bold text-white hover:brightness-110"
                    >
                      Добавить канал
                    </button>
                  </form>
                )}

                <div className="space-y-1">
                  {rooms.map((room) => {
                    const isContentView =
                      activeTab === "feed" || activeTab === "chat";
                    const selected = isContentView && room.id === activeRoom.id;
                    const isVoiceHere = inVoiceCall && voiceRoomId === room.id;
                    const countPosts = posts.filter(
                      (p) => p.roomId === room.id
                    ).length;
                    const countMsgs = messages.filter(
                      (m) => m.roomId === room.id
                    ).length;
                    const isCustom = !DEFAULT_ROOMS.some(
                      (d) => d.id === room.id
                    );

                    return (
                      <div
                        key={room.id}
                        className={`flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-sm transition ${
                          selected
                            ? "border border-pink-400/40 bg-gradient-to-r from-[#9D4EDD]/35 to-[#FF2A85]/25 text-white"
                            : "border border-transparent text-purple-200/80 hover:bg-white/5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRoomId(room.id);
                            setInspectedHandle(null);
                            if (
                              activeTab === "profile" ||
                              activeTab === "friends"
                            ) {
                              setActiveTab("feed");
                            }
                          }}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-semibold">
                            <Hash className="h-4 w-4 shrink-0 text-pink-400" />
                            <span className="truncate">{room.name}</span>
                            {isVoiceHere && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                голос
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-[11px] text-purple-300/80">
                            {countPosts}п • {countMsgs}ч
                          </span>
                        </button>

                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(room.id)}
                            title="Удалить канал"
                            className="rounded-lg p-1 text-purple-300/50 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="space-y-5">
              {/* Шапка и переключение Лента / Чат / Друзья / Профиль + кнопка Голоса */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/20 bg-[#140D2B]/85 p-4">
                <div>
                  <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-white">
                    {activeTab === "profile" ? (
                      <>
                        <UserCheck className="h-5 w-5 text-[#FF70B8]" />
                        {displayedProfileUser ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span>{displayedProfileUser.username}</span>
                            <VerifiedBadge
                              account={displayedProfileUser}
                              size="md"
                            />
                            <span className="text-pink-300">
                              ({displayedProfileUser.handle})
                            </span>
                          </span>
                        ) : (
                          inspectedHandle || "Профиль"
                        )}
                      </>
                    ) : activeTab === "friends" ? (
                      <>
                        <Users className="h-5 w-5 text-[#FF70B8]" />
                        Друзья ({(currentUser.friends || []).length})
                      </>
                    ) : (
                      <>
                        <Hash className="h-5 w-5 text-[#FF70B8]" />
                        {activeRoom.name}
                      </>
                    )}
                  </h2>
                  <p className="text-xs text-purple-200/75">
                    {activeTab === "profile"
                      ? isOwnProfile
                        ? "Обложка, аватарка, статус активности и посты твоего аккаунта"
                        : "Профиль участника Aura Space"
                      : activeTab === "friends"
                      ? "Добавление друзей по @handle и список участников"
                      : activeRoom.topic}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (inVoiceCall && voiceRoomId === activeRoom.id) {
                        cleanupVoiceSession(true);
                      } else {
                        handleJoinVoiceChannel(activeRoom.id);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                      inVoiceCall && voiceRoomId === activeRoom.id
                        ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                        : "border border-pink-400/35 bg-[#24103B] text-pink-200 hover:bg-[#331552]"
                    }`}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    {inVoiceCall && voiceRoomId === activeRoom.id
                      ? "В голосе"
                      : "Голосовой чат"}
                  </button>

                  <div className="flex flex-wrap rounded-xl border border-purple-500/30 bg-[#090414] p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedHandle(null);
                        setActiveTab("feed");
                      }}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        activeTab === "feed"
                          ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                          : "text-purple-200/80 hover:text-white"
                      }`}
                    >
                      Лента ({roomPosts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedHandle(null);
                        setActiveTab("chat");
                      }}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        activeTab === "chat"
                          ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                          : "text-purple-200/80 hover:text-white"
                      }`}
                    >
                      Чат ({roomMessages.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedHandle(null);
                        setActiveTab("friends");
                        setFriendMessage(null);
                      }}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        activeTab === "friends"
                          ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                          : "text-purple-200/80 hover:text-white"
                      }`}
                    >
                      Друзья ({(currentUser.friends || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedHandle(null);
                        setActiveTab("profile");
                      }}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        activeTab === "profile"
                          ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                          : "text-purple-200/80 hover:text-white"
                      }`}
                    >
                      Профиль
                    </button>
                  </div>
                </div>
              </div>

              {activeTab === "friends" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-5 space-y-4">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                      Добавить друга по @handle
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddFriendByHandle(friendHandleInput);
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      <input
                        type="text"
                        value={friendHandleInput}
                        onChange={(e) => setFriendHandleInput(e.target.value)}
                        placeholder="@system_404 или handle"
                        className="min-w-[200px] flex-1 rounded-xl border border-purple-500/30 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white shadow-md hover:brightness-110"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Добавить в друзья
                      </button>
                    </form>

                    {friendMessage && (
                      <div className="rounded-xl border border-fuchsia-500/30 bg-[#090414] px-3.5 py-2 text-xs font-semibold text-pink-200">
                        {friendMessage}
                      </div>
                    )}
                  </div>

                  {/* Список моих друзей */}
                  <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-5 space-y-3">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                      Мои друзья ({(currentUser.friends || []).length})
                    </div>
                    {(currentUser.friends || []).length === 0 ? (
                      <p className="text-sm text-purple-200/70">
                        Список друзей пока пуст. Добавь кого-нибудь по @handle выше или из участников ниже.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(currentUser.friends || []).map((fHandle) => {
                          const acc = accounts.find(
                            (a) => safeLower(a?.handle) === safeLower(fHandle)
                          );
                          const displayName = acc?.username ?? fHandle;
                          const displayAvatar = acc?.avatar ?? null;
                          const presence = acc?.presence ?? "orbit";

                          return (
                            <div
                              key={fHandle}
                              className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-[#090414]/90 p-3"
                            >
                              <button
                                type="button"
                                onClick={() => openUserProfile(fHandle)}
                                className="flex min-w-0 items-center gap-2.5 text-left"
                              >
                                <AvatarBadge
                                  name={displayName}
                                  src={displayAvatar}
                                  size="md"
                                  presence={presence}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 truncate text-sm font-bold text-white hover:text-[#FF70B8]">
                                    <span className="truncate">{displayName}</span>
                                    <VerifiedBadge account={acc} size="sm" />
                                  </div>
                                  <div className="truncate text-xs text-pink-300">
                                    {fHandle} • {PRESENCE_META[presence].label}
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveFriend(fHandle)}
                                title="Удалить из друзей"
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-900/40"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                Убрать
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Участники в базе и ленте */}
                  <div className="rounded-2xl border border-fuchsia-500/20 bg-[#140D2B]/80 p-5 space-y-3">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                      Участники Aura Space
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {knownCommunityHandles
                        .filter(
                          (u) => safeLower(u.handle) !== currentUserHandleLower
                        )
                        .map((person) => {
                          const isFriend = (
                            currentUser.friends || []
                          ).some((f) => safeLower(f) === safeLower(person.handle));

                          return (
                            <div
                              key={person.handle}
                              className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/15 bg-[#090414]/80 p-3"
                            >
                              <button
                                type="button"
                                onClick={() => openUserProfile(person.handle)}
                                className="flex min-w-0 items-center gap-2.5 text-left"
                              >
                                <AvatarBadge
                                  name={person.username}
                                  src={person.avatar}
                                  size="md"
                                  presence={person.presence}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 truncate text-sm font-bold text-white hover:text-[#FF70B8]">
                                    <span className="truncate">{person.username}</span>
                                    <VerifiedBadge
                                      account={{
                                        accountType: person.accountType,
                                        subscribers: person.subscribers,
                                      }}
                                      size="sm"
                                    />
                                  </div>
                                  <div className="truncate text-xs text-pink-300">
                                    {person.handle} •{" "}
                                    {PRESENCE_META[person.presence].label}
                                  </div>
                                </div>
                              </button>

                              {isFriend ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFriend(person.handle)}
                                  className="shrink-0 rounded-lg border border-purple-500/30 bg-white/5 px-2.5 py-1 text-xs font-semibold text-purple-200 hover:bg-white/10"
                                >
                                  В друзьях
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddFriendByHandle(person.handle)
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#FF2A85]/25 px-2.5 py-1 text-xs font-bold text-pink-200 hover:bg-[#FF2A85]/40"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Добавить
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : activeTab === "profile" ? (
                <div className="space-y-5">
                  {displayedProfileUser ? (
                    <div className="overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90">
                      {/* Обложка профиля (баннер) */}
                      {(() => {
                        const activeBanner = isOwnProfile
                          ? profileBanner
                          : displayedProfileUser.banner;
                        const isImageBanner =
                          !!activeBanner &&
                          (activeBanner.startsWith("data:image/") ||
                            activeBanner.startsWith("http"));
                        return (
                          <div
                            className="relative h-36 w-full border-b border-fuchsia-500/25 bg-[#090414] sm:h-44"
                            style={
                              isImageBanner
                                ? undefined
                                : {
                                    background:
                                      activeBanner || BANNER_PRESETS[0].gradient,
                                  }
                            }
                          >
                            {isImageBanner && (
                              <img
                                src={activeBanner}
                                alt="Обложка профиля"
                                className="h-full w-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#140D2B] via-transparent to-black/20" />
                            <div className="absolute right-3 top-3 flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${
                                  PRESENCE_META[
                                    displayedProfileUser.presence || "online"
                                  ].badgeClass
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    PRESENCE_META[
                                      displayedProfileUser.presence || "online"
                                    ].dotClass
                                  }`}
                                />
                                {
                                  PRESENCE_META[
                                    displayedProfileUser.presence || "online"
                                  ].label
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="p-5 space-y-5">
                        <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 border-b border-purple-500/20 pb-4">
                          <div className="flex flex-wrap items-end gap-3.5">
                            <div className="rounded-full bg-[#140D2B] p-1 shadow-xl">
                              <AvatarBadge
                                name={displayedProfileUser.username}
                                src={displayedProfileUser.avatar}
                                size="lg"
                                presence={displayedProfileUser.presence}
                              />
                            </div>
                            <div className="space-y-1 pt-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="flex items-center gap-1.5 text-xl font-black text-white">
                                  <span>{displayedProfileUser.username}</span>
                                  <VerifiedBadge
                                    account={displayedProfileUser}
                                    size="md"
                                  />
                                </h3>
                                <span className="rounded-full bg-[#FF2A85]/20 px-2.5 py-0.5 text-xs font-bold text-pink-200">
                                  {displayedProfileUser.handle}
                                </span>
                                <span className="rounded-full border border-pink-400/35 bg-[#24103B] px-2.5 py-0.5 text-xs font-bold text-pink-200">
                                  {accountBadgeLabel(
                                    displayedProfileUser.accountType
                                  )}
                                </span>
                                <span className="rounded-full border border-purple-500/30 bg-[#090414] px-2.5 py-0.5 text-xs text-purple-200">
                                  {displayedProfileUser.mood || "На орбите"}
                                </span>
                              </div>
                              <p className="text-xs text-purple-300/75">
                                Активность: {displayedProfileUser.lastActive} • В
                                сети с {displayedProfileUser.createdAt} •{" "}
                                {formatSubscribers(
                                  displayedProfileUser.subscribers
                                )}{" "}
                                подписчиков •{" "}
                                {(displayedProfileUser.friends || []).length}{" "}
                                друзей • {inspectedPosts.length} постов •{" "}
                                {inspectedMessagesCount} сообщений
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!isOwnProfile && (
                              <>
                                {(currentUser.friends || []).some(
                                  (f) =>
                                    safeLower(f) ===
                                    safeLower(displayedProfileUser.handle)
                                ) ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveFriend(
                                        displayedProfileUser.handle
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-900/40"
                                  >
                                    <UserMinus className="h-3.5 w-3.5" />
                                    Убрать из друзей
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddFriendByHandle(
                                        displayedProfileUser.handle
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    В друзья
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setInspectedHandle(null)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-1.5 text-xs font-bold text-purple-200 hover:border-pink-400/60"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  К моему профилю
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-purple-100">
                          {displayedProfileUser.bio ||
                            "Пользователь пока не добавил описание профиля."}
                        </p>

                        {isOwnProfile && (
                          <form
                            onSubmit={handleSaveProfile}
                            className="border-t border-purple-500/20 pt-4 space-y-4"
                          >
                            <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                              Редактировать профиль, обложку и статус
                            </div>

                            {profileError && (
                              <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2 text-xs font-semibold text-rose-200">
                                {profileError}
                              </div>
                            )}

                            {profileSaved && !profileError && (
                              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-200">
                                Профиль, обложка и аватарка сохранены.
                              </div>
                            )}

                            <div className="space-y-2.5 rounded-xl border border-purple-500/20 bg-[#090414]/80 p-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-pink-200">
                                  Обложка профиля (баннер)
                                </span>
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-pink-400/40 bg-[#24103B] px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#331552]">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  Загрузить картинку баннера
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBannerFileChange}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {BANNER_PRESETS.map((preset) => {
                                  const selected =
                                    profileBanner === preset.gradient;
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => {
                                        setProfileBanner(preset.gradient);
                                        setProfileSaved(false);
                                      }}
                                      className={`overflow-hidden rounded-xl border text-left transition ${
                                        selected
                                          ? "border-pink-400 ring-2 ring-pink-400/40"
                                          : "border-purple-500/25 opacity-80 hover:opacity-100"
                                      }`}
                                    >
                                      <div
                                        className="h-9 w-full"
                                        style={{ background: preset.gradient }}
                                      />
                                      <div className="bg-[#140D2B] px-2 py-1 text-[10px] font-semibold text-purple-100 truncate">
                                        {preset.label}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-purple-500/20 bg-[#090414]/80 p-3.5">
                              <AvatarBadge
                                name={profileUsername || currentUser.username}
                                src={profileAvatar}
                                size="lg"
                                presence={profilePresence}
                              />
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-pink-400/40 bg-[#24103B] px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#331552]">
                                    <Camera className="h-3.5 w-3.5" />
                                    Загрузить аватарку
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleAvatarFileChange}
                                      className="hidden"
                                    />
                                  </label>
                                  {profileAvatar && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProfileAvatar(null);
                                        setProfileSaved(false);
                                      }}
                                      className="rounded-xl border border-purple-500/30 bg-[#140D2B] px-3 py-1.5 text-xs font-semibold text-purple-200 hover:text-white"
                                    >
                                      Убрать фото
                                    </button>
                                  )}
                                </div>
                                <p className="text-[11px] text-purple-300/70">
                                  PNG, JPG, GIF или WEBP до 1.5 МБ. Отображается
                                  рядом с твоим именем везде.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <span className="block text-xs font-bold text-pink-200">
                                Индикатор активности
                              </span>
                              <div className="flex gap-2 rounded-xl border border-purple-500/25 bg-[#090414] p-1 text-xs font-bold">
                                {(
                                  Object.keys(PRESENCE_META) as PresenceKind[]
                                ).map((key) => (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                      setProfilePresence(key);
                                      setProfileSaved(false);
                                    }}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
                                      profilePresence === key
                                        ? "bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] text-white"
                                        : "text-purple-200/75 hover:text-white"
                                    }`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${PRESENCE_META[key].dotClass}`}
                                    />
                                    {PRESENCE_META[key].label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                              <label className="block space-y-1.5 text-xs">
                                <span className="font-bold text-pink-200">Имя</span>
                                <input
                                  type="text"
                                  value={profileUsername}
                                  onChange={(e) => {
                                    setProfileUsername(e.target.value);
                                    setProfileSaved(false);
                                  }}
                                  maxLength={28}
                                  className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white outline-none focus:border-pink-400/70"
                                />
                              </label>

                              <div className="block space-y-1.5 text-xs">
                                <span className="font-bold text-pink-200">
                                  Хэндл (@handle)
                                </span>
                                <div className="flex h-[38px] items-center rounded-xl border border-purple-500/20 bg-[#090414]/60 px-3 text-sm font-semibold text-pink-300/80">
                                  {currentUser.handle}
                                </div>
                              </div>

                              <label className="block space-y-1.5 text-xs">
                                <span className="font-bold text-pink-200">
                                  Текстовый статус
                                </span>
                                <input
                                  type="text"
                                  value={profileMood}
                                  onChange={(e) => {
                                    setProfileMood(e.target.value);
                                    setProfileSaved(false);
                                  }}
                                  maxLength={40}
                                  placeholder="На орбите"
                                  className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white outline-none focus:border-pink-400/70"
                                />
                              </label>
                            </div>

                            <label className="block space-y-1.5 text-xs">
                              <span className="font-bold text-pink-200">
                                О себе
                              </span>
                              <textarea
                                rows={3}
                                value={profileBio}
                                onChange={(e) => {
                                  setProfileBio(e.target.value);
                                  setProfileSaved(false);
                                }}
                                maxLength={240}
                                placeholder="Пара слов о себе, проектах или настроении..."
                                className="w-full resize-none rounded-xl border border-purple-500/30 bg-[#090414] p-3 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                              />
                            </label>

                            <label className="block space-y-1.5 text-xs">
                              <span className="font-bold text-pink-200">
                                Новый пароль (оставь пустым, если менять не нужно)
                              </span>
                              <input
                                type="password"
                                value={profileNewPassword}
                                onChange={(e) => {
                                  setProfileNewPassword(e.target.value);
                                  setProfileSaved(false);
                                }}
                                placeholder="Минимум 6 символов"
                                className="w-full rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-2 text-sm text-white placeholder-purple-300/35 outline-none focus:border-pink-400/70"
                              />
                            </label>

                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white shadow-md hover:brightness-110"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Сохранить профиль
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-extrabold text-white">
                            {inspectedHandle}
                          </h3>
                          <p className="text-xs text-purple-300/75">
                            Участник из ленты/чата (отдельный аккаунт ещё не создан)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedHandle(null)}
                          className="rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-1.5 text-xs font-bold text-purple-200 hover:border-pink-400/60"
                        >
                          К моему профилю
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Посты выбранного пользователя */}
                  <div className="space-y-3">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                      Публикации ({inspectedPosts.length})
                    </div>
                    {inspectedPosts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-purple-500/25 bg-[#140D2B]/50 p-6 text-center text-sm text-purple-200/70">
                        Пока нет опубликованных постов.
                      </div>
                    ) : (
                      inspectedPosts.map((post) => (
                        <article
                          key={post.id}
                          className="rounded-2xl border border-fuchsia-500/20 bg-[#140D2B]/85 p-4 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs text-purple-300/75">
                            <span className="inline-flex items-center gap-1 font-bold text-pink-200">
                              <span>
                                #{post.roomId} • {post.author}
                              </span>
                              <VerifiedBadge
                                account={accountByHandle.get(safeLower(post.handle))}
                                size="sm"
                              />
                              <span>({post.handle})</span>
                            </span>
                            <span>
                              {post.createdAt}
                              {post.editedAt ? ` (изм. ${post.editedAt})` : ""}
                            </span>
                          </div>
                          {post.text && (
                            <p className="whitespace-pre-wrap text-sm text-purple-100">
                              <RichTextWithMentions
                                text={post.text}
                                knownHandles={knownHandlesSet}
                                currentUserHandle={currentUserHandle}
                                onSelectHandle={openUserProfile}
                              />
                            </p>
                          )}
                          {post.image && (
                            <div className="relative overflow-hidden rounded-xl border border-fuchsia-500/25 bg-[#090414]">
                              <img
                                src={post.image}
                                alt={`Фото в посте ${post.author}`}
                                onClick={() => setLightboxImage(post.image || null)}
                                className="max-h-96 w-full cursor-zoom-in object-contain"
                              />
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === "feed" ? (
                <>
                  <form
                    onSubmit={handleCreatePost}
                    className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-4 space-y-3"
                  >
                    <textarea
                      rows={3}
                      value={postInput}
                      onChange={(e) => {
                        setPostInput(e.target.value);
                        if (postError) setPostError(null);
                      }}
                      placeholder={`Написать пост от имени ${currentUser.username} (${currentUser.handle}) в #${activeRoom.name}... Используй @handle для упоминания`}
                      className="w-full resize-none rounded-xl border border-purple-500/25 bg-[#090414] p-3 text-sm text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                    />

                    {postError && (
                      <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-200">
                        {postError}
                      </div>
                    )}

                    {showImageUrlInput && !postImage && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-purple-500/25 bg-[#090414] p-2.5">
                        <input
                          type="url"
                          value={postImageUrl}
                          onChange={(e) => setPostImageUrl(e.target.value)}
                          placeholder="https://example.com/photo.jpg"
                          className="min-w-[180px] flex-1 rounded-lg border border-purple-500/30 bg-[#140D2B] px-3 py-1.5 text-xs text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPostImageUrl}
                          className="rounded-lg bg-[#FF2A85]/25 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#FF2A85]/40"
                        >
                          Прикрепить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowImageUrlInput(false);
                            setPostError(null);
                          }}
                          className="rounded-lg px-2 py-1.5 text-xs text-purple-300 hover:text-white"
                        >
                          Скрыть
                        </button>
                      </div>
                    )}

                    {postImage && (
                      <div className="relative overflow-hidden rounded-xl border border-pink-400/35 bg-[#090414] p-2">
                        <img
                          src={postImage}
                          alt="Предпросмотр фото к посту"
                          className="max-h-72 w-full rounded-lg object-contain"
                        />
                        <button
                          type="button"
                          onClick={handleClearPostImage}
                          title="Удалить фото"
                          className="absolute right-3.5 top-3.5 inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-[#140D2B]/90 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-rose-950"
                        >
                          <X className="h-3.5 w-3.5" />
                          Убрать фото
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-pink-400/35 bg-[#24103B] px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#331552]">
                          <ImagePlus className="h-3.5 w-3.5" />
                          Фото с устройства
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePostImageFileChange}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setShowImageUrlInput((v) => !v);
                            setPostError(null);
                          }}
                          className="rounded-xl border border-purple-500/30 bg-[#090414] px-3 py-1.5 text-xs font-semibold text-purple-200 hover:border-pink-400/50 hover:text-white"
                        >
                          По ссылке
                        </button>

                        <span className="hidden text-xs text-purple-300/70 sm:inline">
                          • до 2.5 МБ
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={!postInput.trim() && !postImage}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Опубликовать
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4">
                    {roomPosts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-purple-500/25 bg-[#140D2B]/50 p-8 text-center text-sm text-purple-200/70">
                        В канале #{activeRoom.name} пока пусто. Напиши первый
                        пост выше.
                      </div>
                    ) : (
                      roomPosts.map((post) => {
                        const isCommentsOpen = !!openComments[post.id];
                        const draftValue = commentDrafts[post.id] ?? "";
                        const authorAccount = accountByHandle.get(
                          safeLower(post.handle)
                        );
                        const liveAvatar =
                          authorAccount?.avatar ?? post.avatar ?? null;
                        const isAuthor =
                          !!currentUserHandleLower &&
                          safeLower(post.handle) === currentUserHandleLower;
                        const isEditing = editingPostId === post.id;
                        const mentionsMe = textMentionsHandle(
                          post.text,
                          currentUserHandle
                        );
                        const repostSnapshot = post.repostOf ?? null;

                        const hasEgg = hasEasterEggForPost(post.id);
                        const pullVal = hasEgg ? postPeelMap[post.id] ?? 0 : 0;
                        const isPeeledCompletely = hasEgg && pullVal >= 100000;
                        const peelCutPx = Math.min(
                          260,
                          Math.round(34 + (pullVal / 100000) * 226)
                        );

                        if (isPeeledCompletely) {
                          return (
                            <PostPeelUnderlay
                              key={post.id}
                              pullValue={pullVal}
                              onReset={() =>
                                setPostPeelMap((prev) => ({
                                  ...prev,
                                  [post.id]: 0,
                                }))
                              }
                            />
                          );
                        }

                        return (
                          <div
                            key={post.id}
                            className="relative overflow-hidden rounded-2xl"
                          >
                            {hasEgg && <PostPeelUnderlay pullValue={pullVal} />}

                            <article
                              style={
                                hasEgg && pullVal > 0
                                  ? {
                                      clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${peelCutPx}px), calc(100% - ${peelCutPx}px) 100%, 0 100%)`,
                                    }
                                  : undefined
                              }
                              className={`relative z-10 rounded-2xl border p-4 space-y-3 transition-[border-color,background-color] ${
                                post.pinned
                                  ? "border-amber-400/45 bg-gradient-to-br from-[#1C1136] to-[#140D2B]"
                                  : mentionsMe
                                  ? "border-pink-400/45 bg-[#190F33]/95"
                                  : "border-fuchsia-500/20 bg-[#140D2B]/85"
                              }`}
                            >
                              {post.pinned && (
                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                                  <Pin className="h-3.5 w-3.5" />
                                  Закреплённый пост канала
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <AvatarBadge
                                    name={post.author}
                                    src={liveAvatar}
                                    size="md"
                                    presence={authorAccount?.presence}
                                  />
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openUserProfile(post.handle)}
                                      className="text-sm font-extrabold text-white hover:text-[#FF70B8] transition"
                                    >
                                      {post.author}
                                    </button>
                                    <VerifiedBadge
                                      account={authorAccount}
                                      size="sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => openUserProfile(post.handle)}
                                      className="text-xs text-pink-300/80 hover:underline"
                                    >
                                      {post.handle}
                                    </button>
                                    <span className="text-xs text-purple-300/60">
                                      • {post.createdAt}
                                    </span>
                                    {post.editedAt && (
                                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-purple-300/70">
                                        изменено в {post.editedAt}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePinPost(post.id)}
                                    title={
                                      post.pinned
                                        ? "Открепить пост"
                                        : "Закрепить в шапке канала"
                                    }
                                    className={`rounded-lg p-1.5 transition ${
                                      post.pinned
                                        ? "bg-amber-400/20 text-amber-300"
                                        : "text-purple-300/60 hover:bg-white/10 hover:text-amber-200"
                                    }`}
                                  >
                                    <Pin className="h-4 w-4" />
                                  </button>

                                  {isAuthor && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditPost(post)}
                                      title="Изменить пост"
                                      className="rounded-lg p-1.5 text-purple-300/60 hover:bg-white/10 hover:text-pink-200"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleDeletePost(post.id)}
                                    title="Удалить пост"
                                    className="rounded-lg p-1.5 text-purple-300/60 hover:bg-rose-500/15 hover:text-rose-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-2 rounded-xl border border-pink-400/35 bg-[#090414] p-3">
                                  <textarea
                                    rows={3}
                                    value={editingPostText}
                                    onChange={(e) =>
                                      setEditingPostText(e.target.value)
                                    }
                                    className="w-full resize-none rounded-lg border border-purple-500/30 bg-[#140D2B] p-2.5 text-sm text-white outline-none focus:border-pink-400/70"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingPostId(null)}
                                      className="rounded-lg border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200 hover:text-white"
                                    >
                                      Отмена
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditPost(post.id)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-3 py-1 text-xs font-bold text-white"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Сохранить
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                post.text && (
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-purple-100">
                                    <RichTextWithMentions
                                      text={post.text}
                                      knownHandles={knownHandlesSet}
                                      currentUserHandle={currentUserHandle}
                                      onSelectHandle={openUserProfile}
                                    />
                                  </p>
                                )
                              )}

                              {post.image && (
                                <div className="group relative overflow-hidden rounded-xl border border-fuchsia-500/25 bg-[#090414]">
                                  <img
                                    src={post.image}
                                    alt={`Фотография от ${post.author}`}
                                    onClick={() =>
                                      setLightboxImage(post.image || null)
                                    }
                                    className="max-h-[460px] w-full cursor-zoom-in object-contain"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage(post.image || null)
                                    }
                                    title="Открыть в полный размер"
                                    className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#090414]/80 px-2 py-1 text-[11px] font-semibold text-purple-100 opacity-90 hover:bg-[#140D2B]"
                                  >
                                    <Maximize2 className="h-3 w-3" />
                                    Полный экран
                                  </button>
                                </div>
                              )}

                              {/* Карточка репоста */}
                              {repostSnapshot && (
                                <div className="rounded-xl border border-purple-500/30 bg-[#090414]/85 p-3.5 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1.5 font-bold text-pink-200">
                                      <Forward className="h-3.5 w-3.5 text-[#FF70B8]" />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openUserProfile(repostSnapshot.handle)
                                        }
                                        className="hover:underline"
                                      >
                                        {repostSnapshot.author} (
                                        {repostSnapshot.handle})
                                      </button>
                                    </span>
                                    <span className="text-purple-300/65">
                                      из #{repostSnapshot.originalRoomId} •{" "}
                                      {repostSnapshot.createdAt}
                                    </span>
                                  </div>
                                  {repostSnapshot.text && (
                                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-purple-100/90">
                                      <RichTextWithMentions
                                        text={repostSnapshot.text}
                                        knownHandles={knownHandlesSet}
                                        currentUserHandle={currentUserHandle}
                                        onSelectHandle={openUserProfile}
                                      />
                                    </p>
                                  )}
                                  {repostSnapshot.image && (
                                    <img
                                      src={repostSnapshot.image}
                                      alt="Вложение репоста"
                                      onClick={() =>
                                        setLightboxImage(
                                          repostSnapshot.image || null
                                        )
                                      }
                                      className="max-h-60 w-full cursor-zoom-in rounded-lg object-contain bg-black/40"
                                    />
                                  )}
                                </div>
                              )}

                              {/* Реакции эмодзи */}
                              <ReactionBar
                                reactions={post.reactions}
                                currentUserHandle={currentUserHandle}
                                onToggle={(emoji) =>
                                  handleTogglePostReaction(post.id, emoji)
                                }
                              />

                              <div className="flex flex-wrap items-center gap-2.5 border-t border-purple-500/15 pt-2.5 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleToggleLike(post.id)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                                    post.likedByMe
                                      ? "bg-[#FF2A85]/25 text-[#FF70B8]"
                                      : "bg-white/5 text-purple-200/80 hover:bg-white/10"
                                  }`}
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${
                                      post.likedByMe
                                        ? "fill-[#FF2A85] text-[#FF2A85]"
                                        : ""
                                    }`}
                                  />
                                  {post.likes}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenComments((prev) => ({
                                      ...prev,
                                      [post.id]: !prev[post.id],
                                    }))
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 font-semibold text-purple-200/80 hover:bg-white/10"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-pink-300" />
                                  Комментарии ({(post.comments || []).length})
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenRepost(post)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 font-semibold text-purple-200/80 hover:bg-white/10 hover:text-pink-200"
                                >
                                  <Forward className="h-3.5 w-3.5 text-pink-300" />
                                  Поделиться в канал
                                </button>
                              </div>

                              {isCommentsOpen && (
                                <div className="space-y-2.5 border-t border-purple-500/15 pt-3">
                                  {(post.comments || []).map((c) => {
                                    const commentAccount = accountByHandle.get(
                                      safeLower(c.handle)
                                    );
                                    const commentAvatar =
                                      commentAccount?.avatar ?? c.avatar ?? null;

                                    return (
                                      <div
                                        key={c.id}
                                        className="rounded-xl bg-[#090414]/85 px-3 py-2 text-xs"
                                      >
                                        <div className="flex items-center justify-between text-purple-300/75">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openUserProfile(c.handle)
                                            }
                                            className="flex items-center gap-2 font-bold text-pink-200 hover:underline text-left"
                                          >
                                            <AvatarBadge
                                              name={c.author}
                                              src={commentAvatar}
                                              size="sm"
                                              presence={commentAccount?.presence}
                                            />
                                            <span className="inline-flex items-center gap-1">
                                              <span>{c.author}</span>
                                              <VerifiedBadge
                                                account={commentAccount}
                                                size="sm"
                                              />
                                              <span className="font-normal text-pink-300/70">
                                                {c.handle}
                                              </span>
                                            </span>
                                          </button>
                                          <span>{c.createdAt}</span>
                                        </div>
                                        <p className="mt-1.5 pl-9 text-purple-100">
                                          <RichTextWithMentions
                                            text={c.text}
                                            knownHandles={knownHandlesSet}
                                            currentUserHandle={currentUserHandle}
                                            onSelectHandle={openUserProfile}
                                          />
                                        </p>
                                      </div>
                                    );
                                  })}

                                  <form
                                    onSubmit={(e) => handleAddComment(e, post.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <input
                                      type="text"
                                      value={draftValue}
                                      onChange={(e) =>
                                        setCommentDrafts((prev) => ({
                                          ...prev,
                                          [post.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Написать комментарий (можно с @handle)..."
                                      className="flex-1 rounded-xl border border-purple-500/25 bg-[#090414] px-3 py-1.5 text-xs text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!draftValue.trim()}
                                      className="rounded-xl bg-[#FF2A85]/25 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-[#FF2A85]/40 disabled:opacity-40"
                                    >
                                      Ответить
                                    </button>
                                  </form>
                                </div>
                              )}
                            </article>

                            {hasEgg && (
                              <PostCornerPeelHandle
                                pullValue={pullVal}
                                onPullChange={(updater) =>
                                  setPostPeelMap((prev) => {
                                    const current = prev[post.id] ?? 0;
                                    const next =
                                      typeof updater === "function"
                                        ? updater(current)
                                        : updater;
                                    return { ...prev, [post.id]: next };
                                  })
                                }
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-4 space-y-4">
                  {/* Закреплённое сообщение в шапке чата */}
                  {pinnedRoomMessage && (
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-950/25 px-3.5 py-2.5 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-extrabold text-amber-300">
                          <Pin className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Закреплено • {pinnedRoomMessage.author} (
                            {pinnedRoomMessage.handle})
                          </span>
                        </div>
                        <p className="truncate text-purple-100">
                          {pinnedRoomMessage.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePinMessage(pinnedRoomMessage.id)
                        }
                        title="Открепить"
                        className="shrink-0 rounded-lg p-1 text-amber-200/70 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                    {roomMessages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-purple-500/25 p-8 text-center text-sm text-purple-200/70">
                        В чате #{activeRoom.name} пока нет сообщений. Начни
                        первым.
                      </div>
                    ) : (
                      roomMessages.map((msg) => {
                        const msgAccount = accountByHandle.get(
                          safeLower(msg.handle)
                        );
                        const msgAvatar =
                          msgAccount?.avatar ?? msg.avatar ?? null;
                        const isMsgAuthor =
                          !!currentUserHandleLower &&
                          safeLower(msg.handle) === currentUserHandleLower;
                        const isEditingMsg = editingMsgId === msg.id;
                        const mentionsMe = textMentionsHandle(
                          msg.text,
                          currentUserHandle
                        );

                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl border px-3.5 py-2.5 space-y-2 transition ${
                              mentionsMe
                                ? "border-pink-400/55 bg-[#23103C]"
                                : msg.pinned
                                ? "border-amber-400/35 bg-[#191133]"
                                : "border-purple-500/15 bg-[#090414]/90"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openUserProfile(msg.handle)}
                                  className="flex items-center gap-2 font-bold text-pink-300 hover:underline text-left"
                                >
                                  <AvatarBadge
                                    name={msg.author}
                                    src={msgAvatar}
                                    size="sm"
                                    presence={msgAccount?.presence}
                                  />
                                  <span className="inline-flex items-center gap-1">
                                    <span>{msg.author}</span>
                                    <VerifiedBadge
                                      account={msgAccount}
                                      size="sm"
                                    />
                                    <span className="font-normal text-purple-300/70">
                                      {msg.handle}
                                    </span>
                                  </span>
                                </button>

                                {mentionsMe && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FF2A85]/25 px-2 py-0.5 text-[10px] font-bold text-pink-200">
                                    <AtSign className="h-2.5 w-2.5" />
                                    упоминание
                                  </span>
                                )}

                                {msg.editedAt && (
                                  <span className="text-[10px] text-purple-300/60">
                                    (изм. {msg.editedAt})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="mr-1 text-purple-300/60">
                                  {msg.createdAt}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePinMessage(msg.id)}
                                  title={
                                    msg.pinned
                                      ? "Открепить сообщение"
                                      : "Закрепить в шапке чата"
                                  }
                                  className={`rounded p-1 transition ${
                                    msg.pinned
                                      ? "text-amber-300"
                                      : "text-purple-300/50 hover:bg-white/10 hover:text-amber-200"
                                  }`}
                                >
                                  <Pin className="h-3.5 w-3.5" />
                                </button>
                                {isMsgAuthor && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMessage(msg)}
                                    title="Изменить сообщение"
                                    className="rounded p-1 text-purple-300/50 hover:bg-white/10 hover:text-pink-200"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  title="Удалить сообщение"
                                  className="rounded p-1 text-purple-300/50 hover:bg-rose-500/15 hover:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {isEditingMsg ? (
                              <div className="flex items-center gap-2 pl-9">
                                <input
                                  type="text"
                                  value={editingMsgText}
                                  onChange={(e) =>
                                    setEditingMsgText(e.target.value)
                                  }
                                  className="flex-1 rounded-lg border border-pink-400/50 bg-[#140D2B] px-2.5 py-1 text-sm text-white outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditMessage(msg.id)}
                                  className="rounded-lg bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-2.5 py-1 text-xs font-bold text-white"
                                >
                                  Ок
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMsgId(null)}
                                  className="rounded-lg px-2 py-1 text-xs text-purple-300 hover:text-white"
                                >
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <p className="pl-9 text-sm text-purple-100">
                                <RichTextWithMentions
                                  text={msg.text}
                                  knownHandles={knownHandlesSet}
                                  currentUserHandle={currentUserHandle}
                                  onSelectHandle={openUserProfile}
                                />
                              </p>
                            )}

                            <div className="pl-9">
                              <ReactionBar
                                reactions={msg.reactions}
                                currentUserHandle={currentUserHandle}
                                onToggle={(emoji) =>
                                  handleToggleMessageReaction(msg.id, emoji)
                                }
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Сообщение в #${activeRoom.name} (упоминай через @handle)...`}
                      className="flex-1 rounded-xl border border-purple-500/25 bg-[#090414] px-3.5 py-2 text-sm text-white placeholder-purple-300/40 outline-none focus:border-pink-400/60"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Отправить
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Модальное окно репоста в другой канал */}
      {currentUser && repostingPost && (
        <div
          onClick={() => setRepostingPost(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmRepost}
            className="w-full max-w-lg rounded-2xl border border-pink-400/40 bg-[#140D2B] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-pink-300">
                <Forward className="h-4 w-4" />
                Поделиться постом в канал
              </h3>
              <button
                type="button"
                onClick={() => setRepostingPost(null)}
                className="rounded-lg p-1 text-purple-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block space-y-1.5 text-xs">
              <span className="font-bold text-pink-200">Выбери канал</span>
              <select
                value={repostTargetRoomId}
                onChange={(e) => setRepostTargetRoomId(e.target.value)}
                className="w-full rounded-xl border border-purple-500/35 bg-[#090414] px-3 py-2 text-sm text-white outline-none focus:border-pink-400"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-xs">
              <span className="font-bold text-pink-200">
                Твой комментарий к репосту (необязательно)
              </span>
              <textarea
                rows={2}
                value={repostNote}
                onChange={(e) => setRepostNote(e.target.value)}
                placeholder="Добавь пару слов или @упоминание..."
                className="w-full resize-none rounded-xl border border-purple-500/30 bg-[#090414] p-2.5 text-sm text-white placeholder-purple-300/40 outline-none focus:border-pink-400"
              />
            </label>

            <div className="rounded-xl border border-purple-500/25 bg-[#090414]/90 p-3 text-xs space-y-1">
              <div className="font-bold text-pink-200">
                Оригинал: {repostingPost.author} ({repostingPost.handle}) из #
                {repostingPost.roomId}
              </div>
              <p className="line-clamp-3 text-purple-100/80">
                {repostingPost.text || "[Фотография]"}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRepostingPost(null)}
                className="rounded-xl border border-purple-500/30 bg-[#090414] px-4 py-2 text-xs font-bold text-purple-200 hover:text-white"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-4 py-2 text-xs font-extrabold text-white shadow-md hover:brightness-110"
              >
                <Forward className="h-3.5 w-3.5" />
                Опубликовать репост
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Просмотр фотографии в полный размер */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-pink-400/35 bg-[#090414] p-2"
          >
            <img
              src={lightboxImage}
              alt="Просмотр фотографии"
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              title="Закрыть"
              className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-xl border border-white/15 bg-[#140D2B]/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#24103B]"
            >
              <X className="h-4 w-4" />
              Закрыть
            </button>
          </div>
        </div>
      )}

      <footer className="mt-16 border-t border-white/10 bg-[#07070c]/90 px-6 py-8 text-center text-sm text-zinc-300">
        <p>Артём Лотников — основатель и программист.</p>
        <p className="mt-1">Захар Лазебный — основатель и дизайнер.</p>
        <p className="mt-1">Константин Сергиевич — программист и спонсор серверов.</p>
      </footer>
    </main>
  );
}