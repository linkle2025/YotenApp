from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import Star
from .serializers import StarSerializer


class StarListView(generics.ListAPIView):
    """通変星一覧取得API"""
    queryset = Star.objects.all()
    serializer_class = StarSerializer
    permission_classes = [AllowAny]

