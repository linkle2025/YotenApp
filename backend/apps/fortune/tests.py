from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import FortuneCalculation
from .calculators import adjust_birth_hour_by_prefecture


class FortuneCalculationTests(APITestCase):
    """四柱推命計算のテスト"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )
        # ログイン
        response = self.client.post('/api/token/', {
            'username': 'testuser',
            'password': 'TestPass123!',
        })
        self.access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        
        self.calculate_url = '/api/fortune/calculate/'
        self.history_url = '/api/fortune/history/'
    
    def test_calculate_fortune_success(self):
        """正常な四柱推命計算"""
        data = {
            'name': '山田太郎',
            'birth_year': 1990,
            'birth_month': 1,
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '東京都',
            'gender': 'male',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('year_pillar_heavenly_stem', response.data)
        self.assertIn('year_pillar_earthly_branch', response.data)
        self.assertTrue(FortuneCalculation.objects.filter(user=self.user).exists())
    
    def test_calculate_fortune_without_name(self):
        """氏名なしでの四柱推命計算"""
        data = {
            'birth_year': 1990,
            'birth_month': 1,
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '東京都',
            'gender': 'male',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(FortuneCalculation.objects.filter(user=self.user).exists())
    
    def test_calculate_fortune_with_different_prefecture(self):
        """異なる都道府県での四柱推命計算"""
        data = {
            'name': '佐藤花子',
            'birth_year': 1990,
            'birth_month': 1,
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '沖縄県',
            'gender': 'female',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['prefecture'], '沖縄県')
    
    def test_calculate_fortune_unauthorized(self):
        """未認証での計算エラー"""
        self.client.credentials()  # 認証をクリア
        data = {
            'birth_year': 1990,
            'birth_month': 1,
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '東京都',
            'gender': 'male',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_calculate_fortune_invalid_date(self):
        """無効な日付でのエラー"""
        data = {
            'birth_year': 1990,
            'birth_month': 13,  # 無効な月
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '東京都',
            'gender': 'male',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_calculate_fortune_invalid_prefecture(self):
        """無効な都道府県でのエラー"""
        data = {
            'birth_year': 1990,
            'birth_month': 1,
            'birth_day': 1,
            'birth_hour': 10,
            'prefecture': '無効県',  # 無効な都道府県
            'gender': 'male',
        }
        response = self.client.post(self.calculate_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FortuneHistoryTests(APITestCase):
    """計算履歴のテスト"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )
        # ログイン
        response = self.client.post('/api/token/', {
            'username': 'testuser',
            'password': 'TestPass123!',
        })
        self.access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        
        # テストデータ作成
        self.fortune = FortuneCalculation.objects.create(
            user=self.user,
            name='山田太郎',
            birth_year=1990,
            birth_month=1,
            birth_day=1,
            birth_hour=10,
            prefecture='東京都',
            gender='male',
            year_pillar_heavenly_stem='庚',
            year_pillar_earthly_branch='午',
            month_pillar_heavenly_stem='戊',
            month_pillar_earthly_branch='寅',
            day_pillar_heavenly_stem='甲',
            day_pillar_earthly_branch='子',
            hour_pillar_heavenly_stem='丙',
            hour_pillar_earthly_branch='申',
        )
        
        self.history_url = '/api/fortune/history/'
        self.detail_url = f'/api/fortune/history/{self.fortune.id}/'
        self.delete_url = f'/api/fortune/history/{self.fortune.id}/delete/'
        self.favorite_url = f'/api/fortune/history/{self.fortune.id}/favorite/'
    
    def test_get_history_success(self):
        """履歴一覧取得"""
        response = self.client.get(self.history_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_get_detail_success(self):
        """履歴詳細取得"""
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.fortune.id)
    
    def test_delete_history_success(self):
        """履歴削除"""
        response = self.client.delete(self.delete_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FortuneCalculation.objects.filter(id=self.fortune.id).exists())
    
    def test_toggle_favorite_success(self):
        """お気に入り切り替え"""
        # お気に入りON
        response = self.client.patch(self.favorite_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_favorite'])
        
        # お気に入りOFF
        response = self.client.patch(self.favorite_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_favorite'])
    
    def test_access_other_user_history(self):
        """他ユーザーの履歴へのアクセス拒否"""
        # 別のユーザーを作成
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='OtherPass123!'
        )
        other_fortune = FortuneCalculation.objects.create(
            user=other_user,
            name='佐藤花子',
            birth_year=1985,
            birth_month=5,
            birth_day=15,
            birth_hour=15,
            prefecture='大阪府',
            gender='female',
            year_pillar_heavenly_stem='乙',
            year_pillar_earthly_branch='丑',
            month_pillar_heavenly_stem='辛',
            month_pillar_earthly_branch='巳',
            day_pillar_heavenly_stem='癸',
            day_pillar_earthly_branch='酉',
            hour_pillar_heavenly_stem='己',
            hour_pillar_earthly_branch='未',
        )
        
        # 他ユーザーの履歴にアクセス
        response = self.client.get(f'/api/fortune/history/{other_fortune.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FortuneCalculationModelTests(TestCase):
    """FortuneCalculationモデルのテスト"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )
    
    def test_create_fortune_calculation(self):
        """FortuneCalculationの作成"""
        fortune = FortuneCalculation.objects.create(
            user=self.user,
            name='山田太郎',
            birth_year=1990,
            birth_month=1,
            birth_day=1,
            birth_hour=10,
            prefecture='東京都',
            gender='male',
            year_pillar_heavenly_stem='庚',
            year_pillar_earthly_branch='午',
            month_pillar_heavenly_stem='戊',
            month_pillar_earthly_branch='寅',
            day_pillar_heavenly_stem='甲',
            day_pillar_earthly_branch='子',
            hour_pillar_heavenly_stem='丙',
            hour_pillar_earthly_branch='申',
        )
        self.assertEqual(fortune.user, self.user)
        self.assertEqual(fortune.name, '山田太郎')
        self.assertEqual(fortune.birth_year, 1990)
        self.assertEqual(fortune.prefecture, '東京都')
        self.assertFalse(fortune.is_favorite)
    
    def test_fortune_str_method(self):
        """__str__メソッドのテスト"""
        fortune = FortuneCalculation.objects.create(
            user=self.user,
            name='山田太郎',
            birth_year=1990,
            birth_month=1,
            birth_day=1,
            birth_hour=10,
            prefecture='東京都',
            gender='male',
            year_pillar_heavenly_stem='庚',
            year_pillar_earthly_branch='午',
            month_pillar_heavenly_stem='戊',
            month_pillar_earthly_branch='寅',
            day_pillar_heavenly_stem='甲',
            day_pillar_earthly_branch='子',
            hour_pillar_heavenly_stem='丙',
            hour_pillar_earthly_branch='申',
        )
        expected_str = f'{self.user.username} - 1990年1月1日10時'
        self.assertEqual(str(fortune), expected_str)


class PrefectureTimeOffsetTests(TestCase):
    """都道府県の時刻補正のテスト"""
    
    def test_adjust_birth_hour_tokyo(self):
        """東京の時刻補正（9月：均時差0分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '東京', 9)
        # 東京: +19分, 9月: 0分 → 合計 +19分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 19)
        self.assertEqual(day_change, 0)
    
    def test_adjust_birth_hour_okinawa(self):
        """那覇の時刻補正（9月：均時差0分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '那覇', 9)
        # 那覇: -29分, 9月: 0分 → 合計 -29分
        self.assertEqual(hour, 9)
        self.assertEqual(minute, 31)
        self.assertEqual(day_change, 0)
    
    def test_adjust_birth_hour_hokkaido(self):
        """札幌の時刻補正（9月：均時差0分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '札幌', 9)
        # 札幌: +25分, 9月: 0分 → 合計 +25分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 25)
        self.assertEqual(day_change, 0)
    
    def test_adjust_birth_hour_next_day(self):
        """日付が翌日になる場合"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(23, 50, '札幌', 9)
        # 23:50 + 25分 = 24:15 → 翌日 0:15
        self.assertEqual(hour, 0)
        self.assertEqual(minute, 15)
        self.assertEqual(day_change, 1)
    
    def test_adjust_birth_hour_previous_day(self):
        """日付が前日になる場合"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(0, 10, '那覇', 9)
        # 0:10 - 29分 = -19分 → 前日 23:41
        self.assertEqual(hour, 23)
        self.assertEqual(minute, 41)
        self.assertEqual(day_change, -1)


class EquationOfTimeTests(TestCase):
    """均時差の時刻補正のテスト"""
    
    def test_equation_of_time_january(self):
        """1月の均時差（-3分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '東京', 1)
        # 東京: +19分, 1月: -3分 → 合計 +16分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 16)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_february(self):
        """2月の均時差（-13分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '東京', 2)
        # 東京: +19分, 2月: -13分 → 合計 +6分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 6)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_may(self):
        """5月の均時差（+3分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '東京', 5)
        # 東京: +19分, 5月: +3分 → 合計 +22分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 22)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_november(self):
        """11月の均時差（+16分）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '東京', 11)
        # 東京: +19分, 11月: +16分 → 合計 +35分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 35)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_with_okinawa(self):
        """那覇と均時差の組み合わせ（2月）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '那覇', 2)
        # 那覇: -29分, 2月: -13分 → 合計 -42分
        self.assertEqual(hour, 9)
        self.assertEqual(minute, 18)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_with_hokkaido(self):
        """札幌と均時差の組み合わせ（11月）"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(10, 0, '札幌', 11)
        # 札幌: +25分, 11月: +16分 → 合計 +41分
        self.assertEqual(hour, 10)
        self.assertEqual(minute, 41)
        self.assertEqual(day_change, 0)
    
    def test_equation_of_time_day_change(self):
        """均時差により日付が変わる場合"""
        hour, minute, day_change = adjust_birth_hour_by_prefecture(23, 50, '札幌', 11)
        # 23:50 + 25分 + 16分 = 24:31 → 翌日 0:31
        self.assertEqual(hour, 0)
        self.assertEqual(minute, 31)
        self.assertEqual(day_change, 1)
