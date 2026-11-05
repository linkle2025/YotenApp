from django.contrib import admin
from .models import FortuneCalculation, SkillInsight


@admin.register(FortuneCalculation)
class FortuneCalculationAdmin(admin.ModelAdmin):
    list_display = ['user', 'birth_year', 'birth_month', 'birth_day', 'birth_hour', 'is_favorite', 'created_at']
    list_filter = ['is_favorite', 'created_at']
    search_fields = ['user__username', 'user__email']


@admin.register(SkillInsight)
class SkillInsightAdmin(admin.ModelAdmin):
    list_display = ['id', 'calculation', 'created_by', 'model_name', 'prompt_version',
                    'input_tokens', 'output_tokens', 'created_at']
    list_filter = ['model_name', 'prompt_version', 'created_at']
    search_fields = ['created_by__username', 'input_hash']
    readonly_fields = ['calculation', 'input_hash', 'prompt_version', 'model_name', 'context', 'content',
                       'input_tokens', 'output_tokens', 'created_by', 'created_at']
