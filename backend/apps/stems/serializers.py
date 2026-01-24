from rest_framework import serializers
from .models import Stem


class StemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stem
        fields = '__all__'

