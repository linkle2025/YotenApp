"""パスワードリセット（メール送信）のテスト

メールは Django のテスト用 locmem バックエンド（mail.outbox）に溜まり、外部には送られない。
"""
import re

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

REQUEST_URL = '/api/auth/password-reset/'
CONFIRM_URL = '/api/auth/password-reset/confirm/'
LINK_RE = re.compile(r'https://app\.example\.com/password-reset/(?P<uid>[^/\s]+)/(?P<token>[^/\s]+)')


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='https://app.example.com/',
    PASSWORD_RESET_TIMEOUT=3600,
)
class PasswordResetTestBase(APITestCase):
    def setUp(self):
        cache.clear()  # 回数制限のカウントをテストごとにリセット
        self.user = User.objects.create_user(
            username='resetuser', email='reset@example.com', password='OldPass123!'
        )

    def extract_link(self, message):
        match = LINK_RE.search(message.body)
        self.assertIsNotNone(match, message.body)
        return match.group('uid'), match.group('token')

    def request_and_get_link(self):
        self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        return self.extract_link(mail.outbox[-1])


class PasswordResetRequestTests(PasswordResetTestBase):
    def test_sends_email_with_link_and_username(self):
        response = self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['reset@example.com'])
        self.assertIn('パスワード再設定', message.subject)
        self.assertIn('resetuser', message.body)
        self.assertIn('60 分', message.body)
        self.extract_link(message)

    def test_email_is_case_insensitive(self):
        self.client.post(REQUEST_URL, {'email': 'Reset@Example.COM'}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['reset@example.com'])

    def test_unknown_email_returns_same_response_without_sending(self):
        known = self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        unknown = self.client.post(REQUEST_URL, {'email': 'nobody@example.com'}, format='json')
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.data, known.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_inactive_user_gets_no_email(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_each_user_sharing_email_gets_own_link(self):
        User.objects.create_user(username='second', email='reset@example.com', password='Pass12345!')
        self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        self.assertEqual(len(mail.outbox), 2)
        bodies = ' '.join(m.body for m in mail.outbox)
        self.assertIn('resetuser', bodies)
        self.assertIn('second', bodies)

    def test_invalid_email_format_400(self):
        response = self.client.post(REQUEST_URL, {'email': 'not-an-email'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_send_failure_is_not_exposed(self):
        with override_settings(EMAIL_BACKEND='apps.accounts.test_password_reset.FailingBackend'):
            with self.assertLogs('apps.accounts.password_reset', level='ERROR'):
                response = self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_rate_limited_after_5_requests(self):
        for _ in range(5):
            self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        response = self.client.post(REQUEST_URL, {'email': 'reset@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(len(mail.outbox), 5)


class PasswordResetConfirmTests(PasswordResetTestBase):
    def confirm(self, uid, token, password='NewPass456!', password2=None):
        return self.client.post(
            CONFIRM_URL,
            {'uid': uid, 'token': token, 'password': password, 'password2': password2 or password},
            format='json',
        )

    def test_check_link_without_password(self):
        uid, token = self.request_and_get_link()
        response = self.client.post(CONFIRM_URL, {'uid': uid, 'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])

    def test_reset_password_then_login_with_new_password(self):
        uid, token = self.request_and_get_link()
        response = self.confirm(uid, token)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))
        login = self.client.post(
            '/api/token/', {'username': 'resetuser', 'password': 'NewPass456!'}, format='json'
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_link_cannot_be_reused(self):
        uid, token = self.request_and_get_link()
        self.assertEqual(self.confirm(uid, token).status_code, status.HTTP_200_OK)
        response = self.confirm(uid, token, password='Another789!')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('無効', response.data['detail'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))

    def test_invalid_token_400(self):
        uid, _ = self.request_and_get_link()
        response = self.confirm(uid, 'bad-token')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass123!'))

    def test_invalid_uid_400(self):
        _, token = self.request_and_get_link()
        response = self.confirm('!!!', token)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(CONFIRM_URL, {'uid': 'zzzz', 'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_link_400(self):
        uid, token = self.request_and_get_link()
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            response = self.confirm(uid, token)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_mismatch_400(self):
        uid, token = self.request_and_get_link()
        response = self.confirm(uid, token, password='NewPass456!', password2='Different456!')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass123!'))

    def test_weak_password_400(self):
        uid, token = self.request_and_get_link()
        response = self.confirm(uid, token, password='short')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_password_similar_to_username_400(self):
        uid, token = self.request_and_get_link()
        response = self.confirm(uid, token, password='resetuser1')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_user_link_400(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.confirm(uid, token).status_code, status.HTTP_400_BAD_REQUEST)


class FailingBackend:
    """送信に必ず失敗するメールバックエンド（テスト用）"""

    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise ConnectionRefusedError('SMTP unavailable')
