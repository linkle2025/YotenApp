"""パスワードリセット（メールでリセット用リンクを送る）

- トークンは Django 標準の default_token_generator を使う。
  パスワードを変更する・最終ログインが変わると古いリンクは自動で無効になり、
  PASSWORD_RESET_TIMEOUT（秒）を過ぎても無効になる。DB に保存するものはない。
- メールアドレスが登録されているかどうかを外から判別できないよう、
  依頼 API は常に同じ応答を返す（送信先の有無・送信失敗はログにだけ残す）。
- 同じメールアドレスのユーザーが複数いる場合は、それぞれにユーザー名入りのメールを送る。
"""
import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

logger = logging.getLogger(__name__)

SUBJECT = '【陽てん塾】パスワード再設定のご案内'

BODY_TEMPLATE = """{username} 様

パスワード再設定のお申し込みを受け付けました。
下記のリンクから新しいパスワードを設定してください。

{reset_url}

・ログインに使うユーザー名：{username}
・このリンクの有効期限は {timeout_minutes} 分です。
・一度パスワードを再設定すると、このリンクは使えなくなります。

このメールにお心当たりがない場合は、何もせずに破棄してください。
パスワードは変更されません。

※このメールは送信専用です。返信いただいてもお答えできません。
"""


def get_users_for_email(email):
    """リセット対象のユーザー（有効・パスワード設定済み）をメールアドレスで探す"""
    if not email:
        return []
    users = User.objects.filter(email__iexact=email.strip(), is_active=True)
    return [user for user in users if user.has_usable_password()]


def build_reset_url(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    base = settings.FRONTEND_URL.rstrip('/')
    return f'{base}/password-reset/{uid}/{token}'


def send_reset_emails(email):
    """該当ユーザーにリセットメールを送る。送った件数を返す（呼び出し側は応答に使わないこと）"""
    users = get_users_for_email(email)
    sent = 0
    for user in users:
        body = BODY_TEMPLATE.format(
            username=user.username,
            reset_url=build_reset_url(user),
            timeout_minutes=settings.PASSWORD_RESET_TIMEOUT // 60,
        )
        try:
            send_mail(SUBJECT, body, settings.DEFAULT_FROM_EMAIL, [user.email])
            sent += 1
        except Exception:  # noqa: BLE001  送信失敗は応答に出さずログに残す
            logger.exception('パスワードリセットメールの送信に失敗しました（user_id=%s）', user.pk)
    if not users:
        logger.info('パスワードリセット依頼：該当するユーザーがいません')
    return sent


def get_user_from_uid(uidb64):
    try:
        pk = force_str(urlsafe_base64_decode(uidb64))
        return User.objects.get(pk=pk, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def check_reset_link(uidb64, token):
    """リンクが有効ならユーザーを、無効なら None を返す"""
    user = get_user_from_uid(uidb64)
    if user is None or not default_token_generator.check_token(user, token):
        return None
    return user
