import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** 十干の解説（マスタ） */
export type StemInfo = {
  name: string;
  slug: string;
  reading: string;
  element_type: string;
  description: string;
  personality: string;
  strengths: string;
  weaknesses: string;
  sort_order: number;
};

/** 通変星の解説（マスタ） */
export type StarInfo = {
  name: string;
  slug: string;
  reading: string;
  character: string;
  talents: string;
  weaknesses: string;
  sort_order: number;
};

/**
 * 十干・通変星の解説は誰でも読める固定のデータなので、ログイン情報を使わずに読み、キャッシュする。
 * 内容を直したときは、反映まで最長で1日かかる（cacheLife('days')）。
 */
export async function getStems(): Promise<StemInfo[]> {
  "use cache";
  cacheLife("days");
  cacheTag("master");
  const { data, error } = await publicClient().from("stems").select("*").order("sort_order");
  if (error) throw new Error(`十干の解説を読めませんでした: ${error.message}`);
  return data as StemInfo[];
}

export async function getStars(): Promise<StarInfo[]> {
  "use cache";
  cacheLife("days");
  cacheTag("master");
  const { data, error } = await publicClient().from("stars").select("*").order("sort_order");
  if (error) throw new Error(`通変星の解説を読めませんでした: ${error.message}`);
  return data as StarInfo[];
}

function publicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** 十干の画像（旧版から引き継いだもの。public/img/stems/{slug}.png） */
export const stemImage = (slug: string) => `/img/stems/${slug}.png`;
