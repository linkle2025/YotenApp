from django.urls import path
from .views import (
    FortuneCalculationCreateView,
    FortuneCalculationListView,
    FortuneCalculationDetailView,
    FortuneCalculationDeleteView,
    toggle_favorite,
    share_calculation,
    calculate_kimon_tonkou,
    SkillInsightView,
)

app_name = 'fortune'

urlpatterns = [
    path('calculate/', FortuneCalculationCreateView.as_view(), name='calculate'),
    path('history/', FortuneCalculationListView.as_view(), name='history'),
    path('history/<int:pk>/', FortuneCalculationDetailView.as_view(), name='detail'),
    path('history/<int:pk>/delete/', FortuneCalculationDeleteView.as_view(), name='delete'),
    path('history/<int:pk>/favorite/', toggle_favorite, name='toggle_favorite'),
    path('history/<int:pk>/skill-insight/', SkillInsightView.as_view(), name='skill_insight'),
    path('share/<int:pk>/', share_calculation, name='share'),
    path('kimon-tonkou/', calculate_kimon_tonkou, name='calculate_kimon_tonkou'),
]

