# -*- coding: utf-8 -*-
from django.conf import settings
from rest_framework import serializers
from .models import FortuneCalculation
from .calculators import calculate_fortune, CITY_TIME_OFFSETS, get_pillar_for_solar_year, get_heavenly_star


class FortuneCalculationSerializer(serializers.ModelSerializer):
    """四柱推命計算シリアライザー"""
    
    class Meta:
        model = FortuneCalculation
        fields = [
            'id', 'name', 'birth_year', 'birth_month', 'birth_day', 'birth_hour', 'birth_minute', 'hour_unknown',
            'prefecture', 'gender',
            'year_pillar_heavenly_stem', 'year_pillar_heavenly_stem_star', 'year_pillar_earthly_branch', 
            'year_pillar_hidden_stem', 'year_pillar_hidden_stem_star',
            'year_pillar_hidden_stem_secondary', 'year_pillar_hidden_stem_secondary_star',
            'year_pillar_hidden_stem_tertiary', 'year_pillar_hidden_stem_tertiary_star',
            'month_pillar_heavenly_stem', 'month_pillar_heavenly_stem_star', 'month_pillar_earthly_branch', 
            'month_pillar_hidden_stem', 'month_pillar_hidden_stem_star',
            'month_pillar_hidden_stem_secondary', 'month_pillar_hidden_stem_secondary_star',
            'month_pillar_hidden_stem_tertiary', 'month_pillar_hidden_stem_tertiary_star',
            'day_pillar_heavenly_stem', 'day_pillar_heavenly_stem_star', 'day_pillar_earthly_branch', 
            'day_pillar_hidden_stem', 'day_pillar_hidden_stem_star',
            'day_pillar_hidden_stem_secondary', 'day_pillar_hidden_stem_secondary_star',
            'day_pillar_hidden_stem_tertiary', 'day_pillar_hidden_stem_tertiary_star',
            'hour_pillar_heavenly_stem', 'hour_pillar_heavenly_stem_star', 'hour_pillar_earthly_branch', 
            'hour_pillar_hidden_stem', 'hour_pillar_hidden_stem_star',
            'hour_pillar_hidden_stem_secondary', 'hour_pillar_hidden_stem_secondary_star',
            'hour_pillar_hidden_stem_tertiary', 'hour_pillar_hidden_stem_tertiary_star',
            'five_elements_balance_data',
            'kakukyoku',
            'taiun_data',
            'is_favorite', 'created_at', 'updated_at',
            'show_taiun_nenun',
            'nenun_data',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'five_elements_balance_data',
            'kakukyoku',
            'year_pillar_heavenly_stem', 'year_pillar_heavenly_stem_star', 'year_pillar_earthly_branch', 
            'year_pillar_hidden_stem', 'year_pillar_hidden_stem_star',
            'year_pillar_hidden_stem_secondary', 'year_pillar_hidden_stem_secondary_star',
            'year_pillar_hidden_stem_tertiary', 'year_pillar_hidden_stem_tertiary_star',
            'month_pillar_heavenly_stem', 'month_pillar_heavenly_stem_star', 'month_pillar_earthly_branch', 
            'month_pillar_hidden_stem', 'month_pillar_hidden_stem_star',
            'month_pillar_hidden_stem_secondary', 'month_pillar_hidden_stem_secondary_star',
            'month_pillar_hidden_stem_tertiary', 'month_pillar_hidden_stem_tertiary_star',
            'day_pillar_heavenly_stem', 'day_pillar_heavenly_stem_star', 'day_pillar_earthly_branch', 
            'day_pillar_hidden_stem', 'day_pillar_hidden_stem_star',
            'day_pillar_hidden_stem_secondary', 'day_pillar_hidden_stem_secondary_star',
            'day_pillar_hidden_stem_tertiary', 'day_pillar_hidden_stem_tertiary_star',
            'hour_pillar_heavenly_stem', 'hour_pillar_heavenly_stem_star', 'hour_pillar_earthly_branch', 
            'hour_pillar_hidden_stem', 'hour_pillar_hidden_stem_star',
            'hour_pillar_hidden_stem_secondary', 'hour_pillar_hidden_stem_secondary_star',
            'hour_pillar_hidden_stem_tertiary', 'hour_pillar_hidden_stem_tertiary_star',
        ]
    
    def validate_birth_year(self, value):
        if value < 1901 or value > 2040:
            raise serializers.ValidationError("生年は1901年から2040年の間で入力してください。")
        return value
    
    def validate_birth_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("生月は1月から12月の間で入力してください。")
        return value
    
    def validate_birth_day(self, value):
        if value < 1 or value > 31:
            raise serializers.ValidationError("生日は1日から31日の間で入力してください。")
        return value
    
    def validate_birth_hour(self, value):
        if value < 0 or value > 23:
            raise serializers.ValidationError("生時は0時から23時の間で入力してください。")
        return value
    
    def validate_birth_minute(self, value):
        if value < 0 or value > 59:
            raise serializers.ValidationError("生分は0分から59分の間で入力してください。")
        return value
    
    def validate_prefecture(self, value):
        """都市のバリデーション"""
        if value not in CITY_TIME_OFFSETS:
            raise serializers.ValidationError("正しい都市を選択してください。")
        return value

    show_taiun_nenun = serializers.SerializerMethodField()
    nenun_data = serializers.SerializerMethodField()

    def get_show_taiun_nenun(self, obj):
        """DEBUG=True のときのみ大運・年運を表示（鑑定表ページ用）"""
        return getattr(settings, 'DEBUG', False)

    def get_nenun_data(self, obj):
        """DEBUG=True のときのみ年運一覧を返す（生年から80年分）"""
        if not getattr(settings, 'DEBUG', False):
            return None
        day_stem = obj.day_pillar_heavenly_stem or ''
        nenun_list = []
        for y in range(obj.birth_year, obj.birth_year + 81):
            pillar = get_pillar_for_solar_year(y)
            star = get_heavenly_star(day_stem, pillar['heavenly_stem']) if day_stem else ''
            nenun_list.append({
                'year': y,
                'heavenly_stem': pillar['heavenly_stem'],
                'earthly_branch': pillar['earthly_branch'],
                'heavenly_stem_star': star,
            })
        return nenun_list

    def create(self, validated_data):
        # 時間不明かどうかを確認
        hour_unknown = validated_data.get('hour_unknown', False)
        
        # 四柱推命を計算（都道府県情報を含む）
        try:
            result = calculate_fortune(
                validated_data['birth_year'],
                validated_data['birth_month'],
                validated_data['birth_day'],
                validated_data['birth_hour'],
                prefecture=validated_data.get('prefecture', '東京'),
                birth_minute=validated_data.get('birth_minute', 0),
                hour_unknown=hour_unknown,
                gender=validated_data.get('gender', 'male')
            )
        except ValueError as e:
            # 範囲外の年などのエラー
            raise serializers.ValidationError({'birth_year': str(e)})
        except Exception as e:
            # その他の計算エラー
            raise serializers.ValidationError({'non_field_errors': f'計算中にエラーが発生しました: {str(e)}'})
        
        # 計算結果を保存
        # 年柱
        validated_data['year_pillar_heavenly_stem'] = result['year_pillar']['heavenly_stem']
        validated_data['year_pillar_heavenly_stem_star'] = result['year_pillar']['heavenly_stem_star']
        validated_data['year_pillar_earthly_branch'] = result['year_pillar']['earthly_branch']
        validated_data['year_pillar_hidden_stem'] = result['year_pillar']['hidden_stem']
        validated_data['year_pillar_hidden_stem_star'] = result['year_pillar']['hidden_stem_star']
        validated_data['year_pillar_hidden_stem_secondary'] = result['year_pillar']['hidden_stems_full']['余気']
        validated_data['year_pillar_hidden_stem_secondary_star'] = result['year_pillar']['hidden_stem_secondary_star']
        validated_data['year_pillar_hidden_stem_tertiary'] = result['year_pillar']['hidden_stems_full']['中気']
        validated_data['year_pillar_hidden_stem_tertiary_star'] = result['year_pillar']['hidden_stem_tertiary_star']
        
        # 月柱
        validated_data['month_pillar_heavenly_stem'] = result['month_pillar']['heavenly_stem']
        validated_data['month_pillar_heavenly_stem_star'] = result['month_pillar']['heavenly_stem_star']
        validated_data['month_pillar_earthly_branch'] = result['month_pillar']['earthly_branch']
        validated_data['month_pillar_hidden_stem'] = result['month_pillar']['hidden_stem']
        validated_data['month_pillar_hidden_stem_star'] = result['month_pillar']['hidden_stem_star']
        validated_data['month_pillar_hidden_stem_secondary'] = result['month_pillar']['hidden_stems_full']['余気']
        validated_data['month_pillar_hidden_stem_secondary_star'] = result['month_pillar']['hidden_stem_secondary_star']
        validated_data['month_pillar_hidden_stem_tertiary'] = result['month_pillar']['hidden_stems_full']['中気']
        validated_data['month_pillar_hidden_stem_tertiary_star'] = result['month_pillar']['hidden_stem_tertiary_star']
        
        # 日柱
        validated_data['day_pillar_heavenly_stem'] = result['day_pillar']['heavenly_stem']
        validated_data['day_pillar_heavenly_stem_star'] = result['day_pillar']['heavenly_stem_star']
        validated_data['day_pillar_earthly_branch'] = result['day_pillar']['earthly_branch']
        validated_data['day_pillar_hidden_stem'] = result['day_pillar']['hidden_stem']
        validated_data['day_pillar_hidden_stem_star'] = result['day_pillar']['hidden_stem_star']
        validated_data['day_pillar_hidden_stem_secondary'] = result['day_pillar']['hidden_stems_full']['余気']
        validated_data['day_pillar_hidden_stem_secondary_star'] = result['day_pillar']['hidden_stem_secondary_star']
        validated_data['day_pillar_hidden_stem_tertiary'] = result['day_pillar']['hidden_stems_full']['中気']
        validated_data['day_pillar_hidden_stem_tertiary_star'] = result['day_pillar']['hidden_stem_tertiary_star']
        
        # 時柱（時間不明の場合は空欄）
        if hour_unknown or result['hour_pillar'] is None:
            validated_data['hour_pillar_heavenly_stem'] = ''
            validated_data['hour_pillar_heavenly_stem_star'] = ''
            validated_data['hour_pillar_earthly_branch'] = ''
            validated_data['hour_pillar_hidden_stem'] = ''
            validated_data['hour_pillar_hidden_stem_star'] = ''
            validated_data['hour_pillar_hidden_stem_secondary'] = ''
            validated_data['hour_pillar_hidden_stem_secondary_star'] = ''
            validated_data['hour_pillar_hidden_stem_tertiary'] = ''
            validated_data['hour_pillar_hidden_stem_tertiary_star'] = ''
        else:
            validated_data['hour_pillar_heavenly_stem'] = result['hour_pillar']['heavenly_stem']
            validated_data['hour_pillar_heavenly_stem_star'] = result['hour_pillar']['heavenly_stem_star']
            validated_data['hour_pillar_earthly_branch'] = result['hour_pillar']['earthly_branch']
            validated_data['hour_pillar_hidden_stem'] = result['hour_pillar']['hidden_stem']
            validated_data['hour_pillar_hidden_stem_star'] = result['hour_pillar']['hidden_stem_star']
            validated_data['hour_pillar_hidden_stem_secondary'] = result['hour_pillar']['hidden_stems_full']['余気']
            validated_data['hour_pillar_hidden_stem_secondary_star'] = result['hour_pillar']['hidden_stem_secondary_star']
            validated_data['hour_pillar_hidden_stem_tertiary'] = result['hour_pillar']['hidden_stems_full']['中気']
            validated_data['hour_pillar_hidden_stem_tertiary_star'] = result['hour_pillar']['hidden_stem_tertiary_star']
        
        # 五行バランスデータを保存
        validated_data['five_elements_balance_data'] = result.get('five_elements_balance', {})
        
        # 格局を保存
        validated_data['kakukyoku'] = result.get('kakukyoku', '')
        
        # 大運データを保存
        validated_data['taiun_data'] = result.get('taiun', {})
        
        validated_data['user'] = self.context['request'].user
        
        return super().create(validated_data)


class FortuneCalculationListSerializer(serializers.ModelSerializer):
    """四柱推命計算一覧用シリアライザー"""
    
    class Meta:
        model = FortuneCalculation
        fields = [
            'id', 'name', 'birth_year', 'birth_month', 'birth_day', 'birth_hour', 'birth_minute', 'hour_unknown',
            'prefecture',
            'year_pillar_heavenly_stem', 'year_pillar_earthly_branch', 
            'year_pillar_hidden_stem', 'year_pillar_hidden_stem_secondary', 'year_pillar_hidden_stem_tertiary',
            'day_pillar_heavenly_stem', 'day_pillar_earthly_branch', 
            'day_pillar_hidden_stem', 'day_pillar_hidden_stem_secondary', 'day_pillar_hidden_stem_tertiary',
            'kakukyoku',
            'is_favorite', 'created_at'
        ]

