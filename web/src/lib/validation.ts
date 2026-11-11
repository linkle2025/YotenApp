/** 入力チェックの共通部品（画面側と同じ基準をサーバーでも確かめる） */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function checkEmail(email: string): string | undefined {
  if (!email) return "メールアドレスを入力してください。";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "メールアドレスの形が正しくありません。";
}

/** Supabase の設定（8文字以上・英字と数字を含む）と同じ基準 */
export function checkNewPassword(password: string): string | undefined {
  if (!password) return "パスワードを入力してください。";
  if (password.length < 8) return "8文字以上にしてください。";
  if (password.length > 72) return "72文字以内にしてください。";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "英字と数字の両方を含めてください。";
}

export function checkDisplayName(name: string): string | undefined {
  if (!name) return "表示名を入力してください。";
  if ([...name].length > 50) return "50文字以内にしてください。";
}
