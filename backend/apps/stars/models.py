from django.db import models


class Star(models.Model):
    """通変星（つうへんせい）モデル"""
    name = models.CharField(max_length=10, unique=True, verbose_name='通変星')
    reading = models.CharField(max_length=20, verbose_name='読み仮名')
    character = models.TextField(verbose_name='キャラクター')
    talents = models.TextField(verbose_name='才能')
    weaknesses = models.TextField(verbose_name='弱点')
    order = models.IntegerField(default=0, verbose_name='表示順序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新日時')

    class Meta:
        verbose_name = '通変星'
        verbose_name_plural = '通変星'
        ordering = ['order']

    def __str__(self):
        return f'{self.name}（{self.reading}）'

