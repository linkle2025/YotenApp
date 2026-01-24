from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import Stem
from .serializers import StemSerializer


class StemListView(generics.ListAPIView):
    """十干一覧取得API"""
    queryset = Stem.objects.all()
    serializer_class = StemSerializer
    permission_classes = [AllowAny]

