import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface CloudPostRecord {
  id: string;
  room_id: string;
  author: string;
  handle: string;
  avatar: string | null;
  text: string;
  image: string | null;
  created_at: string;
  edited_at: string | null;
  pinned: boolean;
  likes: number;
  liked_by_me: boolean;
  reactions: Record<string, string[]>;
  repost_of: unknown | null;
  comments: unknown[];
}

let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(url, key);
  return cachedClient;
}