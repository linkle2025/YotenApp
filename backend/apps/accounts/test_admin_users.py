# -*- coding: utf-8 -*-
"""ユーザー管理（管理者API）：削除と最終ログインのテスト"""
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.fortune.models import FortuneCalculation, SkillInsight


def _login(client, username, password):
    resp = client.post('/api/token/', {'username': username, 'password': password}, format='json')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
    return resp


def _calculation(user):
    return FortuneCalculation.objects.create(
        user=user, birth_year=1980, birth_month=1, birth_day=1, birth_hour=12, birth_minute=0,
    )


class AdminUserDeleteTests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('adminuser', 'admin@example.com', 'AdminPass123!')
        self.admin.profile.role = 'admin'
        self.admin.profile.save()
        self.target = User.objects.create_user('target', 'target@example.com', 'TargetPass123!')
        _login(self.client, 'adminuser', 'AdminPass123!')

    def url(self, user):
        return f'/api/auth/admin/users/{user.id}/'

    def test_admin_can_delete_user_with_related_records(self):
        calc = _calculation(self.target)
        SkillInsight.objects.create(calculation=calc, input_hash='x' * 64, prompt_version='v2',
                                    model_name='m', content={}, created_by=self.target)
        response = self.client.delete(self.url(self.target))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.target.pk).exists())
        self.assertFalse(FortuneCalculation.objects.filter(pk=calc.pk).exists())
        self.assertEqual(SkillInsight.objects.count(), 0)

    def test_insight_created_by_deleted_user_on_other_record_is_kept(self):
        calc = _calculation(self.admin)
        insight = SkillInsight.objects.create(calculation=calc, input_hash='x' * 64, prompt_version='v2',
                                              model_name='m', content={}, created_by=self.target)
        self.client.delete(self.url(self.target))
        insight.refresh_from_db()
        self.assertIsNone(insight.created_by)

    def test_cannot_delete_self(self):
        response = self.client.delete(self.url(self.admin))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('自分自身', response.data['error'])
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_delete_missing_user_404(self):
        response = self.client.delete('/api/auth/admin/users/999999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_normal_user_cannot_delete(self):
        client = APIClient()
        _login(client, 'target', 'TargetPass123!')
        response = client.delete(self.url(self.admin))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())


class AdminUserListLastLoginTests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user('adminuser', 'admin@example.com', 'AdminPass123!')
        self.admin.profile.role = 'admin'
        self.admin.profile.save()
        self.other = User.objects.create_user('other', 'other@example.com', 'OtherPass123!')

    def test_token_login_updates_last_login(self):
        self.assertIsNone(self.other.last_login)
        _login(APIClient(), 'other', 'OtherPass123!')
        self.other.refresh_from_db()
        self.assertIsNotNone(self.other.last_login)

    def test_list_includes_last_login_and_calculation_count(self):
        _calculation(self.other)
        _calculation(self.other)
        _login(self.client, 'adminuser', 'AdminPass123!')
        response = self.client.get('/api/auth/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = {row['username']: row for row in response.data}
        self.assertIsNotNone(rows['adminuser']['last_login'])
        self.assertIsNone(rows['other']['last_login'])
        self.assertEqual(rows['other']['calculation_count'], 2)
        self.assertEqual(rows['adminuser']['calculation_count'], 0)

    def test_last_login_is_read_only(self):
        _login(self.client, 'adminuser', 'AdminPass123!')
        response = self.client.patch(f'/api/auth/admin/users/{self.other.id}/',
                                     {'last_login': '2020-01-01T00:00:00Z'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other.refresh_from_db()
        self.assertIsNone(self.other.last_login)
