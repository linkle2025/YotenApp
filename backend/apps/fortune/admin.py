from django.contrib import admin
from .models import FortuneCalculation


@admin.register(FortuneCalculation)
class FortuneCalculationAdmin(admin.ModelAdmin):
    list_display = ['user', 'birth_year', 'birth_month', 'birth_day', 'birth_hour', 'is_favorite', 'created_at']
    list_filter = ['is_favorite', 'created_at']
    search_fields = ['user__username', 'user__email']
