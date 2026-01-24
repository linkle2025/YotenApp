from django.urls import path
from .views import StemListView

urlpatterns = [
    path('', StemListView.as_view(), name='stem-list'),
]

