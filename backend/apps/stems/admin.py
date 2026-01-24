from django.contrib import admin
from .models import Stem


@admin.register(Stem)
class StemAdmin(admin.ModelAdmin):
    list_display = ('order', 'name', 'reading', 'element_type', 'updated_at')
    list_display_links = ('name', 'reading')
    search_fields = ('name', 'reading', 'element_type')
    ordering = ('order',)
    
    fieldsets = (
        ('基本情報', {
            'fields': ('name', 'reading', 'element_type', 'order')
        }),
        ('詳細情報', {
            'fields': ('description', 'personality', 'strengths', 'weaknesses')
        }),
    )

