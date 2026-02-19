from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('general', '一般ユーザー'),
        ('fortuneteller', '占者ユーザー'),
        ('admin', '管理者'),
    ]
    DISPLAY_MODE_CHOICES = [
        ('business', '経営者向け'),
        ('parent', '保護者向け'),
    ]
    GENDER_CHOICES = [
        ('male', '男性'),
        ('female', '女性'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='general', verbose_name='ロール')
    display_mode = models.CharField(max_length=20, choices=DISPLAY_MODE_CHOICES, default='business', verbose_name='表示モード')
    is_active = models.BooleanField(default=True, verbose_name='有効')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='male', null=True, blank=True, verbose_name='性別')
    
    # 生年月日・時間情報
    birth_year = models.IntegerField(null=True, blank=True, verbose_name='生年')
    birth_month = models.IntegerField(null=True, blank=True, verbose_name='生月')
    birth_day = models.IntegerField(null=True, blank=True, verbose_name='生日')
    birth_hour = models.IntegerField(null=True, blank=True, verbose_name='生時')
    birth_minute = models.IntegerField(default=0, null=True, blank=True, verbose_name='生分')
    hour_unknown = models.BooleanField(default=False, verbose_name='時間不明')
    prefecture = models.CharField(max_length=10, null=True, blank=True, verbose_name='生まれた都道府県')
    residence_prefecture = models.CharField(max_length=10, null=True, blank=True, verbose_name='お住いの県')
    
    class Meta:
        verbose_name = 'ユーザープロフィール'
        verbose_name_plural = 'ユーザープロフィール'
    
    def __str__(self):
        return f'{self.user.username} - {self.get_role_display()}'


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
