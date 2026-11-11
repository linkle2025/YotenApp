/**
 * Supabase Auth のエラーを、利用者向けの日本語にする
 * 開発者向けの英語のまま見せない（付録B B.2-10）
 */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "メールアドレスまたはパスワードが違います。";
    case "email_not_confirmed":
      return "メールアドレスの確認が済んでいません。登録時に届いたメールのリンクを開いてください。";
    case "user_already_exists":
    case "email_exists":
      return "このメールアドレスはすでに登録されています。ログインしてください。";
    case "weak_password":
      return "パスワードが弱すぎます。英字と数字を組み合わせて8文字以上にしてください。";
    case "same_password":
      return "今のパスワードと同じです。別のパスワードにしてください。";
    case "email_address_invalid":
      return "このメールアドレスは使えません。別のメールアドレスを入力してください。";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "短い時間に何度も操作されました。しばらく（数分）待ってから、もう一度お試しください。";
    case "reauthentication_needed":
      return "安全のため、もう一度ログインしてから操作してください。";
    case "otp_expired":
      return "リンクの有効期限が切れています。もう一度申し込んでください。";
    default:
      return "うまく処理できませんでした。時間をおいて、もう一度お試しください。";
  }
}
