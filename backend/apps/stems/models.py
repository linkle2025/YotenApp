from django.db import models


class Stem(models.Model):
    """十干（じっかん）モデル"""
    name = models.CharField(max_length=1, unique=True, verbose_name='十干')
    reading = models.CharField(max_length=10, verbose_name='読み仮名')
    element_type = models.CharField(max_length=20, verbose_name='タイプ')
    description = models.TextField(verbose_name='詳細説明')
    personality = models.TextField(verbose_name='人物像')
    strengths = models.TextField(verbose_name='強み・活かし方')
    weaknesses = models.TextField(verbose_name='弱み・接し方の注意点')
    order = models.IntegerField(default=0, verbose_name='表示順序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新日時')

    class Meta:
        verbose_name = '十干'
        verbose_name_plural = '十干'
        ordering = ['order']

    def __str__(self):
        return f'{self.name}（{self.reading}）'

