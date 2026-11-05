from django.db import models
from django.contrib.auth.models import User


class FortuneCalculation(models.Model):
    """四柱推命計算履歴"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fortune_calculations')
    name = models.CharField(max_length=100, blank=True, null=True, verbose_name='氏名')
    birth_year = models.IntegerField(verbose_name='生年')
    birth_month = models.IntegerField(verbose_name='生月')
    birth_day = models.IntegerField(verbose_name='生日')
    birth_hour = models.IntegerField(verbose_name='生時')
    birth_minute = models.IntegerField(default=0, verbose_name='生分')
    hour_unknown = models.BooleanField(default=False, verbose_name='時間不明')
    prefecture = models.CharField(max_length=10, default='東京都', verbose_name='生まれた都道府県')
    gender = models.CharField(max_length=10, choices=[('male', '男性'), ('female', '女性')], verbose_name='性別')
    
    # 四柱の結果
    year_pillar_heavenly_stem = models.CharField(max_length=10, verbose_name='年柱天干')
    year_pillar_heavenly_stem_star = models.CharField(max_length=10, default='', verbose_name='年柱天干通変星')
    year_pillar_earthly_branch = models.CharField(max_length=10, verbose_name='年柱地支')
    year_pillar_hidden_stem = models.CharField(max_length=10, default='', verbose_name='年柱蔵干（本気）')
    year_pillar_hidden_stem_star = models.CharField(max_length=10, default='', verbose_name='年柱蔵干通変星（本気）')
    year_pillar_hidden_stem_secondary = models.CharField(max_length=10, blank=True, null=True, verbose_name='年柱蔵干（余気）')
    year_pillar_hidden_stem_secondary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='年柱蔵干通変星（余気）')
    year_pillar_hidden_stem_tertiary = models.CharField(max_length=10, blank=True, null=True, verbose_name='年柱蔵干（中気）')
    year_pillar_hidden_stem_tertiary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='年柱蔵干通変星（中気）')
    month_pillar_heavenly_stem = models.CharField(max_length=10, verbose_name='月柱天干')
    month_pillar_heavenly_stem_star = models.CharField(max_length=10, default='', verbose_name='月柱天干通変星')
    month_pillar_earthly_branch = models.CharField(max_length=10, verbose_name='月柱地支')
    month_pillar_hidden_stem = models.CharField(max_length=10, default='', verbose_name='月柱蔵干（本気）')
    month_pillar_hidden_stem_star = models.CharField(max_length=10, default='', verbose_name='月柱蔵干通変星（本気）')
    month_pillar_hidden_stem_secondary = models.CharField(max_length=10, blank=True, null=True, verbose_name='月柱蔵干（余気）')
    month_pillar_hidden_stem_secondary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='月柱蔵干通変星（余気）')
    month_pillar_hidden_stem_tertiary = models.CharField(max_length=10, blank=True, null=True, verbose_name='月柱蔵干（中気）')
    month_pillar_hidden_stem_tertiary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='月柱蔵干通変星（中気）')
    day_pillar_heavenly_stem = models.CharField(max_length=10, verbose_name='日柱天干')
    day_pillar_heavenly_stem_star = models.CharField(max_length=10, default='', verbose_name='日柱天干通変星')
    day_pillar_earthly_branch = models.CharField(max_length=10, verbose_name='日柱地支')
    day_pillar_hidden_stem = models.CharField(max_length=10, default='', verbose_name='日柱蔵干（本気）')
    day_pillar_hidden_stem_star = models.CharField(max_length=10, default='', verbose_name='日柱蔵干通変星（本気）')
    day_pillar_hidden_stem_secondary = models.CharField(max_length=10, blank=True, null=True, verbose_name='日柱蔵干（余気）')
    day_pillar_hidden_stem_secondary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='日柱蔵干通変星（余気）')
    day_pillar_hidden_stem_tertiary = models.CharField(max_length=10, blank=True, null=True, verbose_name='日柱蔵干（中気）')
    day_pillar_hidden_stem_tertiary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='日柱蔵干通変星（中気）')
    hour_pillar_heavenly_stem = models.CharField(max_length=10, verbose_name='時柱天干')
    hour_pillar_heavenly_stem_star = models.CharField(max_length=10, default='', verbose_name='時柱天干通変星')
    hour_pillar_earthly_branch = models.CharField(max_length=10, verbose_name='時柱地支')
    hour_pillar_hidden_stem = models.CharField(max_length=10, default='', verbose_name='時柱蔵干（本気）')
    hour_pillar_hidden_stem_star = models.CharField(max_length=10, default='', verbose_name='時柱蔵干通変星（本気）')
    hour_pillar_hidden_stem_secondary = models.CharField(max_length=10, blank=True, null=True, verbose_name='時柱蔵干（余気）')
    hour_pillar_hidden_stem_secondary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='時柱蔵干通変星（余気）')
    hour_pillar_hidden_stem_tertiary = models.CharField(max_length=10, blank=True, null=True, verbose_name='時柱蔵干（中気）')
    hour_pillar_hidden_stem_tertiary_star = models.CharField(max_length=10, blank=True, null=True, verbose_name='時柱蔵干通変星（中気）')
    
    # 五行バランス
    five_elements_balance_data = models.JSONField(default=dict, blank=True, verbose_name='五行バランスデータ')
    
    # 格局
    kakukyoku = models.CharField(max_length=50, blank=True, null=True, verbose_name='格局')
    
    # 大運
    taiun_data = models.JSONField(default=dict, blank=True, verbose_name='大運データ')
    
    is_favorite = models.BooleanField(default=False, verbose_name='お気に入り')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新日時')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '四柱推命計算'
        verbose_name_plural = '四柱推命計算'
    
    def __str__(self):
        return f"{self.user.username} - {self.birth_year}年{self.birth_month}月{self.birth_day}日{self.birth_hour}時{self.birth_minute}分"


class SkillInsight(models.Model):
    """判定の要点（LLM生成）のキャッシュ。仕様: doc/判定の要点生成.md"""
    calculation = models.ForeignKey(
        FortuneCalculation, on_delete=models.CASCADE, related_name='skill_insights', verbose_name='計算記録'
    )
    # 入力JSON（context を含む）+ PROMPT_VERSION + モデル名の SHA-256
    input_hash = models.CharField(max_length=64, db_index=True, verbose_name='入力ハッシュ')
    prompt_version = models.CharField(max_length=20, verbose_name='プロンプト版数')
    model_name = models.CharField(max_length=100, verbose_name='モデル名')
    context = models.JSONField(null=True, blank=True, verbose_name='本人コンテキスト')
    content = models.JSONField(verbose_name='生成内容')
    input_tokens = models.IntegerField(null=True, blank=True, verbose_name='入力トークン数')
    output_tokens = models.IntegerField(null=True, blank=True, verbose_name='出力トークン数')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='skill_insights', verbose_name='生成者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '判定の要点'
        verbose_name_plural = '判定の要点'

    def __str__(self):
        return f'{self.calculation_id} - {self.model_name} - {self.created_at:%Y-%m-%d %H:%M}'
