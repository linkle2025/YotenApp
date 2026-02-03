from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import UserProfile


class UserRegistrationTests(APITestCase):
    """ユーザー登録のテスト"""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
    
    def test_register_user_success(self):
        """正常なユーザー登録"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'password2': 'TestPass123!',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='testuser').exists())
    
    def test_register_user_password_mismatch(self):
        """パスワード不一致エラー"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'password2': 'DifferentPass123!',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_register_user_duplicate_username(self):
        """ユーザー名重複エラー"""
        User.objects.create_user(
            username='testuser',
            email='existing@example.com',
            password='TestPass123!'
        )
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'password2': 'TestPass123!',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password_400(self):
        """短いパスワードで登録 → 400"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'short',
            'password2': 'short',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_invalid_email_400(self):
        """不正なメール形式で登録 → 400"""
        data = {
            'username': 'testuser',
            'email': 'not-an-email',
            'password': 'TestPass123!',
            'password2': 'TestPass123!',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserAuthenticationTests(APITestCase):
    """ユーザー認証のテスト"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )
        self.token_url = '/api/token/'
        self.user_url = '/api/auth/user/'
    
    def test_login_success(self):
        """正常なログイン"""
        data = {
            'username': 'testuser',
            'password': 'TestPass123!',
        }
        response = self.client.post(self.token_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_login_wrong_password(self):
        """パスワード誤りエラー"""
        data = {
            'username': 'testuser',
            'password': 'WrongPassword',
        }
        response = self.client.post(self.token_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', response.data)

    def test_login_nonexistent_user_401(self):
        """存在しないユーザーでログイン → 401、トークンが返らない"""
        data = {
            'username': 'nonexistent',
            'password': 'AnyPass123!',
        }
        response = self.client.post(self.token_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', response.data)

    def test_token_refresh_returns_new_access(self):
        """有効な refresh で POST /api/token/refresh/ → 新しい access が返る"""
        login_resp = self.client.post(self.token_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        refresh = login_resp.data['refresh']
        response = self.client.post('/api/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_invalid_token_401(self):
        """不正な access token で認証必須API → 401"""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid.jwt.token')
        response = self.client.get(self.user_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_get_current_user(self):
        """現在のユーザー情報取得"""
        response = self.client.post(self.token_url, {
            'username': 'testuser',
            'password': 'TestPass123!',
        }, format='json')
        access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.user_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
    
    def test_get_current_user_unauthorized(self):
        """未認証でのユーザー情報取得エラー"""
        response = self.client.get(self.user_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AdminEndpointSecurityTests(APITestCase):
    """管理者APIは一般ユーザーで 403 になることを確認"""

    def setUp(self):
        self.client = APIClient()
        self.normal_user = User.objects.create_user(
            username='normaluser',
            email='normal@example.com',
            password='NormalPass123!'
        )
        profile = self.normal_user.profile
        profile.role = 'general'
        profile.save()
        # ログイン
        resp = self.client.post('/api/token/', {
            'username': 'normaluser',
            'password': 'NormalPass123!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='OtherPass123!'
        )

    def test_admin_user_list_403_for_normal_user(self):
        """GET /api/auth/admin/users/ を一般ユーザーで → 403"""
        response = self.client.get('/api/auth/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_detail_403_for_normal_user(self):
        """GET /api/auth/admin/users/{id}/ を一般ユーザーで → 403"""
        response = self.client.get(f'/api/auth/admin/users/{self.other_user.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_patch_403_for_normal_user(self):
        """PATCH /api/auth/admin/users/{id}/ を一般ユーザーで → 403"""
        response = self.client.patch(
            f'/api/auth/admin/users/{self.other_user.id}/',
            {'profile': {'display_mode': 'parent'}},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kimon_tonkou_403_for_normal_user(self):
        """POST /api/fortune/kimon-tonkou/ を一般ユーザーで → 403"""
        response = self.client.post(
            '/api/fortune/kimon-tonkou/',
            {
                'type': '日盤',
                'year': 2024,
                'month': 1,
                'day': 15,
                'yin_yang': '陽',
                'kyokusu': 1,
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class APIPublicScopeSecurityTests(APITestCase):
    """AllowAny のみ認証不要、それ以外は認証必須であることを確認"""

    def setUp(self):
        self.client = APIClient()

    def test_stems_list_without_auth_200(self):
        """GET /api/stems/ は認証なしで 200"""
        response = self.client.get('/api/stems/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stars_list_without_auth_200(self):
        """GET /api/stars/ は認証なしで 200"""
        response = self.client.get('/api/stars/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_register_without_auth_allowed(self):
        """POST /api/auth/register/ は認証なしで許可（登録は誰でも可）"""
        data = {
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'NewPass123!',
            'password2': 'NewPass123!',
        }
        response = self.client.post('/api/auth/register/', data, format='json')
        self.assertIn(response.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))

    def test_fortune_history_without_auth_401(self):
        """GET /api/fortune/history/ は認証なしで 401"""
        response = self.client.get('/api/fortune/history/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_auth_user_without_token_401(self):
        """GET /api/auth/user/ はトークンなしで 401"""
        response = self.client.get('/api/auth/user/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
