from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
import logging
from .models import FortuneCalculation
from .serializers import FortuneCalculationSerializer, FortuneCalculationListSerializer
from .calculators import (
    calculate_year_pillar,
    calculate_month_pillar,
    calculate_day_pillar,
    calculate_hour_pillar,
    adjust_birth_hour_by_prefecture,
    calculate_kimon_tonkou_board,
    get_kyokusu_for_date
)
from apps.accounts.models import UserProfile

logger = logging.getLogger(__name__)


class FortuneCalculationCreateView(generics.CreateAPIView):
    """四柱推命計算"""
    serializer_class = FortuneCalculationSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save()


class FortuneCalculationListView(generics.ListAPIView):
    """計算履歴一覧"""
    serializer_class = FortuneCalculationListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = FortuneCalculation.objects.filter(user=self.request.user)
        is_favorite = self.request.query_params.get('favorite', None)
        if is_favorite == 'true':
            queryset = queryset.filter(is_favorite=True)
        return queryset


class FortuneCalculationDetailView(generics.RetrieveAPIView):
    """計算結果詳細"""
    serializer_class = FortuneCalculationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return FortuneCalculation.objects.filter(user=self.request.user)


class FortuneCalculationDeleteView(generics.DestroyAPIView):
    """履歴削除"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return FortuneCalculation.objects.filter(user=self.request.user)


@api_view(['PATCH'])
def toggle_favorite(request, pk):
    """お気に入り登録/解除"""
    calculation = get_object_or_404(
        FortuneCalculation,
        pk=pk,
        user=request.user
    )
    calculation.is_favorite = not calculation.is_favorite
    calculation.save()
    return Response({
        'id': calculation.id,
        'is_favorite': calculation.is_favorite
    })


@api_view(['GET'])
def share_calculation(request, pk):
    """共有用URL生成（簡易版）"""
    calculation = get_object_or_404(
        FortuneCalculation,
        pk=pk,
        user=request.user
    )
    serializer = FortuneCalculationSerializer(calculation)
    return Response({
        'calculation': serializer.data,
        'share_url': f'/api/fortune/share/{pk}/'
    })


def is_admin(user):
    """管理者かどうかをチェック"""
    try:
        return user.profile.role == 'admin'
    except UserProfile.DoesNotExist:
        return False


@api_view(['POST'])
def calculate_kimon_tonkou(request):
    """
    奇門遁甲の干支を計算
    
    Request Body:
    {
        'type': '日盤' or '時盤',
        'year': int,
        'month': int,
        'day': int,
        'hour': int (optional, 時盤のみ),
        'minute': int (optional, 時盤のみ),
        'prefecture': str (optional, 時盤のみ, 都市名),
        'yin_yang': '陰' or '陽' (required),
        'kyokusu': int (1-9, required)
    }
    
    Returns:
    {
        'datetime_str': str,  # 作盤日時文字列
        'year_pillar': {'heavenly_stem': str, 'earthly_branch': str},
        'month_pillar': {'heavenly_stem': str, 'earthly_branch': str},
        'day_pillar': {'heavenly_stem': str, 'earthly_branch': str},
        'hour_pillar': {'heavenly_stem': str, 'earthly_branch': str} or None,
        'pillars_str': str  # 干支文字列（例: "乙巳年　戊子月　己巳日　庚午時"）
    }
    """
    # 管理者権限チェック
    if not is_admin(request.user):
        return Response(
            {'error': '管理者権限が必要です。'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    data = request.data
    calculation_type = data.get('type')
    year = data.get('year')
    month = data.get('month')
    day = data.get('day')
    
    if not calculation_type or not year or not month or not day:
        return Response(
            {'error': 'type, year, month, day は必須です。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if calculation_type not in ['日盤', '時盤']:
        return Response(
            {'error': 'type は "日盤" または "時盤" である必要があります。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 陰陽・局数の取得（指定されていない場合は自動計算）
    yin_yang = data.get('yin_yang')
    kyokusu = data.get('kyokusu')
    
    # 自動計算（指定されていない場合）
    if not yin_yang or kyokusu is None:
        try:
            auto_yin_yang, auto_kyokusu = get_kyokusu_for_date(year, month, day, calculation_type)
            if not yin_yang:
                yin_yang = auto_yin_yang
            if kyokusu is None:
                kyokusu = auto_kyokusu
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # 陰陽・局数のバリデーション
    if yin_yang not in ['陰', '陽']:
        return Response(
            {'error': 'yin_yang は "陰" または "陽" である必要があります。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        kyokusu = int(kyokusu)
    except (ValueError, TypeError):
        return Response(
            {'error': 'kyokusu は整数である必要があります。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if kyokusu < 1 or kyokusu > 9:
        return Response(
            {'error': 'kyokusu は 1〜9 の範囲内である必要があります。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 日盤の場合
    if calculation_type == '日盤':
        # 年柱・月柱・日柱を計算
        year_pillar = calculate_year_pillar(year, month, day)
        month_pillar = calculate_month_pillar(year, month, day)
        day_pillar = calculate_day_pillar(year, month, day)
        hour_pillar = None
        
        datetime_str = f"{year}年{month}月{day}日（日本標準時）"
        pillars_str = f"{year_pillar['heavenly_stem']}{year_pillar['earthly_branch']}年　{month_pillar['heavenly_stem']}{month_pillar['earthly_branch']}月　{day_pillar['heavenly_stem']}{day_pillar['earthly_branch']}日"
        
        # 作盤計算（日盤の場合は日柱の干支を使用）
        try:
            board = calculate_kimon_tonkou_board(
                day_pillar['heavenly_stem'],
                day_pillar['earthly_branch'],
                yin_yang,
                kyokusu,
                year_stem=year_pillar['heavenly_stem'],
                month_stem=month_pillar['heavenly_stem'],
                hour_stem=None,  # 日盤の場合は時干なし
                hour_branch=None,  # 日盤の場合は時支なし
                calculation_type='日盤'
            )
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"作盤計算エラー: {str(e)}\n{error_detail}")
            return Response(
                {'error': f'作盤計算エラー: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # 時盤の場合
    else:  # 時盤
        hour = data.get('hour', 0)
        minute = data.get('minute', 0)
        prefecture = data.get('prefecture', '東京')
        
        # 都市による時刻補正
        adjusted_hour, adjusted_minute, day_change = adjust_birth_hour_by_prefecture(
            hour, minute, prefecture, month
        )
        
        # 補正の内訳を計算（表示用）
        from .calculators import CITY_TIME_OFFSETS, EQUATION_OF_TIME
        city_offset = CITY_TIME_OFFSETS.get(prefecture, 19)
        equation_of_time = EQUATION_OF_TIME.get(month, 0)
        total_offset = city_offset + equation_of_time
        
        # 日付が変更される場合の処理
        from datetime import datetime, timedelta
        if day_change != 0:
            birth_date = datetime(year, month, day)
            adjusted_date = birth_date + timedelta(days=day_change)
            adjusted_year = adjusted_date.year
            adjusted_month = adjusted_date.month
            adjusted_day = adjusted_date.day
        else:
            adjusted_year = year
            adjusted_month = month
            adjusted_day = day
        
        # 年柱・月柱・日柱・時柱を計算（自然時で計算）
        year_pillar = calculate_year_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour, adjusted_minute)
        month_pillar = calculate_month_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour, adjusted_minute)
        day_pillar = calculate_day_pillar(adjusted_year, adjusted_month, adjusted_day)
        hour_pillar = calculate_hour_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour)
        
        # 入力時刻（日本標準時）の文字列
        datetime_str = f"{year}年{month}月{day}日{hour}時{minute}分（{prefecture}）"
        
        # 自然時（補正後）の文字列（補正の内訳も含める）
        offset_str = f"{city_offset:+d}分" if equation_of_time == 0 else f"{city_offset:+d}分（経度差）+ {equation_of_time:+d}分（均時差）= {total_offset:+d}分"
        natural_time_str = f"{adjusted_year}年{adjusted_month}月{adjusted_day}日{adjusted_hour}時{adjusted_minute}分（補正: {offset_str}）"
        
        pillars_str = f"{year_pillar['heavenly_stem']}{year_pillar['earthly_branch']}年　{month_pillar['heavenly_stem']}{month_pillar['earthly_branch']}月　{day_pillar['heavenly_stem']}{day_pillar['earthly_branch']}日　{hour_pillar['heavenly_stem']}{hour_pillar['earthly_branch']}時"
        
        # 作盤計算（時盤の場合は時柱の干支を使用）
        try:
            board = calculate_kimon_tonkou_board(
                hour_pillar['heavenly_stem'],
                hour_pillar['earthly_branch'],
                yin_yang,
                kyokusu,
                year_stem=year_pillar['heavenly_stem'],
                month_stem=month_pillar['heavenly_stem'],
                hour_stem=hour_pillar['heavenly_stem'],
                hour_branch=hour_pillar['earthly_branch'],
                calculation_type='時盤'
            )
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"作盤計算エラー: {str(e)}\n{error_detail}")
            return Response(
                {'error': f'作盤計算エラー: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    response_data = {
        'datetime_str': datetime_str,
        'year_pillar': year_pillar,
        'month_pillar': month_pillar,
        'day_pillar': day_pillar,
        'hour_pillar': hour_pillar,
        'pillars_str': pillars_str,
        'yin_yang': yin_yang,
        'kyokusu': kyokusu,
        'board': board,
        'gobuuji': board.get('gobuuji', False) if board else False
    }
    
    # 時盤の場合のみ自然時を追加
    if calculation_type == '時盤':
        response_data['natural_time_str'] = natural_time_str
    
    return Response(response_data)
