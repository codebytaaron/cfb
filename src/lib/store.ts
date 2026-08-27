// AI-content cache + persistence. Uses Supabase when configured, otherwise an
// in-memory map so the app is fully functional with zero external setup.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let admin: SupabaseClient | null = null;
if (url && (serviceKey || anonKey)) {
  admin = createClient(url, serviceKey || anonKey!, { auth: { persistSession: false } });
}

export const supabaseEnabled = !!admin;

type Row = { key: string; kind: string; content: any; created_at: string };
const mem = new Map<string, Row>();

// Cache table (create in Supabase):
//   create table ai_content (
//     key text primary key, kind text, content jsonb,
//     created_at timestamptz default now());
//   create table ai_events (
//     id bigint generated always as identity primary key, kind text,
//     importance text, team text, headline text, body text,
//     data jsonb, created_at timestamptz default now());

export async function cacheGet(key: string, maxAgeSec: number): Promise<any | null> {
  if (admin) {
    const { data } = await admin.from("ai_content").select("*").eq("key", key).maybeSingle();
    if (data && Date.now() - +new Date(data.created_at) < maxAgeSec * 1000) return data.content;
    return null;
  }
  const r = mem.get(key);
  if (r && Date.now() - +new Date(r.created_at) < maxAgeSec * 1000) return r.content;
  return null;
}

export async function cacheSet(key: string, kind: string, content: any): Promise<void> {
  const row: Row = { key, kind, content, created_at: new Date().toISOString() };
  if (admin) {
    await admin.from("ai_content").upsert({ key, kind, content, created_at: row.created_at });
    return;
  }
  mem.set(key, row);
}

export type AIEvent = {
  kind: string;
  importance: "LOW" | "MEDIUM" | "HIGH" | "BREAKING";
  team?: string;
  headline: string;
  body: string;
  data?: any;
  created_at?: string;
};
const eventMem: AIEvent[] = [];

export async function recordEvent(e: AIEvent): Promise<void> {
  e.created_at = new Date().toISOString();
  if (admin) {
    await admin.from("ai_events").insert(e);
    return;
  }
  eventMem.unshift(e);
  if (eventMem.length > 100) eventMem.pop();
}

export async function recentEvents(limit = 20): Promise<AIEvent[]> {
  if (admin) {
    const { data } = await admin
      .from("ai_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as AIEvent[]) ?? [];
  }
  return eventMem.slice(0, limit);
}
