from django.contrib import admin
from .models import Star


@admin.register(Star)
class StarAdmin(admin.ModelAdmin):
    list_display = ('order', 'name', 'reading', 'updated_at')
    list_display_links = ('name', 'reading')
    search_fields = ('name', 'reading', 'character')
    ordering = ('order',)
    
    fieldsets = (
        ('基本情報', {
            'fields': ('name', 'reading', 'order')
        }),
        ('詳細情報', {
            'fields': ('character', 'talents', 'weaknesses')
        }),
    )

