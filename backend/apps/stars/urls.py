from django.urls import path
from .views import StarListView

urlpatterns = [
    path('', StarListView.as_view(), name='star-list'),
]

