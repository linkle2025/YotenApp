/**
 * Supabase の接続先（環境変数）
 * 未設定のまま動かすと、原因のわかりにくいエラーになるため、ここで止める。
 */
export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません（web/.env.example を参照）");
  return value;
}

export function supabasePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error("環境変数 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が設定されていません（web/.env.example を参照）");
  return value;
}
